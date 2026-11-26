// 终局计分：第 6 轮所有人 pass 以后算，算完游戏结束。
//  - 区域：自己的建筑里，互相"够得着"的（相邻、过桥、航行范围内隔河）连成一片，最大那片有几座。
//    按座数排名，第 1、2、3 名 18、12、6 分，并列的平分（向下取整）
//  - 学科：每门学科按等级排名，8、4、2 分，并列的平分；0 级不参加
//  - 资源：金币、工具、书、学者、碗 III 里的能量各算 1 金币，每 5 金币 1 分
// 双人局的特殊规则（中立学科标记、区域计分板块）在 M3 加。
import { AREA_SCORE_POINTS, COINS_PER_VP, DISCIPLINES, SCIENCE_SCORE_POINTS } from "./constants.js";
import { groupHexes, reachFrom } from "./map.js";
import { geometryOf, structuresOf } from "./reach.js";
import { rankPoints } from "./scoring.js";
import type { Applied } from "./turn.js";
import type { FinalScore, GameEvent, GameState, HexId, PlayerState, Seat } from "./types.js";

/**
 * 最大一片建筑有几座。两座建筑"够得着"：一座在另一座的可达范围里（航行等级按玩家现在的航行轨算）。
 * 一座建筑都没有时是 0
 */
export function largestArea(state: GameState, seat: Seat): number {
    const geo = geometryOf(state);
    const own = structuresOf(state, seat);
    const bridges = state.bridges.filter((b) => b.owner === seat);
    const sailing = state.players[seat].sailing;
    const reach = new Map(own.map((h) => [h, new Set(reachFrom(geo, h, sailing, bridges))]));
    const linked = (a: HexId, b: HexId) => reach.get(a)!.has(b);
    return Math.max(0, ...groupHexes(own, linked).map((group) => group.length));
}

/** 剩下的资源值多少金币 */
export function resourceValue(p: PlayerState): number {
    const books = DISCIPLINES.reduce((sum, d) => sum + p.books[d], 0);
    return p.coins + p.tools + books + p.scholars + p.power[2];
}

/** 算出每个人的终局分：breakdown 里 game 是游戏中拿到的分，另外三项是终局加的分 */
export function finalScores(state: GameState): FinalScore[] {
    const area = rankPoints(state.players.map((p) => largestArea(state, p.seat)), AREA_SCORE_POINTS);
    const science = state.players.map(() => 0);
    for (const d of DISCIPLINES) {
        rankPoints(state.players.map((p) => p.science[d]), SCIENCE_SCORE_POINTS).forEach((vp, i) => (science[i] += vp));
    }
    return state.players.map((p, i) => {
        const breakdown = {
            game: p.vp,
            area: area[i],
            science: science[i],
            resources: Math.floor(resourceValue(p) / COINS_PER_VP),
        };
        return { seat: p.seat, total: breakdown.game + breakdown.area + breakdown.science + breakdown.resources, breakdown };
    });
}

/** 终局计分的三项，以及它们在 resources 事件里的 reason */
const FINAL_PARTS = [
    { key: "area", reason: "finalArea" },
    { key: "science", reason: "finalScience" },
    { key: "resources", reason: "finalResources" },
] as const;

/** 游戏结束：加上终局分，阶段变成 ended，记下每个人的终局分 */
export function endGame(state: GameState): Applied {
    const scores = finalScores(state);
    const events: GameEvent[] = [];
    for (const s of scores) {
        for (const part of FINAL_PARTS) {
            const vp = s.breakdown[part.key];
            if (vp > 0) events.push({ type: "resources", seat: s.seat, delta: { vp }, reason: part.reason });
        }
    }
    events.push({ type: "phase", round: state.round, phase: "ended" }, { type: "gameEnded", scores });
    return {
        state: {
            ...state,
            phase: "ended",
            players: state.players.map((p) => ({ ...p, vp: scores[p.seat].total })),
            finalScores: scores,
        },
        events,
    };
}