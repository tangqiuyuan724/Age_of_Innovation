// 决策：玩家回应待决策队列里的第一个决定。按决策的种类分给各自的函数处理。
// 这里还放着两种开局时的决策：选书的颜色（荒地）、免费铲子（沙漠）。
import { DISCIPLINES } from "./constants.js";
import { applyLeech, validateLeech } from "./leech.js";
import { isInReach } from "./reach.js";
import {
    applyDraftPick, applyInitialWorkshop, applyPickSet,
    validateDraftPick, validateInitialWorkshop, validatePickSet,
} from "./setup.js";
import { terrainDistance, terraformToward } from "./terrain.js";
import type { Applied } from "./turn.js";
import { applyPalaceTile, validatePalaceTile } from "./upgrade.js";
import type { Decision, DecisionChoice, Discipline, GameState, HexId, RuleError, Seat } from "./types.js";

/** 回应决策之前的通用检查：游戏没结束、id 对得上（防止回应一个已经过去的决策）、种类对得上 */
export function validateDecide(state: GameState, seat: Seat, id: string, choice: DecisionChoice): RuleError | null {
    if (state.phase === "ended") return "game-over";
    const d = state.pending[0];
    if (d === undefined || d.id !== id) return "invalid-choice";
    if (d.kind !== choice.kind) return "bad-move";
    switch (choice.kind) {
        case "pickSet": return validatePickSet(state, seat, choice.set);
        case "draftPick": return validateDraftPick(state, seat, choice.item);
        case "initialWorkshop": return validateInitialWorkshop(state, seat, choice.hex);
        case "bookColor": return validateBookColor(state, seat, choice.books);
        case "leech": return validateLeech(state, seat);
        case "palaceTile": return validatePalaceTile(state, seat, choice.tile);
        case "spades":
            if ("skip" in choice) return d.seat === seat ? null : "not-your-decision";
            return validateSpades(state, seat, choice.hex, choice.build);
        // 下面几种在 M1-5、M1-6 实现
        case "bridge":
        case "scienceLevels":
        case "trackReward":
        case "competency":
        case "cityTile":
            return "bad-move";
        default: {
            const unhandled: never = choice;
            return unhandled;
        }
    }
}

/** 执行决策。调用前先用 validateDecide 检查 */
export function applyDecide(state: GameState, seat: Seat, choice: DecisionChoice): Applied {
    switch (choice.kind) {
        case "pickSet": return { state: applyPickSet(state, seat, choice.set), events: [] };
        case "draftPick": return { state: applyDraftPick(state, seat, choice.item), events: [] };
        case "initialWorkshop":
            return {
                state: applyInitialWorkshop(state, seat, choice.hex),
                events: [{ type: "built", seat, hex: choice.hex, structure: "workshop" }],
            };
        case "bookColor": return applyBookColor(state, seat, choice.books);
        case "leech": return applyLeech(state, seat, choice.accept);
        case "palaceTile": return applyPalaceTile(state, seat, choice.tile);
        case "spades": return "skip" in choice ? applySkipSpades(state) : applySpades(state, seat, choice.hex);
        default:
            throw new Error(`还没实现的决策：${choice.kind}`);
    }
}

// ---------- 选书的颜色 ----------

export function validateBookColor(
    state: GameState, seat: Seat, books: Partial<Record<Discipline, number>>,
): RuleError | null {
    const d = state.pending[0];
    if (d === undefined || d.kind !== "bookColor") return "wrong-phase";
    if (d.seat !== seat) return "not-your-decision";
    let total = 0;
    for (const [color, n] of Object.entries(books)) {
        if (!(DISCIPLINES as readonly string[]).includes(color)) return "invalid-choice";
        if (!Number.isInteger(n) || n! < 0) return "invalid-choice";
        total += n!;
    }
    if (total !== d.count) return "invalid-choice";
    return null;
}
/** 按选的颜色把书加给玩家。调用前先用 validateBookColor 检查 */
export function applyBookColor(state: GameState, seat: Seat, books: Partial<Record<Discipline, number>>): Applied {
    const players = state.players.map((p) => {
        if (p.seat !== seat) return p;
        const next = { ...p.books };
        for (const d of DISCIPLINES) next[d] += books[d] ?? 0;
        return { ...p, books: next };
    });
    return {
        state: { ...state, players, pending: state.pending.slice(1) },
        events: [{ type: "resources", seat, delta: { books }, reason: "bookColor" }],
    };
}

// ---------- 免费铲子 ----------

/**
 * 免费铲子用在哪一格。这一课只处理不能顺带建工坊的情况（沙漠开局的铲子）；
 * 能顺带建工坊、铲子不够时用工具补的情况，M1-5 写能量行动时再加。
 */
export function validateSpades(state: GameState, seat: Seat, hex: HexId, build: boolean): RuleError | null {
    const d = state.pending[0];
    if (d === undefined || d.kind !== "spades") return "wrong-phase";
    if (d.seat !== seat) return "not-your-decision";
    if (build && !d.canBuild) return "invalid-choice";
    if (build) return "bad-move"; // M1-5 再支持
    const h = state.hexes[hex];
    if (h === undefined) return "bad-move";
    if (h.structure !== null) return "hex-occupied";
    if (h.terrain === state.players[seat].homeTerrain) return "invalid-choice"; // 已经是家园地形，铲子没地方用
    if (!isInReach(state, seat, hex)) return "not-in-reach";
    return null;
}

/** 在 hex 用免费铲子。一格用不完的铲子（这一课不会出现）排成新的决策，留给下一格 */
export function applySpades(state: GameState, seat: Seat, hex: HexId): Applied {
    const d = state.pending[0];
    if (d.kind !== "spades") throw new Error("队列第一个不是免费铲子");
    const p = state.players[seat];
    const h = state.hexes[hex];
    const used = Math.min(d.spades, terrainDistance(h.terrain, p.homeTerrain));
    const terrain = terraformToward(h.terrain, p.homeTerrain, used);
    const rest = state.pending.slice(1);
    const left = d.spades - used;
    const pending: Decision[] = left > 0 ? [{ ...d, id: `${d.id}-rest`, spades: left }, ...rest] : rest;
    return {
        state: { ...state, hexes: { ...state.hexes, [hex]: { ...h, terrain } }, pending },
        events: [{ type: "terraformed", seat, hex, from: h.terrain, to: terrain }],
    };
}

/** 不用免费铲子（放弃） */
export function applySkipSpades(state: GameState): Applied {
    return { state: { ...state, pending: state.pending.slice(1) }, events: [] };
}