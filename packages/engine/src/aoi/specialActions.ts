// 主行动"特殊行动"：回合奖励板块上的橙色八边形，每轮一次，不用付任何东西。
// 有特殊行动的回合奖励板块有 3 个：免费 1 铲改造并建造、免费建桥、任选学科前进 1 级。
// 以后宫殿、大创板块、能力板块上也会有特殊行动，source 用来区分是哪一个。
// 特殊行动随时能做（每轮一次），排出来的铲子、建桥、学科前进的决策都可以选放弃。
import { BONUS_TILES } from "./content/bonusTiles.js";
import { checkMainAction, type Applied } from "./turn.js";
import type { BonusTileId, Decision, GameState, RuleError, Seat } from "./types.js";

/** source 是 "bonus:板块编号"，而且正是这位玩家手上那块：返回板块编号，否则返回 null */
function bonusTileOf(state: GameState, seat: Seat, source: string): BonusTileId | null {
    const tile = state.players[seat].bonusTile;
    return tile !== null && source === `bonus:${tile}` ? tile : null;
}

export function validateSpecialAction(state: GameState, seat: Seat, source: string): RuleError | null {
    const error = checkMainAction(state, seat);
    if (error !== null) return error;
    const tile = bonusTileOf(state, seat, source);
    if (tile === null) return "bad-move"; // 不是自己手上的板块（以后别的来源在这里加）
    const special = BONUS_TILES[tile].special;
    if (special === undefined) return "bad-move"; // 这个板块没有特殊行动
    if (state.players[seat].specialsUsed.includes(source)) return "action-taken";
    return null;
}

/** 做特殊行动：记下本轮用过了，按种类排一个决策。调用前先用 validateSpecialAction 检查 */
export function applySpecialAction(state: GameState, seat: Seat, source: string): Applied {
    const special = BONUS_TILES[bonusTileOf(state, seat, source)!].special!;
    const pending: Decision[] = [...state.pending];
    const id = `special-${state.version}`;
    if (special === "spade") pending.push({ id, seat, kind: "spades", spades: 1, canBuild: true });
    if (special === "bridge") pending.push({ id, seat, kind: "bridge" });
    if (special === "level") pending.push({ id, seat, kind: "scienceLevels", levels: 1 });
    return {
        state: {
            ...state,
            players: state.players.map((p) => (p.seat === seat ? { ...p, specialsUsed: [...p.specialsUsed, source] } : p)),
            pending,
            turn: { ...state.turn!, mainActionDone: true },
        },
        events: [],
    };
}