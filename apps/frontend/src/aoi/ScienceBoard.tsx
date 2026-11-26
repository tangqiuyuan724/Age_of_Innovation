import {
    DISCIPLINES, SCHOLAR_SPACE_LEVELS, validateMove,
    type Discipline, type GameState, type Move, type Seat,
} from "@aoi/engine/aoi";
import { TERRAIN_COLOR } from "./colors.ts";
import { DISCIPLINE_NAME, reasonText } from "./labels.ts";
import { scholarChoices } from "./options.ts";
import "./boards.css";
import { Art, Disc, Scholar } from "./pieces.tsx";

// 学科板的贴图是 616 × 968 像素。下面的坐标都是在这张图上量出来的（单位：像素），
// 叠在图上的 SVG 用同样的坐标系（viewBox），所以图怎么缩放，棋子都摆在对的地方。
const W = 616, H = 968;
/** 4 座塔的中线 x，顺序和 DISCIPLINES 一样：银行、法律、工程、医学 */
const COLUMN_X = [95, 233, 371, 508];
/** 每一级格子的中间 y（第 0 级在最下面；第 12 级是塔顶的圆章）。8~11 级的格子矮一些 */
const LEVEL_Y = [749, 694, 644, 581, 531, 467, 417, 352, 292, 249, 206, 162, 75];
/** 学者格：每门学科 4 格，上排"3 级""2 级"，下排两个"2 级"。相对中线左右各 30 像素 */
const SPACE_DX = [-30, 30, -30, 30];
const SPACE_Y = [815, 815, 899, 899];
const DISC_R = 14.5;

interface Props {
    state: GameState;
    name: (seat: Seat) => string;
    /** 能派学者的人（轮到 TA、还没做主行动）；不能时为 null */
    actor: Seat | null;
    /** 等这个人选"哪门学科前进"（scienceLevels 决定）；没有时为 null */
    choosingLevels: { seat: Seat; id: string } | null;
    send?: (move: Move) => void;
}

/** 学科板：4 条轨道上摆着每个人的标记，下面是学者格。能派学者时空格子会亮，点一下就派 */
export function ScienceBoard({ state, name, actor, choosingLevels, send }: Props) {
    const color = (seat: Seat) => TERRAIN_COLOR[state.players[seat].homeTerrain];
    const choices = (d: Discipline) => {
        const all = actor !== null && send ? scholarChoices(state, actor, d) : [];
        return all.some((c) => c.error === null) ? all : [];
    };

    return (
        <section className="science" aria-label="学科板">
            <Art kind="board" id="science" alt="学科板：银行、法律、工程、医学 4 条轨道" />
            <svg className="science-overlay" viewBox={`0 0 ${W} ${H}`} aria-hidden={actor === null && choosingLevels === null}>
                {DISCIPLINES.map((d, col) => {
                    const cx = COLUMN_X[col];
                    const here = (level: number) => state.players.filter((p) => p.science[d] === level);
                    const list = choices(d);
                    const levelsMove: Move | null = choosingLevels && send
                        ? { t: "decide", id: choosingLevels.id, choice: { kind: "scienceLevels", discipline: d } }
                        : null;
                    const levelsError = levelsMove ? validateMove(state, choosingLevels!.seat, levelsMove) : null;
                    return (
                        <g key={d}>
                            {/* 选"哪门学科前进"时，整条轨道是一个按钮 */}
                            {levelsMove && (
                                <rect
                                    className={levelsError === null ? "science-pick" : "science-pick science-pick-no"}
                                    x={cx - 66} y={15} width={132} height={760} rx={16}
                                    role="button" tabIndex={0}
                                    aria-label={`${DISCIPLINE_NAME[d]}前进`}
                                    onClick={() => levelsError === null && send!(levelsMove)}
                                >
                                    <title>{levelsError === null ? `选${DISCIPLINE_NAME[d]}` : reasonText(levelsError)}</title>
                                </rect>
                            )}

                            {/* 每一级上的标记：同一级的人挤在一起，一行最多 3 个 */}
                            {LEVEL_Y.map((y, level) => {
                                const players = here(level);
                                // 标记摆在格子里印的数字右边；同一级的人挤在一起
                                const x0 = level === 12 ? cx : cx + 11;
                                return players.map((p, k) => {
                                    const row = Math.floor(k / 3), inRow = Math.min(3, players.length - row * 3);
                                    const x = x0 + ((k % 3) - (inRow - 1) / 2) * 25;
                                    return (
                                        <g key={p.seat}>
                                            <title>{`${name(p.seat)}：${DISCIPLINE_NAME[d]} ${level} 级`}</title>
                                            <Disc color={color(p.seat)} x={x} y={y - 3 + row * 15.5} r={DISC_R} />
                                        </g>
                                    );
                                });
                            })}

                            {/* 学者格 */}
                            {state.board.scholarSpaces[d].map((seat, k) => {
                                const x = cx + SPACE_DX[k], y = SPACE_Y[k];
                                if (seat !== null) {
                                    return (
                                        <g key={k}>
                                            <title>{`${name(seat)}的学者（${DISCIPLINE_NAME[d]}第 ${k + 1} 格）`}</title>
                                            <Scholar color={color(seat)} x={x} y={y + 16} h={40} />
                                        </g>
                                    );
                                }
                                const c = list[k];
                                if (c === undefined) return null;
                                return (
                                    <rect
                                        key={k}
                                        className={c.error === null ? "science-space" : "science-space science-space-no"}
                                        x={x - 21} y={y - 25} width={42} height={50} rx={4}
                                        role="button" tabIndex={0}
                                        aria-label={`派学者到${DISCIPLINE_NAME[d]}第 ${k + 1} 格，前进 ${SCHOLAR_SPACE_LEVELS[k]} 级`}
                                        onClick={() => c.error === null && send!(c.move)}
                                    >
                                        <title>{c.error === null ? `派学者到这里：${DISCIPLINE_NAME[d]}前进 ${SCHOLAR_SPACE_LEVELS[k]} 级` : reasonText(c.error)}</title>
                                    </rect>
                                );
                            })}
                        </g>
                    );
                })}
            </svg>
            {/* 学者退回供应区：每门学科一个小按钮，只在能做时出现 */}
            {DISCIPLINES.some((d) => choices(d).at(-1)?.error === null) && (
                <p className="science-return">
                    {DISCIPLINES.map((d) => {
                        const ret = choices(d).at(-1);
                        return ret && ret.error === null ? (
                            <button key={d} type="button" className="btn btn-small" title={`学者退回供应区，${DISCIPLINE_NAME[d]}前进 1 级`} onClick={() => send!(ret.move)}>
                                退回 +1
                            </button>
                        ) : <span key={d} />;
                    })}
                </p>
            )}
        </section>
    );
}
