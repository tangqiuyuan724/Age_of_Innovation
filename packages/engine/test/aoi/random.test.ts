// 随机对局：机器人每一步从 getLegalMoves 里随便挑一条，一直打到游戏结束。
// 每一步之后检查"不变量"——不管怎么走都必须成立的事。哪一步出了问题，测试会说是第几局第几步。
import { describe, it, expect } from "vitest";
import {
    BRIDGES_TOTAL, BUILDINGS_TOTAL, DISCIPLINES, SCHOLARS_TOTAL, SCIENCE_MAX,
    applyMove, createGame, getLegalMoves,
    type BuildingType, type GameState, type Move, type SetupMode,
} from "../../src/aoi/index.ts";

/** 测试自己用的随机数（和引擎的分开）：同一个种子每次挑的都一样，出了错能重现 */
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

const FREE: Move["t"][] = ["convert", "sacrificePower"];
const BUILDINGS: BuildingType[] = ["workshop", "guild", "school", "university", "palace"];

/**
 * 机器人挑一条指令：
 *  - 在做决定：随便挑
 *  - 主行动做完了：结束回合
 *  - 还没做主行动：能建造、升级时多半去建造、升级（这样地图上东西多，城市、吸能都会出现）；
 *    否则偶尔 pass，别的时候从主行动里随便挑。不做自由行动，免得来回转换
 */
function pick(state: GameState, moves: Move[], random: () => number): Move {
    const any = (list: Move[]) => list[Math.floor(random() * list.length)];
    if (state.pending.length > 0) return any(moves);
    const end = moves.find((m) => m.t === "endTurn");
    if (end) return end;
    const passes = moves.filter((m) => m.t === "pass");
    const main = moves.filter((m) => m.t !== "pass" && m.t !== "endTurn" && !FREE.includes(m.t));
    const builds = main.filter((m) => (m.t === "terraformAndBuild" && m.build) || m.t === "upgrade");
    if (builds.length > 0 && random() < 0.7) return any(builds);
    if (main.length === 0 || (passes.length > 0 && random() < 0.15)) return any(passes);
    return any(main);
}

/** 每一步之后都要成立的事。出错时抛出的信息里写着是哪一条 */
function checkInvariants(state: GameState, label: string) {
    for (const p of state.players) {
        const who = `${label} 座位 ${p.seat}`;
        for (const [name, n] of Object.entries({ coins: p.coins, tools: p.tools, scholars: p.scholars, keys: p.keys, vp: p.vp })) {
            expect(n, `${who} 的 ${name} 是负数`).toBeGreaterThanOrEqual(0);
        }
        for (const d of DISCIPLINES) {
            expect(p.books[d], `${who} 的书是负数`).toBeGreaterThanOrEqual(0);
            expect(p.science[d], `${who} 的学科等级超出范围`).toBeGreaterThanOrEqual(0);
            expect(p.science[d], `${who} 的学科等级超出范围`).toBeLessThanOrEqual(SCIENCE_MAX);
        }
        for (const n of p.power) expect(n, `${who} 的能量碗是负数`).toBeGreaterThanOrEqual(0);

        // 建筑：规划板上剩下的 + 地图上的 = 总数
        for (const b of BUILDINGS) {
            const onMap = Object.values(state.hexes)
                .filter((h) => h.structure?.owner === p.seat && h.structure.type === b && !h.structure.neutral).length;
            expect(p.buildingsLeft[b] + onMap, `${who} 的${b}数不对`).toBe(BUILDINGS_TOTAL[b]);
        }
        // 学者：手上 + 供应区 + 学科板上 = 7
        const onBoard = DISCIPLINES.reduce((n, d) => n + state.board.scholarSpaces[d].filter((s) => s === p.seat).length, 0);
        expect(p.scholars + p.scholarsInSupply + onBoard, `${who} 的学者数不对`).toBe(SCHOLARS_TOTAL);
        // 桥：手上 + 地图上 = 3
        const bridges = state.bridges.filter((b) => b.owner === p.seat).length;
        expect(p.bridges + bridges, `${who} 的桥数不对`).toBe(BRIDGES_TOTAL);
    }
    // 每门学科 12 级最多一个人
    for (const d of DISCIPLINES) {
        expect(state.players.filter((p) => p.science[d] === SCIENCE_MAX).length, `${label} ${d} 有两个人 12 级`).toBeLessThanOrEqual(1);
    }
}

/** 打一整局，返回最后的状态和走了几步 */
function playOut(playerCount: number, setupMode: SetupMode, seed: number): { state: GameState; steps: number } {
    let state = createGame({ playerCount, mapId: "aoi-base", setupMode }, `random-${seed}`);
    const random = randomFrom(seed);
    let steps = 0;
    while (state.phase !== "ended") {
        const label = `第 ${seed} 局（${playerCount} 人）第 ${steps} 步`;
        const seat = state.pending[0]?.seat ?? state.turn!.seat;
        const moves = getLegalMoves(state, seat);
        expect(moves.length, `${label}：座位 ${seat} 没有能做的事，卡住了`).toBeGreaterThan(0);
        // 能量碗里的能量只会因为牺牲变少，不会凭空变多
        const before = state.players.map((p) => p.power[0] + p.power[1] + p.power[2]);
        state = applyMove(state, seat, pick(state, moves, random)).state;
        state.players.forEach((p, i) => {
            if (i >= before.length) return; // 开局刚选完组合，这一步之前还没有这位玩家
            expect(p.power[0] + p.power[1] + p.power[2], `${label}：座位 ${i} 的能量变多了`).toBeLessThanOrEqual(before[i]);
        });
        checkInvariants(state, label);
        steps++;
        expect(steps, `${label}：走了太多步还没结束`).toBeLessThan(3000);
    }
    return { state, steps };
}

describe("随机对局", () => {
    const cases: [number, SetupMode][] = [
        [2, { kind: "sets" }], [3, { kind: "sets" }], [4, { kind: "sets" }], [5, { kind: "sets" }],
        [3, { kind: "draft", order: "snake" }], [4, { kind: "draft", order: "snake" }],
    ];
    // 每种开法打两局（种子不同）
    cases.flatMap(([playerCount, setupMode], i) => [[playerCount, setupMode, i + 1], [playerCount, setupMode, i + 101]] as const)
        .forEach(([playerCount, setupMode, seed]) => {
        it(`${playerCount} 人、${setupMode.kind === "sets" ? "固定组合" : "轮抽"}、种子 ${seed}：打到第 6 轮结束，终局分对得上`, () => {
            const { state } = playOut(playerCount, setupMode, seed);
            expect(state.round).toBe(6);
            expect(state.finalScores).toHaveLength(playerCount);
            for (const s of state.finalScores!) {
                const b = s.breakdown;
                expect(s.total).toBe(b.game + b.area + b.science + b.resources);
                expect(state.players[s.seat].vp).toBe(s.total);
            }
        });
    });
});