// 吸能：有人新建或升级了建筑，相邻的其他玩家可以获得能量，拿 N 点付 N-1 分。
import { structurePower } from "./city.js";
import { gainPower, leechOffer } from "./power.js";
import { isAdjacent } from "./map.js";
import { geometryOf } from "./reach.js";
import type { Applied } from "./turn.js";
import type { Decision, GameEvent, GameState, HexId, RuleError, Seat } from "./types.js";

/**
 * builder 在 hex 建了东西：其他每位玩家和 hex 相邻的建筑，能量值加起来是多少。
 * 新建筑自己的能量值不算。没有相邻建筑的玩家不出现在结果里。
 */
export function leechAmounts(state: GameState, builder: Seat, hex: HexId): { seat: Seat; power: number }[] {
    const geo = geometryOf(state);
    const totals = new Map<Seat, number>();
    for (const [id, h] of Object.entries(state.hexes)) {
        const s = h.structure;
        if (s === null || s.owner === builder || id === hex) continue;
        if (!isAdjacent(geo, state.bridges, id, hex)) continue;
        totals.set(s.owner, (totals.get(s.owner) ?? 0) + structurePower(s));
    }
    // 按行动顺序排，从建造者的下一位开始
    const order = state.turnOrder;
    const start = order.indexOf(builder);
    const result: { seat: Seat; power: number }[] = [];
    for (let i = 1; i < order.length; i++) {
        const seat = order[(start + i) % order.length];
        const power = totals.get(seat);
        if (power !== undefined) result.push({ seat, power });
    }
    return result;
}

/**
 * 从 hex 向邻居发起吸能。
 * 一点能量都拿不到的不发起；不用付分的（只拿 1 点）直接自动接受；其余排进待决策队列。
 */
export function leechDecisions(state: GameState, builder: Seat, hex: HexId): Applied {
    const events: GameEvent[] = [];
    const pending: Decision[] = [...state.pending];
    let players = state.players;
    for (const { seat, power: offered } of leechAmounts(state, builder, hex)) {
        const p = players[seat];
        const offer = leechOffer(offered, p.power, p.vp);
        if (offer === null) continue;
        if (offer.vpCost === 0) {
            players = players.map((q) => (q.seat === seat ? { ...q, power: gainPower(q.power, offer.power).bowls } : q));
            events.push({ type: "leech", seat, from: builder, power: offer.power, vpCost: 0, accepted: true });
        } else {
            pending.push({ id: `leech-${state.version}-${hex}-${seat}`, seat, kind: "leech", from: builder, ...offer });
        }
    }
    return { state: { ...state, players, pending }, events };
}

export function validateLeech(state: GameState, seat: Seat): RuleError | null {
    const d = state.pending[0];
    if (d === undefined || d.kind !== "leech") return "wrong-phase";
    if (d.seat !== seat) return "not-your-decision";
    return null;
}

/** 回应吸能：接受就拿能量、付分；不接受什么都不变。调用前先用 validateLeech 检查 */
export function applyLeech(state: GameState, seat: Seat, accept: boolean): Applied {
    const d = state.pending[0];
    if (d.kind !== "leech") throw new Error("队列第一个不是吸能");
    const players = accept
        ? state.players.map((p) => (p.seat === seat ? { ...p, power: gainPower(p.power, d.power).bowls, vp: p.vp - d.vpCost } : p))
        : state.players;
    return {
        state: { ...state, players, pending: state.pending.slice(1) },
        events: [{ type: "leech", seat, from: d.from, power: d.power, vpCost: d.vpCost, accepted: accept }],
    };
}