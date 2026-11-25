import { describe, it, expect } from "vitest";
import {
    applyEndTurn, applyLeech, applyUpgrade, checkFreeAction, gainPower, leechAmounts, nextSeat,
    validateEndTurn, validateLeech, type GameState,
} from "../../src/aoi/index.ts";
import { readyGame, seatOf, turnOf, withPlayer, withStructure } from "./fixtures.ts";

const base = readyGame();
const plains = seatOf(base, "plains");
const swamp = seatOf(base, "swamp");
const forest = seatOf(base, "forest");
const game = withPlayer(turnOf(base, plains), plains, { tools: 10, coins: 20 });

/** 平原玩家把 C6 工坊升级成行会，然后结束回合 */
function upgradeAndEnd(state: GameState) {
    return applyEndTurn(applyUpgrade(state, plains, "C6", "guild").state, plains);
}

describe("nextSeat：下一个是谁", () => {
    const [first, second, third] = game.turnOrder;
    it("行动顺序里的下一个人，最后一个人之后回到第一个人", () => {
        expect(nextSeat(game, first)).toBe(second);
        expect(nextSeat(game, third)).toBe(first);
    });
    it("跳过已经 pass 的人", () => {
        expect(nextSeat(withPlayer(game, second, { passed: true }), first)).toBe(third);
    });
    it("其他人都 pass 了：还是自己，接着行动", () => {
        const others = withPlayer(withPlayer(game, second, { passed: true }), third, { passed: true });
        expect(nextSeat(others, first)).toBe(first);
    });
    it("所有人都 pass 了：返回 null", () => {
        let allPassed = game;
        for (const s of game.turnOrder) allPassed = withPlayer(allPassed, s, { passed: true });
        expect(nextSeat(allPassed, first)).toBeNull();
    });
});

describe("结束回合", () => {
    it("还没做主行动：main-action-missing", () => {
        expect(validateEndTurn(game, plains)).toBe("main-action-missing");
    });
    it("做过主行动：可以结束；轮到行动顺序里的下一个人", () => {
        const done = applyUpgrade(game, plains, "E1", "guild").state; // E1 旁边没人，没有吸能
        expect(validateEndTurn(done, plains)).toBeNull();
        const { state, events } = applyEndTurn(done, plains);
        const next = nextSeat(game, plains)!;
        expect(state.turn).toEqual({ seat: next, mainActionDone: false, builtHexes: [] });
        expect(events).toEqual([{ type: "turn", seat: next }]);
    });
});

describe("吸能：算能量", () => {
    it("C6 旁边：沼泽玩家的 C7 工坊（1）、森林玩家的 B6 工坊（1）", () => {
        const amounts = leechAmounts(game, plains, "C6");
        expect(amounts.map((a) => a.power)).toEqual([1, 1]);
        expect(amounts.map((a) => a.seat).sort()).toEqual([swamp, forest].sort());
    });
    it("按行动顺序排：从建造者的下一位开始", () => {
        const t = game.turnOrder;
        const order = [1, 2].map((i) => t[(t.indexOf(plains) + i) % 3]);
        expect(leechAmounts(game, plains, "C6").map((a) => a.seat)).toEqual(order);
    });
    it("别人的建筑越大，能量越多；建造者自己的建筑不算", () => {
        const g = withStructure(withStructure(game, "C7", swamp, "guild"), "D5", plains, "workshop");
        const amounts = leechAmounts(g, plains, "C6");
        expect(amounts.find((a) => a.seat === swamp)!.power).toBe(2);
        expect(amounts.some((a) => a.seat === plains)).toBe(false);
    });
});

describe("吸能：回合结束时发起", () => {
    it("只能拿 1 点的（不用付分）：自动接受，不排队", () => {
        const before = game.players[swamp].power;
        const { state, events } = upgradeAndEnd(game);
        expect(state.pending).toEqual([]);
        expect(state.players[swamp].power).toEqual(gainPower(before, 1).bowls);
        expect(events.filter((e) => e.type === "leech")).toHaveLength(2);
    });
    it("能拿 2 点的：排进待决策队列，拿 2 点付 1 分", () => {
        const g = withStructure(game, "C7", swamp, "guild");
        const { state } = upgradeAndEnd(g);
        expect(state.pending).toEqual([
            { id: `leech-${g.version}-C6-${swamp}`, seat: swamp, kind: "leech", from: plains, power: 2, vpCost: 1 },
        ]);
    });
    it("有人还没回应吸能，下一个人不能行动", () => {
        const { state } = upgradeAndEnd(withStructure(game, "C7", swamp, "guild"));
        expect(checkFreeAction(state, state.turn!.seat)).toBe("decision-pending");
    });
    it("碗里装不下全部能量：能拿多少拿多少，按实际拿到的付分", () => {
        const g = withPlayer(withStructure(game, "C7", swamp, "guild"), swamp, { power: [0, 1, 11] });
        const { state } = upgradeAndEnd(g);
        expect(state.pending).toEqual([]); // 只能拿 1 点，自动接受
        expect(state.players[swamp].power).toEqual([0, 0, 12]);
    });
    it("一点都装不下：不发起", () => {
        const g = withPlayer(withStructure(game, "C7", swamp, "guild"), swamp, { power: [0, 0, 12] });
        const { events } = upgradeAndEnd(g);
        expect(events.some((e) => e.type === "leech" && e.seat === swamp)).toBe(false);
    });
});

describe("吸能：回应", () => {
    const { state } = upgradeAndEnd(withStructure(game, "C7", swamp, "guild"));

    it("只有被问的人能回应", () => {
        expect(validateLeech(state, swamp)).toBeNull();
        expect(validateLeech(state, forest)).toBe("not-your-decision");
    });
    it("接受：拿 2 点能量，付 1 分", () => {
        const before = state.players[swamp];
        const { state: after, events } = applyLeech(state, swamp, true);
        expect(after.players[swamp].vp).toBe(before.vp - 1);
        expect(after.players[swamp].power).toEqual(gainPower(before.power, 2).bowls);
        expect(after.pending).toEqual([]);
        expect(events).toEqual([{ type: "leech", seat: swamp, from: plains, power: 2, vpCost: 1, accepted: true }]);
    });
    it("不要：什么都不变，决策移出队列", () => {
        const { state: after } = applyLeech(state, swamp, false);
        expect(after.players[swamp]).toEqual(state.players[swamp]);
        expect(after.pending).toEqual([]);
    });
});