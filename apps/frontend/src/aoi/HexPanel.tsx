import {
    TOOLS_PER_SPADE, neighbors,
    type GameState, type HexId, type MapGeometry, type Move, type Seat,
} from "@aoi/engine/aoi";
import { describeBundle } from "./describe.ts";
import { reasonText, STRUCTURE_NAME, TERRAIN_NAME } from "./labels.ts";
import { BOARD, boardLabels, hexCenter } from "./mapView.ts";
import { hexChoices, terraformSteps } from "./options.ts";
import { Art } from "./pieces.tsx";

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

/**
 * 点地图上一个格子后，在格子旁边弹出的小卡片：格子信息、改造预览，以及现在能在这里做的事。
 * 卡片放在格子右边；格子太靠右时放在左边，免得超出地图
 */
export function HexPanel({ geo, state, hex, name, viewed, actor, send, onClose }: Props) {
    const labels = boardLabels(geo);
    const info = geo.byId[hex];
    const h = state.hexes[hex];
    const p = state.players[viewed];
    const near = neighbors(geo, hex).filter((id) => !geo.byId[id].river).map((id) => labels[id]);
    const choices = send && actor !== null ? hexChoices(state, actor, hex, (id) => labels[id] ?? id) : [];

    // 格子中心在地图上的位置（百分比），卡片跟着它走
    const c = hexCenter(info.row, info.col);
    const left = ((c.x - BOARD.x) / BOARD.w) * 100;
    const top = ((c.y - BOARD.y) / BOARD.h) * 100;
    const onRight = left < 58;
    // 上下方向：格子靠上时卡片往下长，靠下时往上长，免得被页面顶上的提示条或地图底边挡住
    const shiftY = top < 35 ? -12 : top > 65 ? -88 : -50;

    return (
        <section
            className={onRight ? "hexpanel hexpanel-right" : "hexpanel hexpanel-left"}
            style={{ left: `${left}%`, top: `${top}%`, transform: `translate(${onRight ? 0 : -100}%, ${shiftY}%)` }}
            aria-label={`格子 ${labels[hex]}`}
        >
            <header>
                <Art kind="terrain" id={h.terrain} alt={TERRAIN_NAME[h.terrain]} className="hexpanel-terrain" />
                <p className="hexpanel-title">
                    {labels[hex]}　{TERRAIN_NAME[h.terrain]}
                    {h.terrain !== info.terrain && <small>原来是{TERRAIN_NAME[info.terrain!]}</small>}
                </p>
                <button type="button" className="hexpanel-close" onClick={onClose} aria-label="关闭">×</button>
            </header>

            <p className="hexpanel-line">
                {h.structure ? `${name(h.structure.owner)}的${STRUCTURE_NAME[h.structure.type]}` : "空地"}
                <span className="muted">　相邻 {near.join(" ")}</span>
            </p>

            {/* 改造预览：从现在的地形开始，每多一铲变成什么，一直到正在查看的这位玩家的家园地形 */}
            {h.structure === null && p !== undefined && h.terrain !== p.homeTerrain && (
                <div className="steps" aria-label={`改造成${name(viewed)}的家园地形`}>
                    <ol>
                        {terraformSteps(h.terrain, p.homeTerrain).map((t, i) => (
                            <li key={i}>
                                <Art kind="terrain" id={t} alt={TERRAIN_NAME[t]} className="steps-hex" />
                                <span>{i === 0 ? "现在" : `${i} 铲`}</span>
                            </li>
                        ))}
                    </ol>
                    <p className="muted">每铲 {TOOLS_PER_SPADE[p.terraforming]} 个工具（{name(viewed)}的改造轨 {p.terraforming} 级）</p>
                </div>
            )}

            {choices.length > 0 && (
                <ul className="choices">
                    {choices.map((ch) => (
                        <li key={ch.label}>
                            <button
                                type="button"
                                disabled={ch.error !== null}
                                title={ch.error === null ? undefined : reasonText(ch.error)}
                                onClick={() => send!(ch.move)}
                            >
                                <span>{ch.label}</span>
                                <small>{describeBundle(ch.cost) === "无" ? "免费" : `付 ${describeBundle(ch.cost)}`}</small>
                            </button>
                            {ch.error !== null && <small className="choice-why">{reasonText(ch.error)}</small>}
                        </li>
                    ))}
                </ul>
            )}
            <p className="muted hexpanel-id">引擎编号 {hex}</p>
        </section>
    );
}
