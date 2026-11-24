import { CITY_MIN_BUILDINGS, CITY_MIN_POWER, STRUCTURE_POWER } from "./constants.js";
import { groupHexes, isAdjacent } from "./map.js";
import type { Bridge, HexId, HexState, MapGeometry, Seat, Structure } from "./types.js";

/** 一座建筑的能量值：附楼 +1 */
export function structurePower(s: Structure): number {
    return STRUCTURE_POWER[s.type] + (s.annex ? 1 : 0);
}

/** 一座建筑算几座：带附楼的算 2 座 */
export function structureCount(s: Structure): number {
    return s.annex ? 2 : 1;
}

/**
 * 找出 seat 还没归入城市的建筑里，第一组满足组城条件的；没有则返回 null。
 * 条件：直接相邻（含桥）连成一组，能量值合计 ≥ minPower，且座数 ≥ 要求：
 * 一般 4 座；组里有大学 3 座；组里有纪念碑 2 座。
 */
export function findCityCandidate(
    geo: MapGeometry,
    hexes: Record<HexId, HexState>,
    bridges: Bridge[],
    seat: Seat,
    minPower = CITY_MIN_POWER,
): HexId[] | null {
    const mine = Object.keys(hexes)
        .filter((id) => {
            const s = hexes[id].structure;
            return s !== null && s.owner === seat && s.city === null;
        })
        .sort();
    for (const group of groupHexes(mine, (a, b) => isAdjacent(geo, bridges, a, b))) {
        const structures = group.map((id) => hexes[id].structure!);
        const power = structures.reduce((sum, s) => sum + structurePower(s), 0);
        const count = structures.reduce((sum, s) => sum + structureCount(s), 0);
        let required = CITY_MIN_BUILDINGS;
        if (structures.some((s) => s.type === "university")) required = 3;
        if (structures.some((s) => s.type === "monument")) required = 2;
        if (power >= minPower && count >= required) return group;
    }
    return null;
}