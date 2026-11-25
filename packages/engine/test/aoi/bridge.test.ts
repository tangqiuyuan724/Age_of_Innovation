import { describe, it, expect } from "vitest";
import {
    applyDecide, bridgeOptions, bridgeSpots, isAdjacent, MAPS, parseMap, validateDecide,
    type Decision, type GameState, type HexId, type Seat,
} from "../../src/aoi/index.ts";
import { readyGame, seatOf, withPlayer } from "./fixtures.ts";

describe("哪里能架桥", () => {
    const geo = parseMap(MAPS["aoi-base"]);

    it("C7 和 D8 之间是 C8、D7 两个河流格，能架桥；反过来也一样", () => {
        expect(bridgeSpots(geo, "C7")).toEqual(["D8"]);
        expect(bridgeSpots(geo, "D8")).toContain("C7");
    });
    it("C7 和 E8 隔着河流格 D7，但在一条直线上，只有 1 个共同邻居：不能架桥", () => {
        expect(bridgeSpots(geo, "C7")).not.toContain("E8");
    });
    it("C7 和 D5 有 2 个共同邻居 C6、D6，但都是陆地：不能架桥", () => {
        expect(bridgeSpots(geo, "C7")).not.toContain("D5");
    });
    it("E10 和 E11 本来就相邻，两格的共同邻居 D10、F10 都是河流：不算能架桥", () => {
        expect(bridgeSpots(geo, "E10")).not.toContain("E11");
    });
    it("B6 四周全是陆地：哪里都架不了", () => {
        expect(bridgeSpots(geo, "B6")).toEqual([]);
    });
});

describe("建桥决策", () => {
    // 沼泽玩家的初始工坊在 C7 和 A10；平原玩家在 C6 和 E1
    const game = readyGame();
    const swamp = seatOf(game, "swamp");
    const plains = seatOf(game, "plains");
    const withDecision = (state: GameState, seat: Seat): GameState => {
        const d: Decision = { id: "bridge-test", seat, kind: "bridge" };
        return { ...state, pending: [d] };
    };
    const state = withDecision(game, swamp);
    const check = (s: GameState, seat: Seat, a: HexId, b: HexId) =>
        validateDecide(s, seat, "bridge-test", { kind: "bridge", a, b });

    it("沼泽玩家能建的桥只有 C7—D8", () => {
        expect(bridgeOptions(game, swamp)).toEqual([{ a: "C7", b: "D8" }]);
    });
    it("建在 C7—D8：多一座桥，手上的桥 -1，决策移出队列，两格从此相邻", () => {
        expect(check(state, swamp, "C7", "D8")).toBeNull();
        const { state: after, events } = applyDecide(state, swamp, { kind: "bridge", a: "C7", b: "D8" });
        expect(after.bridges).toEqual([{ owner: swamp, a: "C7", b: "D8" }]);
        expect(after.players[swamp].bridges).toBe(2);
        expect(after.pending).toEqual([]);
        expect(events).toEqual([{ type: "bridgeBuilt", seat: swamp, a: "C7", b: "D8" }]);
        expect(isAdjacent(parseMap(MAPS["aoi-base"]), after.bridges, "C7", "D8")).toBe(true);
    });
    it("两头写反了也行", () => {
        expect(check(state, swamp, "D8", "C7")).toBeNull();
    });
    it("地形上架不了桥：invalid-choice", () => {
        expect(check(state, swamp, "C7", "E8")).toBe("invalid-choice");
    });
    it("一头是河流格，或者格子不存在：bad-move", () => {
        expect(check(state, swamp, "C7", "C8")).toBe("bad-move");
        expect(check(state, swamp, "C7", "Z99")).toBe("bad-move");
    });
    it("那里已经有桥了：invalid-choice，也就没有别的桥能建了", () => {
        const built = { ...state, bridges: [{ owner: plains, a: "D8", b: "C7" }] };
        expect(check(built, swamp, "C7", "D8")).toBe("invalid-choice");
        expect(bridgeOptions(built, swamp)).toEqual([]);
    });
    it("两头都没有自己的建筑：no-own-building", () => {
        const plainsDecides = withDecision(game, plains);
        expect(check(plainsDecides, plains, "C7", "D8")).toBe("no-own-building");
        expect(bridgeOptions(game, plains)).toEqual([]);
    });
    it("3 座桥都建完了：limit-reached", () => {
        const noBridges = withPlayer(state, swamp, { bridges: 0 });
        expect(check(noBridges, swamp, "C7", "D8")).toBe("limit-reached");
    });
    it("不是自己的决策：not-your-decision", () => {
        expect(check(state, plains, "C7", "D8")).toBe("not-your-decision");
    });
    it("放弃建桥：决策移出队列，别的都不变", () => {
        expect(validateDecide(state, swamp, "bridge-test", { kind: "bridge", skip: true })).toBeNull();
        const { state: after, events } = applyDecide(state, swamp, { kind: "bridge", skip: true });
        expect(after.pending).toEqual([]);
        expect(after.bridges).toEqual([]);
        expect(after.players[swamp].bridges).toBe(3);
        expect(events).toEqual([]);
    });
    it("没有地方能架、桥都建完了，也能放弃；但不能替别人放弃", () => {
        const skip = { kind: "bridge" as const, skip: true as const };
        expect(validateDecide(withDecision(game, plains), plains, "bridge-test", skip)).toBeNull();
        expect(validateDecide(withPlayer(state, swamp, { bridges: 0 }), swamp, "bridge-test", skip)).toBeNull();
        expect(validateDecide(state, plains, "bridge-test", skip)).toBe("not-your-decision");
    });
});