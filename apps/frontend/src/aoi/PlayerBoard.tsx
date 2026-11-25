import {
    BUILDINGS_TOTAL, PALACE_TILE_INCOME, TOOLS_PER_SPADE,
    type BuildingType, type PlayerState,
} from "@aoi/engine/aoi";
import { TERRAIN_COLOR } from "./colors.ts";
import { assetUrl, reportMissing } from "./assets.ts";
import { describeBundle } from "./describe.ts";
import { COMPETENCY_LABEL, STRUCTURE_NAME, TERRAIN_NAME, factionName } from "./labels.ts";
import { Art, BridgeIcon, Disc, FactionToken, Piece, ScholarIcon } from "./pieces.tsx";

// 规划板的图是 1400 × 734 像素，7 块规划板的排法一样。下面的坐标都是在图上量的，
// 叠在图上的 SVG 用同样的坐标系（viewBox），所以图怎么缩放，棋子都摆在对的地方。
const W = 1400, H = 734;

/**
 * 每种建筑在规划板上的格子（从左到右）。建出去第 k 座，就空出第 k 格、露出下面印的收入；
 * 所以还剩 n 座时，木头建筑摆在最右边的 n 格里（和引擎 PLANNING_DISPLAYS 的说明一致）
 */
const SLOTS: Record<BuildingType, { x: number; y: number }[]> = {
    workshop: [170, 233, 296, 358, 420, 485, 548, 610, 672].map((x) => ({ x, y: 662 })),
    guild: [127, 185, 247, 307].map((x) => ({ x, y: 556 })),
    school: [492, 580, 665].map((x) => ({ x, y: 552 })),
    university: [{ x: 583, y: 414 }],
    // 宫殿站在宫殿板块上，盖住板块上印的收入；建出去以后板块整块露出来
    palace: [{ x: 160, y: 432 }],
};
const PIECE_SCALE: Record<BuildingType, number> = { workshop: 1.9, guild: 2, school: 2.4, university: 2.6, palace: 2.8 };

/** 宫殿板块放在宫殿那一行的大空格里 */
const PALACE_TILE = { x: 97, y: 372, w: 265, h: 125 };
/** 航行轨：第 0~3 级的小船（左上那一列）；改造轨：第 0~2 级（每铲 3、2、1 个工具） */
const SAILING_Y = [238, 183, 128, 74];
const TERRAFORMING_Y = [226, 166, 106];
/** 能量碗 I、II、III 的中心 */
const BOWLS = [{ x: 858, y: 626 }, { x: 855, y: 440 }, { x: 1036, y: 530 }];
/** 能量区上方那块空着的木头：派系板摆在这里（派系板的图是 520 × 352） */
const FACTION_AREA = { x: 782, y: 92, w: 326, h: 221 };

interface Props {
    p: PlayerState;
    name: string;
    isMe: boolean;
}

/**
 * 下面的玩家板：这位玩家的规划板，派系板压在能量区上方。
 * 还没建的建筑、能量碗里的能量、航行轨和改造轨的标记、宫殿板块摆在板子上；
 * 板子下面一条放能力板块、供应区里的学者、还没用的桥。
 * 资源和分数都在右边的玩家卡片上，回合奖励板块在右边的回合奖励区
 */
export function PlayerBoard({ p, name, isMe }: Props) {
    const color = TERRAIN_COLOR[p.homeTerrain];
    const bg = assetUrl("planning", p.planning);
    const pieces = (Object.keys(SLOTS) as BuildingType[]).flatMap((b) => {
        const built = BUILDINGS_TOTAL[b] - p.buildingsLeft[b];
        return SLOTS[b].map((pos, i) => ({ b, pos, i, onBoard: i >= built }));
    });

    return (
        <section className="pboard" aria-label={`${name}的规划板`} style={{ ["--seat" as string]: color }}>
            <p className="pboard-caption">
                <FactionToken faction={p.faction} name={factionName(p.faction)} color={color} size={30} />
                <strong>{name}</strong>{isMe && <em>你</em>}
                <span>的规划板（{factionName(p.faction)}，家园地形{TERRAIN_NAME[p.homeTerrain]}）</span>
            </p>
            <svg className="pboard-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={boardSummary(p)}>
                <image href={bg} x={0} y={0} width={W} height={H} onError={() => reportMissing(bg)} />

                {p.palaceTile !== null && (
                    <g>
                        <title>{`宫殿板块 #${p.palaceTile}，收入 ${describeBundle(PALACE_TILE_INCOME[p.palaceTile])}`}</title>
                        <image href={assetUrl("palace", p.palaceTile)} {...xywh(PALACE_TILE)} preserveAspectRatio="xMidYMid meet" />
                    </g>
                )}

                <g>
                    <title>{`派系：${factionName(p.faction)}`}</title>
                    <image href={assetUrl("faction", p.faction)} {...xywh(FACTION_AREA)} preserveAspectRatio="xMidYMid meet" className="pboard-faction" />
                </g>

                {/* 两条轨道上的标记 */}
                <g>
                    <title>{`航行轨 ${p.sailing} 级`}</title>
                    <Disc color={color} x={135} y={SAILING_Y[Math.min(p.sailing, SAILING_Y.length - 1)]} r={19} />
                </g>
                <g>
                    <title>{`改造轨 ${p.terraforming} 级：每铲 ${TOOLS_PER_SPADE[p.terraforming]} 个工具`}</title>
                    <Disc color={color} x={580} y={TERRAFORMING_Y[Math.min(p.terraforming, TERRAFORMING_Y.length - 1)]} r={19} />
                </g>

                {/* 能量碗：碗里的每个紫色圆片是一个能量，旁边写数量 */}
                {p.power.map((n, k) => (
                    <g key={k} className="pboard-bowl">
                        <title>{`碗 ${["I", "II", "III"][k]}：${n} 个能量`}</title>
                        {tokenSpots(n).map((t, i) => (
                            <g key={i}>
                                <ellipse cx={BOWLS[k].x + t.x + 1.5} cy={BOWLS[k].y + t.y + 3} rx={11} ry={10} fill="rgba(0,0,0,.4)" />
                                <circle cx={BOWLS[k].x + t.x} cy={BOWLS[k].y + t.y} r={11} fill="#7B4DB0" stroke="#2A1540" strokeWidth={2} />
                            </g>
                        ))}
                        <text x={BOWLS[k].x} y={BOWLS[k].y + 74}>{n}</text>
                    </g>
                ))}

                {/* 还没建的建筑 */}
                {pieces.filter((x) => x.onBoard).map(({ b, pos, i }) => (
                    <g key={`${b}-${i}`}>
                        <title>{`${STRUCTURE_NAME[b]}：还剩 ${p.buildingsLeft[b]} 座`}</title>
                        <Piece type={b} color={color} x={pos.x} y={pos.y} scale={PIECE_SCALE[b]} />
                    </g>
                ))}
            </svg>

            {/* 板子下面一条：能力板块、供应区里的学者、还没用的桥 */}
            <div className="pboard-supply">
                <ul className="pboard-comps" aria-label="能力板块">
                    {p.competencies.map((c) => (
                        <li key={c}><Art kind="competency" id={c} alt={COMPETENCY_LABEL[c].text} /></li>
                    ))}
                </ul>
                <span className="pboard-pile" title={`供应区里的学者：${p.scholarsInSupply} 个`} aria-label={`供应区里的学者 ${p.scholarsInSupply} 个`}>
                    {Array.from({ length: p.scholarsInSupply }, (_, i) => <ScholarIcon key={i} color={color} size={30} />)}
                </span>
                <span className="pboard-pile" title={`还没用的桥：${p.bridges} 座`} aria-label={`还没用的桥 ${p.bridges} 座`}>
                    {Array.from({ length: p.bridges }, (_, i) => <BridgeIcon key={i} color={color} size={46} />)}
                </span>
            </div>
        </section>
    );
}

function xywh(r: { x: number; y: number; w: number; h: number }) {
    return { x: r.x, y: r.y, width: r.w, height: r.h };
}

/** n 个能量圆片在碗里的位置（相对碗心）：一行最多 5 个，从上往下摆，整体居中 */
function tokenSpots(n: number): { x: number; y: number }[] {
    const perRow = 5, step = 25;
    const rows = Math.ceil(n / perRow);
    return Array.from({ length: n }, (_, i) => {
        const row = Math.floor(i / perRow), inRow = Math.min(perRow, n - row * perRow);
        return { x: ((i % perRow) - (inRow - 1) / 2) * step, y: (row - (rows - 1) / 2) * step - 6 };
    });
}

/** 给读屏软件的一句话 */
function boardSummary(p: PlayerState): string {
    const left = (Object.keys(SLOTS) as BuildingType[]).map((b) => `${STRUCTURE_NAME[b]}剩 ${p.buildingsLeft[b]}`).join("，");
    return `${left}；能量碗 ${p.power.join(" / ")}；航行 ${p.sailing} 级，改造 ${p.terraforming} 级`;
}
