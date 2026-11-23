import { activeSeat, applyMove, createGame, GameEvent, GameState, validateMove } from "@aoi/engine";
import z from "zod";
import { PlayerMeta, RoomMeta } from "./schema/RoomMeta.js";
import { Client, CloseCode, MessageContext, Room, validate } from "colyseus";

// 客户端加入时带的参数
const JoinOptions = z.object({
    nickname: z.string().trim().min(1).max(12),
});

// "move"的消息格式
const MoveMessage = z.object({
    move: z.object({ t: z.literal("add"), n: z.number().int() }),
    version: z.number().int(),
});

// 服务器发给客户端的快照
export interface Snapshot {
    state: GameState;
    events: GameEvent[];
}

// 生成5位房间码
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function makeRoomCode(): string {
    let code = "";
    for (let i = 0; i < 5; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    return code;
}

export class GameRoom extends Room<{ state: RoomMeta }> {
    maxClients = 5;
    state = new RoomMeta();

    private game: GameState | null = null;

    messages = {
        // 房主开始游戏
        start: (client: Client, _payload: unknown, ctx: MessageContext) => {
            if (client.sessionId !== this.state.hostSessionId) return ctx.reject("not-host");
            if (this.state.phase !== "waiting") return ctx.reject("already-started");
            if (this.state.players.size < 2) return ctx.reject("need-2-players");

            const seats = [...this.state.players.values()].map((p) => p.seat).sort((a, b) => a - b);
            this.game = createGame(seats);
            this.state.phase = "playing";
            this.lock();    // 开局后不再接受新玩家
            this.syncMeta();
            this.broadcastSnapshot([]);
            return { ok: true };
        },

        // 玩家行动：validate() 先用 zod 检查消息格式，格式不对直接拒绝
        move: validate(MoveMessage, (client, msg, ctx) => {
            if (!this.game) return ctx.reject("not-started");

            const player = this.state.players.get(client.sessionId);
            if (!player) return ctx.reject("not-seated");

            if (msg.version !== this.game.version) return ctx.reject("stale-version");

            const error = validateMove(this.game, player.seat, msg.move);
            if (error) return ctx.reject(error);

            const { state, events } = applyMove(this.game, player.seat, msg.move);
            this.game = state;
            if (state.winner != null) this.state.phase = "ended";
            this.syncMeta();
            this.broadcastSnapshot(events);
            return { version: state.version };
        }),
    };

    onCreate() {
        this.roomId = makeRoomCode();
    }

    onJoin(client: Client, options: unknown) {
        const { nickname } = JoinOptions.parse(options);  // 不合法会抛错，加入失败

        const player = new PlayerMeta();
        player.nickname = nickname;
        player.seat = this.nextFreeSeat();
        this.state.players.set(client.sessionId, player);

        if (!this.state.hostSessionId) this.state.hostSessionId = client.sessionId;
        console.log(`${nickname} 加入房间 ${this.roomId}，座位${player.seat}`);
    }

    // 非主动断线（网络抖动、合上笔记本……）
    onDrop(client: Client, code: CloseCode) {
        const player = this.state.players.get(client.sessionId);
        if (player) player.connected = false;
        this.allowReconnection(client, 60).catch(() => { });    // 给 60 秒重连
    }

    onReconnect(client: Client) {
        const player = this.state.players.get(client.sessionId);
        if (player) player.connected = true;
        // 断线期间错过的快照，重连后补发一次
        if (this.game) {
            const snapshot: Snapshot = { state: this.game, events: [] };
            client.send("snapshot", snapshot);
        }
    }

    // 真正离开（主动离开，或重连超时）
    onLeave(client: Client, code: CloseCode) {
        if (this.state.phase === "waiting") {
            this.state.players.delete(client.sessionId);
            if (this.state.hostSessionId === client.sessionId) {
                // 房主走了，把房主交给剩下的第一个人
                const [first] = this.state.players.keys();
                this.state.hostSessionId = first ?? "";
            }
        } else {
            // 游戏已开始：保留座位，只标记离线
            const player = this.state.players.get(client.sessionId);
            if (player) player.connected = false;
        }
    }

    private nextFreeSeat(): number {
        const taken = new Set([...this.state.players.values()].map((p) => p.seat));
        let seat = 0;
        while (taken.has(seat)) seat++;
        return seat;
    }

    private syncMeta() {
        if (!this.game) return;
        this.state.version = this.game.version;
        this.state.activeSeat = activeSeat(this.game) ?? -1;
    }

    private broadcastSnapshot(events: GameEvent[]) {
        if (!this.game) return;
        const snapshot: Snapshot = { state: this.game, events };
        this.broadcast("snapshot", snapshot);
    }
}