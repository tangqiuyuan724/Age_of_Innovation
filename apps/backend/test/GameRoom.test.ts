import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { ColyseusTestServer, boot } from "@colyseus/testing";
import appConfig from "../src/app.config.js";
import type { Snapshot } from "../src/rooms/GameRoom.js";

describe("GameRoom", () => {
    let colyseus: ColyseusTestServer<typeof appConfig>;

    beforeAll(async () => { colyseus = await boot(appConfig); });
    afterAll(async () => { await colyseus.shutdown(); });
    beforeEach(async () => { await colyseus.cleanup(); });

    it("房间码是 5 位", async () => {
        const room = await colyseus.createRoom("game", {});
        expect(room.roomId).toMatch(/^[A-Z2-9]{5}$/);
    });

    it("两人加入、房主开局、只有轮到的人能行动", async () => {
        const room = await colyseus.createRoom("game", {});
        const alice = await colyseus.connectTo(room, { nickname: "Alice" });
        const bob = await colyseus.connectTo(room, { nickname: "Bob" });

        expect(room.state.hostSessionId).toBe(alice.sessionId);
        expect(room.state.players.get(bob.sessionId)?.seat).toBe(1);

        // Bob 不是房主，不能开局
        await expect(bob.request("start")).rejects.toMatchObject({ reason: "not-host" });

        // 收集 Alice 收到的快照
        const snapshots: Snapshot[] = [];
        alice.onMessage("snapshot", (s: Snapshot) => snapshots.push(s));

        await alice.request("start");
        expect(room.state.phase).toBe("playing");
        expect(room.state.activeSeat).toBe(0);

        // 没轮到 Bob
        await expect(bob.request("move", { move: { t: "add", n: 1 }, version: 0 }))
            .rejects.toMatchObject({ reason: "not-your-turn" });

        // 格式错误（n 不是整数）会被 zod 拒绝
        await expect(alice.request("move", { move: { t: "add", n: 1.5 }, version: 0 })).rejects.toThrow();

        // Alice 合法行动
        const reply = await alice.request("move", { move: { t: "add", n: 2 }, version: 0 });
        expect(reply).toEqual({ version: 1 });
        expect(room.state.activeSeat).toBe(1);

        // 旧版本号的操作被拒绝（防止双击重复提交）
        await expect(bob.request("move", { move: { t: "add", n: 1 }, version: 0 }))
            .rejects.toMatchObject({ reason: "stale-version" });

        await room.waitForNextPatch();
        expect(snapshots.at(-1)?.state.total).toBe(2);
    });

    it("没有昵称不能加入", async () => {
        const room = await colyseus.createRoom("game", {});
        await expect(colyseus.connectTo(room, {})).rejects.toThrow();
    });
});