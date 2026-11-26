// 联机：所有和服务器打交道的代码都在这里。React 组件只读 store、调用这里的函数。
//
// 局面怎么到前端：
//  - 加入、重连以后，发一个 "sync" 请求，拿到现在的局面和从开局到现在的每一步（日志）
//  - 之后每有人走一步，服务器广播一次 "snapshot"：新局面 + 刚走的那一步
//  - 如果中间漏了（比如断线的时候别人走了几步），版本号对不上，就再 sync 一次
//
// 座位令牌（seatToken）：加入房间时浏览器自己生成一串随机字符，相当于这个座位的密码。
// 刷新页面、关掉再打开，带着同一个令牌加入，服务器就把原来的座位还给你。
import { ColyseusSDK, type Room } from "@colyseus/sdk";
import { create } from "zustand";
import type { GameState, Move } from "@aoi/engine/aoi";
import type { default as server } from "@aoi/backend/app.config";
import type { GameRoom as ServerGameRoom, LoggedStep, Snapshot, SyncReply } from "@aoi/backend/rooms/GameRoom";
import { RULE_ERROR_TEXT } from "./aoi/labels.ts";

// 服务器和网页在同一台电脑上（或者同一个局域网地址）
const SERVER_URL = `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:2567`;
const sdk = new ColyseusSDK<typeof server>(SERVER_URL);

type GameRoom = Room<ServerGameRoom>;
type Meta = ReturnType<GameRoom["state"]["toJSON"]>;

interface Online {
    room: GameRoom | null;
    /** 房间元数据：座位、谁在线、谁是房主、现在该谁（Schema 同步过来的，转成普通对象） */
    meta: Meta | null;
    /** 现在的局面；还没开局是 null */
    state: GameState | null;
    /** 从开局到现在的每一步，日志用 */
    steps: LoggedStep[];
    /** 正在加入房间 */
    joining: boolean;
    /** 断线了，SDK 正在自动重连 */
    reconnecting: boolean;
    /** 最近一次的提示（服务器拒绝了指令、加入失败……） */
    error: string | null;
}

export const useOnline = create<Online>(() => ({
    room: null, meta: null, state: null, steps: [], joining: false, reconnecting: false, error: null,
}));

const set = useOnline.setState;
const get = useOnline.getState;

// ---------- 座位令牌和"最近的房间" ----------

/** 记下来的一个座位：哪个房间、叫什么、令牌 */
export interface SavedSeat {
    code: string;
    nickname: string;
    seatToken: string;
}

/** 这个标签页现在在哪个房间（刷新页面时自动回去）。每个标签页各存各的 */
const CURRENT_KEY = "aoi-current-room";
/** 这个浏览器最近进过的房间（大厅里显示"回到房间"） */
const RECENT_KEY = "aoi-recent-rooms";

/** 生成座位令牌：32 个十六进制字符 */
function newSeatToken(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function readJSON<T>(storage: Storage, key: string): T | null {
    try {
        return JSON.parse(storage.getItem(key) ?? "null");
    } catch {
        return null;
    }
}

function writeJSON(storage: Storage, key: string, value: unknown) {
    try {
        if (value === null) storage.removeItem(key);
        else storage.setItem(key, JSON.stringify(value));
    } catch {
        // 浏览器不让存就算了：只是刷新以后要手动回到房间
    }
}

/** 最近进过的房间，最新的在前面 */
export function recentSeats(): SavedSeat[] {
    return readJSON<SavedSeat[]>(localStorage, RECENT_KEY) ?? [];
}

function remember(seat: SavedSeat) {
    writeJSON(sessionStorage, CURRENT_KEY, seat);
    writeJSON(localStorage, RECENT_KEY, [seat, ...recentSeats().filter((s) => s.code !== seat.code)].slice(0, 5));
}

function forget(code: string) {
    if (readJSON<SavedSeat>(sessionStorage, CURRENT_KEY)?.code === code) writeJSON(sessionStorage, CURRENT_KEY, null);
    writeJSON(localStorage, RECENT_KEY, recentSeats().filter((s) => s.code !== code));
}

// ---------- 加入、离开 ----------

export async function createRoom(nickname: string) {
    const seat = { code: "", nickname, seatToken: newSeatToken() };
    await connect(seat, () => sdk.create("game", { nickname, seatToken: seat.seatToken }));
}

/** 用房间码加入：新的座位，新的令牌 */
export async function joinRoom(code: string, nickname: string) {
    const seat = { code: code.trim().toUpperCase(), nickname, seatToken: newSeatToken() };
    await connect(seat, () => sdk.joinById<ServerGameRoom>(seat.code, { nickname, seatToken: seat.seatToken }));
}

/** 带着记下来的令牌回到原来的座位 */
export async function rejoinRoom(seat: SavedSeat) {
    await connect(seat, () => sdk.joinById<ServerGameRoom>(seat.code, { nickname: seat.nickname, seatToken: seat.seatToken }));
}

/** 页面刚打开时：这个标签页刚才在一个房间里（刷新了页面），自动回去 */
export function resumeAfterReload() {
    const seat = readJSON<SavedSeat>(sessionStorage, CURRENT_KEY);
    if (seat !== null && get().room === null && !get().joining) void rejoinRoom(seat);
}

/** 是自己点了"离开房间"（不是被断开的） */
let leavingOnPurpose = false;

export function leaveRoom() {
    const { room, meta } = get();
    if (!room) return;
    // 开局前离开就让出了座位，令牌作废；开局后座位还留着，以后还能"回到房间"
    if (meta?.phase === "waiting") forget(room.roomId);
    else writeJSON(sessionStorage, CURRENT_KEY, null);
    leavingOnPurpose = true;
    void room.leave();
}

async function connect(seat: SavedSeat, join: () => Promise<GameRoom>) {
    set({ joining: true, error: null });
    try {
        const room = await join();
        remember({ ...seat, code: room.roomId });
        attach(room);
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        // 房间已经没了：从"最近的房间"里去掉
        if (message.includes("not found")) forget(seat.code);
        set({ error: joinErrorText(message) });
    } finally {
        set({ joining: false });
    }
}

// 加入成功后立刻注册所有监听，不要等 React 组件挂载，否则可能漏掉第一条消息
function attach(room: GameRoom) {
    leavingOnPurpose = false;
    set({ room, meta: null, state: null, steps: [], reconnecting: false });

    room.onStateChange((meta) => set({ meta: meta.toJSON() }));
    room.onMessage("snapshot", onSnapshot);
    room.onDrop(() => set({ reconnecting: true }));
    room.onReconnect(() => {
        set({ reconnecting: false });
        void sync();   // 断线期间可能错过了几步
    });
    room.onLeave(() => {
        const error = leavingOnPurpose ? null : "和房间断开了：可能是同一个座位在别的窗口打开了，或者断线太久。可以在下面点\"回到房间\"";
        set({ room: null, meta: null, state: null, steps: [], reconnecting: false, error });
    });
    void sync();
}

// ---------- 局面 ----------

/** 拿到现在的局面和全部日志 */
async function sync() {
    const room = get().room;
    if (!room) return;
    try {
        const reply: SyncReply = await room.request("sync");
        // 等回复的时候又收到了更新的 snapshot：不要用旧的盖掉新的
        const current = get().state;
        if (current !== null && reply.state !== null && reply.state.version < current.version) return;
        set({ state: reply.state, steps: reply.steps });
    } catch {
        // 正好断线了：重连以后会再 sync
    }
}

function onSnapshot({ state, step }: Snapshot) {
    if (step === null) {
        set({ state, steps: [] });   // 刚开局
        return;
    }
    const { steps } = get();
    // 版本号 = 一共走了几步。正好是下一步就接上；对不上说明中间漏了，整份重新拿
    if (state.version === steps.length + 1) set({ state, steps: [...steps, step] });
    else void sync();
}

// ---------- 发指令 ----------

export async function startGame(setupMode: "sets" | "draft") {
    const room = get().room;
    if (!room) return;
    set({ error: null });
    try {
        await room.request("start", { setupMode });
    } catch (e) {
        set({ error: requestErrorText(e) });
    }
}

/** 发一条指令。带上"我是照着第几版局面点的"，服务器发现局面已经变了会拒绝 */
export async function sendMove(move: Move) {
    const { room, state } = get();
    if (!room || !state) return;
    set({ error: null });
    try {
        await room.request("move", { move, version: state.version });
    } catch (e) {
        set({ error: requestErrorText(e) });
    }
}

export function clearError() {
    set({ error: null });
}

// ---------- 中文提示 ----------

/** 房间自己的拒绝原因（引擎的拒绝原因在 labels.ts 的 RULE_ERROR_TEXT 里） */
const ROOM_ERROR_TEXT: Record<string, string> = {
    "not-host": "只有房主可以开始",
    "already-started": "游戏已经开始了",
    "need-2-players": "至少要 2 个人才能开始",
    "not-started": "游戏还没开始",
    "not-seated": "你不在座位上",
    "stale-version": "局面刚刚变了，请再点一次",
};

function requestErrorText(e: unknown): string {
    const reason = (e as { reason?: string } | null)?.reason;
    if (reason) return ROOM_ERROR_TEXT[reason] ?? RULE_ERROR_TEXT[reason as keyof typeof RULE_ERROR_TEXT] ?? `服务器拒绝了：${reason}`;
    // 没有 reason：格式检查没通过（前端发的指令格式不对，一般是前端的 bug）
    return `服务器没有接受这条指令：${e instanceof Error ? e.message.slice(0, 120) : String(e)}`;
}

function joinErrorText(message: string): string {
    if (message.includes("game-started")) return "这一局已经开始了，新的人进不来。如果你原来就在这一局里，点下面的\"回到房间\"";
    if (message.includes("room-full")) return "房间满了（最多 5 人）";
    if (message.includes("not found")) return "没有这个房间：房间码输错了，或者大家都离开以后房间已经关了";
    if (message.includes("ECONNREFUSED") || message.includes("Failed to fetch") || message.includes("NetworkError")) {
        return "连不上服务器：服务器开了吗？（npm run dev:server）";
    }
    return `加入失败：${message}`;
}
