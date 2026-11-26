// 行动得分：本轮回合计分板块的左半边，加上手上回合奖励板块的行动分。
// 不在每个行动里各写一遍，而是看这一步发生了哪些事件：建了工坊、升了行会、学科前进了几级……
// 每种事件算成"做了几次哪种行动"，再按板块加分。
import { BONUS_TILES } from "./content/bonusTiles.js";
import { ROUND_SCORE_TILES, type ScoreAction } from "./content/roundScores.js";
import { neighbors } from "./map.js";
import { geometryOf } from "./reach.js";
import { terrainDistance } from "./terrain.js";
import type { Applied } from "./turn.js";
import type { GameEvent, GameState, HexId, MapGeometry, PlayerState, Seat } from "./types.js";

/** 河边：至少有一个邻居是河流格 */
export function isRiverside(geo: MapGeometry, hex: HexId): boolean {
    return neighbors(geo, hex).some((n) => geo.byId[n].river);
}

/** 一个事件算做了几次哪些行动；和得分无关的事件返回空对象 */
export function scoreActions(geo: MapGeometry, e: GameEvent): Partial<Record<ScoreAction, number>> {
    switch (e.type) {
        case "built":
            if (e.structure !== "workshop") return {};
            return isRiverside(geo, e.hex) ? { workshop: 1, riverWorkshop: 1 } : { workshop: 1 };
        case "upgraded":
            if (e.to === "guild") return { guild: 1 };
            if (e.to === "school") return { school: 1 };
            return { bigBuilding: 1 }; // 宫殿或大学
        case "terraformed":
            return { spade: terrainDistance(e.from, e.to) }; // 改造了几步就是用了几把铲子
        case "science":
            return { level: e.to - e.from };
        case "scholarSent":
            return { scholar: 1 };
        case "track":
            return { track: e.to - e.from };
        case "tileTaken":
            if (e.kind === "city") return { city: 1 };
            if (e.kind === "innovation") return { innovation: 1 };
            return {};
        default:
            return {};
    }
}

/** 给 seat 加 vp 分 */
function addVp(players: PlayerState[], seat: Seat, vp: number): PlayerState[] {
    return players.map((p) => (p.seat === seat ? { ...p, vp: p.vp + vp } : p));
}

/**
 * 按这一步发生的事件加行动分：本轮的回合计分板块、做事的人手上的回合奖励板块。
 * 只在行动阶段算：开局放工坊、轮末科学奖励给的铲子都不得分
 */
export function actionPoints(state: GameState, events: GameEvent[]): Applied {
    if (state.phase !== "actions") return { state, events: [] };
    const geo = geometryOf(state);
    const tile = ROUND_SCORE_TILES[state.board.roundScores[state.round - 1]];
    let players = state.players;
    const scored: GameEvent[] = [];
    for (const e of events) {
        if (!("seat" in e)) continue;
        const done = scoreActions(geo, e);
        const fromTile = (done[tile.action] ?? 0) * tile.vp;
        if (fromTile > 0) {
            players = addVp(players, e.seat, fromTile);
            scored.push({ type: "resources", seat: e.seat, delta: { vp: fromTile }, reason: "roundScore" });
        }
        const bonusTile = players[e.seat].bonusTile;
        const bonus = bonusTile === null ? undefined : BONUS_TILES[bonusTile].action;
        const fromBonus = bonus === undefined ? 0 : (done[bonus.action] ?? 0) * bonus.vp;
        if (fromBonus > 0) {
            players = addVp(players, e.seat, fromBonus);
            scored.push({ type: "resources", seat: e.seat, delta: { vp: fromBonus }, reason: "bonusTileAction" });
        }
    }
    if (scored.length === 0) return { state, events: [] };
    return { state: { ...state, players }, events: scored };
}