// 地图的"画法"：格子画在哪、版图上印的编号是什么、某个玩家能到达哪些空格、城市的轮廓。
// 规则本身（邻接、可达范围）全部调用引擎函数，这里只负责换算成屏幕坐标。
import type { CSSProperties } from "react";
import {
    MAPS, hexesInReach, parseMap, reachRange, structuresOf, terrainDistance,
    type GameState, type HexId, type MapGeometry, type Seat,
} from "@aoi/engine/aoi";

/** 解析好的地图按编号存起来：地图数据不会变，解析一次就够了 */
const geometries = new Map<string, MapGeometry>();

/** 这张地图解析后的样子。数据来自引擎的 MAPS，和服务端用的是同一份 */
export function mapGeometry(mapId: string): MapGeometry {
    let geo = geometries.get(mapId);
    if (geo === undefined) {
        geo = parseMap(MAPS[mapId]);
        geometries.set(mapId, geo);
    }
    return geo;
}

/** 现在只有这一张地图 */
export const AOI_BASE: MapGeometry = mapGeometry("aoi-base");

/** 六边形外接圆半径（中心到顶点），单位是 SVG 坐标，不是像素 */
export const HEX_R = 40;
/** 尖顶六边形的宽度，也是相邻两格中心的距离 */
export const HEX_W = Math.sqrt(3) * HEX_R;
const PAD = 8;                        // 地图四周留白

/**
 * 底图（board/map：地图贴图只裁掉四周不属于版图的一小圈，1552 × 968 像素）在 SVG 坐标里的位置和大小。
 * 左边的回合轨、下面一排书本行动和能量行动都在图上；我们自己的回合计分板块、书本行动、按钮叠在它们上面（见 boardBox）。
 * 在图上量的：A1 的中心在 (245.5, 102)，左右相邻两格中心隔 99.9 像素，上下相邻两行隔 83.0 像素。
 * 图上的六边形比正六边形扁一点（高只有 96%），所以横竖用不同的比例，把图拉到正好对上 SVG 里的正六边形格子
 */
const BOARD_PX = { w: 1552, h: 968, a1x: 245.5, a1y: 102, col: 99.9, row: 83.0 };
const BOARD_SX = HEX_W / BOARD_PX.col;
const BOARD_SY = (1.5 * HEX_R) / BOARD_PX.row;
export const BOARD = {
    x: PAD + HEX_W / 2 - BOARD_PX.a1x * BOARD_SX,
    y: PAD + HEX_R - BOARD_PX.a1y * BOARD_SY,
    w: BOARD_PX.w * BOARD_SX,
    h: BOARD_PX.h * BOARD_SY,
};

/**
 * 底图上的一块（单位是底图的像素）换成相对整张地图的百分比位置。
 * 叠在地图上的 HTML（回合计分板块、行动格）用它摆到图上对应的格子里，地图怎么缩放都对得上
 */
export function boardBox(x: number, y: number, w: number, h: number): CSSProperties {
    const pct = (v: number, total: number) => `${(v / total) * 100}%`;
    return { left: pct(x, BOARD_PX.w), top: pct(y, BOARD_PX.h), width: pct(w, BOARD_PX.w), height: pct(h, BOARD_PX.h) };
}

/** 格子上印的编号在格子中心往上多少（SVG 单位）：图上是 38 像素 */
export const LABEL_DY = 38 * BOARD_SY;

/** 格子中心坐标。odd-r 排法：奇数行（B、D、F…）整体右移半格 */
export function hexCenter(row: number, col: number): { x: number; y: number } {
    return {
        x: PAD + HEX_W * (col + 0.5 + (row % 2) * 0.5),
        y: PAD + HEX_R + row * 1.5 * HEX_R,
    };
}

/** 尖顶六边形第 k 个顶点（k = 0~5，从右下开始顺时针） */
function corner(cx: number, cy: number, r: number, k: number): { x: number; y: number } {
    const a = (Math.PI / 180) * (30 + 60 * k);
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

/** 尖顶六边形的 6 个顶点，拼成 SVG polygon 的 points 字符串 */
export function hexPoints(cx: number, cy: number, r: number): string {
    const pts: string[] = [];
    for (let k = 0; k < 6; k++) {
        const p = corner(cx, cy, r, k);
        pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
    }
    return pts.join(" ");
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

export interface ReachableHex {
    id: HexId;
    /** 改造成这位玩家的家园地形要几铲；0 表示可以直接建 */
    spades: number;
}

/**
 * 某个玩家可达范围内、还没有建筑的格子。这是"TA 能在哪建造"的第一步答案。
 * 用的是引擎的 structuresOf 和 reachRange，和引擎判断"够不够得着"的算法完全一样
 * （包括回合奖励板块"河边工坊"给的航行 +1）
 */
export function reachableEmpty(geo: MapGeometry, state: GameState, seat: Seat): ReachableHex[] {
    const p = state.players[seat];
    if (p === undefined) return [];   // 开局还没选完，玩家还不存在
    const ownBridges = state.bridges.filter((b) => b.owner === seat);
    return hexesInReach(geo, structuresOf(state, seat), reachRange(p), ownBridges)
        .filter((id) => state.hexes[id] && state.hexes[id].structure === null)
        .map((id) => ({ id, spades: terrainDistance(state.hexes[id].terrain, p.homeTerrain) }));
}

/**
 * 城市的轮廓：一组格子最外面的那一圈边，拼成 SVG path。
 * 做法：每个格子看自己的 6 条边，边对面的格子不在这组里，这条边就是轮廓的一部分。
 * 第 k 条边连着第 k、k+1 个顶点，它对面那一格的中心在 60° + 60°×k 的方向上，距离是 HEX_W。
 */
export function outlinePath(geo: MapGeometry, ids: HexId[], r: number): string {
    const key = (x: number, y: number) => `${Math.round(x)},${Math.round(y)}`;
    const inside = new Set(ids.map((id) => {
        const c = hexCenter(geo.byId[id].row, geo.byId[id].col);
        return key(c.x, c.y);
    }));
    const parts: string[] = [];
    for (const id of ids) {
        const c = hexCenter(geo.byId[id].row, geo.byId[id].col);
        for (let k = 0; k < 6; k++) {
            const a = (Math.PI / 180) * (60 + 60 * k);
            if (inside.has(key(c.x + HEX_W * Math.cos(a), c.y + HEX_W * Math.sin(a)))) continue;
            const p = corner(c.x, c.y, r, k), q = corner(c.x, c.y, r, (k + 1) % 6);
            parts.push(`M${p.x.toFixed(1)} ${p.y.toFixed(1)}L${q.x.toFixed(1)} ${q.y.toFixed(1)}`);
        }
    }
    return parts.join("");
}
