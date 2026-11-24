import type { GameState } from "@aoi/engine/aoi";
import { describeDecision } from "./labels.ts";

/** 底部：现在在等谁做什么决定 */
export function PendingBar({ state, mySeat, name }: { state: GameState; mySeat: number; name: (seat: number) => string }) {
    if (state.pending.length === 0) {
        const seat = state.turn?.seat;
        return <footer className="pending">{seat === undefined ? "" : `等待 ${name(seat)} 行动`}</footer>;
    }
    return (
        <footer className="pending">
            <ul>
                {state.pending.map((d) => (
                    <li key={d.id} className={d.seat === mySeat ? "pending-mine" : ""}>
                        <span className="pending-who">{d.seat === mySeat ? "轮到你决定" : `等待 ${name(d.seat)}`}</span>
                        <span>{describeDecision(d, name)}</span>
                        {d.seat === mySeat && d.kind === "leech" && (
                            <span className="pending-buttons">
                                <button disabled title="预览模式下按钮不可用">接受</button>
                                <button disabled title="预览模式下按钮不可用">放弃</button>
                            </span>
                        )}
                    </li>
                ))}
            </ul>
        </footer>
    );
}
