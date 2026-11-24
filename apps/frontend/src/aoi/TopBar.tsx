import type { GameState } from "@aoi/engine/aoi";
import { TERRAIN_COLOR, inkOn } from "./colors.ts";
import { PHASE_NAME } from "./labels.ts";

/** 顶栏：第几轮、哪个阶段、行动顺序 */
export function TopBar({ state, name }: { state: GameState; name: (seat: number) => string }) {
    return (
        <header className="topbar">
            <div className="round">
                <span className="round-num">第 {state.round} 轮</span>
                <span className="round-phase">{PHASE_NAME[state.phase]}</span>
            </div>
            <ol className="order" aria-label="本轮行动顺序">
                {state.turnOrder.map((seat) => {
                    const p = state.players[seat];
                    const active = state.turn?.seat === seat;
                    return (
                        <li
                            key={seat}
                            className={active ? "order-chip order-active" : "order-chip"}
                            style={{ background: TERRAIN_COLOR[p.homeTerrain], color: inkOn(p.homeTerrain) }}
                        >
                            {name(seat)}{p.passed ? "（已结束）" : ""}
                        </li>
                    );
                })}
            </ol>
            <ol className="rounds" aria-label="六轮的计分板块">
                {state.board.roundScores.map((id, i) => (
                    <li key={id} className={i + 1 === state.round ? "rounds-now" : i + 1 < state.round ? "rounds-past" : ""}>
                        {i + 1}
                    </li>
                ))}
            </ol>
        </header>
    );
}
