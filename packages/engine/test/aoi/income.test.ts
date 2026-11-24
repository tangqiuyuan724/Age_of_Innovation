import { describe, it, expect } from "vitest";
import {
    collectIncome, incomeOf, type GameState, type PlayerState,
} from "../../src/aoi/index.ts";

function player(overrides: Partial<PlayerState> = {}): PlayerState {
    return {
        seat: 0, faction: "goblins", planning: "plains", homeTerrain: "plains",
        vp: 20, coins: 0, tools: 0, scholars: 0, scholarsInSupply: 7,
        books: { banking: 0, law: 0, engineering: 0, medicine: 0 },
        power: [5, 7, 0], bridges: 3, sailing: 0, terraforming: 0,
        science: { banking: 0, law: 0, engineering: 0, medicine: 0 }, keys: 0,
        buildingsLeft: { workshop: 9, guild: 4, school: 3, university: 1, palace: 1 },
        palaceTile: null, innovations: [], competencies: [], cityTiles: [], bonusTile: null,
        specialsUsed: [], passed: false,
        ...overrides,
    };
}
const left = (workshop: number, guild = 4, school = 3, university = 1, palace = 1) =>
    ({ workshop, guild, school, university, palace });

describe("incomeOf：规划板", () => {
    it("什么都没建：只有固定的 1 工具", () => {
        expect(incomeOf(player())).toEqual({ tools: 1 });
    });
    it("建了 2 座工坊：1 + 2 = 3 工具", () => {
        expect(incomeOf(player({ buildingsLeft: left(7) }))).toEqual({ tools: 3 });
    });
    it("第 5 座工坊下面是空格：建 4 座和建 5 座收入一样", () => {
        expect(incomeOf(player({ buildingsLeft: left(5) }))).toEqual({ tools: 5 });
        expect(incomeOf(player({ buildingsLeft: left(4) }))).toEqual({ tools: 5 });
        expect(incomeOf(player({ buildingsLeft: left(3) }))).toEqual({ tools: 6 });
    });
    it("行会：前两个各 1 能量 2 金币，后两个各 2 能量 2 金币", () => {
        expect(incomeOf(player({ buildingsLeft: left(9, 3) }))).toEqual({ tools: 1, power: 1, coins: 2 });
        expect(incomeOf(player({ buildingsLeft: left(9, 1) }))).toEqual({ tools: 1, power: 4, coins: 6 });
    });
    it("学校、大学各 1 学者", () => {
        expect(incomeOf(player({ buildingsLeft: left(9, 4, 1, 0) }))).toEqual({ tools: 1, scholars: 3 });
    });
    it("山脉：固定收入多 2 金币，第一个行会 3 金币", () => {
        expect(incomeOf(player({ planning: "mountain" }))).toEqual({ tools: 1, coins: 2 });
        expect(incomeOf(player({ planning: "mountain", buildingsLeft: left(9, 3) })))
            .toEqual({ tools: 1, coins: 5, power: 1 });
    });
});

describe("incomeOf：宫殿、回合奖励板块、学科", () => {
    it("宫殿建好后，宫殿板块的收入", () => {
        const palaceBuilt = left(9, 4, 3, 1, 0);
        expect(incomeOf(player({ palaceTile: 9, buildingsLeft: palaceBuilt }))).toEqual({ tools: 1, scholars: 1 });
        expect(incomeOf(player({ palaceTile: 6, buildingsLeft: palaceBuilt })))
            .toEqual({ tools: 1, power: 2, books: { gray: 1 } });
        expect(incomeOf(player({ palaceTile: 2, buildingsLeft: palaceBuilt }))).toEqual({ tools: 1 });
    });
    it("宫殿板块拿在手上、宫殿还没建（轮抽开局）：没有收入", () => {
        expect(incomeOf(player({ palaceTile: 9 }))).toEqual({ tools: 1 });
    });
    it("回合奖励板块的收入", () => {
        expect(incomeOf(player({ bonusTile: "coins6" }))).toEqual({ tools: 1, coins: 6 });
        expect(incomeOf(player({ bonusTile: "levelAction" }))).toEqual({ tools: 3 });
        expect(incomeOf(player({ bonusTile: "riverWorkshop" }))).toEqual({ tools: 1 });
    });
    it("学科 9 级及以上才有额外收入", () => {
        const science = { banking: 9, law: 12, engineering: 8, medicine: 10 };
        expect(incomeOf(player({ science }))).toEqual({ tools: 1, coins: 3, power: 6, vp: 3 });
    });
});

describe("collectIncome", () => {
    const state = {
        round: 2,
        pending: [],
        players: [
            player({ seat: 0, bonusTile: "spadeAction", power: [1, 11, 0] }),
            player({ seat: 1, bonusTile: "scholarSend", scholarsInSupply: 0 }),
        ],
    } as unknown as GameState;

    it("每个人都拿到收入", () => {
        const next = collectIncome(state);
        expect(next.players[0].tools).toBe(1);
        expect(next.players[1].tools).toBe(1);
    });
    it("学者供应区空了就拿不到学者", () => {
        expect(collectIncome(state).players[1].scholars).toBe(0);
    });
    it("任选颜色的书排进待决策队列", () => {
        expect(collectIncome(state).pending).toEqual([
            { id: "income-2-0", seat: 0, kind: "bookColor", count: 1 },
        ]);
    });
    it("不修改传入的状态", () => {
        collectIncome(state);
        expect(state.players[0].tools).toBe(0);
        expect(state.pending).toEqual([]);
    });
});