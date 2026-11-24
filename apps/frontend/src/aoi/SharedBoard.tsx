import {
    BOOK_ACTION_COST, DISCIPLINES, POWER_ACTION_COST, SCIENCE_KEY_THRESHOLD, SCIENCE_MAX,
    type GameState, type PowerActionId, type Seat,
} from "@aoi/engine/aoi";
import { DISCIPLINE_COLOR, TERRAIN_COLOR } from "./colors.ts";
import { BOOK_ACTION_LABEL, DISCIPLINE_NAME, POWER_ACTION_LABEL } from "./labels.ts";
import { BookIcon, CoinIcon, KeyIcon } from "./icons.tsx";

const POWER_ACTIONS: PowerActionId[] = ["bridge", "scholar", "tools2", "coins7", "spade1", "spade2"];
/** 学科轨道从上往下画：12, 11, …, 0 */
const LEVELS = Array.from({ length: SCIENCE_MAX + 1 }, (_, i) => SCIENCE_MAX - i);

/** 右侧公共版图：学科轨道、能量行动、书本行动、回合奖励板块（计分板块在顶栏） */
export function SharedBoard({ state, name }: { state: GameState; name: (seat: Seat) => string }) {
    const { board, players } = state;
    const color = (seat: Seat) => TERRAIN_COLOR[players[seat].homeTerrain];

    return (
        <aside className="shared" aria-label="公共版图">
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
                            <p className="scholar-spaces" title="派遣学者的格子">
                                {board.scholarSpaces[d].map((seat, i) => (
                                    <span
                                        key={i}
                                        className={seat === null ? "scholar-space" : "scholar-space scholar-space-taken"}
                                        title={seat === null ? "空" : `${name(seat)}的学者`}
                                        style={seat === null ? undefined : { background: color(seat) }}
                                    />
                                ))}
                            </p>
                        </div>
                    ))}
                </div>
                <p className="shared-note">超过 {SCIENCE_KEY_THRESHOLD} 级要用钥匙；12 级每门学科只能有一人。</p>
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
                            <li key={id} className={used ? "tile tile-used" : "tile"}>
                                <span className="cost-book" aria-label={`花 ${BOOK_ACTION_COST[id]} 本书`}>
                                    <BookIcon color="#8C9396" /><span className="num">{BOOK_ACTION_COST[id]}</span>
                                </span>
                                <span className="tile-text">{BOOK_ACTION_LABEL[id]}</span>
                                {used && <span className="tile-stamp">本轮已用</span>}
                            </li>
                        );
                    })}
                </ul>
            </section>

            <section>
                <h3>还没人拿的回合奖励板块</h3>
                <ul className="tiles tiles-3">
                    {board.bonusTiles.map((t) => (
                        <li key={t.id} className="tile tile-bonus">
                            <span className="tile-text">{t.id}</span>
                            {t.coins > 0 && (
                                <span className="bonus-coins" title={`上面有 ${t.coins} 金币`}>
                                    {Array.from({ length: t.coins }, (_, i) => <CoinIcon key={i} />)}
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            </section>

        </aside>
    );
}
