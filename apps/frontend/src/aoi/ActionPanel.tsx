import { useMemo, useState } from "react";
import {
    DISCIPLINES, PLANNING_DISPLAYS, validateMove,
    type ConversionId, type Discipline, type GameState, type MapGeometry, type Move, type Seat,
} from "@aoi/engine/aoi";
import { describeBundle } from "./describe.ts";
import { CONVERSION_LABEL, DISCIPLINE_NAME, reasonText } from "./labels.ts";
import type { ReachableHex } from "./mapView.ts";
import { actionSummary, asIfActive, type SummaryLine } from "./options.ts";

interface Props {
    state: GameState;
    geo: MapGeometry;
    /** 现在由谁操作；只读预览时是"我"的座位 */
    me: Seat;
    viewed: Seat;
    name: (seat: Seat) => string;
    reach: ReachableHex[];
    /** 发指令。没有就是只读预览 */
    send?: (move: Move) => void;
    onBack: () => void;
}

/** 玩家板右边的行动区。操作的人看到按钮；看别人时是只读的"假如现在轮到 TA，TA 能做什么" */
export function ActionPanel({ state, geo, me, viewed, name, reach, send, onBack }: Props) {
    // "假如现在轮到 TA"的局面，以及在这个局面下每类主行动能不能做。只在局面或查看的人变了时重算
    const summary = useMemo(() => {
        const s = asIfActive(state, viewed);
        return s === null ? [] : actionSummary(s, geo, viewed);
    }, [state, geo, viewed]);

    if (state.players[viewed] === undefined) return null;
    const direct = reach.filter((r) => r.spades === 0).length;

    if (viewed !== me || send === undefined) {
        const who = viewed === me ? "你" : name(viewed);
        return (
            <section className="act act-readonly" aria-label={`${who}能做什么`}>
                <p className="act-title" title="假装现在轮到这位玩家、还没做主行动，按 TA 手上的资源，每类行动问一下引擎">
                    假如现在轮到{who}，能做什么
                    {send === undefined && <span className="act-tag">只读预览</span>}
                </p>
                <Summary lines={summary} />
                <p className="act-line">
                    能到达的空格 <span className="num">{reach.length}</span> 个（地图上的虚线框），其中 <span className="num">{direct}</span> 个不用改造
                    {viewed !== me && <button type="button" className="act-back" onClick={onBack}>回到操作的人</button>}
                </p>
            </section>
        );
    }

    return <MyActions state={state} me={me} name={name} send={send} summary={summary} />;
}

function Summary({ lines }: { lines: SummaryLine[] }) {
    return (
        <ul className="summary">
            {lines.map((l) => (
                <li key={l.label} className={l.ok ? "summary-ok" : "summary-no"}>
                    <span className="summary-mark" aria-hidden>{l.ok ? "✓" : "—"}</span>
                    <span className="summary-label">{l.label}</span>
                    <span className="summary-detail">{l.detail}</span>
                </li>
            ))}
        </ul>
    );
}

interface MyProps {
    state: GameState;
    me: Seat;
    name: (seat: Seat) => string;
    send: (move: Move) => void;
    summary: SummaryLine[];
}

/** 操作的人的按钮。每个按钮能不能点，都是先问引擎 validateMove */
function MyActions({ state, me, name, send, summary }: MyProps) {
    const p = state.players[me];
    const display = PLANNING_DISPLAYS[p.planning];
    const myTurn = state.turn?.seat === me;
    const deciding = state.pending.length > 0;
    const mainDone = state.turn?.mainActionDone ?? false;

    const title = deciding
        ? (state.pending[0].seat === me ? "先回应地图上方的决定" : `等 ${name(state.pending[0].seat)} 决定`)
        : !myTurn ? "现在没有人行动"
            : mainDone ? "主行动做完了，可以结束回合了"
                : "做一个主行动";
    // actionSummary 的前两行是"改造并建造""升级建筑"，这里压成一句提示
    const [build, upgrade] = summary;
    const later = summary.find((l) => l.label === "其他行动");

    return (
        <section className="act" aria-label={`${name(me)}的行动`}>
            <p className="act-title">{name(me)}：{title}</p>

            {myTurn && !deciding && !mainDone && build && (
                <p className="act-line">
                    点地图上的格子改造、建造、升级（{build.detail}；{upgrade.detail}）。
                    派学者点右边学科下面的学者格。{later && `${later.detail}。`}
                </p>
            )}

            {myTurn && !deciding && (
                <>
                    <div className="act-group">
                        {!mainDone && (
                            <>
                                <MoveButton state={state} me={me} send={send} move={{ t: "advanceTrack", track: "sailing" }} label="推进航行轨" hint={`付 ${describeBundle(display.sailingCost)}`} />
                                <MoveButton state={state} me={me} send={send} move={{ t: "advanceTrack", track: "terraforming" }} label="推进改造轨" hint={`付 ${describeBundle(display.terraformingCost)}`} />
                            </>
                        )}
                        <MoveButton state={state} me={me} send={send} move={{ t: "endTurn" }} label="结束回合" primary />
                    </div>
                    <FreeActions state={state} me={me} send={send} />
                </>
            )}
        </section>
    );
}

interface MoveButtonProps {
    state: GameState;
    me: Seat;
    send: (move: Move) => void;
    move: Move;
    label: string;
    hint?: string;
    /** 主要按钮（结束回合）：深色，靠右 */
    primary?: boolean;
}

/** 一个"问过引擎"的按钮：不能做时变灰，鼠标悬停显示原因 */
function MoveButton({ state, me, send, move, label, hint, primary = false }: MoveButtonProps) {
    const error = validateMove(state, me, move);
    return (
        <button
            type="button"
            className={primary ? "primary" : undefined}
            disabled={error !== null}
            title={error === null ? hint : reasonText(error)}
            onClick={() => send(move)}
        >
            {label}{hint && <small>{hint}</small>}
        </button>
    );
}

const CONVERSIONS = Object.keys(CONVERSION_LABEL) as ConversionId[];

/** 自由行动：资源转换、牺牲能量。选好再点"执行" */
function FreeActions({ state, me, send }: { state: GameState; me: Seat; send: (move: Move) => void }) {
    const [conversion, setConversion] = useState<ConversionId>("power1ToCoin");
    const [times, setTimes] = useState(1);
    const [color, setColor] = useState<Discipline>("banking");
    const [sacrifice, setSacrifice] = useState(1);

    const needsColor = conversion === "power5ToBook" || conversion === "bookToCoin";
    const convertMove: Move = { t: "convert", conversion, times, ...(needsColor ? { color } : {}) };
    const convertError = validateMove(state, me, convertMove);
    const sacrificeMove: Move = { t: "sacrificePower", times: sacrifice };
    const sacrificeError = validateMove(state, me, sacrificeMove);

    return (
        <div className="free">
            {/* 每一组包在一个 span 里：宽度不够时整组换行，不会把输入框和按钮拆开 */}
            <span className="free-item">
                <span className="act-label">转换</span>
                <select value={conversion} onChange={(e) => setConversion(e.target.value as ConversionId)} aria-label="转换哪一种">
                    {CONVERSIONS.map((c) => <option key={c} value={c}>{CONVERSION_LABEL[c]}</option>)}
                </select>
                {needsColor && (
                    <select value={color} onChange={(e) => setColor(e.target.value as Discipline)} aria-label="书的颜色">
                        {DISCIPLINES.map((d) => <option key={d} value={d}>{DISCIPLINE_NAME[d]}书</option>)}
                    </select>
                )}
                <input type="number" min={1} max={20} value={times} onChange={(e) => setTimes(Number(e.target.value))} aria-label="转换几次" title="转换几次" />
                <button type="button" disabled={convertError !== null} title={convertError ? reasonText(convertError) : undefined} onClick={() => send(convertMove)}>
                    执行
                </button>
            </span>
            <span className="free-item">
                <span className="act-label" title="牺牲 1 次：碗 II 里拿 2 个能量，一个移出游戏，一个放进碗 III">牺牲能量</span>
                <input type="number" min={1} max={12} value={sacrifice} onChange={(e) => setSacrifice(Number(e.target.value))} aria-label="牺牲几次" title="牺牲几次" />
                <button type="button" disabled={sacrificeError !== null} title={sacrificeError ? reasonText(sacrificeError) : undefined} onClick={() => send(sacrificeMove)}>
                    执行
                </button>
            </span>
        </div>
    );
}
