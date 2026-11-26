// 回合：行动前的通用检查。一轮的流程（开始一轮、自动推进）在 round.ts。
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