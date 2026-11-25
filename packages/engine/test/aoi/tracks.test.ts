import { describe, it, expect } from "vitest";
import {
    applyAdvanceTrack, isInReach, spadeCost, validateAdvanceTrack,
} from "../../src/aoi/index.ts";
import { readyGame, seatOf, turnOf, withPlayer } from "./fixtures.ts";

const base = readyGame();
const swamp = seatOf(base, "swamp");
const plains = seatOf(base, "plains");
// 沼泽玩家：开局航行 0、改造 0
const game = withPlayer(turnOf(base, swamp), swamp, { coins: 20, tools: 5, scholars: 3, scholarsInSupply: 3 });

describe("推进轨道：能不能做", () => {
    it("钱和学者够：两条轨道都能推进", () => {
        expect(validateAdvanceTrack(game, swamp, "sailing")).toBeNull();
        expect(validateAdvanceTrack(game, swamp, "terraforming")).toBeNull();
    });
    it("航行到 3 级、改造到 2 级就到顶了：limit-reached", () => {
        expect(validateAdvanceTrack(withPlayer(game, swamp, { sailing: 3 }), swamp, "sailing")).toBe("limit-reached");
        expect(validateAdvanceTrack(withPlayer(game, swamp, { terraforming: 2 }), swamp, "terraforming")).toBe("limit-reached");
    });
    it("没有学者、金币不够：insufficient-resources", () => {
        expect(validateAdvanceTrack(withPlayer(game, swamp, { scholars: 0 }), swamp, "sailing")).toBe("insufficient-resources");
        expect(validateAdvanceTrack(withPlayer(game, swamp, { coins: 4 }), swamp, "terraforming")).toBe("insufficient-resources");
    });
    it("不是这两条轨道：bad-move", () => {
        expect(validateAdvanceTrack(game, swamp, "science" as "sailing")).toBe("bad-move");
    });
});

describe("航行轨", () => {
    const { state, events } = applyAdvanceTrack(game, swamp, "sailing");
    const before = game.players[swamp];
    const after = state.players[swamp];

    it("付 4 金币、1 学者（学者回供应区）；航行 0 → 1，奖励 2 分", () => {
        expect(after.sailing).toBe(1);
        expect(after.coins).toBe(before.coins - 4);
        expect(after.scholars).toBe(before.scholars - 1);
        expect(after.scholarsInSupply).toBe(before.scholarsInSupply + 1);
        expect(after.vp).toBe(before.vp + 2);
    });
    it("主行动做过了；事件：付费用、拿奖励", () => {
        expect(state.turn!.mainActionDone).toBe(true);
        expect(events).toEqual([
            { type: "resources", seat: swamp, delta: { coins: -4, scholars: -1 }, reason: "advanceTrack" },
            { type: "resources", seat: swamp, delta: { vp: 2 }, reason: "trackReward" },
        ]);
    });
    it("航行到 1 级以后，隔一格河的 D8 够得着了", () => {
        expect(isInReach(game, swamp, "D8")).toBe(false);
        expect(isInReach(state, swamp, "D8")).toBe(true);
    });
    it("1 → 2：奖励 2 本任选颜色的书，排进选书颜色的决策", () => {
        const g = withPlayer(game, swamp, { sailing: 1 });
        const { state: s2 } = applyAdvanceTrack(g, swamp, "sailing");
        expect(s2.pending).toEqual([{ id: `track-${g.version}`, seat: swamp, kind: "bookColor", count: 2 }]);
        expect(s2.players[swamp].books).toEqual(g.players[swamp].books);
    });
    it("2 → 3：奖励 4 分", () => {
        const g = withPlayer(game, swamp, { sailing: 2 });
        expect(applyAdvanceTrack(g, swamp, "sailing").state.players[swamp].vp).toBe(g.players[swamp].vp + 4);
    });
});

describe("改造轨", () => {
    it("付 5 金币、1 工具、1 学者；0 → 1 奖励 2 本任选颜色的书", () => {
        const { state } = applyAdvanceTrack(game, swamp, "terraforming");
        const after = state.players[swamp];
        expect(after.terraforming).toBe(1);
        expect(after.coins).toBe(game.players[swamp].coins - 5);
        expect(after.tools).toBe(game.players[swamp].tools - 1);
        expect(state.pending.map((d) => d.kind)).toEqual(["bookColor"]);
    });
    it("1 → 2：奖励 6 分；以后每把铲子只要 1 个工具", () => {
        const g = withPlayer(game, swamp, { terraforming: 1 });
        const after = applyAdvanceTrack(g, swamp, "terraforming").state.players[swamp];
        expect(after.vp).toBe(g.players[swamp].vp + 6);
        expect(spadeCost(after, 2)).toEqual({ tools: 2 });
    });
});

describe("有的规划板不一样", () => {
    it("平原：推进改造轨只要 1 金币", () => {
        const g = withPlayer(turnOf(base, plains), plains, { coins: 20, tools: 5, scholars: 1 });
        const after = applyAdvanceTrack(g, plains, "terraforming").state.players[plains];
        expect(after.coins).toBe(19);
    });
    it("湖泊：航行从 1 开始，到 2 级奖励 3 分，到 3 级奖励 2 本书", () => {
        // 借沼泽玩家来测湖泊规划板上印的数据
        const lake = withPlayer(game, swamp, { planning: "lake", sailing: 1 });
        const s2 = applyAdvanceTrack(lake, swamp, "sailing").state;
        expect(s2.players[swamp].vp).toBe(lake.players[swamp].vp + 3);
        const s3 = applyAdvanceTrack(withPlayer(lake, swamp, { sailing: 2 }), swamp, "sailing").state;
        expect(s3.pending.map((d) => d.kind)).toEqual(["bookColor"]);
    });
});