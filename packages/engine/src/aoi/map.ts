import { TERRAIN_BY_CODE } from "./constants.js";
import type { Bridge, HexId, HexInfo, HexState, MapDef, MapGeometry, TerrainCode } from "./types.js";

/** 行列下标 → 格子编号，例如 (0, 0) → "A1"，(4, 6) → "E7" */
export function hexId(row: number, col: number): HexId {
    return String.fromCharCode(65 + row) + (col + 1);
}

/** 把地图定义解析成格子列表；遇到不认识的字符直接报错 */
export function parseMap(def: MapDef): MapGeometry {
    const hexes: HexInfo[] = [];
    def.rows.forEach((line, row) => {
        [...line].forEach((ch, col) => {
            const id = hexId(row, col);
            if (ch === "~") {
                hexes.push({ id, row, col, river: true, terrain: null });
            } else if (ch in TERRAIN_BY_CODE) {
                hexes.push({ id, row, col, river: false, terrain: TERRAIN_BY_CODE[ch as TerrainCode] });
            } else {
                throw new Error(`地图 ${def.id} 的 ${id} 有不认识的字符 "${ch}"`);
            }
        });
    });
    const byId: Record<HexId, HexInfo> = {};
    for (const h of hexes) byId[h.id] = h;
    return { id: def.id, name: def.name, rowCount: def.rows.length, hexes, byId };
}

/** 开局时 GameState.hexes 的初始值：每个陆地格，地形照地图，没有建筑 */
export function initialHexes(geo: MapGeometry): Record<HexId, HexState> {
    const result: Record<HexId, HexState> = {};
    for (const h of geo.hexes) {
        if (h.terrain !== null) result[h.id] = { terrain: h.terrain, structure: null };
    }
    return result;
}

// odd-r 排法下 6 个方向的（行偏移, 列偏移）
const EVEN_ROW_DIRS: [number, number][] = [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]];
const ODD_ROW_DIRS: [number, number][] = [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]];

/** 一个格子的所有邻居（陆地和河流都算），地图外的不算 */
export function neighbors(geo: MapGeometry, id: HexId): HexId[] {
    const h = geo.byId[id];
    const dirs = h.row % 2 === 0 ? EVEN_ROW_DIRS : ODD_ROW_DIRS;
    const result: HexId[] = [];
    for (const [dr, dc] of dirs) {
        const n = hexId(h.row + dr, h.col + dc);
        if (n in geo.byId) result.push(n);
    }
    return result;
}

/** 两个陆地格是否相邻：共用一条边，或者有桥连着 */
export function isAdjacent(geo: MapGeometry, bridges: Bridge[], a: HexId, b: HexId): boolean {
    if (bridges.some((br) => (br.a === a && br.b === b) || (br.a === b && br.b === a))) return true;
    return neighbors(geo, a).includes(b);
}

/**
 * 从一个格子出发，可达范围（reach）内的所有陆地格（不含自己）：
 *  - 相邻的陆地格（包括桥对岸）
 *  - 经过不超过 sailing 个河流格能到的陆地格
 */
export function reachFrom(geo: MapGeometry, from: HexId, sailing: number, bridges: Bridge[]): HexId[] {
    const found = new Set<HexId>();
    for (const br of bridges) {
        if (br.a === from) found.add(br.b);
        if (br.b === from) found.add(br.a);
    }

    // 广度优先：frontier 里是"刚走到的河流格"，depth 是已经过了几个河流格
    const seenRiver = new Set<HexId>();
    let frontier: HexId[] = [from];
    for (let depth = 0; depth <= sailing && frontier.length > 0; depth++) {
        const next: HexId[] = [];
        for (const id of frontier) {
            for (const n of neighbors(geo, id)) {
                if (geo.byId[n].river) {
                    if (!seenRiver.has(n)) { seenRiver.add(n); next.push(n); }
                } else if (n !== from) {
                    found.add(n);
                }
            }
        }
        frontier = next;
    }
    return [...found].sort();
}

/** 从多个格子（通常是玩家的所有建筑）出发，可达范围的并集 */
export function hexesInReach(geo: MapGeometry, sources: HexId[], sailing: number, bridges: Bridge[]): HexId[] {
    const all = new Set<HexId>();
    for (const s of sources) for (const id of reachFrom(geo, s, sailing, bridges)) all.add(id);
    return [...all].sort();
}

/** 把格子分成若干组：linked(a, b) 为真的两格属于同一组（连通分量） */
export function groupHexes(ids: HexId[], linked: (a: HexId, b: HexId) => boolean): HexId[][] {
    const groups: HexId[][] = [];
    const visited = new Set<HexId>();
    for (const start of ids) {
        if (visited.has(start)) continue;
        const group: HexId[] = [];
        const queue = [start];
        visited.add(start);
        while (queue.length > 0) {
            const cur = queue.shift()!;
            group.push(cur);
            for (const other of ids) {
                if (!visited.has(other) && linked(cur, other)) {
                    visited.add(other);
                    queue.push(other);
                }
            }
        }
        groups.push(group.sort());
    }
    return groups;
}

/**
 * 从陆地格 from 出发，能架桥到哪些陆地格。桥要跨过河：
 * 对面那格和 from 不相邻，两格正好有 2 个共同邻居，而且这 2 个都是河流格
 * （桥就架在这两个河流格中间那条边上）
 */
export function bridgeSpots(geo: MapGeometry, from: HexId): HexId[] {
    const mine = neighbors(geo, from);
    const result: HexId[] = [];
    for (const h of geo.hexes) {
        if (h.river || h.id === from || mine.includes(h.id)) continue;
        const common = neighbors(geo, h.id).filter((n) => mine.includes(n));
        if (common.length === 2 && common.every((n) => geo.byId[n].river)) result.push(h.id);
    }
    return result;
}