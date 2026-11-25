import {
    COMPETENCY_ROW_REWARD, DISCIPLINES,
    type CompetencyId, type GameState, type Move, type Seat,
} from "@aoi/engine/aoi";
import { TERRAIN_COLOR } from "./colors.ts";
import { assetUrl, reportMissing } from "./assets.ts";
import { COMPETENCY_LABEL, DISCIPLINE_NAME } from "./labels.ts";
import { Disc } from "./pieces.tsx";

// 展示板的图是 3282 × 4082 像素：上半部分放创新板块（M3 才用），下半部分是 4 列 × 3 行的能力板块。
// 现在只显示下半部分（从 y = 2490 往下），坐标都是在原图上量的
const W = 3282, H = 4082, TOP = 2490;
/** 每一列（一门学科）卡片的左右边，顺序和 DISCIPLINES 一样 */
const COLUMN = [[78, 769], [911, 1586], [1736, 2418], [2559, 3234]];
/** 每一行卡片的上下边。第 1 行拿到 +3 级，第 2 行 +2 级 +1 书，第 3 行 +1 级 +2 书 */
const ROW = [[2559, 2998], [3046, 3485], [3532, 3972]];
/** 能力板块的图是 260 × 251 */
const TILE_RATIO = 260 / 251;

interface Props {
    state: GameState;
    name: (seat: Seat) => string;
    /** 等这个人选能力板块：能选的那几张会亮，点一下就选 */
    choosing: { seat: Seat; id: string; options: CompetencyId[] } | null;
    send?: (move: Move) => void;
}

/** 能力板块展示区：每格摆着一叠板块，角上写还剩几张，下面是已经拿了这张的人 */
export function DisplayBoard({ state, name, choosing, send }: Props) {
    const { competencyGrid, competenciesLeft } = state.board;
    const bg = assetUrl("board", "display");
    return (
        <section className="display" aria-label="能力板块">
            <svg viewBox={`0 ${TOP} ${W} ${H - TOP}`} className="display-svg">
                <image href={bg} x={0} y={0} width={W} height={H} onError={() => reportMissing(bg)} />
                {DISCIPLINES.map((d, col) => competencyGrid[d].map((tile, row) => {
                    const [x1, x2] = COLUMN[col], [y1, y2] = ROW[row];
                    const h = (y2 - y1) * 0.9, w = h * TILE_RATIO;
                    const x = x1 + (x2 - x1) * 0.615 - w / 2, y = y1 + (y2 - y1) * 0.05;
                    const left = competenciesLeft[tile];
                    const reward = COMPETENCY_ROW_REWARD[row];
                    const text = `${COMPETENCY_LABEL[tile].text}。拿这一格：${DISCIPLINE_NAME[d]} +${reward.levels} 级${reward.books > 0 ? `、+${reward.books} 本书` : ""}。还剩 ${left} 张`;
                    const owners = state.players.filter((p) => p.competencies.includes(tile));
                    const can = choosing !== null && send !== undefined && choosing.options.includes(tile);
                    const url = assetUrl("competency", tile);
                    return (
                        <g
                            key={tile}
                            className={can ? "comp comp-can" : "comp"}
                            role={can ? "button" : undefined}
                            tabIndex={can ? 0 : undefined}
                            aria-label={can ? `选这张：${text}` : undefined}
                            onClick={can ? () => send!({ t: "decide", id: choosing!.id, choice: { kind: "competency", tile } }) : undefined}
                        >
                            <title>{text}</title>
                            {left > 0 && (
                                <>
                                    {/* 一叠板块：下面错开画两层边，看起来有厚度 */}
                                    {left > 1 && <rect x={x + 16} y={y + 14} width={w} height={h} rx={24} fill="#5C4A33" />}
                                    {left > 2 && <rect x={x + 8} y={y + 7} width={w} height={h} rx={24} fill="#8A7353" />}
                                    <image href={url} x={x} y={y} width={w} height={h} onError={() => reportMissing(url)} />
                                    <g className="comp-count">
                                        <circle cx={x + w - 10} cy={y + 22} r={58} />
                                        <text x={x + w - 10} y={y + 22}>{left}</text>
                                    </g>
                                </>
                            )}
                            {can && <rect className="comp-ring" x={x - 14} y={y - 14} width={w + 28} height={h + 28} rx={32} />}
                            {owners.map((p, k) => (
                                <g key={p.seat}>
                                    <title>{`${name(p.seat)}有这张`}</title>
                                    <Disc color={TERRAIN_COLOR[p.homeTerrain]} x={x2 - 6} y={y1 + 90 + k * 96} r={46} />
                                </g>
                            ))}
                        </g>
                    );
                }))}
            </svg>
        </section>
    );
}
