// 一轮的流程：I 收入 → II 行动（轮流，直到所有人 pass）→ III 科学奖励和整理 → 下一轮。
// 第 6 轮没有第 III 步，所有人 pass 以后游戏结束（终局计分在 M1-8）。
// 每执行完一条指令，applyMove 都调用 autoAdvance：没有人需要做决定的时候，游戏自己往下走。
import { LAST_ROUND } from "./constants.js";
import { ROUND_SCORE_TILES } from "./content/roundScores.js";
import { endGame } from "./final.js";
import { collectIncome, incomeOf } from "./income.js";
import { gainResources, scaleBundle } from "./resources.js";
import type { Applied } from "./turn.js";
import type { Decision, GameEvent, GameState, PlayerState, ResourceBundle, Seat } from "./types.js";

/** 开始一轮的行动阶段：所有人拿收入，然后轮到行动顺序第一个人 */
export function startRound(state: GameState): Applied {
    const events: GameEvent[] = [{ type: "phase", round: state.round, phase: "income" }];
    for (const p of state.players) {
        const income = incomeOf(p);
        if (Object.keys(income).length > 0) events.push({ type: "resources", seat: p.seat, delta: income, reason: "income" });
    }
    const seat = state.turnOrder[0];
    events.push({ type: "phase", round: state.round, phase: "actions" }, { type: "turn", seat });
    return {
        state: { ...collectIncome(state), phase: "actions", turn: { seat, mainActionDone: false, builtHexes: [] } },
        events,
    };
}

/** seat 这一轮的科学奖励：回合计分板块右半边的奖励，乘上学科等级里有几个 per。铲子单独拿出来 */
export function scienceBonusOf(state: GameState, seat: Seat): { gain: ResourceBundle; spades: number } {
    const { discipline, per, reward } = ROUND_SCORE_TILES[state.board.roundScores[state.round - 1]].science;
    const times = Math.floor(state.players[seat].science[discipline] / per);
    const { spades, ...gain } = scaleBundle(reward, times);
    return { gain, spades: spades ?? 0 };
}

/**
 * 所有人都 pass 了、队列也空了：这一轮的行动阶段结束。第 6 轮直接结束游戏。第 1~5 轮：
 *  1. 科学奖励：按下一轮的行动顺序，每人拿回合计分板块右半边的奖励。
 *     铲子排成"免费铲子"决策（不能建工坊），任选颜色的书排成选颜色的决策
 *  2. 能量行动、书本行动、特殊行动的"本轮已用"清掉
 *  3. 场上每块回合奖励板块上放 1 金币
 */
export function endActions(state: GameState): Applied {
        if (state.round === LAST_ROUND) return endGame(state);
    const events: GameEvent[] = [{ type: "phase", round: state.round, phase: "scienceBonus" }];
    const pending: Decision[] = [...state.pending];
    let players: PlayerState[] = state.players;
    for (const seat of state.nextTurnOrder) {
        const { gain, spades } = scienceBonusOf(state, seat);
        const { player, bookChoices } = gainResources(players[seat], gain);
        players = players.map((q) => (q.seat === seat ? player : q));
        if (Object.keys(gain).length > 0) events.push({ type: "resources", seat, delta: gain, reason: "scienceBonus" });
        if (bookChoices > 0) {
            pending.push({ id: `science-${state.round}-${seat}-books`, seat, kind: "bookColor", count: bookChoices });
        }
        if (spades > 0) {
            pending.push({ id: `science-${state.round}-${seat}`, seat, kind: "spades", spades, canBuild: false });
        }
    }
    return {
        state: {
            ...state,
            phase: "scienceBonus",
            players: players.map((p): PlayerState => ({ ...p, specialsUsed: [] })),
            pending,
            board: {
                ...state.board,
                powerActionsUsed: [],
                bookActionsUsed: [],
                bonusTiles: state.board.bonusTiles.map((t) => ({ ...t, coins: t.coins + 1 })),
            },
        },
        events,
    };
}

/** 科学奖励的决策都处理完了：进入下一轮的收入阶段。行动顺序按上一轮 pass 的先后 */
export function nextRound(state: GameState): GameState {
    return {
        ...state,
        round: state.round + 1,
        phase: "income",
        turnOrder: state.nextTurnOrder,
        nextTurnOrder: [],
        players: state.players.map((p) => ({ ...p, passed: false })),
    };
}

/**
 * 自动推进：队列空了的时候，游戏自己往下走，直到需要有人做决定或者行动：
 *  - 收入阶段 → 拿收入，开始行动阶段
 *  - 行动阶段，所有人都 pass 了（turn 是 null）→ 科学奖励和整理；第 6 轮游戏结束
 *  - 科学奖励阶段 → 下一轮的收入阶段
 * 什么都不用做时，原样返回传进来的 state
 */
export function autoAdvance(state: GameState): Applied {
    let current = state;
    const events: GameEvent[] = [];
    while (current.pending.length === 0) {
        let step: Applied;
        if (current.phase === "income") step = startRound(current);
        else if (current.phase === "actions" && current.turn === null) step = endActions(current);
        else if (current.phase === "scienceBonus") step = { state: nextRound(current), events: [] };
        else break;
        current = step.state;
        events.push(...step.events);
    }
    return { state: current, events };
}

/** 只要推进以后的局面、不要事件时用 */
export function advance(state: GameState): GameState {
    return autoAdvance(state).state;
}