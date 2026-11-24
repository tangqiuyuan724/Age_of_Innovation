import type { GameState, MapGeometry, Seat, StructureType } from "@aoi/engine/aoi";
import { TERRAIN_COLOR, WATER_COLOR, inkOn } from "./colors.ts";
import { STRUCTURE_NAME, TERRAIN_NAME } from "./labels.ts";
import { HEX_R, boardLabels, hexCenter, hexPoints, mapSize, type ReachableHex } from "./mapView.ts";

/** 地图上建筑徽章里的单字，和徽章半径（越高级越大） */
const BADGE: Record<StructureType, { ch: string; r: number }> = {
    workshop: { ch: "坊", r: 12 },
    guild: { ch: "会", r: 14 },
    school: { ch: "校", r: 14 },
    university: { ch: "大", r: 16 },
    palace: { ch: "宫", r: 17 },
    tower: { ch: "塔", r: 13 },
    monument: { ch: "碑", r: 16 },
};

interface Props {
    geo: MapGeometry;
    state: GameState;
    name: (seat: Seat) => string;
    /** 正在查看谁：TA 能到达的空格会画虚线框 */
    reach: ReachableHex[];
}

/** 六边形地图：地形、河流、建筑、桥，以及某位玩家的可达范围 */
export function HexMap({ geo, state, name, reach }: Props) {
    const { width, height } = mapSize(geo);
    const labels = boardLabels(geo);
    const reachById = new Map(reach.map((r) => [r.id, r.spades]));
    const land = geo.hexes.filter((h) => !h.river);
    const rivers = geo.hexes.filter((h) => h.river);

    return (
        <svg className="hexmap" viewBox={`0 0 ${width.toFixed(0)} ${height.toFixed(0)}`} role="img" aria-label={`${geo.name}，${land.length} 个陆地格`}>
            {/* 第 1 层：河流。画得比格子略大一点，相邻河流格之间就不会露出缝 */}
            <g>
                {rivers.map((h) => {
                    const c = hexCenter(h.row, h.col);
                    return <polygon key={h.id} points={hexPoints(c.x, c.y, HEX_R + 0.8)} fill={WATER_COLOR} />;
                })}
            </g>

            {/* 第 2 层：陆地。地形以 state.hexes 为准（改造过的格子颜色会变），而不是地图原始数据 */}
            <g>
                {land.map((h) => {
                    const c = hexCenter(h.row, h.col);
                    const hs = state.hexes[h.id];
                    const terrain = hs ? hs.terrain : h.terrain;
                    const owner = hs?.structure ? `，${name(hs.structure.owner)}的${STRUCTURE_NAME[hs.structure.type]}` : "";
                    const changed = terrain !== h.terrain ? `（原来是${TERRAIN_NAME[h.terrain]}）` : "";
                    return (
                        <g key={h.id}>
                            <title>{`${labels[h.id]}：${TERRAIN_NAME[terrain]}${changed}${owner}。引擎编号 ${h.id}`}</title>
                            <polygon points={hexPoints(c.x, c.y, HEX_R - 1.4)} fill={TERRAIN_COLOR[terrain]} />
                            <text className="hex-label" x={c.x} y={c.y + HEX_R * 0.66} fill={inkOn(terrain)}>{labels[h.id]}</text>
                        </g>
                    );
                })}
            </g>

            {/* 第 3 层：可达范围。虚线框 + 需要几铲 */}
            <g aria-hidden>
                {land.filter((h) => reachById.has(h.id)).map((h) => {
                    const c = hexCenter(h.row, h.col);
                    const terrain = state.hexes[h.id].terrain;
                    const spades = reachById.get(h.id)!;
                    return (
                        <g key={h.id} className="reach">
                            <polygon points={hexPoints(c.x, c.y, HEX_R * 0.86)} fill="none" stroke={inkOn(terrain)} />
                            <text x={c.x} y={c.y + 2} fill={inkOn(terrain)}>{spades === 0 ? "可建" : `${spades} 铲`}</text>
                        </g>
                    );
                })}
            </g>

            {/* 第 4 层：桥。从一个格子中心附近画到另一个格子中心附近 */}
            <g>
                {state.bridges.map((b, i) => {
                    const ha = geo.byId[b.a], hb = geo.byId[b.b];
                    const a = hexCenter(ha.row, ha.col), z = hexCenter(hb.row, hb.col);
                    const dx = z.x - a.x, dy = z.y - a.y, len = Math.hypot(dx, dy);
                    const t = (HEX_R * 0.55) / len;   // 两端各缩进 0.55 个半径
                    const x1 = a.x + dx * t, y1 = a.y + dy * t, x2 = z.x - dx * t, y2 = z.y - dy * t;
                    const color = TERRAIN_COLOR[state.players[b.owner].homeTerrain];
                    return (
                        <g key={i}>
                            <title>{`${name(b.owner)}的桥：${labels[b.a]} — ${labels[b.b]}`}</title>
                            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--ink)" strokeWidth={11} strokeLinecap="round" />
                            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={6} strokeLinecap="round" />
                        </g>
                    );
                })}
            </g>

            {/* 第 5 层：建筑徽章。玩家色填充 + 白圈，玩家色和格子同色时也看得清 */}
            <g aria-hidden>
                {land.map((h) => {
                    const s = state.hexes[h.id]?.structure;
                    if (!s) return null;
                    const c = hexCenter(h.row, h.col);
                    const home = state.players[s.owner].homeTerrain;
                    const { ch, r } = BADGE[s.type];
                    return (
                        <g key={h.id} className="badge">
                            <circle cx={c.x} cy={c.y - 2} r={r} fill={s.neutral ? "var(--panel)" : TERRAIN_COLOR[home]} stroke="var(--panel)" strokeWidth={3} />
                            <text x={c.x} y={c.y - 2} fontSize={r * 1.05} fill={s.neutral ? "var(--ink)" : inkOn(home)}>{ch}</text>
                        </g>
                    );
                })}
            </g>
        </svg>
    );
}
