import { describe, it, expect } from "vitest";
import {
    applyDraftPick, applyInitialWorkshop, applyPickSet, createGame, draftOptions, draftOrder,
    initialWorkshopOrder, pickSetOrder, validateDraftPick, validateInitialWorkshop, validatePickSet,
    type DraftItem, type GameState, type HexId, type SetupOptions, type SetupSet, type Terrain,
} from "../../src/aoi/index.ts";

const OPTIONS: SetupOptions = { playerCount: 3, mapId: "aoi-base", setupMode: { kind: "sets" } };
const DRAFT_OPTIONS: SetupOptions = { playerCount: 3, mapId: "aoi-base", setupMode: { kind: "draft", order: "snake" } };

describe("createGame（固定组合）", () => {
    const game = createGame(OPTIONS, "seed-1");

    it("开局状态：第 0 轮、setup 阶段、还没有玩家", () => {
        expect(game.round).toBe(0);
        expect(game.phase).toBe("setup");
        expect(game.players).toEqual([]);
        expect(game.turn).toBeNull();
    });
    it("行动顺序：随机一个起始玩家，然后按座位顺时针", () => {
        const [first, second, third] = game.turnOrder;
        expect([...game.turnOrder].sort()).toEqual([0, 1, 2]);
        expect(second).toBe((first + 1) % 3);
        expect(third).toBe((first + 2) % 3);
    });
    it("7 组开局组合：7 块规划板各一组，派系和回合奖励板块都不重复", () => {
        const sets = game.board.setupSets;
        expect(sets.map((s) => s.id)).toEqual([0, 1, 2, 3, 4, 5, 6]);
        expect(new Set(sets.map((s) => s.planning)).size).toBe(7);
        expect(new Set(sets.map((s) => s.faction)).size).toBe(7);
        expect(new Set(sets.map((s) => s.bonusTile)).size).toBe(7);
        expect(sets.every((s) => s.takenBy === null)).toBe(true);
    });
    it("剩下 3 个回合奖励板块放到场上，各有 1 金币", () => {
        const onBoard = game.board.bonusTiles;
        expect(onBoard).toHaveLength(3);
        expect(onBoard.every((t) => t.coins === 1)).toBe(true);
        const inSets = game.board.setupSets.map((s) => s.bonusTile);
        expect(onBoard.some((t) => inSets.includes(t.id))).toBe(false);
    });
    it("3 个书本行动、6 个回合计分板块，都不重复", () => {
        expect(new Set(game.board.bookActions).size).toBe(3);
        expect(new Set(game.board.roundScores).size).toBe(6);
    });
    it("宫殿板块：17 号一定在，另外随机 人数+1 个", () => {
        const tiles = game.board.palaceTilesAvailable;
        expect(tiles).toHaveLength(5);
        expect(tiles).toContain(17);
        expect(new Set(tiles).size).toBe(5);
    });
    it("地图：81 个陆地格，都还没有建筑", () => {
        const hexes = Object.values(game.hexes);
        expect(hexes).toHaveLength(81);
        expect(hexes.every((h) => h.structure === null)).toBe(true);
    });
    it("第一个决策：行动顺序最后的人先选组合，7 组都能选", () => {
        const last = game.turnOrder[2];
        expect(game.pending).toEqual([
            { id: `pickSet-${last}`, seat: last, kind: "pickSet", options: [0, 1, 2, 3, 4, 5, 6] },
        ]);
    });
    it("同一个种子开出同一局；不同种子开出不同的局", () => {
        expect(createGame(OPTIONS, "seed-1")).toEqual(game);
        expect(createGame(OPTIONS, "seed-2").board.setupSets).not.toEqual(game.board.setupSets);
    });
    it("人数不对、地图不存在：直接报错", () => {
        expect(() => createGame({ ...OPTIONS, playerCount: 6 }, "x")).toThrow();
        expect(() => createGame({ ...OPTIONS, mapId: "nope" }, "x")).toThrow();
    });
});

/**
 * 测试小工具：把随机摆出的 7 组换成固定的 7 组，这样每组选到什么是确定的。
 * 第 k 组（k = 0~6）的规划板按下面这个顺序。
 */
const FIXED: Omit<SetupSet, "id" | "takenBy">[] = [
    { planning: "wasteland", faction: "goblins", bonusTile: "coins6" },
    { planning: "swamp", faction: "navigators", bonusTile: "spadeAction" },
    { planning: "forest", faction: "blessed", bonusTile: "guildBuild" },
    { planning: "lake", faction: "lizards", bonusTile: "scholarSend" },
    { planning: "desert", faction: "moles", bonusTile: "levelAction" },
    { planning: "plains", faction: "philosophers", bonusTile: "schoolsPass" },
    { planning: "mountain", faction: "omar", bonusTile: "bridgeAction" },
];
function fixedGame(seed = "seed-1"): GameState {
    const game = createGame(OPTIONS, seed);
    const setupSets = FIXED.map((s, i) => ({ ...s, id: i, takenBy: null }));
    return { ...game, board: { ...game.board, setupSets } };
}

/** 按顺序帮每个人选组合：第 1 个选的人拿 picks[0]，以此类推 */
function pickAll(game: GameState, picks: number[]): GameState {
    let state = game;
    for (const setId of picks) {
        const seat = state.pending[0].seat;
        expect(validatePickSet(state, seat, setId)).toBeNull();
        state = applyPickSet(state, seat, setId);
    }
    return state;
}

describe("选组合", () => {
    const game = fixedGame();
    const order = pickSetOrder(game);

    it("选组合的顺序是行动顺序倒过来", () => {
        expect(order).toEqual([...game.turnOrder].reverse());
    });
    it("不是你选：not-your-decision；选不存在或被选走的组：invalid-choice", () => {
        expect(validatePickSet(game, order[1], 0)).toBe("not-your-decision");
        expect(validatePickSet(game, order[0], 7)).toBe("invalid-choice");
        const after = applyPickSet(game, order[0], 0);
        expect(validatePickSet(after, order[1], 0)).toBe("invalid-choice");
    });
    it("选了一组之后：这组记上座位，轮到下一个人，可选的少一组", () => {
        const after = applyPickSet(game, order[0], 3);
        expect(after.board.setupSets[3].takenBy).toBe(order[0]);
        expect(after.pending).toEqual([
            { id: `pickSet-${order[1]}`, seat: order[1], kind: "pickSet", options: [0, 1, 2, 4, 5, 6] },
        ]);
        expect(after.players).toEqual([]);
    });
    it("不修改传入的状态", () => {
        applyPickSet(game, order[0], 3);
        expect(game.board.setupSets[3].takenBy).toBeNull();
    });
});

describe("所有人选完组合：建立玩家", () => {
    // 第 1 个选的人拿荒地+哥布林，第 2 个拿沼泽+航海家，第 3 个拿森林+圣者
    const game = pickAll(fixedGame(), [0, 1, 2]);
    const [p1, p2, p3] = pickSetOrder(game).map((seat) => game.players[seat]);

    it("players 按座位排好，每人记着自己选到的东西", () => {
        expect(game.players.map((p) => p.seat)).toEqual([0, 1, 2]);
        expect(p1.planning).toBe("wasteland");
        expect(p1.homeTerrain).toBe("wasteland");
        expect(p1.faction).toBe("goblins");
        expect(p1.bonusTile).toBe("coins6");
    });
    it("荒地 + 哥布林：4+1 工具、15 金币、20 分；书要等放完工坊再选", () => {
        expect(p1.tools).toBe(5);
        expect(p1.coins).toBe(15);
        expect(p1.vp).toBe(20);
        expect(p1.books).toEqual({ banking: 0, law: 0, engineering: 0, medicine: 0 });
        expect(p1.science).toEqual({ banking: 1, law: 0, engineering: 1, medicine: 0 });
        expect(p1.power).toEqual([5, 7, 0]);
    });
    it("沼泽 + 航海家：开局 1 学者，能量 3/9/0，法律 3 级", () => {
        expect(p2.scholars).toBe(1);
        expect(p2.scholarsInSupply).toBe(6);
        expect(p2.power).toEqual([3, 9, 0]);
        expect(p2.science.law).toBe(3);
    });
    it("森林 + 圣者：每门学科 1+1 级，能量 4/8/0", () => {
        expect(p3.science).toEqual({ banking: 2, law: 2, engineering: 2, medicine: 2 });
        expect(p3.power).toEqual([4, 8, 0]);
    });
    it("其他初始值：3 座桥、建筑都在规划板上", () => {
        expect(p1.bridges).toBe(3);
        expect(p1.buildingsLeft).toEqual({ workshop: 9, guild: 4, school: 3, university: 1, palace: 1 });
        expect(p1.sailing).toBe(0);
    });
    it("下一个决策：行动顺序第一个人放初始工坊", () => {
        expect(game.pending).toEqual([
            { id: "initialWorkshop-0", seat: game.turnOrder[0], kind: "initialWorkshop" },
        ]);
    });
});

/** 每种地形在 aoi-base 地图上的几个格子（引擎编号） */
const SPOTS: Record<Terrain, HexId[]> = {
    wasteland: ["A6", "C1"],
    swamp: ["A4", "A10"],
    forest: ["A1", "B4"],
    lake: ["A3", "A9"],
    desert: ["A12", "B7"],
    plains: ["A5", "A11"],
    mountain: ["A7", "B1"],
};

/** 按顺序帮每个人放初始工坊，每人用自己地形的第 1、2 个格子 */
function placeAll(game: GameState): GameState {
    let state = game;
    const used: Record<number, number> = {};
    while (state.phase === "setup") {
        const seat = state.pending[0].seat;
        const k = used[seat] ?? 0;
        used[seat] = k + 1;
        const hex = SPOTS[state.players[seat].homeTerrain][k];
        expect(validateInitialWorkshop(state, seat, hex)).toBeNull();
        state = applyInitialWorkshop(state, seat, hex);
    }
    return state;
}

describe("放初始工坊", () => {
    const game = pickAll(fixedGame(), [0, 1, 2]);
    const first = game.turnOrder[0];
    const home = game.players[first].homeTerrain;

    it("顺序：按行动顺序一轮，再倒过来一轮", () => {
        const t = game.turnOrder;
        expect(initialWorkshopOrder(game)).toEqual([t[0], t[1], t[2], t[2], t[1], t[0]]);
    });
    it("各种放不了的情况", () => {
        expect(validateInitialWorkshop(game, game.turnOrder[1], SPOTS[home][0])).toBe("not-your-decision");
        expect(validateInitialWorkshop(game, first, "A2")).toBe("invalid-choice");   // 河流
        expect(validateInitialWorkshop(game, first, "Z9")).toBe("invalid-choice");   // 不存在
        const wrong = home === "plains" ? "A1" : "A5";
        expect(validateInitialWorkshop(game, first, wrong)).toBe("not-home-terrain");
    });
    it("放下之后：格子上有工坊，规划板上少一座，轮到下一个人", () => {
        const after = applyInitialWorkshop(game, first, SPOTS[home][0]);
        expect(after.hexes[SPOTS[home][0]].structure).toEqual({
            owner: first, type: "workshop", neutral: false, annex: false, city: null,
        });
        expect(after.players[first].buildingsLeft.workshop).toBe(8);
        expect(after.players[first].coins).toBe(game.players[first].coins); // 不花钱
        expect(after.pending[0]).toEqual({ id: "initialWorkshop-1", seat: game.turnOrder[1], kind: "initialWorkshop" });
    });
    it("已经有建筑的格子：hex-occupied", () => {
        // 直接造一个"这格已经有别人工坊"的状态来测
        const spot = SPOTS[home][0];
        const occupied = {
            ...game,
            hexes: { ...game.hexes, [spot]: { ...game.hexes[spot], structure: { owner: 1, type: "workshop" as const, neutral: false, annex: false, city: null } } },
        };
        expect(validateInitialWorkshop(occupied, first, spot)).toBe("hex-occupied");
    });
});

describe("开局结束", () => {
    it("工坊放完：进入第 1 轮收入阶段，每人 2 座工坊", () => {
        const done = placeAll(pickAll(fixedGame(), [0, 1, 2]));
        expect(done.round).toBe(1);
        expect(done.phase).toBe("income");
        expect(done.players.every((p) => p.buildingsLeft.workshop === 7)).toBe(true);
        const built = Object.values(done.hexes).filter((h) => h.structure !== null);
        expect(built).toHaveLength(6);
    });
    it("荒地的玩家要选 1 本书的颜色", () => {
        const done = placeAll(pickAll(fixedGame(), [0, 1, 2]));
        const seat = pickSetOrder(done)[0]; // 选了荒地的人
        expect(done.pending).toEqual([{ id: `setup-book-${seat}`, seat, kind: "bookColor", count: 1 }]);
    });
    it("蜥蜴选 2 次学科、沙漠用 1 把铲子，按行动顺序排队", () => {
        // 第 1、2、3 个选的人分别拿湖泊+蜥蜴、沙漠+鼹鼠、平原+哲学家
        const done = placeAll(pickAll(fixedGame(), [3, 4, 5]));
        const [lizard, desert] = pickSetOrder(done);
        const expected = [
            { id: `setup-level-${lizard}-0`, seat: lizard, kind: "scienceLevels", levels: 1 },
            { id: `setup-level-${lizard}-1`, seat: lizard, kind: "scienceLevels", levels: 1 },
            { id: `setup-spade-${desert}`, seat: desert, kind: "spades", spades: 1, canBuild: false },
        ];
        // 两个人谁先谁后取决于行动顺序
        const lizardFirst = done.turnOrder.indexOf(lizard) < done.turnOrder.indexOf(desert);
        expect(done.pending).toEqual(lizardFirst ? expected : [expected[2], expected[0], expected[1]]);
    });
    it("湖泊的航行从 1 开始", () => {
        const done = placeAll(pickAll(fixedGame(), [3, 4, 5]));
        expect(done.players[pickSetOrder(done)[0]].sailing).toBe(1);
    });
});

// ---------- 方式二：轮抽 ----------

const NOTHING_PICKED = { planning: null, faction: null, bonusTile: null, palaceTile: null };

describe("轮抽开局：createGame", () => {
    const game = createGame(DRAFT_OPTIONS, "seed-1");
    const pool = game.board.draft!;

    it("4 类分开摆：规划板、派系、宫殿板块各 人数+1 个，回合奖励板块 人数+3 个，都不重复", () => {
        expect(new Set(pool.planning).size).toBe(4);
        expect(new Set(pool.faction).size).toBe(4);
        expect(new Set(pool.bonusTile).size).toBe(6);
        expect(new Set(pool.palaceTile).size).toBe(4);
    });
    it("轮抽不用 17 号宫殿板块", () => {
        expect(pool.palaceTile).not.toContain(17);
    });
    it("还没人拿东西；固定组合是空的；场上还没有回合奖励板块和宫殿板块", () => {
        expect(pool.picks).toEqual([NOTHING_PICKED, NOTHING_PICKED, NOTHING_PICKED]);
        expect(game.board.setupSets).toEqual([]);
        expect(game.board.bonusTiles).toEqual([]);
        expect(game.board.palaceTilesAvailable).toEqual([]);
    });
    it("蛇形顺序：每人 4 次，1-2-3-3-2-1-1-2-3-3-2-1", () => {
        const [a, b, c] = game.turnOrder;
        expect(draftOrder(game)).toEqual([a, b, c, c, b, a, a, b, c, c, b, a]);
    });
    it("固定组合开局时没有轮抽顺序", () => {
        expect(draftOrder(createGame(OPTIONS, "seed-1"))).toEqual([]);
    });
    it("第一个决策：起始玩家先拿，4 类的东西都能拿", () => {
        const d = game.pending[0];
        expect(d.seat).toBe(game.turnOrder[0]);
        expect(d.kind === "draftPick" ? d.options.length : 0).toBe(4 + 4 + 6 + 4);
    });
});

describe("轮抽开局：拿东西", () => {
    const game = createGame(DRAFT_OPTIONS, "seed-1");
    const pool = game.board.draft!;
    const [a, b] = game.turnOrder;
    const planning: DraftItem = { category: "planning", id: pool.planning[0] };

    it("拿了之后：从池子里拿走，记到这个座位名下，轮到下一个人", () => {
        const after = applyDraftPick(game, a, planning);
        expect(after.board.draft!.planning).toEqual(pool.planning.slice(1));
        expect(after.board.draft!.picks[a].planning).toBe(pool.planning[0]);
        expect(after.pending[0].seat).toBe(b);
    });
    it("自己已经拿过的类别，不会再出现在可选项里", () => {
        const after = applyDraftPick(game, a, planning);
        const options = draftOptions(after.board.draft!, a);
        expect(options.some((o) => o.category === "planning")).toBe(false);
        expect(options).toHaveLength(4 + 6 + 4);
    });
    it("各种拿不了的情况", () => {
        expect(validateDraftPick(game, b, planning)).toBe("not-your-decision");
        expect(validateDraftPick(game, a, { category: "palaceTile", id: 17 })).toBe("invalid-choice");
        const after = applyDraftPick(game, a, planning);
        expect(validateDraftPick(after, b, planning)).toBe("invalid-choice"); // 已经被拿走了
        expect(validatePickSet(game, a, 0)).toBe("wrong-phase");              // 轮抽开局不能选组合
    });
    it("不修改传入的状态", () => {
        applyDraftPick(game, a, planning);
        expect(game.board.draft!.planning).toEqual(pool.planning);
        expect(game.board.draft!.picks[a]).toEqual(NOTHING_PICKED);
    });
});

/** 按顺序帮每个人拿东西：每次拿可选项里的第一个 */
function draftAll(game: GameState): GameState {
    let state = game;
    for (; ;) {
        const d = state.pending[0];
        if (d === undefined || d.kind !== "draftPick") return state;
        expect(validateDraftPick(state, d.seat, d.options[0])).toBeNull();
        state = applyDraftPick(state, d.seat, d.options[0]);
    }
}

describe("轮抽开局：拿完之后", () => {
    const done = draftAll(createGame(DRAFT_OPTIONS, "seed-1"));
    const picks = done.board.draft!.picks;

    it("每人 4 类各拿到 1 个", () => {
        for (const p of picks) {
            expect(p.planning).not.toBeNull();
            expect(p.faction).not.toBeNull();
            expect(p.bonusTile).not.toBeNull();
            expect(p.palaceTile).not.toBeNull();
        }
    });
    it("按拿到的东西建立玩家；宫殿板块已经在手上，宫殿还没建", () => {
        for (const p of done.players) {
            expect(p.planning).toBe(picks[p.seat].planning);
            expect(p.homeTerrain).toBe(picks[p.seat].planning);
            expect(p.faction).toBe(picks[p.seat].faction);
            expect(p.bonusTile).toBe(picks[p.seat].bonusTile);
            expect(p.palaceTile).toBe(picks[p.seat].palaceTile);
            expect(p.buildingsLeft.palace).toBe(1);
        }
    });
    it("剩下的 3 个回合奖励板块放到场上，各 1 金币", () => {
        const taken = done.players.map((p) => p.bonusTile);
        expect(done.board.bonusTiles).toHaveLength(3);
        expect(done.board.bonusTiles.every((t) => t.coins === 1)).toBe(true);
        expect(done.board.bonusTiles.some((t) => taken.includes(t.id))).toBe(false);
    });
    it("下一步放初始工坊；放完后和固定组合一样进入第 1 轮", () => {
        expect(done.pending).toEqual([{ id: "initialWorkshop-0", seat: done.turnOrder[0], kind: "initialWorkshop" }]);
        const end = placeAll(done);
        expect(end.round).toBe(1);
        expect(end.phase).toBe("income");
    });
});