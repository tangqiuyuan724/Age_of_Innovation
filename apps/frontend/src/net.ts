// 所有和服务器打交道的代码都放在这里，React 组件只读 store、调用这里的函数。
import { ColyseusSDK, type Room } from "@colyseus/sdk";
import { create } from "zustand";
import type { default as server } from "@aoi/backend/app.config";
import type { GameRoom as ServerGameRoom, Snapshot } from "@aoi/backend/rooms/GameRoom";
import type { Move } from "@aoi/engine";

const SERVER_URL = "ws://localhost:2567";
const sdk = new ColyseusSDK<typeof server>(SERVER_URL);

type GameRoom = Room<ServerGameRoom>;
type MetaJSON = ReturnType<GameRoom["state"]["toJSON"]>;

interface Store {
    room: GameRoom | null;
    meta: MetaJSON | null;        // 房间元数据（Schema 同步过来的，转成普通对象）
    snapshot: Snapshot | null;    // 游戏状态快照
    reconnecting: boolean;
    error: string | null;
}

export const useStore = create<Store>(() => ({
    room: null, meta: null, snapshot: null, reconnecting: false, error: null,
}));

export async function createRoom(nickname: string) {
    await connect(() => sdk.create("game", { nickname }));
}

export async function joinRoom(code: string, nickname: string) {
    await connect(() => sdk.joinById<ServerGameRoom>(code.trim().toUpperCase(), { nickname }));
}

async function connect(join: () => Promise<GameRoom>) {
    useStore.setState({ error: null });
    try {
        const room = await join();
        attach(room);
    } catch (e) {
        useStore.setState({ error: "加入失败：" + (e instanceof Error ? e.message : String(e)) });
    }
}

// 加入成功后立刻注册所有监听，不要等 React 组件挂载，否则可能漏掉第一条消息
function attach(room: GameRoom) {
    // 注意：此刻 room.state 还是空的，第一份完整状态会在随后的 onStateChange 里到达
    useStore.setState({ room, meta: null, snapshot: null });

    room.onStateChange((state) => useStore.setState({ meta: state.toJSON() }));
    room.onMessage("snapshot", (snapshot: Snapshot) => useStore.setState({ snapshot }));
    room.onDrop(() => useStore.setState({ reconnecting: true }));
    room.onReconnect(() => useStore.setState({ reconnecting: false }));
    room.onLeave(() => useStore.setState({ room: null, meta: null, snapshot: null, reconnecting: false }));
}

export async function startGame() {
    await call((room) => room.request("start"));
}

export async function sendMove(move: Move) {
    const version = useStore.getState().snapshot?.state.version ?? 0;
    await call((room) => room.request("move", { move, version }));
}

export function leaveRoom() {
    void useStore.getState().room?.leave();
}

async function call(fn: (room: GameRoom) => Promise<unknown>) {
    const room = useStore.getState().room;
    if (!room) return;
    useStore.setState({ error: null });
    try {
        await fn(room);
    } catch (e: any) {
        useStore.setState({ error: errorText(e?.reason ?? e?.message) });
    }
}

const ERROR_TEXT: Record<string, string> = {
    "not-host": "只有房主可以开始",
    "already-started": "游戏已经开始了",
    "need-2-players": "至少需要 2 名玩家",
    "not-started": "游戏还没开始",
    "not-seated": "你不在座位上",
    "stale-version": "局面刚刚更新了，请再点一次",
    "game-over": "游戏已经结束",
    "not-your-turn": "还没轮到你",
    "bad-amount": "只能加 1～3",
    "overshoot": "不能超过 21",
};

function errorText(reason: string): string {
    return ERROR_TEXT[reason] ?? `出错了：${reason}`;
}