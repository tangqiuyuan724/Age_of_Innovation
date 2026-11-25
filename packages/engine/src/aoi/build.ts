// 主行动"改造并建造"：把一格的地形朝自己的家园地形改造，改成家园地形后可以建工坊。
import { BUILD_WORKSHOP_COST, TOOLS_PER_SPADE } from "./constants.js";
import { isInReach } from "./reach.js";
import { addBundles, negateBundle, payResources } from "./resources.js";
import { terrainDistance, terraformToward } from "./terrain.js";
import { checkMainAction, type Applied } from "./turn.js";
import type { GameEvent, GameState, HexId, PlayerState, ResourceBundle, RuleError, Seat, Structure } from "./types.js";

/** 用工具买 spades 把铲子要付多少：每把铲子的工具数看改造轨等级 */
export function spadeCost(p: PlayerState, spades: number): ResourceBundle {
    return spades === 0 ? {} : { tools: spades * TOOLS_PER_SPADE[p.terraforming] };
}

export function validateTerraformAndBuild(
    state: GameState, seat: Seat, hex: HexId, spades: number, build: boolean,
): RuleError | null {
    const error = checkMainAction(state, seat);
    if (error !== null) return error;
    const p = state.players[seat];
    const h = state.hexes[hex];
    if (h === undefined) return "bad-move";
    if (h.structure !== null) return "hex-occupied";
    if (!isInReach(state, seat, hex)) return "not-in-reach";

    const distance = terrainDistance(h.terrain, p.homeTerrain);
    if (!Number.isInteger(spades) || spades < 0 || spades > distance) return "bad-move";
    if (spades === 0 && !build) return "bad-move"; // 什么都不做
    if (build) {
        if (spades !== distance) return "not-home-terrain"; // 改造完还不是家园地形，不能建
        if (p.buildingsLeft.workshop === 0) return "limit-reached";
    }
    const cost = addBundles(spadeCost(p, spades), build ? BUILD_WORKSHOP_COST : {});
    if (payResources(p, cost) === null) return "insufficient-resources";
    return null;
}

/** 改造（可以只改一部分），并且可以选择建工坊。调用前先用 validateTerraformAndBuild 检查 */
export function applyTerraformAndBuild(
    state: GameState, seat: Seat, hex: HexId, spades: number, build: boolean,
): Applied {
    const p = state.players[seat];
    const h = state.hexes[hex];
    const cost = addBundles(spadeCost(p, spades), build ? BUILD_WORKSHOP_COST : {});
    const events: GameEvent[] = [];

    let player = payResources(p, cost)!;
    const terrain = terraformToward(h.terrain, p.homeTerrain, spades);
    if (terrain !== h.terrain) events.push({ type: "terraformed", seat, hex, from: h.terrain, to: terrain });
    if (build) {
        player = { ...player, buildingsLeft: { ...player.buildingsLeft, workshop: player.buildingsLeft.workshop - 1 } };
        events.push({ type: "built", seat, hex, structure: "workshop" });
    }
    events.push({ type: "resources", seat, delta: negateBundle(cost), reason: build ? "build" : "terraform" });

    const structure: Structure | null = build
        ? { owner: seat, type: "workshop", neutral: false, annex: false, city: null }
        : null;
    const turn = state.turn!;
    return {
        state: {
            ...state,
            hexes: { ...state.hexes, [hex]: { terrain, structure } },
            players: state.players.map((q) => (q.seat === seat ? player : q)),
            turn: { ...turn, mainActionDone: true, builtHexes: build ? [...turn.builtHexes, hex] : turn.builtHexes },
        },
        events,
    };
}