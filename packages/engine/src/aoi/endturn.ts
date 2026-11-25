// 结束回合：本回合建过东西的格子向邻居发起吸能，然后轮到下一个人。
import { leechDecisions } from "./leech.js";
import { checkFreeAction, type Applied } from "./turn.js";
import type { GameEvent, GameState, RuleError, Seat } from "./types.js";

/** 行动顺序里，seat 之后下一个还没 pass 的人；所有人都 pass 了返回 null */
export function nextSeat(state: GameState, seat: Seat): Seat | null {
    const order = state.turnOrder;
    const start = order.indexOf(seat);
    for (let i = 1; i <= order.length; i++) {
        const s = order[(start + i) % order.length];
        if (!state.players[s].passed) return s;
    }
    return null;
}

export function validateEndTurn(state: GameState, seat: Seat): RuleError | null {
    const error = checkFreeAction(state, seat);
    if (error !== null) return error;
    if (!state.turn!.mainActionDone) return "main-action-missing";
    return null;
}

/** 结束回合。调用前先用 validateEndTurn 检查 */
export function applyEndTurn(state: GameState, seat: Seat): Applied {
    const events: GameEvent[] = [];
    let next = state;
    for (const hex of state.turn!.builtHexes) {
        const result = leechDecisions(next, seat, hex);
        next = result.state;
        events.push(...result.events);
    }
    const after = nextSeat(next, seat);
    if (after === null) return { state: { ...next, turn: null }, events }; // 所有人都 pass 了
    events.push({ type: "turn", seat: after });
    return { state: { ...next, turn: { seat: after, mainActionDone: false, builtHexes: [] } }, events };
}