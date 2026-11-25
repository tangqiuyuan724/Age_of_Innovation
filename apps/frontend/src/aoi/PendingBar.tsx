import { useState, type ReactNode } from "react";
import {
    COMPETENCY_ROW_REWARD, DISCIPLINES, PALACE_TILE_INCOME, validateMove,
    type CompetencyId, type Decision, type DecisionChoice, type Discipline, type GameState, type Move, type Seat,
} from "@aoi/engine/aoi";
import { DISCIPLINE_COLOR } from "./colors.ts";
import { describeBundle, describeDecision } from "./describe.ts";
import { BookIcon } from "./icons.tsx";
import { COMPETENCY_LABEL, DISCIPLINE_NAME, reasonText } from "./labels.ts";

interface Props {
    state: GameState;
    /** 现在由谁操作；只读预览时为 null */
    actor: Seat | null;
    name: (seat: Seat) => string;
    send?: (move: Move) => void;
}

/** 浮在地图上方的提示条：现在在等谁做什么决定。第一个决定如果轮到操作的人，就在这里选 */
export function PendingBar({ state, actor, name, send }: Props) {
    if (state.pending.length === 0) return null;
    return (
        <ul className="pending" aria-live="polite">
            {state.pending.map((d, i) => {
                const mine = d.seat === actor;
                const active = i === 0 && mine && send !== undefined;
                return (
                    <li key={d.id} className={(mine ? "pending-mine" : "") + (i > 0 ? " pending-later" : "")}>
                        <span className="pending-who">
                            {i > 0 ? "排队：" : ""}{mine ? `${name(d.seat)}来决定` : `等 ${name(d.seat)} 决定`}
                        </span>
                        <span>{describeDecision(d, name)}</span>
                        {active && <DecisionControls state={state} d={d} send={send} />}
                    </li>
                );
            })}
        </ul>
    );
}

/** 能力板块在展示区的哪一列、第几行（决定拿到时的奖励） */
function competencyWhere(state: GameState, tile: CompetencyId): string {
    for (const d of DISCIPLINES) {
        const row = state.board.competencyGrid[d].indexOf(tile);
        if (row >= 0) {
            const r = COMPETENCY_ROW_REWARD[row];
            return `${DISCIPLINE_NAME[d]} +${r.levels} 级${r.books > 0 ? `、${r.books} 本书` : ""}`;
        }
    }
    return "";
}

/** 第一个决定的选择按钮。每种决定的样子不一样 */
function DecisionControls({ state, d, send }: { state: GameState; d: Decision; send: (move: Move) => void }) {
    const p = state.players[d.seat];
    /** 一个选项按钮：先问引擎这个回应行不行，不行就变灰，鼠标悬停显示原因 */
    const option = (key: string | number, choice: DecisionChoice, label: ReactNode, title?: string) => {
        const move: Move = { t: "decide", id: d.id, choice };
        const error = validateMove(state, d.seat, move);
        return (
            <button key={key} type="button" disabled={error !== null} title={error === null ? title : reasonText(error)} onClick={() => send(move)}>
                {label}
            </button>
        );
    };
    const answer = (choice: DecisionChoice) => send({ t: "decide", id: d.id, choice });

    switch (d.kind) {
        case "leech":
            return (
                <span className="pending-buttons">
                    {option("yes", { kind: "leech", accept: true }, "接受")}
                    {option("no", { kind: "leech", accept: false }, "不要")}
                </span>
            );
        case "scienceLevels":
            return (
                <span className="pending-buttons">
                    {DISCIPLINES.map((x) => option(x, { kind: "scienceLevels", discipline: x }, `${DISCIPLINE_NAME[x]}（现在 ${p.science[x]} 级）`))}
                </span>
            );
        case "bookColor":
            return <BookColorPicker key={d.id} count={d.count} onDone={(books) => answer({ kind: "bookColor", books })} />;
        case "competency":
            return (
                <span className="pending-buttons pending-wrap">
                    {d.options.map((tile) => option(tile, { kind: "competency", tile },
                        <>{COMPETENCY_LABEL[tile].short}<small>（{competencyWhere(state, tile)}）</small></>,
                        COMPETENCY_LABEL[tile].text))}
                </span>
            );
        case "palaceTile":
            return (
                <span className="pending-buttons pending-wrap">
                    {d.options.map((tile) => option(tile, { kind: "palaceTile", tile },
                        <>#{tile}<small>（收入 {describeBundle(PALACE_TILE_INCOME[tile])}）</small></>))}
                </span>
            );
        case "initialWorkshop":
            return <span className="pending-hint">在地图上点一个实线框出来的格子</span>;
        case "spades":
            return (
                <span className="pending-buttons">
                    <span className="pending-hint">在地图上点一个实线框出来的格子</span>
                    {option("skip", { kind: "spades", skip: true }, "不用了")}
                </span>
            );
        case "pickSet":
        case "draftPick":
            return <span className="pending-hint">在下面选</span>;
        case "bridge":
        case "cityTile":
            return <span className="pending-hint">引擎还没实现这个决定，只能撤销上一步</span>;
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
    const change = (x: Discipline, by: number) => setBooks({ ...books, [x]: books[x] + by });
    return (
        <span className="pending-buttons">
            {DISCIPLINES.map((x) => (
                <span key={x} className="stepper" title={`${DISCIPLINE_NAME[x]}书`}>
                    <BookIcon color={DISCIPLINE_COLOR[x]} />
                    <button type="button" disabled={books[x] === 0} onClick={() => change(x, -1)} aria-label={`少一本${DISCIPLINE_NAME[x]}书`}>−</button>
                    <span className="num">{books[x]}</span>
                    <button type="button" disabled={total === count} onClick={() => change(x, 1)} aria-label={`多一本${DISCIPLINE_NAME[x]}书`}>+</button>
                </span>
            ))}
            {/* 只把选了的颜色发出去，日志里就不会出现"0 本银行书" */}
            <button
                type="button"
                disabled={total !== count}
                onClick={() => onDone(Object.fromEntries(DISCIPLINES.filter((x) => books[x] > 0).map((x) => [x, books[x]])))}
            >
                确定（{total} / {count}）
            </button>
        </span>
    );
}
