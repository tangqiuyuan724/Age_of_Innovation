// 主行动"能量行动"：花碗 III 里的能量，做行动板上的 6 个能量行动之一。
// 行动格大家共用，每一格每轮只能用一次（用过的盖一个 X，下一轮开始时拿掉）。
// 只要能量够就能做，拿到的效果可以放弃：学者拿完了就拿不到，铲子、建桥的决策可以选放弃。
import { POWER_ACTION_COST } from "./constants.js";
import { spendPower } from "./power.js";
import { addBundles, gainResources } from "./resources.js";
import { checkMainAction, type Applied } from "./turn.js";
import type { Decision, GameState, PowerActionId, ResourceBundle, RuleError, Seat } from "./types.js";

/** 直接拿资源的 3 个能量行动。另外 3 个（建桥、1 铲、2 铲）要再排一个决策，让玩家选用在哪 */
const POWER_ACTION_GAIN: Partial<Record<PowerActionId, ResourceBundle>> = {
    scholar: { scholars: 1 },
    tools2: { tools: 2 },
    coins7: { coins: 7 },
};

export function validatePowerAction(state: GameState, seat: Seat, id: PowerActionId): RuleError | null {
    const error = checkMainAction(state, seat);
    if (error !== null) return error;
    if (!Object.hasOwn(POWER_ACTION_COST, id)) return "bad-move"; // 不用 in：in 会把 "toString" 这种也算进去
    if (state.board.powerActionsUsed.includes(id)) return "action-taken";
    const p = state.players[seat];
    if (spendPower(p.power, POWER_ACTION_COST[id]) === null) return "insufficient-power";
    return null;
}

/** 做能量行动。调用前先用 validatePowerAction 检查 */
export function applyPowerAction(state: GameState, seat: Seat, id: PowerActionId): Applied {
    const p = state.players[seat];
    const cost = POWER_ACTION_COST[id];
    let gain = POWER_ACTION_GAIN[id] ?? {};
    if (id === "scholar" && p.scholarsInSupply === 0) gain = {}; // 7 个学者都拿出来了：行动照做，学者拿不到
    const { player } = gainResources({ ...p, power: spendPower(p.power, cost)! }, gain);

    const pending: Decision[] = [...state.pending];
    if (id === "spade1" || id === "spade2") {
        const spades = id === "spade1" ? 1 : 2;
        pending.push({ id: `spades-${state.version}`, seat, kind: "spades", spades, canBuild: true });
    }
    if (id === "bridge") pending.push({ id: `bridge-${state.version}`, seat, kind: "bridge" });

    return {
        state: {
            ...state,
            players: state.players.map((q) => (q.seat === seat ? player : q)),
            board: { ...state.board, powerActionsUsed: [...state.board.powerActionsUsed, id] },
            pending,
            turn: { ...state.turn!, mainActionDone: true },
        },
        events: [{ type: "resources", seat, delta: addBundles({ power: -cost }, gain), reason: "powerAction" }],
    };
}