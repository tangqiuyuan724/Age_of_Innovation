import { describe, it, expect } from "vitest";
import {
    applyPalaceTile, applyUpgrade, upgradeCost, validatePalaceTile, validateUpgrade,
} from "../../src/aoi/index.ts";
import { readyGame, seatOf, turnOf, withPlayer, withStructure } from "./fixtures.ts";

const base = readyGame();
const plains = seatOf(base, "plains");
const game = withPlayer(turnOf(base, plains), plains, { tools: 10, coins: 20 });

describe("升级的费用", () => {
    it("C6 工坊旁边有别人的建筑（C7、B6）：升行会只要 2 工具 3 金币", () => {
        expect(upgradeCost(game, plains, "C6", "guild")).toEqual({ tools: 2, coins: 3 });
    });
    it("E1 工坊旁边没有别人的建筑：2 工具 6 金币", () => {
        expect(upgradeCost(game, plains, "E1", "guild")).toEqual({ tools: 2, coins: 6 });
    });
    it("旁边只有自己的建筑：不算，还是 6 金币", () => {
        const own = withStructure(game, "E2", plains, "workshop");
        expect(upgradeCost(own, plains, "E1", "guild")).toEqual({ tools: 2, coins: 6 });
    });
    it("其他升级没有优惠", () => {
        expect(upgradeCost(game, plains, "C6", "school")).toEqual({ tools: 3, coins: 5 });
    });
});

describe("升级：能不能做", () => {
    it("不是自己的建筑、空格子、不存在的格子：no-own-building", () => {
        expect(validateUpgrade(game, plains, "C7", "guild")).toBe("no-own-building");
        expect(validateUpgrade(game, plains, "D5", "guild")).toBe("no-own-building");
        expect(validateUpgrade(game, plains, "Z9", "guild")).toBe("no-own-building");
    });
    it("跳级：cannot-upgrade；行会用完了：limit-reached；钱不够：insufficient-resources", () => {
        expect(validateUpgrade(game, plains, "C6", "school")).toBe("cannot-upgrade");
        const noGuild = withPlayer(game, plains, { buildingsLeft: { ...game.players[plains].buildingsLeft, guild: 0 } });
        expect(validateUpgrade(noGuild, plains, "C6", "guild")).toBe("limit-reached");
        expect(validateUpgrade(withPlayer(game, plains, { coins: 2 }), plains, "C6", "guild")).toBe("insufficient-resources");
    });
    it("行会可以升学校或宫殿，学校可以升大学", () => {
        const g = withStructure(game, "C6", plains, "guild");
        expect(validateUpgrade(g, plains, "C6", "school")).toBeNull();
        expect(validateUpgrade(g, plains, "C6", "palace")).toBeNull();
        expect(validateUpgrade(withStructure(game, "C6", plains, "school"), plains, "C6", "university")).toBeNull();
    });
});

describe("升级：执行", () => {
    const { state, events } = applyUpgrade(game, plains, "C6", "guild");
    const before = game.players[plains].buildingsLeft;

    it("格子上换成行会；行会从规划板上拿走，工坊放回去", () => {
        expect(state.hexes.C6.structure!.type).toBe("guild");
        expect(state.players[plains].buildingsLeft).toEqual({ ...before, guild: before.guild - 1, workshop: before.workshop + 1 });
    });
    it("付钱；主行动做过了；C6 记进本回合建过的格子（升级也算建造，邻居能吸能）", () => {
        expect(state.players[plains].coins).toBe(20 - 3);
        expect(state.turn!.mainActionDone).toBe(true);
        expect(state.turn!.builtHexes).toEqual(["C6"]);
    });
    it("事件：升级、付资源", () => {
        expect(events).toEqual([
            { type: "upgraded", seat: plains, hex: "C6", from: "workshop", to: "guild" },
            { type: "resources", seat: plains, delta: { tools: -2, coins: -3 }, reason: "upgrade" },
        ]);
    });
});

describe("升级成宫殿：选宫殿板块", () => {
    const g = withStructure(game, "C6", plains, "guild");
    const { state } = applyUpgrade(g, plains, "C6", "palace");
    const tile = g.board.palaceTilesAvailable[0];

    it("还没有宫殿板块（固定组合开局）：排进一个选宫殿板块的决策，可选的是场上那几个", () => {
        expect(state.pending).toEqual([
            { id: `palaceTile-${g.version}`, seat: plains, kind: "palaceTile", options: g.board.palaceTilesAvailable },
        ]);
    });
    it("轮抽开局时宫殿板块已经在手上：不用再选", () => {
        const drafted = withPlayer(g, plains, { palaceTile: 5 });
        expect(applyUpgrade(drafted, plains, "C6", "palace").state.pending).toEqual([]);
    });
    it("选场上有的：可以；选场上没有的：invalid-choice；别人来选：not-your-decision", () => {
        expect(validatePalaceTile(state, plains, tile)).toBeNull();
        expect(validatePalaceTile(state, plains, 99)).toBe("invalid-choice");
        expect(validatePalaceTile(state, (plains + 1) % 3, tile)).toBe("not-your-decision");
    });
    it("选了以后：宫殿板块归这位玩家，场上少一个，决策移出队列", () => {
        const { state: after } = applyPalaceTile(state, plains, tile);
        expect(after.players[plains].palaceTile).toBe(tile);
        expect(after.board.palaceTilesAvailable).not.toContain(tile);
        expect(after.pending).toEqual([]);
    });
});