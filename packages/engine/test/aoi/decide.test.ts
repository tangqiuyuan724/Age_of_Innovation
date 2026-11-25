import { describe, it, expect } from "vitest";
import { advance, applyDecide, createGame, validateDecide } from "../../src/aoi/index.ts";
import { readyGame, seatOf } from "./fixtures.ts";

describe("回应决策的通用检查", () => {
    const game = createGame({ playerCount: 3, mapId: "aoi-base", setupMode: { kind: "sets" } }, "m14");
    const d = game.pending[0];

    it("开局选组合也走这里：和直接调用 applyPickSet 结果一样", () => {
        expect(validateDecide(game, d.seat, d.id, { kind: "pickSet", set: 0 })).toBeNull();
        const { state } = applyDecide(game, d.seat, { kind: "pickSet", set: 0 });
        expect(state.board.setupSets[0].takenBy).toBe(d.seat);
    });
    it("id 对不上（回应的是已经过去的决策）：invalid-choice", () => {
        expect(validateDecide(game, d.seat, "old", { kind: "pickSet", set: 0 })).toBe("invalid-choice");
    });
    it("种类对不上：bad-move", () => {
        expect(validateDecide(game, d.seat, d.id, { kind: "leech", accept: true })).toBe("bad-move");
    });
    it("游戏结束：game-over", () => {
        expect(validateDecide({ ...game, phase: "ended" }, d.seat, d.id, { kind: "pickSet", set: 0 })).toBe("game-over");
    });
});

describe("选书的颜色", () => {
    // 第 6 组是荒地：开局多 1 本任选颜色的书，放完工坊后选颜色
    const setup = readyGame([5, 0, 1]);
    const waste = seatOf(setup, "wasteland");
    const d = setup.pending[0];
    const check = (books: Record<string, number>) => validateDecide(setup, waste, d.id, { kind: "bookColor", books });

    it("开局结束后排着一个选书颜色的决策", () => {
        expect(d).toEqual({ id: `setup-book-${waste}`, seat: waste, kind: "bookColor", count: 1 });
    });
    it("选法律：法律书 +1，决策移出队列", () => {
        expect(check({ law: 1 })).toBeNull();
        const { state } = applyDecide(setup, waste, { kind: "bookColor", books: { law: 1 } });
        expect(state.players[waste].books).toEqual({ banking: 0, law: 1, engineering: 0, medicine: 0 });
        expect(state.pending).toEqual([]);
    });
    it("本数加起来不对、负数、不是学科：invalid-choice", () => {
        expect(check({ law: 2 })).toBe("invalid-choice");
        expect(check({ law: 2, banking: -1 })).toBe("invalid-choice");
        expect(check({ gray: 1 })).toBe("invalid-choice");
        expect(check({})).toBe("invalid-choice");
    });
    it("选完以后，开局的决策就处理完了：advance 开始第 1 轮", () => {
        const { state } = applyDecide(setup, waste, { kind: "bookColor", books: { medicine: 1 } });
        expect(advance(state).phase).toBe("actions");
    });
});

describe("沙漠开局的免费铲子", () => {
    // 第 5 组是沙漠：工坊放在 D5 和 A12，放完所有建筑后有 1 把免费铲子，不能顺带建工坊
    const setup = readyGame([4, 0, 1]);
    const desert = seatOf(setup, "desert");
    const d = setup.pending[0];
    const check = (hex: string, build = false) => validateDecide(setup, desert, d.id, { kind: "spades", hex, build });

    it("开局结束后排着一个免费铲子的决策", () => {
        expect(d).toEqual({ id: `setup-spade-${desert}`, seat: desert, kind: "spades", spades: 1, canBuild: false });
    });
    it("用在 D5 旁边的 D6（荒地）：朝沙漠走一步，变成沙漠", () => {
        expect(check("D6")).toBeNull();
        const { state, events } = applyDecide(setup, desert, { kind: "spades", hex: "D6", build: false });
        expect(state.hexes.D6.terrain).toBe("desert");
        expect(state.pending).toEqual([]);
        expect(events).toEqual([{ type: "terraformed", seat: desert, hex: "D6", from: "wasteland", to: "desert" }]);
    });
    it("够不着、有建筑、本来就是沙漠、想顺带建工坊：都不行", () => {
        expect(check("I13")).toBe("not-in-reach");
        expect(check("C6")).toBe("hex-occupied");
        expect(check("E4")).toBe("invalid-choice"); // 本来就是沙漠，铲子没地方用
        expect(check("D6", true)).toBe("invalid-choice");
    });
    it("也可以不用；但不能替别人放弃", () => {
        expect(validateDecide(setup, desert, d.id, { kind: "spades", skip: true })).toBeNull();
        expect(validateDecide(setup, seatOf(setup, "plains"), d.id, { kind: "spades", skip: true })).toBe("not-your-decision");
        const { state } = applyDecide(setup, desert, { kind: "spades", skip: true });
        expect(state.pending).toEqual([]);
        expect(state.hexes).toEqual(setup.hexes);
    });
});

describe("这一课还没实现的决策", () => {
    it("bad-move", () => {
        const game = readyGame();
        const waiting = { ...game, pending: [{ id: "c", seat: 0, kind: "competency" as const, options: [] }] };
        expect(validateDecide(waiting, 0, "c", { kind: "competency", tile: "x" })).toBe("bad-move");
    });
});