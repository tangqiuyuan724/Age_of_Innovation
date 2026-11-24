import {
    BOOK_ACTION_COST, DISCIPLINES, POWER_ACTION_COST,
    type GameState, type PowerActionId,
} from "@aoi/engine/aoi";
import { DISCIPLINE_COLOR, TERRAIN_COLOR } from "./colors.ts";
import { BOOK_ACTION_LABEL, DISCIPLINE_NAME, POWER_ACTION_LABEL } from "./labels.ts";

const POWER_ACTIONS: PowerActionId[] = ["bridge", "scholar", "tools2", "coins7", "spade1", "spade2"];

/** 公共版图：能量行动、书本行动、学科轨道、回合奖励板块 */
export function SharedBoard({ state, name }: { state: GameState; name: (seat: number) => string }) {
    const { board, players } = state;
    return (
        <section className="shared">
            <div className="shared-block">
                <h3>能量行动</h3>
                <ul className="actions">
                    {POWER_ACTIONS.map((id) => {
                        const used = board.powerActionsUsed.includes(id);
                        return (
                            <li key={id} className={used ? "action action-used" : "action"}>
                                <span className="cost cost-power">{POWER_ACTION_COST[id]}</span>
                                <span>{POWER_ACTION_LABEL[id]}</span>
                                {used && <span className="used-mark">本轮已用</span>}
                            </li>
                        );
                    })}
                </ul>
            </div>

            <div className="shared-block">
                <h3>书本行动</h3>
                <ul className="actions">
                    {board.bookActions.map((id) => {
                        const used = board.bookActionsUsed.includes(id);
                        return (
                            <li key={id} className={used ? "action action-used" : "action"}>
                                <span className="cost cost-book">{BOOK_ACTION_COST[id]} 书</span>
                                <span>{BOOK_ACTION_LABEL[id]}</span>
                                {used && <span className="used-mark">本轮已用</span>}
                            </li>
                        );
                    })}
                </ul>
                <h3>可选的回合奖励板块</h3>
                <ul className="bonus">
                    {board.bonusTiles.map((t) => (
                        <li key={t.id}>{t.id}{t.coins > 0 && <span className="bonus-coins">上面有 {t.coins} 金币</span>}</li>
                    ))}
                </ul>
            </div>

            <div className="shared-block shared-science">
                <h3>学科</h3>
                {DISCIPLINES.map((d) => (
                    <div key={d} className="discipline">
                        <p className="discipline-name" style={{ color: DISCIPLINE_COLOR[d] }}>{DISCIPLINE_NAME[d]}</p>
                        <ul className="discipline-levels">
                            {players.map((p) => (
                                <li key={p.seat}>
                                    <span className="swatch swatch-sm" style={{ background: TERRAIN_COLOR[p.homeTerrain] }} />
                                    {name(p.seat)}
                                    <span className="num">{p.science[d]}</span>
                                </li>
                            ))}
                        </ul>
                        <p className="scholar-spaces" aria-label="学者格">
                            {board.scholarSpaces[d].map((seat, i) => (
                                <span
                                    key={i}
                                    className="scholar-space"
                                    title={seat === null ? "空" : name(seat)}
                                    style={seat === null ? undefined : { background: TERRAIN_COLOR[players[seat].homeTerrain] }}
                                />
                            ))}
                        </p>
                    </div>
                ))}
            </div>
        </section>
    );
}
