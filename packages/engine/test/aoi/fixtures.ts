// 测试用的小工具：快速开出一局固定的游戏，并且可以随手改状态。
// 文件名不以 .test.ts 结尾，vitest 不会把它当成测试来跑，只给别的测试文件导入。
import {
    advance, applyInitialWorkshop, applyPickSet, createGame,
    type BuildingType, type GameState, type HexId, type PlayerState, type Seat, type SetupSet, type Terrain,
} from "../../src/aoi/index.ts";

/** 7 组固定组合：前 3 组是平原、沼泽、森林，都没有开局要选的东西 */
const SETS: Omit<SetupSet, "id" | "takenBy">[] = [
    { planning: "plains", faction: "philosophers", bonusTile: "coins6" },
    { planning: "swamp", faction: "navigators", bonusTile: "guildBuild" },
    { planning: "forest", faction: "blessed", bonusTile: "levelAction" },
    { planning: "lake", faction: "lizards", bonusTile: "scholarSend" },
    { planning: "desert", faction: "moles", bonusTile: "spadeAction" },
    { planning: "wasteland", faction: "goblins", bonusTile: "schoolsPass" },
    { planning: "mountain", faction: "omar", bonusTile: "bridgeAction" },
];

/**
 * 初始工坊放在哪：C6（平原）、C7（沼泽）、B6（森林）三格两两相邻，方便测吸能；
 * 每人另一个工坊放在远处。
 */
const START: Partial<Record<Terrain, HexId[]>> = {
    plains: ["C6", "E1"],
    swamp: ["C7", "A10"],
    forest: ["B6", "I1"],
    desert: ["D5", "A12"],
    wasteland: ["A6", "C1"],
    lake: ["G1", "H10"],
};

/**
 * 开出一局 3 人游戏：选组合 → 放初始工坊 → 第 1 轮收入，停在行动阶段第一个人的回合。
 * picks 是依次选的组合编号；选了荒地（5）、沙漠（4）的话，停在开局决策那里
 */
export function readyGame(picks: number[] = [0, 1, 2]): GameState {
    const base = createGame({ playerCount: 3, mapId: "aoi-base", setupMode: { kind: "sets" } }, "m14");
    let state: GameState = {
        ...base,
        board: { ...base.board, setupSets: SETS.map((s, i) => ({ ...s, id: i, takenBy: null })) },
    };
    for (const id of picks) state = applyPickSet(state, state.pending[0].seat, id);
    const placed: Record<number, number> = {};
    while (state.phase === "setup") {
        const seat = state.pending[0].seat;
        const k = placed[seat] ?? 0;
        placed[seat] = k + 1;
        state = applyInitialWorkshop(state, seat, START[state.players[seat].homeTerrain]![k]);
    }
    return advance(state); // 开局没有要选的东西，就直接开始第 1 轮
}

/** 家园地形是 terrain 的那位玩家的座位号 */
export function seatOf(state: GameState, terrain: Terrain): Seat {
    return state.players.find((p) => p.homeTerrain === terrain)!.seat;
}

/** 改某位玩家的几个字段 */
export function withPlayer(state: GameState, seat: Seat, overrides: Partial<PlayerState>): GameState {
    return { ...state, players: state.players.map((p) => (p.seat === seat ? { ...p, ...overrides } : p)) };
}

/** 直接轮到某位玩家（跳过前面的人） */
export function turnOf(state: GameState, seat: Seat): GameState {
    return { ...state, turn: { seat, mainActionDone: false, builtHexes: [] } };
}

/** 直接在一格上放（或换成）某位玩家的建筑 */
export function withStructure(state: GameState, hex: HexId, owner: Seat, type: BuildingType): GameState {
    return {
        ...state,
        hexes: { ...state.hexes, [hex]: { ...state.hexes[hex], structure: { owner, type, neutral: false, annex: false, city: null } } },
    };
}