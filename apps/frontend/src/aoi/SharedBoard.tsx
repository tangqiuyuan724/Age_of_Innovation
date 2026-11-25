import { useEffect, useState } from "react";
import {
    BOOK_ACTION_COST, DISCIPLINES, POWER_ACTION_COST, SCIENCE_KEY_THRESHOLD, SCIENCE_MAX,
    type Discipline, type GameState, type Move, type PowerActionId, type Seat,
} from "@aoi/engine/aoi";
import { DISCIPLINE_COLOR, TERRAIN_COLOR } from "./colors.ts";
import type { Namer } from "./describe.ts";
import { GameLog, type LogEntry } from "./GameLog.tsx";
import { BookIcon, KeyIcon } from "./icons.tsx";
import { BOOK_ACTION_LABEL, DISCIPLINE_NAME, POWER_ACTION_LABEL, reasonText } from "./labels.ts";
import { scholarChoices } from "./options.ts";
import { TilesPanel } from "./TilesPanel.tsx";
import { TileImage } from "./TileImage.tsx";

const POWER_ACTIONS: PowerActionId[] = ["bridge", "scholar", "tools2", "coins7", "spade1", "spade2"];
/** 学科轨道从上往下画：12, 11, …, 0 */
const LEVELS = Array.from({ length: SCIENCE_MAX + 1 }, (_, i) => SCIENCE_MAX - i);

type Tab = "board" | "tiles" | "log";

interface Props {
    state: GameState;
    namer: Namer;
    actor: Seat | null;
    send?: (move: Move) => void;
    /** 日志。只读预览没有日志，就不显示这一栏 */
    log?: LogEntry[];
}

/** 右侧一栏，分三页：公共版图（学科、能量行动、书本行动）、板块、日志 */
export function SharedBoard({ state, namer, actor, send, log }: Props) {
    const [tab, setTab] = useState<Tab>("board");

    // 轮到某人选能力板块、宫殿板块时，自动翻到"板块"这一页，能直接在展示区里点
    const d = state.pending[0];
    const tilesDecision = d !== undefined && d.seat === actor && (d.kind === "competency" || d.kind === "palaceTile") ? d.id : null;
    useEffect(() => {
        if (tilesDecision !== null) setTab("tiles");
    }, [tilesDecision]);

    const tabs: [Tab, string][] = [["board", "公共版图"], ["tiles", "板块"]];
    if (log) tabs.push(["log", `日志（${log.length}）`]);

    return (
        <aside className="shared" aria-label="公共版图">
            <div className="tabs" role="tablist">
                {tabs.map(([id, label]) => (
                    <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "tab tab-on" : "tab"} onClick={() => setTab(id)}>
                        {label}
                    </button>
                ))}
            </div>
            {tab === "board" && <BoardTab state={state} name={namer.name} actor={actor} send={send} />}
            {tab === "tiles" && <TilesPanel state={state} actor={actor} name={namer.name} send={send} />}
            {tab === "log" && log && <GameLog entries={log} state={state} namer={namer} />}
        </aside>
    );
}

interface BoardTabProps {
    state: GameState;
    name: (seat: Seat) => string;
    actor: Seat | null;
    send?: (move: Move) => void;
}

/** 公共版图：学科轨道、学者格、能量行动、书本行动。操作的人可以直接点学者格派学者 */
function BoardTab({ state, name, actor, send }: BoardTabProps) {
    const { board, players } = state;
    const color = (seat: Seat) => TERRAIN_COLOR[players[seat].homeTerrain];
    // 轮到操作的人、还没做主行动时，学者格变成按钮（能不能点再问引擎）；其他时候学者格只是显示
    const canAct = send !== undefined && actor !== null && state.turn?.seat === actor
        && !state.turn.mainActionDone && state.pending.length === 0;

    return (
        <>
            <section>
                <h3>学科</h3>
                <div className="sci">
                    <ol className="sci-axis" aria-hidden>
                        {LEVELS.map((lv) => (
                            <li key={lv} className={lv === SCIENCE_KEY_THRESHOLD ? "sci-key-row" : ""}>
                                {lv === SCIENCE_KEY_THRESHOLD + 1 ? <KeyIcon /> : lv % 2 === 0 ? lv : ""}
                            </li>
                        ))}
                    </ol>
                    {DISCIPLINES.map((d) => (
                        <div key={d} className="sci-track" style={{ ["--d" as string]: DISCIPLINE_COLOR[d] }}>
                            <p className="sci-name">{DISCIPLINE_NAME[d]}</p>
                            <ol aria-label={`${DISCIPLINE_NAME[d]}轨道`}>
                                {LEVELS.map((lv) => {
                                    const here = players.filter((p) => p.science[d] === lv);
                                    return (
                                        <li key={lv} className={lv === SCIENCE_KEY_THRESHOLD ? "sci-key-row" : ""}>
                                            {here.map((p) => (
                                                <span
                                                    key={p.seat}
                                                    className="marker"
                                                    style={{ background: color(p.seat) }}
                                                    title={`${name(p.seat)}：${lv} 级`}
                                                />
                                            ))}
                                        </li>
                                    );
                                })}
                            </ol>
                            <ScholarSpaces state={state} discipline={d} name={name} color={color} actor={canAct ? actor : null} send={send} />
                        </div>
                    ))}
                </div>
                <p className="shared-note">
                    超过 {SCIENCE_KEY_THRESHOLD} 级要用钥匙；12 级每门学科只能有一人。
                    下面一排是学者格：第 1 格 +3 级，其余 +2 级{canAct ? "，轮到你时点空格就能派学者" : ""}。
                </p>
            </section>

            <section>
                <h3>能量行动</h3>
                <ul className="tiles tiles-3">
                    {POWER_ACTIONS.map((id) => {
                        const used = board.powerActionsUsed.includes(id);
                        return (
                            <li key={id} className={used ? "tile tile-used" : "tile"}>
                                <span className="cost-power num" aria-label={`花 ${POWER_ACTION_COST[id]} 能量`}>{POWER_ACTION_COST[id]}</span>
                                <span className="tile-text">{POWER_ACTION_LABEL[id]}</span>
                                {used && <span className="tile-stamp">本轮已用</span>}
                            </li>
                        );
                    })}
                </ul>
            </section>

            <section>
                <h3>书本行动</h3>
                <ul className="tiles tiles-3">
                    {board.bookActions.map((id) => {
                        const used = board.bookActionsUsed.includes(id);
                        return (
                            <li key={id} className={used ? "tile tile-used tile-pic" : "tile tile-pic"}>
                                <TileImage
                                    kind="bookAction" id={id} alt={`${BOOK_ACTION_COST[id]} 本书：${BOOK_ACTION_LABEL[id]}`}
                                    fallback={
                                        <>
                                            <span className="cost-book" aria-label={`花 ${BOOK_ACTION_COST[id]} 本书`}>
                                                <BookIcon color="#8C9396" /><span className="num">{BOOK_ACTION_COST[id]}</span>
                                            </span>
                                            <span className="tile-text">{BOOK_ACTION_LABEL[id]}</span>
                                        </>
                                    }
                                />
                                {used && <span className="tile-stamp">本轮已用</span>}
                            </li>
                        );
                    })}
                </ul>
            </section>
        </>
    );
}

interface ScholarSpacesProps {
    state: GameState;
    discipline: Discipline;
    name: (seat: Seat) => string;
    color: (seat: Seat) => string;
    /** 能操作的人；只读时为 null */
    actor: Seat | null;
    send?: (move: Move) => void;
}

/** 一门学科下面的 4 个学者格，再加一个"退回"。能派学者时，空格子变成按钮 */
function ScholarSpaces({ state, discipline, name, color, actor, send }: ScholarSpacesProps) {
    const spaces = state.board.scholarSpaces[discipline];
    // 引擎说一个都派不了（比如手上没有学者），就只显示，不变成按钮
    const all = actor === null ? [] : scholarChoices(state, actor, discipline);
    const choices = all.some((c) => c.error === null) ? all : [];
    const ret = choices[choices.length - 1];   // 最后一个是"退回供应区"
    return (
        <div className="scholar-spaces">
            <p>
                {spaces.map((seat, i) => {
                    if (seat !== null) {
                        return <span key={i} className="scholar-space scholar-space-taken" title={`第 ${i + 1} 格：${name(seat)}的学者`} style={{ background: color(seat) }} />;
                    }
                    const c = choices[i];
                    if (c === undefined) return <span key={i} className="scholar-space" title={`第 ${i + 1} 格：空`} />;
                    return (
                        <button
                            key={i} type="button" className="scholar-space" disabled={c.error !== null}
                            title={c.error === null ? `派学者到这里：${c.label}` : `第 ${i + 1} 格：${reasonText(c.error)}`}
                            onClick={() => send!(c.move)}
                        />
                    );
                })}
            </p>
            {ret && ret.error === null && (
                <button type="button" className="scholar-return" title="学者退回供应区，这门学科 +1 级" onClick={() => send!(ret.move)}>
                    退回 +1
                </button>
            )}
        </div>
    );
}
