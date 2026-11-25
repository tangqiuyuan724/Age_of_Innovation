import type { GameEvent, GameState, Move, Seat } from "@aoi/engine/aoi";
import { TERRAIN_COLOR } from "./colors.ts";
import { describeEvent, describeMove, type Namer } from "./describe.ts";

/** 日志里的一条：谁执行了什么指令，引擎说发生了什么 */
export interface LogEntry {
    seat: Seat;
    move: Move;
    events: GameEvent[];
}

/** 日志：最新的一步在最上面。每一步下面列出引擎返回的事件 */
export function GameLog({ entries, state, namer }: { entries: LogEntry[]; state: GameState; namer: Namer }) {
    if (entries.length === 0) return <p className="muted">还没有人行动。</p>;
    const color = (seat: Seat) => {
        const p = state.players[seat];
        return p ? TERRAIN_COLOR[p.homeTerrain] : "var(--muted)";
    };
    return (
        <ol className="log" reversed>
            {entries.map((e, i) => ({ e, i })).reverse().map(({ e, i }) => (
                <li key={i} style={{ ["--seat-color" as string]: color(e.seat) }}>
                    <p>
                        <span className="log-step num">{i + 1}</span>
                        <strong>{namer.name(e.seat)}</strong>　{describeMove(e.move, namer)}
                    </p>
                    {e.events.length > 0 && (
                        <ul>
                            {e.events.map((ev, k) => <li key={k}>{describeEvent(ev, namer)}</li>)}
                        </ul>
                    )}
                </li>
            ))}
        </ol>
    );
}
