import { describe, it, expect } from "vitest";
import {
    applyBookAction, applyDecide, validateBookAction, validateDecide,
    type BookActionId, type BookPayment, type GameState, type HexId,
} from "../../src/aoi/index.ts";
import { readyGame, seatOf, turnOf, withPlayer, withStructure } from "./fixtures.ts";

// 平原玩家的工坊在 C6 和 E1。手上 2 本银行书、1 本法律书。
// 开局随机翻开 3 个书本行动；测试里把 6 个都翻开，方便每个都试一试
const base = readyGame();
const plains = seatOf(base, "plains");
const swamp = seatOf(base, "swamp");
const ALL: BookActionId[] = ["power5", "levels2", "coins6", "freeGuild", "guildVp", "spade3"];
const ready = withPlayer(turnOf(base, plains), plains, {
    books: { banking: 2, law: 1, engineering: 0, medicine: 0 },
    power: [5, 7, 0],
});
const game: GameState = { ...ready, board: { ...ready.board, bookActions: ALL } };

const check = (id: BookActionId, books: BookPayment, hex?: HexId, state = game) =>
    validateBookAction(state, plains, id, books, hex);
const act = (id: BookActionId, books: BookPayment, hex?: HexId, state = game) =>
    applyBookAction(state, plains, id, books, hex);

describe("书本行动：直接拿资源", () => {
    it("5 能量：付 1 本书（颜色随意），能量 +5；这一格用掉了，主行动做完了", () => {
        expect(check("power5", { law: 1 })).toBeNull();
        const { state, events } = act("power5", { law: 1 });
        const p = state.players[plains];
        expect(p.books.law).toBe(0);
        expect(p.power).toEqual([0, 12, 0]);
        expect(state.board.bookActionsUsed).toEqual(["power5"]);
        expect(state.turn!.mainActionDone).toBe(true);
        expect(events).toEqual([
            { type: "resources", seat: plains, delta: { power: 5, books: { law: -1 } }, reason: "bookAction" },
        ]);
    });
    it("6 金币：付 2 本书", () => {
        const { state } = act("coins6", { banking: 2 });
        expect(state.players[plains].coins).toBe(game.players[plains].coins + 6);
        expect(state.players[plains].books.banking).toBe(0);
    });
    it("每个行会 2 分：只数自己的行会", () => {
        const s = withStructure(withStructure(game, "C6", plains, "guild"), "C7", swamp, "guild");
        const { state } = act("guildVp", { banking: 1, law: 1 }, undefined, s);
        expect(state.players[plains].vp).toBe(game.players[plains].vp + 2);
    });
    it("一个行会都没有也能做，得 0 分", () => {
        const { state } = act("guildVp", { banking: 2 });
        expect(state.players[plains].vp).toBe(game.players[plains].vp);
    });
});

describe("书本行动：排决策的两个", () => {
    it("学科前进 2 级：付 1 本书，排一个前进 2 级的决策；只能选一门学科", () => {
        const { state } = act("levels2", { banking: 1 });
        expect(state.pending).toEqual([{ id: `levels-${game.version}`, seat: plains, kind: "scienceLevels", levels: 2 }]);
        const { state: after } = applyDecide(state, plains, { kind: "scienceLevels", discipline: "medicine" });
        expect(after.players[plains].science.medicine).toBe(game.players[plains].science.medicine + 2);
    });
    it("学科前进也可以放弃：决策移出队列，学科不变", () => {
        const { state } = act("levels2", { banking: 1 });
        const id = state.pending[0].id;
        expect(validateDecide(state, plains, id, { kind: "scienceLevels", skip: true })).toBeNull();
        const { state: after } = applyDecide(state, plains, { kind: "scienceLevels", skip: true });
        expect(after.pending).toEqual([]);
        expect(after.players[plains].science).toEqual(game.players[plains].science);
    });
    it("3 铲：付 3 本书，排一个能顺带建工坊的 3 铲决策", () => {
        const { state } = act("spade3", { banking: 2, law: 1 });
        expect(state.pending).toEqual([
            { id: `spades-${game.version}`, seat: plains, kind: "spades", spades: 3, canBuild: true },
        ]);
    });
});

describe("书本行动：免费把工坊升成行会", () => {
    it("C6 的工坊变成行会；规划板上少一个行会、多一个工坊；算作建造（回合结束时吸能）", () => {
        expect(check("freeGuild", { banking: 2 }, "C6")).toBeNull();
        const { state, events } = act("freeGuild", { banking: 2 }, "C6");
        const before = game.players[plains].buildingsLeft;
        expect(state.hexes.C6.structure?.type).toBe("guild");
        expect(state.players[plains].buildingsLeft.guild).toBe(before.guild - 1);
        expect(state.players[plains].buildingsLeft.workshop).toBe(before.workshop + 1);
        expect(state.players[plains].coins).toBe(game.players[plains].coins); // 不付钱、不付工具
        expect(state.turn!.builtHexes).toEqual(["C6"]);
        expect(events[0]).toEqual({ type: "upgraded", seat: plains, hex: "C6", from: "workshop", to: "guild" });
    });
    it("不填 hex：放弃升级，书照样付，这一格照样用掉", () => {
        expect(check("freeGuild", { banking: 2 })).toBeNull();
        const { state, events } = act("freeGuild", { banking: 2 });
        expect(state.hexes.C6.structure?.type).toBe("workshop");
        expect(state.players[plains].books.banking).toBe(0);
        expect(state.board.bookActionsUsed).toEqual(["freeGuild"]);
        expect(state.turn!.builtHexes).toEqual([]);
        expect(events).toEqual([{ type: "resources", seat: plains, delta: { books: { banking: -2 } }, reason: "bookAction" }]);
    });
    it("填了 hex：别人的建筑 no-own-building；已经是行会 cannot-upgrade", () => {
        expect(check("freeGuild", { banking: 2 }, "C7")).toBe("no-own-building");
        expect(check("freeGuild", { banking: 2 }, "C6", withStructure(game, "C6", plains, "guild"))).toBe("cannot-upgrade");
    });
    it("行会都建完了：填 hex 是 limit-reached，不填 hex（放弃升级）照样能做", () => {
        const left = { ...game.players[plains].buildingsLeft, guild: 0 };
        const noGuild = withPlayer(game, plains, { buildingsLeft: left });
        expect(check("freeGuild", { banking: 2 }, "C6", noGuild)).toBe("limit-reached");
        expect(check("freeGuild", { banking: 2 }, undefined, noGuild)).toBeNull();
    });
});

describe("书本行动：不能做的情况", () => {
    it("这一局没翻开这个行动：bad-move", () => {
        const three = { ...game, board: { ...game.board, bookActions: ["power5", "coins6", "spade3"] as BookActionId[] } };
        expect(check("guildVp", { banking: 2 }, undefined, three)).toBe("bad-move");
    });
    it("本轮已经有人用过了：action-taken", () => {
        const used = { ...game, board: { ...game.board, bookActionsUsed: ["power5"] as BookActionId[] } };
        expect(check("power5", { law: 1 }, undefined, used)).toBe("action-taken");
    });
    it("付的书总数不对、付灰色的书：bad-move", () => {
        expect(check("power5", { banking: 2 })).toBe("bad-move");
        expect(check("power5", {})).toBe("bad-move");
        expect(check("power5", { gray: 1 } as BookPayment)).toBe("bad-move");
    });
    it("这种颜色的书不够：insufficient-resources", () => {
        expect(check("power5", { engineering: 1 })).toBe("insufficient-resources");
        expect(check("coins6", { law: 2 })).toBe("insufficient-resources");
    });
    it("不是免费升行会却填了 hex：bad-move", () => {
        expect(check("coins6", { banking: 2 }, "C6")).toBe("bad-move");
    });
    it("做过主行动了：main-action-done", () => {
        const { state } = act("power5", { law: 1 });
        expect(check("coins6", { banking: 2 }, undefined, state)).toBe("main-action-done");
    });
});