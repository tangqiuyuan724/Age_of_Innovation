import {
    TOOLS_PER_SPADE, neighbors,
    type GameState, type HexId, type MapGeometry, type Move, type Seat, type Terrain,
} from "@aoi/engine/aoi";
import { TERRAIN_COLOR, inkOn } from "./colors.ts";
import { describeBundle } from "./describe.ts";
import { reasonText, STRUCTURE_NAME, TERRAIN_NAME } from "./labels.ts";
import { boardLabels, hexPoints } from "./mapView.ts";
import { hexChoices, terraformSteps } from "./options.ts";

interface Props {
    geo: MapGeometry;
    state: GameState;
    hex: HexId;
    name: (seat: Seat) => string;
    /** 正在查看谁：改造预览按 TA 的家园地形算 */
    viewed: Seat;
    /** 现在由谁操作；只读预览时为 null */
    actor: Seat | null;
    send?: (move: Move) => void;
    onClose: () => void;
}

/** 一个小六边形色块，用在改造预览里 */
function Swatch({ terrain }: { terrain: Terrain }) {
    return (
        <svg width="28" height="30" viewBox="-15 -16 30 32" aria-hidden className="swatch">
            <polygon points={hexPoints(0, 0, 14)} fill={TERRAIN_COLOR[terrain]} stroke="var(--rule)" />
        </svg>
    );
}

/** 点地图上一个格子后弹出的小面板：格子信息、改造预览，以及现在能在这里做的事 */
export function HexPanel({ geo, state, hex, name, viewed, actor, send, onClose }: Props) {
    const labels = boardLabels(geo);
    const info = geo.byId[hex];
    const h = state.hexes[hex];
    const p = state.players[viewed];
    const near = neighbors(geo, hex).filter((id) => !geo.byId[id].river).map((id) => labels[id]);
    const choices = send && actor !== null ? hexChoices(state, actor, hex) : [];

    return (
        <section className="hexpanel" aria-label={`格子 ${labels[hex]}`}>
            <header>
                <p className="hexpanel-title">
                    {labels[hex]}
                    <small>引擎编号 {hex}</small>
                </p>
                <button type="button" className="hexpanel-close" onClick={onClose} aria-label="关闭">×</button>
            </header>

            <p>
                <span className="terrain-chip" style={{ background: TERRAIN_COLOR[h.terrain], color: inkOn(h.terrain) }}>
                    {TERRAIN_NAME[h.terrain]}
                </span>
                {h.terrain !== info.terrain && <span className="muted">（原来是{TERRAIN_NAME[info.terrain!]}）</span>}
                {h.structure
                    ? <span>　{name(h.structure.owner)}的{STRUCTURE_NAME[h.structure.type]}</span>
                    : <span className="muted">　空地</span>}
            </p>
            <p className="muted">相邻：{near.join("、")}</p>

            {/* 改造预览：从现在的地形开始，每多一铲变成什么，一直到正在查看的这位玩家的家园地形 */}
            {h.structure === null && p !== undefined && (
                <div className="steps">
                    <p className="muted">改造成{name(viewed)}的家园地形（{TERRAIN_NAME[p.homeTerrain]}）：</p>
                    <ol>
                        {terraformSteps(h.terrain, p.homeTerrain).map((t, i) => (
                            <li key={i}>
                                <Swatch terrain={t} />
                                <span>{i === 0 ? "现在" : `${i} 铲`}</span>
                                <span className="muted">{TERRAIN_NAME[t]}</span>
                            </li>
                        ))}
                    </ol>
                    <p className="muted">每铲 {TOOLS_PER_SPADE[p.terraforming]} 个工具（改造轨 {p.terraforming} 级）</p>
                </div>
            )}

            {choices.length > 0 && (
                <ul className="choices">
                    {choices.map((c) => (
                        <li key={c.label}>
                            <button
                                type="button"
                                disabled={c.error !== null}
                                title={c.error === null ? undefined : reasonText(c.error)}
                                onClick={() => send!(c.move)}
                            >
                                <span>{c.label}</span>
                                <small>{describeBundle(c.cost) === "无" ? "免费" : `付 ${describeBundle(c.cost)}`}</small>
                            </button>
                            {c.error !== null && <small className="choice-why">{reasonText(c.error)}</small>}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
