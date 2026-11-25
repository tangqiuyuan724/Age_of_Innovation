// 回合：行动前的通用检查、开始一轮、自动推进。
import { collectIncome } from "./income.js";
import type { GameEvent, GameState, RuleError, Seat } from "./types.js";

/** 执行一条指令或一个决策的结果：新状态，加上这一步发生了什么（给前端写日志、做动画） */
export interface Applied {
    state: GameState;
    events: GameEvent[];
}

/** 自由行动（转换、牺牲能量）之前的检查：行动阶段、轮到你、没有待处理的决策 */
export function checkFreeAction(state: GameState, seat: Seat): RuleError | null {
    if (state.phase === "ended") return "game-over";
    if (state.phase !== "actions" || state.turn === null) return "wrong-phase";
    if (state.turn.seat !== seat) return "not-your-turn";
    if (state.pending.length > 0) return "decision-pending";
    return null;
}

/** 主行动之前的检查：自由行动的检查，再加上"这回合还没做过主行动" */
export function checkMainAction(state: GameState, seat: Seat): RuleError | null {
    const error = checkFreeAction(state, seat);
    if (error !== null) return error;
    if (state.turn!.mainActionDone) return "main-action-done";
    return null;
}

/** 开始一轮的行动阶段：所有人拿收入，然后轮到行动顺序第一个人 */
export function startRound(state: GameState): GameState {
    const withIncome = collectIncome(state);
    return {
        ...withIncome,
        phase: "actions",
        turn: { seat: state.turnOrder[0], mainActionDone: false, builtHexes: [] },
    };
}

/**
 * 自动推进：没有人需要做决定的时候，游戏自己往下走。
 * 这一课只有一种情况：开局设置结束、开局的决策都处理完了，开始第 1 轮。
 * 一轮结束后进入下一轮，在 M1-6 补上。
 */
export function advance(state: GameState): GameState {
    if (state.phase === "income" && state.pending.length === 0) return startRound(state);
    return state;
}