import { useState, type ReactNode } from "react";
import {
    DISCIPLINES, LAST_ROUND, PLANNING_DISPLAYS, bridgeOptions, validateMove,
    type ConversionId, type Decision, type DecisionChoice, type Discipline, type GameState, type HexId, type Move, type Seat,
} from "@aoi/engine/aoi";
import { BookStepper } from "./ActionRow.tsx";
import { describeBundle, describeDecision } from "./describe.ts";
import { CONVERSION_LABEL, DISCIPLINE_NAME, reasonText } from "./labels.ts";
import { passChoices, specialActionChoices } from "./options.ts";

interface Props {
    state: GameState;
    /** 现在由谁操作；只读预览时为 null */
    actor: Seat | null;
    name: (seat: Seat) => string;
    hexName: (id: HexId) => string;
    send?: (move: Move) => void;
    /** 正在选 pass 时拿哪块回合奖励板块 */
    passing: boolean;
    onPassing: (on: boolean) => void;
    /** 右边的按钮（撤销、结束试玩……） */
    tools?: ReactNode;
}

/**
 * 顶上的提示条：现在轮到谁、要做什么。轮到操作的人时变成金色，能点的按钮都在这一条上；
 * 地图格子、行动格、学者格、板块直接在桌面上点
 */
export function PromptBar({ state, actor, name, hexName, send, passing, onPassing, tools }: Props) {
    const d = state.pending[0];
    const turn = state.turn;
    const mine = send !== undefined && actor !== null && (d !== undefined ? d.seat === actor : turn?.seat === actor);

    let body: ReactNode;
    if (state.phase === "ended") {
        body = <p className="prompt-text">游戏结束</p>;
    } else if (d !== undefined) {
        const waiting = state.pending.length - 1;
        body = (
            <>
                <p className="prompt-text">
                    <strong>{name(d.seat)}</strong>
                    {mine ? "：" : " 正在决定："}{describeDecision(d, name)}
                    {waiting > 0 && <span className="prompt-queue">后面还有 {waiting} 个决定</span>}
                </p>
                {mine && <DecisionControls state={state} d={d} hexName={hexName} send={send!} />}
            </>
        );
    } else if (turn) {
        body = mine
            ? <MyTurn state={state} me={actor!} name={name} send={send!} passing={passing} onPassing={onPassing} />
            : <p className="prompt-text"><strong>{name(turn.seat)}</strong> 正在行动</p>;
    } else {
        body = <p className="prompt-text">等待下一步</p>;
    }

    return (
        <header className={mine ? "prompt prompt-mine" : "prompt"} aria-live="polite">
            <div className="prompt-body">{body}</div>
            <div className="prompt-tools">
                {tools}
                <a className="prompt-back" href="#">回大厅</a>
            </div>
        </header>
    );
}

/** 轮到自己、没有人在等决定时的提示和按钮 */
function MyTurn({ state, me, name, send, passing, onPassing }: {
    state: GameState; me: Seat; name: (seat: Seat) => string; send: (move: Move) => void;
    passing: boolean; onPassing: (on: boolean) => void;
}) {
    const p = state.players[me];
    const display = PLANNING_DISPLAYS[p.planning];
    const mainDone = state.turn!.mainActionDone;

    if (passing) {
        return (
            <>
                <p className="prompt-text"><strong>{name(me)}</strong>：在右边点一块回合奖励板块，带着它 pass（上面的金币一起拿走）</p>
                <span className="prompt-buttons"><button type="button" className="btn" onClick={() => onPassing(false)}>取消</button></span>
            </>
        );
    }
    if (mainDone) {
        return (
            <>
                <p className="prompt-text"><strong>{name(me)}</strong>：主行动做完了。还可以做自由行动，然后结束回合</p>
                <span className="prompt-buttons">
                    <FreeActions state={state} me={me} send={send} />
                    <MoveButton state={state} me={me} send={send} move={{ t: "endTurn" }} label="结束回合" primary />
                </span>
            </>
        );
    }
    // 最后一轮 pass 不拿板块，直接一个按钮；其他轮先进入"选板块"
    const lastRound = state.round === LAST_ROUND;
    const pass = lastRound ? passChoices(state, me)[0] : null;
    return (
        <>
            <p className="prompt-text"><strong>{name(me)}</strong>：做一个主行动<span className="prompt-hint">点地图格子、行动格、学者格，或者</span></p>
            <span className="prompt-buttons">
                <MoveButton state={state} me={me} send={send} move={{ t: "advanceTrack", track: "sailing" }} label="推进航行轨" hint={`付 ${describeBundle(display.sailingCost)}`} />
                <MoveButton state={state} me={me} send={send} move={{ t: "advanceTrack", track: "terraforming" }} label="推进改造轨" hint={`付 ${describeBundle(display.terraformingCost)}`} />
                {specialActionChoices(state, me).map((c) => (
                    <MoveButton key={c.label} state={state} me={me} send={send} move={c.move} label="特殊行动" hint={c.label} />
                ))}
                {pass ? (
                    <button type="button" className="btn" disabled={pass.error !== null} title={pass.error === null ? "最后一轮，不拿板块" : reasonText(pass.error)} onClick={() => send(pass.move)}>pass</button>
                ) : (
                    <button type="button" className="btn" title="这一轮不再行动：在右边选一块回合奖励板块" onClick={() => onPassing(true)}>pass…</button>
                )}
                <FreeActions state={state} me={me} send={send} />
            </span>
        </>
    );
}

/** 第一个决定的选择按钮。地图、学科板、板块上能点的，这里只给提示 */
function DecisionControls({ state, d, hexName, send }: {
    state: GameState; d: Decision; hexName: (id: HexId) => string; send: (move: Move) => void;
}) {
    /** 一个选项按钮：先问引擎这个回应行不行，不行就变灰，鼠标悬停显示原因 */
    const option = (key: string, choice: DecisionChoice, label: ReactNode, primary = false) => {
        const move: Move = { t: "decide", id: d.id, choice };
        const error = validateMove(state, d.seat, move);
        return (
            <button key={key} type="button" className={primary ? "btn btn-primary" : "btn"} disabled={error !== null} title={error === null ? undefined : reasonText(error)} onClick={() => send(move)}>
                {label}
            </button>
        );
    };
    const hint = (text: string) => <span className="prompt-hint">{text}</span>;

    switch (d.kind) {
        case "leech":
            return <span className="prompt-buttons">{option("yes", { kind: "leech", accept: true }, "接受", true)}{option("no", { kind: "leech", accept: false }, "不要")}</span>;
        case "scienceLevels":
            return <span className="prompt-buttons">{hint("在学科板上点一条轨道")}{option("skip", { kind: "scienceLevels", skip: true }, "放弃")}</span>;
        case "bookColor":
            return <BookColorPicker key={d.id} count={d.count} onDone={(books) => send({ t: "decide", id: d.id, choice: { kind: "bookColor", books } })} />;
        case "competency":
            return <span className="prompt-buttons">{hint("在右边的能力板块里点一张亮起来的")}</span>;
        case "palaceTile":
            return <span className="prompt-buttons">{hint("在右边点一块宫殿板块")}</span>;
        case "cityTile":
            return <span className="prompt-buttons">{hint("在右边点一种城市板块")}</span>;
        case "initialWorkshop":
            return <span className="prompt-buttons">{hint("在地图上点一个金框格子")}</span>;
        case "spades":
            return <span className="prompt-buttons">{hint(`在地图上点一个金框格子${d.canBuild ? "，可以顺带建工坊" : ""}`)}{option("skip", { kind: "spades", skip: true }, "放弃")}</span>;
        case "bridge": {
            // 能架的桥一般没几座，直接列成按钮；也可以在地图上点桥的一头
            const options = bridgeOptions(state, d.seat);
            return (
                <span className="prompt-buttons">
                    {options.length === 0 && hint("没有能架桥的地方，只能放弃")}
                    {options.map((o) => option(`${o.a}-${o.b}`, { kind: "bridge", a: o.a, b: o.b }, `${hexName(o.a)}—${hexName(o.b)}`))}
                    {option("skip", { kind: "bridge", skip: true }, "放弃建桥")}
                </span>
            );
        }
        case "pickSet":
        case "draftPick":
            return <span className="prompt-buttons">{hint("在地图下面选")}</span>;
        default: {
            const unhandled: never = d;
            return unhandled;
        }
    }
}

/** 选书的颜色：每种颜色加减，加起来等于 count 本才能确定 */
function BookColorPicker({ count, onDone }: { count: number; onDone: (books: Partial<Record<Discipline, number>>) => void }) {
    const [books, setBooks] = useState<Record<Discipline, number>>({ banking: 0, law: 0, engineering: 0, medicine: 0 });
    const total = DISCIPLINES.reduce((sum, x) => sum + books[x], 0);
    return (
        <span className="prompt-buttons">
            <BookStepper books={books} max={(x) => books[x] + count - total} onChange={(x, by) => setBooks({ ...books, [x]: books[x] + by })} />
            {/* 只把选了的颜色发出去，日志里就不会出现"0 本银行书" */}
            <button type="button" className="btn btn-primary" disabled={total !== count}
                onClick={() => onDone(Object.fromEntries(DISCIPLINES.filter((x) => books[x] > 0).map((x) => [x, books[x]])))}>
                确定（{total} / {count}）
            </button>
        </span>
    );
}

interface MoveButtonProps {
    state: GameState;
    me: Seat;
    send: (move: Move) => void;
    move: Move;
    label: string;
    hint?: string;
    primary?: boolean;
}

/** 一个"问过引擎"的按钮：不能做时变灰，鼠标悬停显示原因 */
function MoveButton({ state, me, send, move, label, hint, primary = false }: MoveButtonProps) {
    const error = validateMove(state, me, move);
    return (
        <button type="button" className={primary ? "btn btn-primary" : "btn"} disabled={error !== null} title={error === null ? hint : reasonText(error)} onClick={() => send(move)}>
            {label}{hint && <small>{hint}</small>}
        </button>
    );
}

const CONVERSIONS = Object.keys(CONVERSION_LABEL) as ConversionId[];

/** 自由行动：资源转换、牺牲能量。点"转换"弹出一个小面板 */
function FreeActions({ state, me, send }: { state: GameState; me: Seat; send: (move: Move) => void }) {
    const [open, setOpen] = useState(false);
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
        <span className="free">
            <button type="button" className="btn" aria-expanded={open} onClick={() => setOpen(!open)}>转换 / 牺牲能量</button>
            {open && (
                <div className="popover free-panel" role="dialog" aria-label="自由行动">
                    <p className="free-row">
                        <select value={conversion} onChange={(e) => setConversion(e.target.value as ConversionId)} aria-label="转换哪一种">
                            {CONVERSIONS.map((c) => <option key={c} value={c}>{CONVERSION_LABEL[c]}</option>)}
                        </select>
                        {needsColor && (
                            <select value={color} onChange={(e) => setColor(e.target.value as Discipline)} aria-label="书的颜色">
                                {DISCIPLINES.map((x) => <option key={x} value={x}>{DISCIPLINE_NAME[x]}书</option>)}
                            </select>
                        )}
                        <input type="number" min={1} max={20} value={times} onChange={(e) => setTimes(Number(e.target.value))} aria-label="转换几次" title="转换几次" />
                        <button type="button" className="btn btn-primary" disabled={convertError !== null} title={convertError ? reasonText(convertError) : undefined} onClick={() => send(convertMove)}>转换</button>
                    </p>
                    <p className="free-row">
                        <span title="牺牲 1 次：碗 II 里拿 2 个能量，一个移出游戏，一个放进碗 III">牺牲能量</span>
                        <input type="number" min={1} max={12} value={sacrifice} onChange={(e) => setSacrifice(Number(e.target.value))} aria-label="牺牲几次" title="牺牲几次" />
                        <span>次</span>
                        <button type="button" className="btn btn-primary" disabled={sacrificeError !== null} title={sacrificeError ? reasonText(sacrificeError) : undefined} onClick={() => send(sacrificeMove)}>牺牲</button>
                    </p>
                    {(convertError || sacrificeError) && (
                        <p className="muted">{convertError ? `转换：${reasonText(convertError)}` : ""}{convertError && sacrificeError ? "；" : ""}{sacrificeError ? `牺牲：${reasonText(sacrificeError)}` : ""}</p>
                    )}
                </div>
            )}
        </span>
    );
}
