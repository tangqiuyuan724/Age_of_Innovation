// 假数据：一局进行到第 2 轮的 3 人游戏。
// 只用来在引擎和服务器接好之前预览界面；M2 起换成服务器发来的快照。
import { CONTRACT_VERSION, STARTING_VP, type GameState, type PlayerState } from "@aoi/engine/aoi";

export const MOCK_NAMES = ["小唐", "朋友A", "朋友B"];
export const MOCK_MY_SEAT = 0;

function player(p: Partial<PlayerState> & Pick<PlayerState, "seat" | "faction" | "homeTerrain">): PlayerState {
    return {
        planning: p.homeTerrain,
        vp: STARTING_VP,
        coins: 0, tools: 0, scholars: 0, scholarsInSupply: 7,
        books: { banking: 0, law: 0, engineering: 0, medicine: 0, gray: 0 },
        power: [5, 7, 0],
        bridges: 3, sailing: 0, terraforming: 0,
        science: { banking: 0, law: 0, engineering: 0, medicine: 0 },
        keys: 0,
        buildingsLeft: { workshop: 9, guild: 4, school: 3, university: 1, palace: 1 },
        palaceTile: null, innovations: [], competencies: [], cityTiles: [], bonusTile: null,
        specialsUsed: [], passed: false,
        ...p,
    };
}

export const MOCK_STATE: GameState = {
    contractVersion: CONTRACT_VERSION,
    version: 37,
    options: { playerCount: 3, mapId: "base" },
    rng: 20261124,
    round: 2,
    phase: "actions",
    turnOrder: [1, 0, 2],
    nextTurnOrder: [],
    turn: { seat: 2, mainActionDone: false },
    pending: [{ id: "d-41", seat: 0, kind: "leech", from: 1, power: 2, vpCost: 1 }],
    hexes: {},
    bridges: [],
    cities: [],
    players: [
        player({
            seat: 0, faction: "philosophers", homeTerrain: "plains",
            vp: 27, coins: 6, tools: 3, scholars: 1, scholarsInSupply: 4,
            books: { banking: 1, law: 2, engineering: 0, medicine: 0, gray: 0 },
            power: [2, 8, 2], sailing: 1, terraforming: 1,
            science: { banking: 3, law: 5, engineering: 1, medicine: 0 },
            buildingsLeft: { workshop: 6, guild: 3, school: 2, university: 1, palace: 1 },
            competencies: ["law-2"], bonusTile: "bonus-4",
        }),
        player({
            seat: 1, faction: "moles", homeTerrain: "mountain",
            vp: 31, coins: 2, tools: 5, scholars: 0, scholarsInSupply: 5,
            books: { banking: 0, law: 0, engineering: 2, medicine: 1, gray: 0 },
            power: [0, 6, 6], terraforming: 2,
            science: { banking: 0, law: 1, engineering: 6, medicine: 2 },
            buildingsLeft: { workshop: 5, guild: 2, school: 3, university: 1, palace: 0 },
            palaceTile: 9, bonusTile: "bonus-7",
        }),
        player({
            seat: 2, faction: "navigators", homeTerrain: "lake",
            vp: 22, coins: 11, tools: 1, scholars: 2, scholarsInSupply: 3,
            books: { banking: 0, law: 0, engineering: 0, medicine: 3, gray: 1 },
            power: [4, 7, 1], sailing: 2,
            science: { banking: 2, law: 0, engineering: 0, medicine: 4 },
            buildingsLeft: { workshop: 7, guild: 4, school: 2, university: 1, palace: 1 },
            bonusTile: "bonus-1",
        }),
    ],
    board: {
        powerActionsUsed: ["coins7", "spade1"],
        bookActions: ["power5", "coins6", "spade3"],
        bookActionsUsed: ["coins6"],
        scholarSpaces: {
            banking: [0, null, null, null],
            law: [0, null, null, null],
            engineering: [1, 1, null, null],
            medicine: [2, null, null, null],
        },
        level12: { banking: null, law: null, engineering: null, medicine: null },
        roundScores: ["rs-1", "rs-2", "rs-3", "rs-4", "rs-5", "rs-6"],
        finalRoundScore: "frs-1",
        bonusTiles: [
            { id: "bonus-2", coins: 1 },
            { id: "bonus-5", coins: 2 },
            { id: "bonus-9", coins: 1 },
        ],
        innovationsAvailable: [],
        competenciesLeft: {},
        palaceTilesAvailable: [3, 12, 17],
        cityTilesLeft: {},
    },
    finalScores: null,
};
