import type { GameState, Seat } from "@aoi/engine/aoi";
import { describeDecision } from "./labels.ts";

/** 浮在地图上方的提示条：现在在等谁做什么决定。没有待决定的事就不显示 */
export function PendingBar({ state, mySeat, name }: { state: GameState; mySeat: Seat; name: (seat: Seat) => string }) {
    if (state.pending.length === 0) return null;
    return (
        <ul className="pending" aria-live="polite">
            {state.pending.map((d) => (
                <li key={d.id} className={d.seat === mySeat ? "pending-mine" : ""}>
                    <span className="pending-who">{d.seat === mySeat ? "轮到你决定" : `等 ${name(d.seat)} 决定`}</span>
                    <span>{describeDecision(d, name)}</span>
                    {d.seat === mySeat && d.kind === "leech" && (
                        <span className="pending-buttons">
                            <button type="button" disabled title="预览模式，还不能操作">接受</button>
                            <button type="button" disabled title="预览模式，还不能操作">不要</button>
                        </span>
                    )}
                </li>
            ))}
        </ul>
    );
}
