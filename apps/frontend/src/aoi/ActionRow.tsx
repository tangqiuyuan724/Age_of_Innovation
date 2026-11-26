import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
    BOOK_ACTION_COST, DISCIPLINES, POWER_ACTION_COST, validateMove,
    type BookActionId, type Discipline, type GameState, type HexId, type Move, type Seat,
} from "@aoi/engine/aoi";
import { BOOK_ACTION_LABEL, BOOK_NAME, POWER_ACTION_LABEL, reasonText } from "./labels.ts";
import { POWER_ACTIONS, autoBooks, bookActionChoices, powerActionChoices, type Choice } from "./options.ts";
import { boardBox } from "./mapView.ts";
import { Art } from "./pieces.tsx";

/** 底图最下面一排行动格的位置（底图像素）：左边 3 个书本行动、右边 6 个能量行动，每格 148 × 83 */
const SLOT_Y = 883, SLOT_W = 148, SLOT_H = 83;
const BOOK_SLOT_X = [10, 176, 343];
const POWER_SLOT_X = [551, 719, 887, 1055, 1223, 1391];

interface Props {
    state: GameState;
    /** 能操作的人：轮到 TA、还没做主行动、没有人在等决定时才传，否则为 null（行动格只是显示） */
    actor: Seat | null;
    hexName: (id: HexId) => string;
    send?: (move: Move) => void;
}

/**
 * 行动格：叠在底图最下面那一排上。
 *  - 书本行动每局翻开的不一样，摆上这一局的 3 个（盖住图上原来的）
 *  - 能量行动 6 个是固定的，用图上画好的，只在上面放按钮
 * 本轮用过的盖一个 X 标记。轮到你时，能做的格子会亮起来：能量行动点了直接做，书本行动点了先选付哪几本书
 */
export function ActionRow({ state, actor, hexName, send }: Props) {
    const { board } = state;
    const powerChoices = actor !== null ? powerActionChoices(state, actor) : [];
    const bookChoices = actor !== null ? bookActionChoices(state, actor) : [];
    const [paying, setPaying] = useState<BookActionId | null>(null);
    useEffect(() => setPaying(null), [state.version]);

    return (
        <div className="actionrow">
            <ul className="slots" aria-label="书本行动">
                {board.bookActions.map((id, i) => (
                    <Slot
                        key={id}
                        box={boardBox(BOOK_SLOT_X[i], SLOT_Y, SLOT_W, SLOT_H)}
                        art={<Art kind="bookAction" id={id} alt={`${BOOK_ACTION_COST[id]} 本书：${BOOK_ACTION_LABEL[id]}`} />}
                        used={board.bookActionsUsed.includes(id)}
                        choice={bookChoices[i]}
                        picked={paying === id}
                        hint={`付 ${BOOK_ACTION_COST[id]} 本书：${BOOK_ACTION_LABEL[id]}（点了以后选付哪几本）`}
                        onClick={() => setPaying(paying === id ? null : id)}
                    />
                ))}
            </ul>
            <ul className="slots" aria-label="能量行动">
                {POWER_ACTIONS.map((id, i) => (
                    <Slot
                        key={id}
                        box={boardBox(POWER_SLOT_X[i], SLOT_Y, SLOT_W, SLOT_H)}
                        label={`花 ${POWER_ACTION_COST[id]} 能量：${POWER_ACTION_LABEL[id]}`}
                        used={board.powerActionsUsed.includes(id)}
                        choice={powerChoices[i]}
                        hint={`花 ${POWER_ACTION_COST[id]} 能量：${POWER_ACTION_LABEL[id]}`}
                        onClick={() => send!(powerChoices[i].move)}
                    />
                ))}
            </ul>
            {paying !== null && actor !== null && send && (
                <BookActionForm key={paying} state={state} seat={actor} id={paying} hexName={hexName} send={send} onCancel={() => setPaying(null)} />
            )}
        </div>
    );
}

interface SlotProps {
    /** 在底图上的位置 */
    box: CSSProperties;
    /** 盖在图上的板块（书本行动）；能量行动用图上画好的，不传 */
    art?: ReactNode;
    /** 没有 art 时，给读屏软件的说明 */
    label?: string;
    used: boolean;
    /** 引擎对这个行动的判断；不能操作时没有 */
    choice: Choice | undefined;
    picked?: boolean;
    hint: string;
    onClick: () => void;
}

function Slot({ box, art, label, used, choice, picked = false, hint, onClick }: SlotProps) {
    const marker = used && <Art kind="marker" id="x" alt="本轮已用" className="slot-x" />;
    if (choice === undefined) {
        return <li className="slot" style={box} title={hint} aria-label={label}>{art}{marker}</li>;
    }
    const ok = choice.error === null;
    return (
        <li className={"slot" + (ok ? " slot-ready" : "") + (picked ? " slot-picked" : "")} style={box}>
            <button type="button" disabled={!ok} title={ok ? hint : reasonText(choice.error!)} aria-label={label} onClick={onClick}>
                {art}{marker}
            </button>
        </li>
    );
}

interface BookActionFormProps {
    state: GameState;
    seat: Seat;
    id: BookActionId;
    hexName: (id: HexId) => string;
    send: (move: Move) => void;
    onCancel: () => void;
}

/**
 * 书本行动的表单：每种颜色付几本（一开始先填好一种付法，可以改），
 * "免费升行会"还要选升哪个工坊，也可以不升（放弃这个效果）
 */
function BookActionForm({ state, seat, id, hexName, send, onCancel }: BookActionFormProps) {
    const p = state.players[seat];
    const cost = BOOK_ACTION_COST[id];
    const start = autoBooks(p, cost) ?? {};
    const [books, setBooks] = useState<Record<Discipline, number>>(
        Object.fromEntries(DISCIPLINES.map((x) => [x, start[x] ?? 0])) as Record<Discipline, number>);
    // 自己的工坊（中立的不能升）
    const workshops = Object.entries(state.hexes)
        .filter(([, h]) => h.structure?.owner === seat && h.structure.type === "workshop" && !h.structure.neutral)
        .map(([hex]) => hex);
    const [hex, setHex] = useState<HexId | "">(workshops[0] ?? "");

    const total = DISCIPLINES.reduce((sum, x) => sum + books[x], 0);
    const change = (x: Discipline, by: number) => setBooks({ ...books, [x]: books[x] + by });
    const payment = Object.fromEntries(DISCIPLINES.filter((x) => books[x] > 0).map((x) => [x, books[x]]));
    const move: Move = id === "freeGuild" && hex !== ""
        ? { t: "bookAction", id, books: payment, hex }
        : { t: "bookAction", id, books: payment };
    const error = validateMove(state, seat, move);

    return (
        <div className="popover bookform" role="dialog" aria-label={`${BOOK_ACTION_LABEL[id]}：付哪几本书`}>
            <p className="popover-title">{BOOK_ACTION_LABEL[id]}：付 {cost} 本书，颜色随意</p>
            <BookStepper books={books} max={(x) => Math.min(p.books[x], books[x] + cost - total)} onChange={change} />
            {id === "freeGuild" && (
                <label className="bookform-row">
                    升哪个工坊：
                    <select value={hex} onChange={(e) => setHex(e.target.value)}>
                        {workshops.map((w) => <option key={w} value={w}>{hexName(w)}</option>)}
                        <option value="">不升级（放弃这个效果）</option>
                    </select>
                </label>
            )}
            <p className="bookform-row">
                <button type="button" className="btn btn-primary" disabled={error !== null} title={error === null ? undefined : reasonText(error)} onClick={() => send(move)}>
                    确定（{total} / {cost}）
                </button>
                <button type="button" className="btn" onClick={onCancel}>取消</button>
                {error !== null && total === cost && <span className="muted">{reasonText(error)}</span>}
            </p>
        </div>
    );
}

interface StepperProps {
    books: Record<Discipline, number>;
    /** 这种颜色最多能选到几本 */
    max: (x: Discipline) => number;
    onChange: (x: Discipline, by: number) => void;
}

/** 四种颜色的书，每种一个加减器。付书、拿任选颜色的书都用它 */
export function BookStepper({ books, max, onChange }: StepperProps) {
    return (
        <p className="bookstepper">
            {DISCIPLINES.map((x) => (
                <span key={x} className="stepper" title={`${BOOK_NAME[x]}书`}>
                    <Art kind="book" id={x} alt={`${BOOK_NAME[x]}书`} className="stepper-book" />
                    <button type="button" disabled={books[x] === 0} onClick={() => onChange(x, -1)} aria-label={`少一本${BOOK_NAME[x]}书`}>−</button>
                    <span className="num">{books[x]}</span>
                    <button type="button" disabled={books[x] >= max(x)} onClick={() => onChange(x, 1)} aria-label={`多一本${BOOK_NAME[x]}书`}>+</button>
                </span>
            ))}
        </p>
    );
}
