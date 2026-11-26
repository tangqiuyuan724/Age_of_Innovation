import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { ColyseusTestServer, boot } from "@colyseus/testing";
import { getLegalMoves, type GameState, type Move, type Seat } from "@aoi/engine/aoi";
import appConfig from "../src/app.config.js";
import type { Snapshot, SyncReply } from "../src/rooms/GameRoom.js";

/** 每个人的座位令牌（真正的浏览器里是随机生成的） */
const token = (name: string) => `seat-token-of-${name}`;

/** 测试用的随机数：同一个种子每次挑的都一样 */
function randomFrom(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** 和引擎 random.test.ts 里的机器人一样：做决定随便挑；主行动做完就结束回合；多半去建造、升级 */
function pick(state: GameState, moves: Move[], random: () => number): Move {
    const any = (list: Move[]) => list[Math.floor(random() * list.length)];
    if (state.pending.length > 0) return any(moves);
    const end = moves.find((m) => m.t === "endTurn");
    if (end) return end;
    const passes = moves.filter((m) => m.t === "pass");
    const main = moves.filter((m) => m.t !== "pass" && m.t !== "endTurn" && m.t !== "convert" && m.t !== "sacrificePower");
    const builds = main.filter((m) => (m.t === "terraformAndBuild" && m.build) || m.t === "upgrade");
    if (builds.length > 0 && random() < 0.7) return any(builds);
    if (main.length === 0 || random() < 0.15) return any(passes);
    return any(main);
}

/** 现在该谁操作 */
const actingSeat = (state: GameState): Seat => state.pending[0]?.seat ?? state.turn!.seat;

describe("GameRoom", () => {
    let colyseus: ColyseusTestServer<typeof appConfig>;

    beforeAll(async () => { colyseus = await boot(appConfig); });
    afterAll(async () => { await colyseus.shutdown(); });
    beforeEach(async () => { await colyseus.cleanup(); });

    /** 建一个房间，按顺序加入几个人（第一个是房主） */
    async function roomWith(...names: string[]) {
        const room = await colyseus.createRoom("game", {});
        const clients = [];
        for (const name of names) clients.push(await colyseus.connectTo(room, { nickname: name, seatToken: token(name) }));
        return { room, clients };
    }

    it("房间码是 5 位", async () => {
        const room = await colyseus.createRoom("game", {});
        expect(room.roomId).toMatch(/^[A-Z2-9]{5}$/);
    });

    it("加入要带昵称和座位令牌", async () => {
        const room = await colyseus.createRoom("game", {});
        await expect(colyseus.connectTo(room, {})).rejects.toThrow();
        await expect(colyseus.connectTo(room, { nickname: "Alice" })).rejects.toThrow();
        await expect(colyseus.connectTo(room, { nickname: "Alice", seatToken: "short" })).rejects.toThrow();
    });

    it("房主选开局方式开局，所有人收到开局的局面", async () => {
        const { room, clients: [alice, bob] } = await roomWith("Alice", "Bob");
        expect(room.state.hostSessionId).toBe(alice.sessionId);

        await expect(bob.request("start", { setupMode: "sets" })).rejects.toMatchObject({ reason: "not-host" });
        // 格式不对（没有这种开局方式）：zod 直接拒绝
        await expect(alice.request("start", { setupMode: "chaos" } as never)).rejects.toThrow();

        const snapshot = bob.waitForMessage("snapshot");
        await alice.request("start", { setupMode: "sets" });
        const { state, step }: Snapshot = await snapshot;

        expect(room.state.phase).toBe("playing");
        expect(state.options.playerCount).toBe(2);
        expect(state.version).toBe(0);
        expect(step).toBeNull();
        expect(state.rng).toBe(0);   // toPublicState 去掉了随机数状态
        expect(room.state.activeSeat).toBe(actingSeat(state));
        await expect(alice.request("start", { setupMode: "sets" })).rejects.toMatchObject({ reason: "already-started" });
    });

    it("只有一个人不能开局", async () => {
        const { clients: [alice] } = await roomWith("Alice");
        await expect(alice.request("start", { setupMode: "sets" })).rejects.toMatchObject({ reason: "need-2-players" });
    });

    it("指令：格式、轮到谁、版本号都要对；执行以后广播新局面和这一步", async () => {
        const { room, clients } = await roomWith("Alice", "Bob");
        await clients[0].request("start", { setupMode: "sets" });
        const { state } = await clients[0].request("sync");
        const seat = actingSeat(state!);
        const me = clients.find((c) => room.state.players.get(c.sessionId)!.seat === seat)!;
        const other = clients.find((c) => c !== me)!;
        const move = getLegalMoves(state!, seat)[0];

        // 格式不对：zod 拒绝
        await expect(me.request("move", { move: { t: "fly" }, version: 0 } as never)).rejects.toThrow();
        // 没轮到另一个人（开局第一件事是选组合，所以是"不是你的决定"）
        await expect(other.request("move", { move, version: 0 })).rejects.toMatchObject({ reason: "not-your-decision" });

        const snapshot = other.waitForMessage("snapshot");
        expect(await me.request("move", { move, version: 0 })).toEqual({ version: 1 });
        const sent: Snapshot = await snapshot;
        expect(sent.state.version).toBe(1);
        expect(sent.step).toMatchObject({ seat, move });

        // 照着旧局面（版本 0）再发一次：拒绝
        await expect(me.request("move", { move, version: 0 })).rejects.toMatchObject({ reason: "stale-version" });

        // sync 拿到现在的局面和全部日志
        const reply: SyncReply = await other.request("sync");
        expect(reply.state!.version).toBe(1);
        expect(reply.steps).toEqual([sent.step]);
    });

    it("开局前走了就让出座位，房主交给下一个人", async () => {
        const { room, clients: [alice, bob, carol] } = await roomWith("Alice", "Bob", "Carol");
        await bob.leave();
        await room.waitForNextPatch();
        expect([...room.state.players.values()].map((p) => p.seat)).toEqual([0, 2]);

        await alice.leave();
        await room.waitForNextPatch();
        expect(room.state.hostSessionId).toBe(carol.sessionId);

        // 走了的人令牌作废，再来就是新座位
        const bob2 = await colyseus.connectTo(room, { nickname: "Bob", seatToken: token("Bob") });
        expect(room.state.players.get(bob2.sessionId)!.seat).toBe(0);
    });

    it("开局时座位号重新排成 0、1、2……", async () => {
        const { room, clients: [alice, bob, carol] } = await roomWith("Alice", "Bob", "Carol");
        await bob.leave();
        await room.waitForNextPatch();
        await alice.request("start", { setupMode: "sets" });
        expect(room.state.players.get(alice.sessionId)!.seat).toBe(0);
        expect(room.state.players.get(carol.sessionId)!.seat).toBe(1);
    });

    it("开局后新的人进不来；带着令牌能回到原来的座位", async () => {
        const { room, clients: [alice, bob] } = await roomWith("Alice", "Bob");
        await alice.request("start", { setupMode: "sets" });
        const bobSeat = room.state.players.get(bob.sessionId)!.seat;

        await expect(colyseus.connectTo(room, { nickname: "Carol", seatToken: token("Carol") })).rejects.toThrow("game-started");

        // Bob 走了：座位还在，标成离线
        await bob.leave();
        await room.waitForNextPatch();
        expect([...room.state.players.values()].find((p) => p.seat === bobSeat)!.connected).toBe(false);

        // 带着令牌回来：还是原来的座位
        const bob2 = await colyseus.connectTo(room, { nickname: "Bob", seatToken: token("Bob") });
        const seat = room.state.players.get(bob2.sessionId)!;
        expect(seat.seat).toBe(bobSeat);
        expect(seat.connected).toBe(true);
        expect(room.state.players.size).toBe(2);
        const reply: SyncReply = await bob2.request("sync");
        expect(reply.state!.version).toBe(0);
    });

    it("同一个令牌又连进来一次：旧的连接被请出去", async () => {
        const { room, clients: [alice] } = await roomWith("Alice", "Bob");
        const left = new Promise<void>((resolve) => alice.onLeave(() => resolve()));
        const alice2 = await colyseus.connectTo(room, { nickname: "Alice", seatToken: token("Alice") });
        await left;
        expect(room.state.players.size).toBe(2);
        expect(room.state.hostSessionId).toBe(alice2.sessionId);
        expect(room.state.players.get(alice2.sessionId)!.seat).toBe(0);
    });

    it("三个人通过房间打完一整局", async () => {
        const { room, clients } = await roomWith("Alice", "Bob", "Carol");
        await clients[0].request("start", { setupMode: "draft" });
        const bySeat = new Map(clients.map((c) => [room.state.players.get(c.sessionId)!.seat, c]));
        const random = randomFrom(7);

        let state = (await clients[0].request("sync")).state!;
        for (let i = 0; i < 3000 && state.phase !== "ended"; i++) {
            const seat = actingSeat(state);
            expect(room.state.activeSeat).toBe(seat);
            const move = pick(state, getLegalMoves(state, seat), random);
            await bySeat.get(seat)!.request("move", { move, version: state.version });
            state = (await bySeat.get(seat)!.request("sync")).state!;
        }

        expect(state.phase).toBe("ended");
        expect(state.finalScores).toHaveLength(3);
        expect(room.state.phase).toBe("ended");
        expect(room.state.activeSeat).toBe(-1);
    }, 30000);
});