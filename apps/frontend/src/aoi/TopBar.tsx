import type { GameState, Seat } from "@aoi/engine/aoi";
import { TERRAIN_COLOR } from "./colors.ts";
import { PHASE_NAME, TERRAIN_NAME, factionName } from "./labels.ts";

interface Props {
    state: GameState;
    mySeat: Seat;
    viewed: Seat;
    onView: (seat: Seat) => void;
    name: (seat: Seat) => string;
}

/** 顶栏：第几轮、哪个阶段，以及按本轮行动顺序排好的玩家卡片。点卡片切换"正在查看谁" */
export function TopBar({ state, mySeat, viewed, onView, name }: Props) {
    return (
        <header className="topbar">
            <div className="round">
                <span className="round-num">第 {state.round} 轮</span>
                <span className="round-sub">{PHASE_NAME[state.phase]}</span>
            </div>

            <ol className="rounds" aria-label="六轮的计分板块">
                {state.board.roundScores.map((id, i) => {
                    const r = i + 1;
                    const cls = r === state.round ? "rounds-now" : r < state.round ? "rounds-past" : "";
                    return (
                        <li key={id} className={cls} title={`第 ${r} 轮计分：${id}`}>
                            <span className="num">{r}</span>
                            <span className="rounds-tile">{id}</span>
                        </li>
                    );
                })}
                <li className="rounds-final" title={`终局计分：${state.board.finalRoundScore}`}>
                    <span>终局</span>
                    <span className="rounds-tile">{state.board.finalRoundScore}</span>
                </li>
            </ol>

            <ol className="seats" aria-label="本轮行动顺序，点一位玩家查看 TA 的玩家板">
                {state.turnOrder.map((seat, i) => {
                    const p = state.players[seat];
                    const active = state.turn?.seat === seat;
                    const deciding = state.pending.some((d) => d.seat === seat);
                    const status = p.passed ? "已结束本轮" : active ? "正在行动" : deciding ? "等 TA 决定" : "";
                    return (
                        <li key={seat}>
                            <button
                                type="button"
                                className={"seat" + (seat === viewed ? " seat-viewed" : "") + (p.passed ? " seat-passed" : "")}
                                aria-pressed={seat === viewed}
                                onClick={() => onView(seat)}
                                style={{ ["--seat-color" as string]: TERRAIN_COLOR[p.homeTerrain] }}
                            >
                                <span className="seat-order num" aria-label={`第 ${i + 1} 个行动`}>{i + 1}</span>
                                <span className="seat-name">
                                    {name(seat)}
                                    {seat === mySeat && <span className="seat-me">你</span>}
                                    {status && <span className={active ? "seat-status seat-status-active" : "seat-status"}>{status}</span>}
                                </span>
                                <span className="seat-faction">{factionName(p.faction)}，{TERRAIN_NAME[p.homeTerrain]}</span>
                                <span className="seat-vp"><span className="num">{p.vp}</span>分</span>
                            </button>
                        </li>
                    );
                })}
            </ol>

            <a className="topbar-back" href="#">回到抢 21</a>
        </header>
    );
}
