// 本地试玩：不连服务器，在浏览器里直接调用你写的引擎。几个人坐在一台电脑前轮流操作。
// 流程和服务端处理一条指令完全一样：validateMove 通过了才 applyMove，只是少了网络这一段。
// M2 接上服务器以后，界面不用改，只要把下面的 sendLocal 换成"发给服务器"。
import {
    applyMove, createGame, validateMove,
    type GameEvent, type GameState, type Move, type Seat, type SetupOptions,
} from "@aoi/engine/aoi";
import { create } from "zustand";
import { RULE_ERROR_TEXT } from "./labels.ts";
import { MOCK_NAMES, MOCK_STATE } from "./mock.ts";
import { actingSeat } from "./options.ts";

/** 这局是怎么开始的：用 createGame 新开，或者从示例局面（假数据）开始 */
export type LocalStart =
    | { kind: "new"; options: SetupOptions; seed: string }
    | { kind: "mock" };

/** 执行过的一步：谁、什么指令、引擎说发生了什么，以及执行之前的局面（撤销时退回去） */
export interface Step {
    seat: Seat;
    move: Move;
    events: GameEvent[];
    before: GameState;
}

interface LocalGame {
    start: LocalStart | null;
    names: string[];
    state: GameState | null;
    steps: Step[];
    /** 最近一次的提示（比如引擎拒绝了一条指令），没有为 null */
    notice: string | null;
}

export const useLocalGame = create<LocalGame>(() => ({
    start: null, names: [], state: null, steps: [], notice: null,
}));

// ---------- 开局 ----------

function initialState(start: LocalStart): GameState {
    return start.kind === "new" ? createGame(start.options, start.seed) : MOCK_STATE;
}

export function startLocalGame(start: LocalStart, names: string[]) {
    try {
        useLocalGame.setState({ start, names, state: initialState(start), steps: [], notice: null });
        save();
    } catch (e) {
        // createGame 在人数、地图不对时会抛错
        useLocalGame.setState({ notice: `开局失败：${e instanceof Error ? e.message : String(e)}` });
    }
}

/** 从示例局面（预览页的假数据）开始 */
export function startFromMock() {
    startLocalGame({ kind: "mock" }, MOCK_NAMES);
}

export function quitLocalGame() {
    useLocalGame.setState({ start: null, state: null, steps: [], notice: null });
}

// ---------- 执行一条指令 ----------

/**
 * 以"现在该操作的人"的身份执行一条指令。
 * 先问引擎能不能做：不能做就把原因显示出来，局面不变；能做就执行，并记下这一步。
 */
export function sendLocal(move: Move) {
    const { state, steps } = useLocalGame.getState();
    if (state === null) return;
    const seat = actingSeat(state);
    if (seat === null) {
        useLocalGame.setState({ notice: "现在没有人需要操作" });
        return;
    }
    const error = validateMove(state, seat, move);
    if (error !== null) {
        useLocalGame.setState({ notice: `引擎拒绝了这一步：${RULE_ERROR_TEXT[error]}（${error}）` });
        return;
    }
    try {
        const { state: next, events } = applyMove(state, seat, move);
        useLocalGame.setState({ state: next, steps: [...steps, { seat, move, events, before: state }], notice: null });
        save();
    } catch (e) {
        // validateMove 说可以、applyMove 却出错了：这是引擎的 bug，把错误显示出来方便查
        useLocalGame.setState({ notice: `引擎执行出错：${e instanceof Error ? e.message : String(e)}` });
    }
}

/** 撤销上一步：退回到上一步执行之前的局面 */
export function undoLocal() {
    const { steps } = useLocalGame.getState();
    const last = steps[steps.length - 1];
    if (last === undefined) return;
    useLocalGame.setState({ state: last.before, steps: steps.slice(0, -1), notice: null });
    save();
}

export function clearNotice() {
    useLocalGame.setState({ notice: null });
}

// ---------- 存档：只存"怎么开的局 + 每一步指令"，读档时从头重放 ----------
// 这就是计划书 2.1 节说的"事件溯源"：局面 = 开局 + 指令日志。存的东西很小，
// 而且你改了引擎以后读旧档，看到的是新引擎算出来的结果。

const SAVE_KEY = "aoi-local-game";

interface Saved {
    start: LocalStart;
    names: string[];
    moves: { seat: Seat; move: Move }[];
}

function save() {
    const { start, names, steps } = useLocalGame.getState();
    if (start === null) return;
    const saved: Saved = { start, names, moves: steps.map((s) => ({ seat: s.seat, move: s.move })) };
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
    } catch {
        // 存不了（浏览器不允许、或者空间满了）就算了，不影响继续玩
    }
}

/** 浏览器里有没有上次的存档 */
export function hasSavedGame(): boolean {
    try {
        return localStorage.getItem(SAVE_KEY) !== null;
    } catch {
        return false;
    }
}

/**
 * 读档：从开局开始，把存下来的指令一条条重放。
 * 某一步引擎不认了（比如你改了规则），就停在那一步之前，并且说明停在哪里
 */
export function resumeSavedGame() {
    let saved: Saved;
    try {
        saved = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "null");
    } catch {
        saved = null;
    }
    if (saved === null) return;
    try {
        let state = initialState(saved.start);
        const steps: Step[] = [];
        let notice: string | null = null;
        for (const [i, { seat, move }] of saved.moves.entries()) {
            const error = validateMove(state, seat, move);
            if (error !== null) {
                notice = `存档重放到第 ${i + 1} 步时引擎不认了（${RULE_ERROR_TEXT[error]}），停在这一步之前`;
                break;
            }
            const { state: next, events } = applyMove(state, seat, move);
            steps.push({ seat, move, events, before: state });
            state = next;
        }
        useLocalGame.setState({ start: saved.start, names: saved.names, state, steps, notice });
    } catch (e) {
        useLocalGame.setState({ notice: `读档失败：${e instanceof Error ? e.message : String(e)}` });
    }
}
