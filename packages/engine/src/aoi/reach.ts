// 和"某位玩家在地图上能够到哪里"有关的小工具。规则本身都在 map.ts 里，这里只是把 GameState 接上去。
import { MAPS } from "./content/maps.js";
import { hexesInReach, parseMap } from "./map.js";
import type { GameState, HexId, MapGeometry, PlayerState, Seat } from "./types.js";

/** 解析好的地图。每张地图只解析一次：getLegalMoves 一次要检查上百条指令，每条都重新解析太慢 */
const geometries = new Map<string, MapGeometry>();

/** 这局用的地图（解析好的） */
export function geometryOf(state: GameState): MapGeometry {
    const id = state.options.mapId;
    if (!geometries.has(id)) geometries.set(id, parseMap(MAPS[id]));
    return geometries.get(id)!;
}

/** 某位玩家所有建筑所在的格子（中立建筑也算，它们也属于这位玩家） */
export function structuresOf(state: GameState, seat: Seat): HexId[] {
    return Object.keys(state.hexes).filter((id) => state.hexes[id].structure?.owner === seat);
}

/** 航行范围：航行等级，加上回合奖励板块"河边工坊"的 +1 */
export function reachRange(p: PlayerState): number {
    return p.sailing + (p.bonusTile === "riverWorkshop" ? 1 : 0);
}

/** 这一格在不在这位玩家的可达范围内 */
export function isInReach(state: GameState, seat: Seat, hex: HexId): boolean {
    const ownBridges = state.bridges.filter((b) => b.owner === seat);
    const reach = hexesInReach(geometryOf(state), structuresOf(state, seat), reachRange(state.players[seat]), ownBridges);
    return reach.includes(hex);
}