// 主行动"推进航行轨 / 改造轨"：付规划板上印的费用，轨道前进一格，拿新格子上的奖励。
// 航行等级越高，隔着河能够到的地方越远；改造等级越高，每把铲子要的工具越少。
import { PLANNING_DISPLAYS } from "./content/planning.js";
import { gainResources, negateBundle, payResources } from "./resources.js";
import { checkMainAction, type Applied } from "./turn.js";
import type { Decision, GameEvent, GameState, Move, PlayerState, ResourceBundle, RuleError, Seat } from "./types.js";

/** 两条轨道："sailing"（航行）或 "terraforming"（改造） */
export type Track = Extract<Move, { t: "advanceTrack" }>["track"];

/** 前进一格的费用 */
export function trackCost(p: PlayerState, track: Track): ResourceBundle {
    const display = PLANNING_DISPLAYS[p.planning];
    return track === "sailing" ? display.sailingCost : display.terraformingCost;
}

/** 每一格的奖励，下标 = 等级 */
export function trackRewards(p: PlayerState, track: Track): ResourceBundle[] {
    const display = PLANNING_DISPLAYS[p.planning];
    return track === "sailing" ? display.sailingRewards : display.terraformingRewards;
}

export function validateAdvanceTrack(state: GameState, seat: Seat, track: Track): RuleError | null {
    const error = checkMainAction(state, seat);
    if (error !== null) return error;
    if (track !== "sailing" && track !== "terraforming") return "bad-move";
    const p = state.players[seat];
    if (p[track] >= trackRewards(p, track).length - 1) return "limit-reached";
    if (payResources(p, trackCost(p, track)) === null) return "insufficient-resources";
    return null;
}

/** 推进轨道。奖励里有任选颜色的书时，排进选书颜色的决策。调用前先用 validateAdvanceTrack 检查 */
export function applyAdvanceTrack(state: GameState, seat: Seat, track: Track): Applied {
    const p = state.players[seat];
    const cost = trackCost(p, track);
    const level = p[track] + 1;
    const reward = trackRewards(p, track)[level];
    const paid: PlayerState = { ...payResources(p, cost)!, [track]: level };
    const { player, bookChoices } = gainResources(paid, reward);

    const pending: Decision[] = [...state.pending];
    if (bookChoices > 0) pending.push({ id: `track-${state.version}`, seat, kind: "bookColor", count: bookChoices });
    const events: GameEvent[] = [{ type: "resources", seat, delta: negateBundle(cost), reason: "advanceTrack" }];
    if (Object.keys(reward).length > 0) events.push({ type: "resources", seat, delta: reward, reason: "trackReward" });
    return {
        state: {
            ...state,
            players: state.players.map((q) => (q.seat === seat ? player : q)),
            pending,
            turn: { ...state.turn!, mainActionDone: true },
        },
        events,
    };
}