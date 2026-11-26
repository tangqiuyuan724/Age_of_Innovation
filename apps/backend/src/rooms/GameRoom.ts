// 大创造时代的房间：一局游戏一个房间。
// 服务器说了算：客户端只发"我想做什么"，服务器用引擎检查、执行，再把新局面发给所有人。
import { randomUUID } from "node:crypto";
import {
    applyMove, createGame, toPublicState, validateMove,
    type GameEvent, type GameState, type Move, type Seat, type SetupMode,
} from "@aoi/engine/aoi";
import { Client, CloseCode, Room, validate } from "colyseus";
import z from "zod";
import { MoveSchema } from "./moveSchema.js";
import { PlayerMeta, RoomMeta } from "./schema/RoomMeta.js";

/** 现在只有一张地图 */
const MAP_ID = "aoi-base";
/** 一局最多几个人 */
const MAX_PLAYERS = 5;
/** 断线以后保留多少秒让 SDK 自动重连。超过了也没关系，还能凭座位令牌回来 */
const RECONNECT_SECONDS = 60;

/**
 * 加入时带的参数。
 * seatToken：浏览器自己生成的一串随机字符，相当于"这个座位的密码"。
 * 刷新页面、换浏览器以后带着同一个令牌加入，就回到原来的座位
 */
const JoinOptions = z.object({
    nickname: z.string().trim().min(1).max(12),
    seatToken: z.string().min(16).max(64),
});

/** 房主开局时选开局方式：固定组合 / 轮抽 */
const StartMessage = z.object({
    setupMode: z.enum(["sets", "draft"]),
});

/** "move" 的消息格式：指令 + 客户端看到的局面版本号 */
const MoveMessage = z.object({
    move: MoveSchema,
    version: z.number().int().min(0),
});

/** 执行过的一步：谁、什么指令、引擎说发生了什么。前端拿来写日志 */
export interface LoggedStep {
    seat: Seat;
    move: Move;
    events: GameEvent[];
}

/** 每执行一步广播一次：新的局面和刚执行的那一步。开局那一次 step 是 null */
export interface Snapshot {
    state: GameState;
    step: LoggedStep | null;
}

/** "sync" 的回复：现在的局面（还没开局是 null）和从开局到现在的每一步 */
export interface SyncReply {
    state: GameState | null;
    steps: LoggedStep[];
}

// 生成 5 位房间码（去掉了容易看错的 I、O、0、1）
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function makeRoomCode(): string {
    let code = "";
    for (let i = 0; i < 5; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    return code;
}

export class GameRoom extends Room<{ state: RoomMeta }> {
    // 5 个座位，再给断线的人留 5 个名额：断线的人在等重连的时候也占一个名额，
    // 房间满了会被自动锁上，锁上以后谁都加不进来，带令牌的人也不行
    maxClients = MAX_PLAYERS * 2;
    state = new RoomMeta();

    private game: GameState | null = null;
    /** 从开局到现在执行过的每一步 */
    private steps: LoggedStep[] = [];
    /** 座位令牌 → 现在坐在这个座位上的 sessionId。只存在服务器上，不同步给客户端 */
    private tokens = new Map<string, string>();

    messages = {
        // 房主开始游戏
        start: validate(StartMessage, (client, msg, ctx) => {
            if (client.sessionId !== this.state.hostSessionId) return ctx.reject("not-host");
            if (this.state.phase !== "waiting") return ctx.reject("already-started");
            if (this.state.players.size < 2) return ctx.reject("need-2-players");

            // 等人的时候有人走了，座位号会有空当（比如 0、2）。引擎要求座位号是 0、1、2……，重新排一遍
            [...this.state.players.values()]
                .sort((a, b) => a.seat - b.seat)
                .forEach((player, i) => (player.seat = i));

            const setupMode: SetupMode = msg.setupMode === "sets" ? { kind: "sets" } : { kind: "draft", order: "snake" };
            // 种子随机生成。M2-2 存档时会把它存下来，重放时用同一个种子
            this.game = createGame({ playerCount: this.state.players.size, mapId: MAP_ID, setupMode }, randomUUID());
            this.state.phase = "playing";
            this.syncMeta();
            this.broadcastSnapshot(null);
            return { ok: true };
        }),

        // 玩家的指令。validate() 先用 zod 检查格式，格式不对直接拒绝，不会进到这里
        move: validate(MoveMessage, (client, msg, ctx) => {
            if (!this.game) return ctx.reject("not-started");

            const player = this.state.players.get(client.sessionId);
            if (!player) return ctx.reject("not-seated");

            // 版本号对不上：客户端是照着旧局面点的（比如手快点了两下）
            if (msg.version !== this.game.version) return ctx.reject("stale-version");

            const error = validateMove(this.game, player.seat, msg.move);
            if (error) return ctx.reject(error);

            const { state, events } = applyMove(this.game, player.seat, msg.move);
            const step: LoggedStep = { seat: player.seat, move: msg.move, events };
            this.game = state;
            this.steps.push(step);
            this.syncMeta();
            this.broadcastSnapshot(step);
            return { version: state.version };
        }),

        // 客户端加入、重连以后用它拿到现在的局面和全部日志
        sync: (): SyncReply => ({
            state: this.game ? toPublicState(this.game) : null,
            steps: this.steps,
        }),
    };

    onCreate() {
        this.roomId = makeRoomCode();
    }

    onJoin(client: Client, options: unknown) {
        const { nickname, seatToken } = JoinOptions.parse(options);  // 不合法会抛错，加入失败

        // 带着认识的令牌：回到原来的座位
        const oldSessionId = this.tokens.get(seatToken);
        if (oldSessionId !== undefined) {
            this.takeOverSeat(client, seatToken, oldSessionId);
            return;
        }

        // 新来的人只能在开局前坐下。抛出的错误信息前端会收到
        if (this.state.phase !== "waiting") throw new Error("game-started");
        if (this.state.players.size >= MAX_PLAYERS) throw new Error("room-full");

        const player = new PlayerMeta();
        player.nickname = nickname;
        player.seat = this.nextFreeSeat();
        this.state.players.set(client.sessionId, player);
        this.tokens.set(seatToken, client.sessionId);
        if (!this.state.hostSessionId) this.state.hostSessionId = client.sessionId;
        console.log(`${nickname} 加入房间 ${this.roomId}，座位 ${player.seat}`);
    }

    // 非主动断线（网络抖动、合上笔记本、刷新页面……）
    onDrop(client: Client, code: CloseCode) {
        const player = this.state.players.get(client.sessionId);
        if (player) player.connected = false;
        this.allowReconnection(client, RECONNECT_SECONDS).catch(() => { });
    }

    onReconnect(client: Client) {
        const player = this.state.players.get(client.sessionId);
        // 断线的这段时间里，座位已经被同一个令牌的新连接接走了：这个旧连接不要了
        if (!player) {
            client.leave();
            return;
        }
        player.connected = true;
    }

    // 真正离开（主动离开，或者重连超时）
    onLeave(client: Client, code: CloseCode) {
        const player = this.state.players.get(client.sessionId);
        if (!player) return;   // 座位已经被同一个令牌的新连接接走了

        if (this.state.phase === "waiting") {
            // 开局前走了：让出座位，令牌作废
            this.state.players.delete(client.sessionId);
            for (const [token, sessionId] of this.tokens) {
                if (sessionId === client.sessionId) this.tokens.delete(token);
            }
            if (this.state.hostSessionId === client.sessionId) {
                // 房主走了，把房主交给剩下的第一个人
                const [first] = this.state.players.keys();
                this.state.hostSessionId = first ?? "";
            }
        } else {
            // 开局后：保留座位，等这个人凭令牌回来
            player.connected = false;
        }
    }

    /** 凭令牌回到座位：座位从旧的 sessionId 挪到新的 sessionId 名下 */
    private takeOverSeat(client: Client, seatToken: string, oldSessionId: string) {
        const old = this.state.players.get(oldSessionId)!;
        const player = new PlayerMeta();
        player.nickname = old.nickname;
        player.seat = old.seat;
        player.connected = true;
        this.state.players.delete(oldSessionId);
        this.state.players.set(client.sessionId, player);
        this.tokens.set(seatToken, client.sessionId);
        if (this.state.hostSessionId === oldSessionId) this.state.hostSessionId = client.sessionId;
        // 旧的连接还开着（比如另一个标签页开着同一个座位）：请它离开
        this.clients.getById(oldSessionId)?.leave();
        console.log(`${player.nickname} 凭令牌回到房间 ${this.roomId}，座位 ${player.seat}`);
    }

    private nextFreeSeat(): number {
        const taken = new Set([...this.state.players.values()].map((p) => p.seat));
        let seat = 0;
        while (taken.has(seat)) seat++;
        return seat;
    }

    /** 把局面里大家都要看的几样同步到 RoomMeta */
    private syncMeta() {
        if (!this.game) return;
        this.state.version = this.game.version;
        // 现在该谁操作：有人在做决定就是他，否则是正在行动的人；都没有是 -1
        this.state.activeSeat = this.game.pending[0]?.seat ?? this.game.turn?.seat ?? -1;
        if (this.game.phase === "ended") this.state.phase = "ended";
    }

    private broadcastSnapshot(step: LoggedStep | null) {
        if (!this.game) return;
        // toPublicState：去掉不该让客户端知道的（随机数状态）
        const snapshot: Snapshot = { state: toPublicState(this.game), step };
        this.broadcast("snapshot", snapshot);
    }
}