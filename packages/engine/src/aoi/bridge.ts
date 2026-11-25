// 建桥：桥跨过一条河，把两个陆地格连起来。连起来的两格算相邻（可达范围、吸能、组成城市都算）。
// 能量行动"建桥"和回合奖励板块"免费建桥"都先排一个"建桥"决策，玩家在这里选桥架在哪，也可以放弃。
// 没有地方能架、桥都建完了，也能做这两个行动（能量照样花掉），只是只能放弃建桥。
import { bridgeSpots } from "./map.js";
import { geometryOf, structuresOf } from "./reach.js";
import type { Applied } from "./turn.js";
import type { GameState, HexId, RuleError, Seat } from "./types.js";

/** 两格之间已经有桥了吗（不管是谁的桥） */
function hasBridge(state: GameState, a: HexId, b: HexId): boolean {
    return state.bridges.some((br) => (br.a === a && br.b === b) || (br.a === b && br.b === a));
}

/** 这位玩家现在能建的所有桥：至少一头是自己的建筑，地形上能架桥，那里还没有桥 */
export function bridgeOptions(state: GameState, seat: Seat): { a: HexId; b: HexId }[] {
    const geo = geometryOf(state);
    const own = structuresOf(state, seat);
    const result: { a: HexId; b: HexId }[] = [];
    for (const a of own) {
        for (const b of bridgeSpots(geo, a)) {
            if (own.includes(b) && b < a) continue; // 两头都是自己的建筑，同一座桥只算一次
            if (!hasBridge(state, a, b)) result.push({ a, b });
        }
    }
    return result;
}

// ---------- 决策：把桥架在 a 和 b 之间 ----------

export function validateBridge(state: GameState, seat: Seat, a: HexId, b: HexId): RuleError | null {
    const d = state.pending[0];
    if (d === undefined || d.kind !== "bridge") return "wrong-phase";
    if (d.seat !== seat) return "not-your-decision";
    const geo = geometryOf(state);
    if (geo.byId[a] === undefined || geo.byId[b] === undefined) return "bad-move";
    if (geo.byId[a].river || geo.byId[b].river) return "bad-move"; // 桥的两头都要是陆地
    if (!bridgeSpots(geo, a).includes(b)) return "invalid-choice";
    if (hasBridge(state, a, b)) return "invalid-choice";
    const own = structuresOf(state, seat);
    if (!own.includes(a) && !own.includes(b)) return "no-own-building";
    if (state.players[seat].bridges === 0) return "limit-reached";
    return null;
}

/** 建桥，决策移出队列。调用前先用 validateBridge 检查 */
export function applyBridge(state: GameState, seat: Seat, a: HexId, b: HexId): Applied {
    return {
        state: {
            ...state,
            bridges: [...state.bridges, { owner: seat, a, b }],
            players: state.players.map((p) => (p.seat === seat ? { ...p, bridges: p.bridges - 1 } : p)),
            pending: state.pending.slice(1),
        },
        events: [{ type: "bridgeBuilt", seat, a, b }],
    };
}