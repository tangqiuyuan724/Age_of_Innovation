import { CITY_MIN_BUILDINGS, CITY_MIN_POWER, DISCIPLINES, STRUCTURE_POWER } from "./constants.js";
import { CITY_TILES, CITY_TILE_IDS } from "./content/cityTiles.js";
import { groupHexes, isAdjacent } from "./map.js";
import { geometryOf, structuresOf } from "./reach.js";
import { gainResources } from "./resources.js";
import { advanceScience } from "./science.js";
import type { Applied } from "./turn.js";
import type {
    Bridge, CityTileId, Decision, GameEvent, GameState, HexId, HexState, MapGeometry, PlayerState, RuleError, Seat, Structure,
} from "./types.js";

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

// ---------- 组成城市、选城市板块 ----------

/** 把这些格子上的建筑都标成属于第 cityId 座城市 */
function joinCity(hexes: Record<HexId, HexState>, ids: HexId[], cityId: number): Record<HexId, HexState> {
    const result = { ...hexes };
    for (const id of ids) result[id] = { ...hexes[id], structure: { ...hexes[id].structure!, city: cityId } };
    return result;
}

/**
 * seat 的建筑或桥变了以后，整理 seat 的城市：
 *  1. 和城市连着（直接相邻或者有桥）的建筑，归入那座城市
 *  2. 剩下的建筑里，满足组城条件的组成新城市，选城市板块的决策插到队列最前面，马上选
 */
export function updateCities(state: GameState, seat: Seat): Applied {
    const geo = geometryOf(state);
    const bridges = state.bridges.filter((b) => b.owner === seat);
    const linked = (a: HexId, b: HexId) => isAdjacent(geo, bridges, a, b);
    let hexes = state.hexes;
    let cities = state.cities;

    // 1. 归入已有的城市
    for (const group of groupHexes(structuresOf(state, seat), linked)) {
        const cityId = group.map((id) => hexes[id].structure!.city).find((c) => c !== null);
        const joining = group.filter((id) => hexes[id].structure!.city === null);
        if (cityId === undefined || cityId === null || joining.length === 0) continue;
        hexes = joinCity(hexes, joining, cityId);
        cities = cities.map((c) => (c.id === cityId ? { ...c, hexes: [...c.hexes, ...joining].sort() } : c));
    }

    // 2. 组成新的城市
    const events: GameEvent[] = [];
    const decisions: Decision[] = [];
    let group = findCityCandidate(geo, hexes, bridges, seat);
    while (group !== null) {
        const id = cities.length;
        hexes = joinCity(hexes, group, id);
        cities = [...cities, { id, owner: seat, hexes: group, tile: null }];
        events.push({ type: "cityFounded", seat, cityId: id, hexes: group });
        // 城市板块被拿光的那种不能选；全部拿光了就没有决策（21 张，实际上拿不完）
        const options = CITY_TILE_IDS.filter((t) => state.board.cityTilesLeft[t] > 0);
        if (options.length > 0) decisions.push({ id: `city-${id}`, seat, kind: "cityTile", cityId: id, options });
        group = findCityCandidate(geo, hexes, bridges, seat);
    }

    if (hexes === state.hexes) return { state, events: [] };
    return { state: { ...state, hexes, cities, pending: [...decisions, ...state.pending] }, events };
}

export function validateCityTile(state: GameState, seat: Seat, tile: CityTileId): RuleError | null {
    const d = state.pending[0];
    if (d === undefined || d.kind !== "cityTile") return "wrong-phase";
    if (d.seat !== seat) return "not-your-decision";
    if (!d.options.includes(tile)) return "invalid-choice";
    if (state.board.cityTilesLeft[tile] <= 0) return "tile-unavailable";
    return null;
}

/**
 * 拿城市板块：得分和资源、1 把钥匙；带铲子的排一个"免费铲子"决策（可以建工坊），
 * 任选颜色的书排一个选颜色的决策，都插在队列最前面。调用前先用 validateCityTile 检查
 */
export function applyCityTile(state: GameState, seat: Seat, tile: CityTileId): Applied {
    const d = state.pending[0];
    if (d.kind !== "cityTile") throw new Error("队列第一个不是选城市板块");
    const def = CITY_TILES[tile];
    const { player, bookChoices } = gainResources(state.players[seat], def.gain);
    const after: PlayerState = { ...player, keys: player.keys + 1, cityTiles: [...player.cityTiles, tile] };

    const extra: Decision[] = [];
    if (def.spades !== undefined) extra.push({ id: `${d.id}-spades`, seat, kind: "spades", spades: def.spades, canBuild: true });
    if (bookChoices > 0) extra.push({ id: `${d.id}-books`, seat, kind: "bookColor", count: bookChoices });

    const left = state.board.cityTilesLeft;
    let next: GameState = {
        ...state,
        players: state.players.map((q) => (q.seat === seat ? after : q)),
        cities: state.cities.map((c) => (c.id === d.cityId ? { ...c, tile } : c)),
        board: { ...state.board, cityTilesLeft: { ...left, [tile]: left[tile] - 1 } },
        pending: [...extra, ...state.pending.slice(1)],
    };
    const events: GameEvent[] = [
        { type: "tileTaken", seat, tile, kind: "city" },
        { type: "resources", seat, delta: def.gain, reason: "cityTile" },
    ];
    // 每门学科前进：钥匙已经先拿到了，所以这次就能用
    if (def.levels !== undefined) {
        for (const discipline of DISCIPLINES) {
            const result = advanceScience(next, seat, discipline, def.levels);
            next = result.state;
            events.push(...result.events);
        }
    }
    return { state: next, events };
}