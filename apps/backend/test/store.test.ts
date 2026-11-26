import { describe, it, expect } from "vitest";
import type { Move, SetupOptions } from "@aoi/engine/aoi";
import { GameStore, type SavedSeat } from "../src/rooms/store.js";

const options: SetupOptions = { playerCount: 2, mapId: "aoi-base", setupMode: { kind: "sets" } };
const seats: SavedSeat[] = [
    { seat: 0, nickname: "Alice", seatToken: "token-of-alice-0000" },
    { seat: 1, nickname: "Bob", seatToken: "token-of-bob-00000" },
];
const pick: Move = { t: "decide", id: "pick-0", choice: { kind: "pickSet", set: 2 } };
const pass: Move = { t: "pass", bonusTile: "coins6" };

describe("GameStore：存档", () => {
    it("存一局、读回来，和存进去的一样", () => {
        const store = new GameStore(":memory:");
        store.createGame("ABCDE", options, "seed-1", seats);
        store.appendMove("ABCDE", 1, 1, pick);
        store.appendMove("ABCDE", 2, 0, pass);

        expect(store.load("ABCDE")).toEqual({
            code: "ABCDE",
            options,
            seed: "seed-1",
            seats,
            contractVersion: expect.any(Number),
            moves: [{ seat: 1, move: pick }, { seat: 0, move: pass }],
        });
    });

    it("每一步按 seq 的顺序读出来，不管写进去的先后", () => {
        const store = new GameStore(":memory:");
        store.createGame("ABCDE", options, "seed-1", seats);
        store.appendMove("ABCDE", 2, 0, pass);
        store.appendMove("ABCDE", 1, 1, pick);
        expect(store.load("ABCDE")!.moves.map((m) => m.move)).toEqual([pick, pass]);
    });

    it("同一局同一个 seq 只能写一次", () => {
        const store = new GameStore(":memory:");
        store.createGame("ABCDE", options, "seed-1", seats);
        store.appendMove("ABCDE", 1, 1, pick);
        expect(() => store.appendMove("ABCDE", 1, 0, pass)).toThrow();
    });

    it("同一个房间码不能开两局", () => {
        const store = new GameStore(":memory:");
        store.createGame("ABCDE", options, "seed-1", seats);
        expect(() => store.createGame("ABCDE", options, "seed-2", seats)).toThrow();
    });

    it("没有存档的房间码：has 是 false，load 是 null", () => {
        const store = new GameStore(":memory:");
        store.createGame("ABCDE", options, "seed-1", seats);
        expect(store.has("ABCDE")).toBe(true);
        expect(store.has("ZZZZZ")).toBe(false);
        expect(store.load("ZZZZZ")).toBeNull();
    });

    it("几局互不影响", () => {
        const store = new GameStore(":memory:");
        store.createGame("AAAAA", options, "seed-a", seats);
        store.createGame("BBBBB", options, "seed-b", seats);
        store.appendMove("AAAAA", 1, 1, pick);
        expect(store.load("AAAAA")!.moves).toHaveLength(1);
        expect(store.load("BBBBB")!.moves).toHaveLength(0);
    });
});