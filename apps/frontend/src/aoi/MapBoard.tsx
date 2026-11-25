import type { GameState, HexId, MapGeometry, Seat } from "@aoi/engine/aoi";
import { TERRAIN_COLOR } from "./colors.ts";
import { assetUrl, reportMissing } from "./assets.ts";
import { STRUCTURE_NAME, TERRAIN_NAME } from "./labels.ts";
import { FRAME, HEX_R, HEX_W, boardLabels, hexCenter, hexPoints, mapSize, outlinePath, type ReachableHex } from "./mapView.ts";
import { Piece } from "./pieces.tsx";

/** 地形图是 214 × 248 像素，宽对齐格子宽度，高按比例 */
const TILE_H = HEX_W * (248 / 214);

interface Props {
    geo: MapGeometry;
    state: GameState;
    name: (seat: Seat) => string;
    /** 正在查看谁：TA 能到达的空格画虚线框，写上要几铲 */
    reach: ReachableHex[];
    /** 现在可以点的格子（放初始工坊、用免费铲子、建桥），画金色实线框 */
    targets: Set<HexId>;
    selected: HexId | null;
    /** 点了一个陆地格 */
    onHexClick: (id: HexId) => void;
}

/**
 * 地图：书本样子的边框里，每个陆地格贴上对应地形的图，河流是水面。
 * 上面再摆建筑、桥、城市轮廓，以及"能到哪里""现在能点哪里"的提示框。
 * 边框图（图 147）本来就是为这张 9 行 × 13 列的地图画的，FRAME 记的是它在 SVG 坐标里的位置
 */
export function MapBoard({ geo, state, name, reach, targets, selected, onHexClick }: Props) {
    const { width, height } = mapSize(geo);
    const labels = boardLabels(geo);
    const reachById = new Map(reach.map((r) => [r.id, r.spades]));
    const land = geo.hexes.filter((h) => !h.river);
    const color = (seat: Seat) => TERRAIN_COLOR[state.players[seat].homeTerrain];

    return (
        <svg
            className="mapboard"
            viewBox={`${FRAME.x} ${FRAME.y} ${FRAME.w} ${FRAME.h}`}
            role="group"
            aria-label={`${geo.name}，${land.length} 个陆地格。点格子看详情`}
        >
            <defs>
                {/* 水面：深蓝底色上叠一层拉长的噪点，像有水纹 */}
                <filter id="water-ripple" x="0" y="0" width="100%" height="100%">
                    <feTurbulence type="fractalNoise" baseFrequency="0.006 0.045" numOctaves="2" seed="7" />
                    <feColorMatrix values="0 0 0 0 0.86  0 0 0 0 0.93  0 0 0 0 1  0 0 0 0.5 -0.12" />
                    <feComposite in2="SourceGraphic" operator="in" />
                </filter>
                <linearGradient id="water-depth" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#3F7096" />
                    <stop offset="1" stopColor="#2C5677" />
                </linearGradient>
            </defs>

            {/* 第 1 层：水面，铺满整张地图（陆地格盖在上面，没盖到的就是河） */}
            <rect x={0} y={0} width={width} height={height} fill="url(#water-depth)" />
            <rect x={0} y={0} width={width} height={height} fill="#fff" filter="url(#water-ripple)" opacity={0.7} />

            {/* 第 2 层：陆地。先垫一块深色的六边形当作格子之间的缝，再贴地形图。
                地形以 state.hexes 为准：改造过的格子会换成新地形的图 */}
            <g>
                {land.map((h) => {
                    const c = hexCenter(h.row, h.col);
                    const hs = state.hexes[h.id];
                    const terrain = hs ? hs.terrain : h.terrain!;
                    const owner = hs?.structure ? `，${name(hs.structure.owner)}的${STRUCTURE_NAME[hs.structure.type]}` : "";
                    const changed = terrain !== h.terrain ? `（原来是${TERRAIN_NAME[h.terrain!]}）` : "";
                    const title = `${labels[h.id]}：${TERRAIN_NAME[terrain]}${changed}${owner}`;
                    const url = assetUrl("terrain", terrain);
                    return (
                        <g
                            key={h.id}
                            data-hex={h.id}
                            className="hex-cell"
                            onClick={() => onHexClick(h.id)}
                            tabIndex={0}
                            role="button"
                            aria-label={title}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onHexClick(h.id); }
                            }}
                        >
                            <title>{`${title}。引擎编号 ${h.id}`}</title>
                            <polygon points={hexPoints(c.x, c.y, HEX_R + 0.4)} fill="#2B2720" />
                            <image
                                href={url} x={c.x - HEX_W / 2} y={c.y - TILE_H / 2} width={HEX_W} height={TILE_H}
                                preserveAspectRatio="none" onError={() => reportMissing(url)}
                            />
                            <text className="hex-label" x={c.x} y={c.y + HEX_R * 0.72}>{labels[h.id]}</text>
                        </g>
                    );
                })}
            </g>

            {/* 第 3 层：城市轮廓。深色粗线 + 中间一道金线 */}
            <g aria-hidden className="city-outline">
                {state.cities.map((city) => {
                    const d = outlinePath(geo, city.hexes, HEX_R - 2.5);
                    return (
                        <g key={city.id}>
                            <title>{`${name(city.owner)}的城市`}</title>
                            <path d={d} stroke="rgba(20,16,10,.85)" strokeWidth={6.5} />
                            <path d={d} stroke="#F0CF73" strokeWidth={2.6} />
                        </g>
                    );
                })}
            </g>

            {/* 第 4 层：可达范围。白色虚线框 + 要几铲 */}
            <g aria-hidden className="reach">
                {land.filter((h) => reachById.has(h.id)).map((h) => {
                    const c = hexCenter(h.row, h.col);
                    const spades = reachById.get(h.id)!;
                    return (
                        <g key={h.id} data-hex={h.id}>
                            <polygon points={hexPoints(c.x, c.y, HEX_R * 0.84)} />
                            <text x={c.x} y={c.y - HEX_R * 0.42}>{spades === 0 ? "可建" : `${spades} 铲`}</text>
                        </g>
                    );
                })}
            </g>

            {/* 第 5 层：桥。一块木板，从一格中心附近搭到另一格中心附近 */}
            <g>
                {state.bridges.map((b, i) => {
                    const ha = geo.byId[b.a], hb = geo.byId[b.b];
                    const a = hexCenter(ha.row, ha.col), z = hexCenter(hb.row, hb.col);
                    const mx = (a.x + z.x) / 2, my = (a.y + z.y) / 2;
                    const angle = (Math.atan2(z.y - a.y, z.x - a.x) * 180) / Math.PI;
                    const len = Math.hypot(z.x - a.x, z.y - a.y) * 0.62;
                    const c = color(b.owner);
                    return (
                        <g key={i} transform={`translate(${mx.toFixed(1)} ${my.toFixed(1)}) rotate(${angle.toFixed(1)})`} className="bridge">
                            <title>{`${name(b.owner)}的桥：${labels[b.a]} — ${labels[b.b]}`}</title>
                            <rect x={-len / 2 + 1.5} y={-4} width={len} height={9} rx={2.5} fill="rgba(0,0,0,.45)" />
                            <rect x={-len / 2} y={-5.5} width={len} height={10} rx={2.5} fill={c} stroke="rgba(0,0,0,.65)" strokeWidth={1} />
                            <line x1={-len / 2 + 3} y1={-2.6} x2={len / 2 - 3} y2={-2.6} stroke="rgba(255,255,255,.35)" strokeWidth={1.2} />
                        </g>
                    );
                })}
            </g>

            {/* 第 6 层：建筑 */}
            <g aria-hidden>
                {land.map((h) => {
                    const s = state.hexes[h.id]?.structure;
                    if (!s) return null;
                    const c = hexCenter(h.row, h.col);
                    return (
                        <g key={h.id}>
                            {/* 中立建筑是浅色木头，下面垫一圈主人的颜色 */}
                            {s.neutral && <ellipse cx={c.x} cy={c.y + 12} rx={17} ry={5.5} fill={color(s.owner)} stroke="rgba(0,0,0,.5)" />}
                            <Piece type={s.type} color={s.neutral ? undefined : color(s.owner)} x={c.x} y={c.y + 2} scale={1.45} />
                            {s.annex && (
                                <g transform={`translate(${c.x + 15} ${c.y + 9})`}>
                                    <rect x={-4.5} y={-9} width={9} height={9} fill={color(s.owner)} stroke="rgba(0,0,0,.6)" strokeWidth={0.9} />
                                </g>
                            )}
                        </g>
                    );
                })}
            </g>

            {/* 第 7 层：现在可以点的格子（金色实线框）、选中的格子（白色粗框） */}
            <g aria-hidden className="targets">
                {land.filter((h) => targets.has(h.id)).map((h) => {
                    const c = hexCenter(h.row, h.col);
                    return <polygon key={h.id} data-hex={h.id} points={hexPoints(c.x, c.y, HEX_R * 0.8)} />;
                })}
                {selected && geo.byId[selected] && (() => {
                    const h = geo.byId[selected];
                    const c = hexCenter(h.row, h.col);
                    return <polygon className="selected" points={hexPoints(c.x, c.y, HEX_R - 3)} />;
                })()}
            </g>

            {/* 最上面：书本边框。中间是透明的，边缘正好压住最外圈格子的一点点 */}
            <image
                href={assetUrl("board", "frame")} x={FRAME.x} y={FRAME.y} width={FRAME.w} height={FRAME.h}
                preserveAspectRatio="none" pointerEvents="none" onError={() => reportMissing(assetUrl("board", "frame"))}
            />
        </svg>
    );
}
