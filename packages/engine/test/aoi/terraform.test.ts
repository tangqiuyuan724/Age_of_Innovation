import { describe, it, expect } from "vitest";
import { applyTerraformAndBuild, negateBundle, validateTerraformAndBuild } from "../../src/aoi/index.ts";
import { readyGame, seatOf, turnOf, withPlayer } from "./fixtures.ts";

// 平原玩家的工坊在 C6 和 E1。C6 旁边：D5 沙漠、D6 荒地、C7 沼泽玩家的工坊、B6 森林玩家的工坊
const base = readyGame();
const plains = seatOf(base, "plains");
const swamp = seatOf(base, "swamp");
const game = withPlayer(turnOf(base, plains), plains, { tools: 10, coins: 20 });

describe("negateBundle：费用写进事件时变成负数", () => {
    it("每一项取相反数，书也一样；没有的项不出现", () => {
        expect(negateBundle({ tools: 4, coins: 2 })).toEqual({ tools: -4, coins: -2 });
        expect(negateBundle({ books: { law: 1 } })).toEqual({ books: { law: -1 } });
        expect(negateBundle({})).toEqual({});
    });
});

describe("改造并建造：能不能做", () => {
    it("沙漠 D5 离平原 1 铲：改造并建工坊", () => {
        expect(validateTerraformAndBuild(game, plains, "D5", 1, true)).toBeNull();
    });
    it("荒地 D6 离平原 2 铲：只用 1 铲可以，但不能建", () => {
        expect(validateTerraformAndBuild(game, plains, "D6", 1, false)).toBeNull();
        expect(validateTerraformAndBuild(game, plains, "D6", 1, true)).toBe("not-home-terrain");
    });
    it("铲子数不对、什么都不做、格子不存在：bad-move", () => {
        expect(validateTerraformAndBuild(game, plains, "D5", 2, false)).toBe("bad-move");
        expect(validateTerraformAndBuild(game, plains, "D5", 0, false)).toBe("bad-move");
        expect(validateTerraformAndBuild(game, plains, "Z9", 1, false)).toBe("bad-move");
    });
    it("有建筑：hex-occupied；够不着：not-in-reach", () => {
        expect(validateTerraformAndBuild(game, plains, "C7", 0, true)).toBe("hex-occupied");
        expect(validateTerraformAndBuild(game, plains, "I12", 0, true)).toBe("not-in-reach");
    });
    it("工具不够：insufficient-resources；工坊用完了：limit-reached", () => {
        const poor = withPlayer(game, plains, { tools: 3 }); // 1 铲 3 工具 + 建工坊 1 工具
        expect(validateTerraformAndBuild(poor, plains, "D5", 1, true)).toBe("insufficient-resources");
        expect(validateTerraformAndBuild(poor, plains, "D5", 1, false)).toBeNull();
        const noneLeft = withPlayer(game, plains, { buildingsLeft: { ...game.players[plains].buildingsLeft, workshop: 0 } });
        expect(validateTerraformAndBuild(noneLeft, plains, "D5", 1, true)).toBe("limit-reached");
    });
    it("做过主行动了：main-action-done", () => {
        const { state } = applyTerraformAndBuild(game, plains, "D5", 1, false);
        expect(validateTerraformAndBuild(state, plains, "D6", 1, false)).toBe("main-action-done");
    });
});

describe("改造并建造：执行", () => {
    const { state, events } = applyTerraformAndBuild(game, plains, "D5", 1, true);
    const p = state.players[plains];

    it("格子变成平原，上面有平原玩家的工坊", () => {
        expect(state.hexes.D5).toEqual({
            terrain: "plains",
            structure: { owner: plains, type: "workshop", neutral: false, annex: false, city: null },
        });
    });
    it("付 1 铲 3 工具 + 工坊 1 工具 2 金币；规划板上少一座工坊", () => {
        expect(p.tools).toBe(10 - 4);
        expect(p.coins).toBe(20 - 2);
        expect(p.buildingsLeft.workshop).toBe(game.players[plains].buildingsLeft.workshop - 1);
    });
    it("主行动做过了；D5 记进本回合建过的格子", () => {
        expect(state.turn!.mainActionDone).toBe(true);
        expect(state.turn!.builtHexes).toEqual(["D5"]);
    });
    it("事件：改造、建造、付资源", () => {
        expect(events).toEqual([
            { type: "terraformed", seat: plains, hex: "D5", from: "desert", to: "plains" },
            { type: "built", seat: plains, hex: "D5", structure: "workshop" },
            { type: "resources", seat: plains, delta: { tools: -4, coins: -2 }, reason: "build" },
        ]);
    });
    it("不修改传入的状态", () => {
        expect(game.hexes.D5).toEqual({ terrain: "desert", structure: null });
        expect(game.players[plains].tools).toBe(10);
    });
    it("只改一部分：荒地用 1 铲变成沙漠（朝平原走一步），不建", () => {
        const { state: after } = applyTerraformAndBuild(game, plains, "D6", 1, false);
        expect(after.hexes.D6).toEqual({ terrain: "desert", structure: null });
        expect(after.turn!.builtHexes).toEqual([]);
    });
    it("改造轨升了一级：每铲 2 工具", () => {
        const skilled = withPlayer(game, plains, { terraforming: 1 });
        const { state: after } = applyTerraformAndBuild(skilled, plains, "D6", 2, false);
        expect(after.players[plains].tools).toBe(10 - 4);
    });
});

describe("可达范围：隔着河", () => {
    // 沼泽玩家的工坊在 C7；D8 是沼泽，和 C7 之间隔一格河（D7）
    const s = withPlayer(turnOf(base, swamp), swamp, { tools: 5, coins: 10 });

    it("航行 0：够不着", () => {
        expect(validateTerraformAndBuild(s, swamp, "D8", 0, true)).toBe("not-in-reach");
    });
    it("航行 1：够得着，本来就是沼泽，不用改造直接建", () => {
        expect(validateTerraformAndBuild(withPlayer(s, swamp, { sailing: 1 }), swamp, "D8", 0, true)).toBeNull();
    });
    it("拿着回合奖励板块\"河边工坊\"：航行范围 +1，也够得着", () => {
        expect(validateTerraformAndBuild(withPlayer(s, swamp, { bonusTile: "riverWorkshop" }), swamp, "D8", 0, true)).toBeNull();
    });
});