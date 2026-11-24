// 地图的"画法"：格子画在哪、版图上印的编号是什么、某个玩家能到达哪些空格。
// 规则本身（邻接、可达范围）全部调用引擎函数，这里只负责换算成屏幕坐标。
import def from "../../../../tools/maps/aoi-base.json";
import {
    hexesInReach, parseMap, terrainDistance,
    type GameState, type HexId, type MapGeometry, type Seat,
} from "@aoi/engine/aoi";

/** 目前只支持这一张地图；M1-3 会把地图数据搬进引擎 */
export const AOI_BASE: MapGeometry = parseMap(def);

/** 六边形外接圆半径（中心到顶点），单位是 SVG 坐标，不是像素 */
export const HEX_R = 40;
const HEX_W = Math.sqrt(3) * HEX_R;   // 尖顶六边形的宽度
const PAD = 8;                        // 地图四周留白

/** 格子中心坐标。odd-r 排法：奇数行（B、D、F…）整体右移半格 */
export function hexCenter(row: number, col: number): { x: number; y: number } {
    return {
        x: PAD + HEX_W * (col + 0.5 + (row % 2) * 0.5),
        y: PAD + HEX_R + row * 1.5 * HEX_R,
    };
}

/** 尖顶六边形的 6 个顶点，拼成 SVG polygon 的 points 字符串 */
export function hexPoints(cx: number, cy: number, r: number): string {
    const pts: string[] = [];
    for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 180) * (30 + 60 * k);
        pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
    }
    return pts.join(" ");
}

/** 整张地图需要的画布大小 */
export function mapSize(geo: MapGeometry): { width: number; height: number } {
    const maxCols = Math.max(...geo.hexes.map((h) => h.col)) + 1;
    return {
        width: 2 * PAD + HEX_W * (maxCols + 0.5),
        height: 2 * PAD + 2 * HEX_R + (geo.rowCount - 1) * 1.5 * HEX_R,
    };
}

/**
 * 版图上印的编号：每行只数陆地格，河流不占号。
 * 引擎的 HexId 连河流一起数，所以两者会不一样，例如引擎的 A3 在版图上印的是 A2。
 * 界面上给玩家看版图编号，鼠标悬停时再附上引擎编号，方便对照日志。
 */
export function boardLabels(geo: MapGeometry): Record<HexId, string> {
    const labels: Record<HexId, string> = {};
    const countInRow: number[] = [];
    for (const h of geo.hexes) {   // parseMap 按"逐行、每行从左到右"的顺序给出格子
        if (h.river) continue;
        countInRow[h.row] = (countInRow[h.row] ?? 0) + 1;
        labels[h.id] = String.fromCharCode(65 + h.row) + countInRow[h.row];
    }
    return labels;
}

/** 某个玩家所有建筑所在的格子 */
export function ownedHexes(state: GameState, seat: Seat): HexId[] {
    return Object.entries(state.hexes)
        .filter(([, h]) => h.structure !== null && !h.structure.neutral && h.structure.owner === seat)
        .map(([id]) => id);
}

export interface ReachableHex {
    id: HexId;
    /** 改造成这位玩家的家园地形要几铲；0 表示可以直接建 */
    spades: number;
}

/** 某个玩家可达范围内、还没有建筑的格子。这是"TA 能在哪建造"的第一步答案 */
export function reachableEmpty(geo: MapGeometry, state: GameState, seat: Seat): ReachableHex[] {
    const p = state.players[seat];
    const ownBridges = state.bridges.filter((b) => b.owner === seat);
    return hexesInReach(geo, ownedHexes(state, seat), p.sailing, ownBridges)
        .filter((id) => state.hexes[id] && state.hexes[id].structure === null)
        .map((id) => ({ id, spades: terrainDistance(state.hexes[id].terrain, p.homeTerrain) }));
}
