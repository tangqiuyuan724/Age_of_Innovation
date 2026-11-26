// 决策：玩家回应待决策队列里的第一个决定。按决策的种类分给各自的函数处理。
// 这里还放着两种决策：选书的颜色、免费铲子（沙漠开局、能量行动、书本行动、特殊行动都会给）。
import { applyBridge, validateBridge } from "./bridge.js";
import { spadeCost } from "./build.js";
import { applyCityTile, validateCityTile } from "./city.js";
import { applyCompetency, validateCompetency } from "./competency.js";
import { BUILD_WORKSHOP_COST, DISCIPLINES } from "./constants.js";
import { applyLeech, validateLeech } from "./leech.js";
import { isInReach } from "./reach.js";
import { addBundles, negateBundle, payResources } from "./resources.js";
import { applyScienceLevels, validateScienceLevels } from "./science.js";
import {
    applyDraftPick, applyInitialWorkshop, applyPickSet,
    validateDraftPick, validateInitialWorkshop, validatePickSet,
} from "./setup.js";
import { terrainDistance, terraformToward } from "./terrain.js";
import type { Applied } from "./turn.js";
import { applyPalaceTile, validatePalaceTile } from "./upgrade.js";
import type {
    Decision, DecisionChoice, Discipline, GameEvent, GameState, HexId, PlayerState, ResourceBundle, RuleError, Seat, Structure,
} from "./types.js";

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
        case "scienceLevels":
            if ("skip" in choice) return d.seat === seat ? null : "not-your-decision";
            return validateScienceLevels(state, seat, choice.discipline);
        case "competency": return validateCompetency(state, seat, choice.tile);
        case "spades":
            if ("skip" in choice) return d.seat === seat ? null : "not-your-decision";
            return validateSpades(state, seat, choice.hex, choice.build);
        case "bridge":
            if ("skip" in choice) return d.seat === seat ? null : "not-your-decision";
            return validateBridge(state, seat, choice.a, choice.b);
        case "cityTile": return validateCityTile(state, seat, choice.tile);
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
        case "scienceLevels": return "skip" in choice ? applySkip(state) : applyScienceLevels(state, seat, choice.discipline);
        case "competency": return applyCompetency(state, seat, choice.tile);
        case "spades": return "skip" in choice ? applySkip(state) : applySpades(state, seat, choice.hex, choice.build);
        case "bridge": return "skip" in choice ? applySkip(state) : applyBridge(state, seat, choice.a, choice.b);
        case "cityTile": return applyCityTile(state, seat, choice.tile);
        default: {
            const unhandled: never = choice;
            throw new Error(`不认识的决策：${JSON.stringify(unhandled)}`);
        }
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

/** 免费铲子不够改到家园地形时，建工坊要另外付多少：缺的铲子用工具买（价格看改造等级），再加上工坊的钱 */
export function spadesBuildCost(p: PlayerState, free: number, distance: number): ResourceBundle {
    return addBundles(spadeCost(p, Math.max(0, distance - free)), BUILD_WORKSHOP_COST);
}

/**
 * 免费铲子用在哪一格。build 为真时，改成家园地形后顺带建一个工坊：
 * 免费铲子不够的部分用工具补。不建工坊时只用免费铲子，不能另外买铲子。
 */
export function validateSpades(state: GameState, seat: Seat, hex: HexId, build: boolean): RuleError | null {
    const d = state.pending[0];
    if (d === undefined || d.kind !== "spades") return "wrong-phase";
    if (d.seat !== seat) return "not-your-decision";
    if (build && !d.canBuild) return "invalid-choice";
    const p = state.players[seat];
    const h = state.hexes[hex];
    if (h === undefined) return "bad-move";
    if (h.structure !== null) return "hex-occupied";
    const distance = terrainDistance(h.terrain, p.homeTerrain);
    if (distance === 0) return "invalid-choice"; // 已经是家园地形，铲子没地方用
    if (!isInReach(state, seat, hex)) return "not-in-reach";
    if (build) {
        if (p.buildingsLeft.workshop === 0) return "limit-reached";
        if (payResources(p, spadesBuildCost(p, d.spades, distance)) === null) return "insufficient-resources";
    }
    return null;
}

/**
 * 在 hex 用免费铲子，build 为真时顺带建工坊。
 * 一格用不完的铲子排成新的决策，留给下一格；下一格只能改造，不能再建工坊。
 */
export function applySpades(state: GameState, seat: Seat, hex: HexId, build: boolean): Applied {
    const d = state.pending[0];
    if (d.kind !== "spades") throw new Error("队列第一个不是免费铲子");
    const p = state.players[seat];
    const h = state.hexes[hex];
    const distance = terrainDistance(h.terrain, p.homeTerrain);
    const used = build ? distance : Math.min(d.spades, distance); // 建工坊就一定改到家园地形
    const terrain = terraformToward(h.terrain, p.homeTerrain, used);
    const events: GameEvent[] = [{ type: "terraformed", seat, hex, from: h.terrain, to: terrain }];

    let player = p;
    let structure: Structure | null = null;
    let turn = state.turn;
    if (build) {
        const cost = spadesBuildCost(p, d.spades, distance);
        player = payResources(p, cost)!;
        player = { ...player, buildingsLeft: { ...player.buildingsLeft, workshop: player.buildingsLeft.workshop - 1 } };
        structure = { owner: seat, type: "workshop", neutral: false, annex: false, city: null };
        turn = { ...turn!, builtHexes: [...turn!.builtHexes, hex] };
        events.push({ type: "built", seat, hex, structure: "workshop" });
        events.push({ type: "resources", seat, delta: negateBundle(cost), reason: "build" });
    }

    const rest = state.pending.slice(1);
    const left = Math.max(0, d.spades - distance);
    const pending: Decision[] = left > 0
        ? [{ ...d, id: `${d.id}-rest`, spades: left, canBuild: false }, ...rest]
        : rest;
    return {
        state: {
            ...state,
            hexes: { ...state.hexes, [hex]: { terrain, structure } },
            players: state.players.map((q) => (q.seat === seat ? player : q)),
            turn,
            pending,
        },
        events,
    };
}

/** 放弃这个决策（免费铲子、建桥、学科前进都能放弃）：移出队列，别的都不变 */
export function applySkip(state: GameState): Applied {
    return { state: { ...state, pending: state.pending.slice(1) }, events: [] };
}