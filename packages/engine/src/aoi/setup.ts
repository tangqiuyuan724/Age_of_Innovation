// 开局：摆版图、选规划板和派系（固定组合或轮抽两种方式）、放初始工坊。
import {
    BRIDGES_TOTAL, BUILDINGS_TOTAL, DISCIPLINES, DRAFT_EXTRA, SCHOLARS_TOTAL, STARTING_POWER, STARTING_VP,
} from "./constants.js";
import { BONUS_TILE_IDS } from "./content/bonusTiles.js";
import { FACTIONS, FACTION_IDS } from "./content/factions.js";
import { MAPS } from "./content/maps.js";
import { PALACE_TILE_ALWAYS, PALACE_TILE_IDS } from "./content/palaceTiles.js";
import { PLANNING_DISPLAYS, PLANNING_IDS } from "./content/planning.js";
import { BOOK_ACTION_IDS, FINAL_ROUND_SCORE_IDS, ROUND_SCORE_IDS } from "./content/tiles.js";
import { initialHexes, parseMap } from "./map.js";
import { addBundles, gainResources } from "./resources.js";
import { randomInt, seedFromString, shuffle } from "./rng.js";
import {
    CONTRACT_VERSION,
    type BonusTileId, type Decision, type DraftCategory, type DraftItem, type DraftPicks, type DraftPool,
    type GameState, type HexId, type HexState, type PalaceTileId, type PlayerState, type RuleError,
    type Seat, type SetupOptions, type SetupSet, type SetupSetId,
} from "./types.js";

/**
 * 开一局新游戏。只有服务端调用；同一个 seed 永远得到同一局。
 * 人数或地图不对时直接抛错：这是服务端代码写错了，不是玩家操作的问题。
 */
export function createGame(options: SetupOptions, seed: string): GameState {
    const n = options.playerCount;
    if (!Number.isInteger(n) || n < 2 || n > 5) throw new Error(`人数必须是 2~5，收到 ${n}`);
    const mapDef = MAPS[options.mapId];
    if (mapDef === undefined) throw new Error(`没有这张地图：${options.mapId}`);

    // 随机数状态只在这个函数里面变；每抽一次，rng 就换成新的状态
    let rng = seedFromString(seed);
    function take<T>(items: readonly T[]): T[] {
        const [result, next] = shuffle(items, rng);
        rng = next;
        return result;
    }

    // 随机选起始玩家，然后按座位顺时针排行动顺序
    let start: number;
    [start, rng] = randomInt(rng, n);
    const turnOrder = Array.from({ length: n }, (_, i) => (start + i) % n);

    // 两种开局方式摆的东西不一样
    const otherPalaces = PALACE_TILE_IDS.filter((id) => id !== PALACE_TILE_ALWAYS);
    let setupSets: SetupSet[] = [];
    let draft: DraftPool | null = null;
    let bonusOnBoard: BonusTileId[] = [];
    let palaceTiles: PalaceTileId[] = [];
    if (options.setupMode.kind === "sets") {
        // 7 块规划板旁边各放 1 个随机派系和 1 个随机回合奖励板块；剩下 3 个回合奖励板块放到场上
        const factions = take(FACTION_IDS);
        const bonusTiles = take(BONUS_TILE_IDS);
        setupSets = PLANNING_IDS.map((planning, i): SetupSet => ({
            id: i, planning, faction: factions[i], bonusTile: bonusTiles[i], takenBy: null,
        }));
        bonusOnBoard = bonusTiles.slice(PLANNING_IDS.length);
        // 宫殿板块：17 号每局都在，另外随机放"人数 + 1"个，升级宫殿时再选
        palaceTiles = [PALACE_TILE_ALWAYS, ...take(otherPalaces).slice(0, n + 1)];
    } else {
        // 轮抽：4 类东西分开摆，每类"人数 + 几"个；宫殿板块不用 17 号
        draft = {
            planning: take(PLANNING_IDS).slice(0, n + DRAFT_EXTRA.planning),
            faction: take(FACTION_IDS).slice(0, n + DRAFT_EXTRA.faction),
            bonusTile: take(BONUS_TILE_IDS).slice(0, n + DRAFT_EXTRA.bonusTile),
            palaceTile: take(otherPalaces).slice(0, n + DRAFT_EXTRA.palaceTile),
            picks: Array.from({ length: n }, (): DraftPicks => ({
                planning: null, faction: null, bonusTile: null, palaceTile: null,
            })),
        };
    }

    const state: GameState = {
        contractVersion: CONTRACT_VERSION,
        version: 0,
        options,
        rng: 0, // 最后再填，等所有随机都抽完
        round: 0,
        phase: "setup",
        turnOrder,
        nextTurnOrder: [],
        turn: null,
        pending: [],
        hexes: initialHexes(parseMap(mapDef)),
        bridges: [],
        cities: [],
        players: [], // 所有人选完之后才建立
        board: {
            setupSets,
            draft,
            powerActionsUsed: [],
            bookActions: take(BOOK_ACTION_IDS).slice(0, 3),
            bookActionsUsed: [],
            scholarSpaces: {
                banking: [null, null, null, null],
                law: [null, null, null, null],
                engineering: [null, null, null, null],
                medicine: [null, null, null, null],
            },
            level12: { banking: null, law: null, engineering: null, medicine: null },
            roundScores: take(ROUND_SCORE_IDS).slice(0, 6),
            finalRoundScore: take(FINAL_ROUND_SCORE_IDS)[0],
            bonusTiles: bonusOnBoard.map((id) => ({ id, coins: 1 })),
            innovationsAvailable: [], // M3
            competenciesLeft: {},     // M1-4
            palaceTilesAvailable: palaceTiles,
            cityTilesLeft: {},        // M1-5
        },
        finalScores: null,
    };
    const first = options.setupMode.kind === "sets" ? nextPickSet(state) : nextDraftPick(state);
    return { ...state, rng, pending: [first!] };
}

// ---------- 方式一：固定组合 ----------

/** 选组合的顺序：从起始玩家右手边开始逆时针，也就是行动顺序倒过来 */
export function pickSetOrder(state: GameState): Seat[] {
    return [...state.turnOrder].reverse();
}

/** 下一个要选组合的决策；所有人都选完了返回 null */
function nextPickSet(state: GameState): Decision | null {
    const sets = state.board.setupSets;
    const taken = sets.filter((s) => s.takenBy !== null).length;
    const order = pickSetOrder(state);
    if (taken >= order.length) return null;
    const seat = order[taken];
    return {
        id: `pickSet-${seat}`,
        seat,
        kind: "pickSet",
        options: sets.filter((s) => s.takenBy === null).map((s) => s.id),
    };
}

export function validatePickSet(state: GameState, seat: Seat, setId: SetupSetId): RuleError | null {
    const d = state.pending[0];
    if (state.phase !== "setup" || d === undefined || d.kind !== "pickSet") return "wrong-phase";
    if (d.seat !== seat) return "not-your-decision";
    if (!d.options.includes(setId)) return "invalid-choice";
    return null;
}

/** 选一组。调用前先用 validatePickSet 检查 */
export function applyPickSet(state: GameState, seat: Seat, setId: SetupSetId): GameState {
    const setupSets = state.board.setupSets.map((s) => (s.id === setId ? { ...s, takenBy: seat } : s));
    const next: GameState = { ...state, board: { ...state.board, setupSets } };

    const decision = nextPickSet(next);
    if (decision !== null) return { ...next, pending: [decision] };

    // 所有人都选完了：按座位建立玩家，然后开始放初始工坊
    const players = Array.from({ length: state.options.playerCount }, (_, s) =>
        createPlayer(s, setupSets.find((set) => set.takenBy === s)!),
    );
    return startInitialWorkshops({ ...next, players });
}

// ---------- 方式二：轮抽 ----------

/** 轮抽的 4 类东西；每人每类拿 1 个，所以一共绕 4 圈 */
export const DRAFT_CATEGORIES: readonly DraftCategory[] = ["planning", "faction", "bonusTile", "palaceTile"];

/**
 * 轮抽每一步轮到谁。按开局设置里的 order 排；
 * 以后要加别的顺序，就在 DraftOrder 类型里加一个名字，再在这里加一个 case。
 */
export function draftOrder(state: GameState): Seat[] {
    const mode = state.options.setupMode;
    if (mode.kind !== "draft") return [];
    const t = state.turnOrder;
    switch (mode.order) {
        case "snake": {
            // 1-2-3, 3-2-1, 1-2-3, 3-2-1
            const result: Seat[] = [];
            for (let lap = 0; lap < DRAFT_CATEGORIES.length; lap++) {
                result.push(...(lap % 2 === 0 ? t : [...t].reverse()));
            }
            return result;
        }
        default: {
            const unhandled: never = mode.order;
            return unhandled;
        }
    }
}

/** 这个座位现在能拿的东西：自己还没拿过的类别里，池子中剩下的 */
export function draftOptions(pool: DraftPool, seat: Seat): DraftItem[] {
    const mine = pool.picks[seat];
    const items: DraftItem[] = [];
    if (mine.planning === null) for (const id of pool.planning) items.push({ category: "planning", id });
    if (mine.faction === null) for (const id of pool.faction) items.push({ category: "faction", id });
    if (mine.bonusTile === null) for (const id of pool.bonusTile) items.push({ category: "bonusTile", id });
    if (mine.palaceTile === null) for (const id of pool.palaceTile) items.push({ category: "palaceTile", id });
    return items;
}

/** 已经拿了几样：数每个人手上不是 null 的格子，不用另外记 */
function draftPicksMade(pool: DraftPool): number {
    return pool.picks.reduce((sum, p) => sum + DRAFT_CATEGORIES.filter((c) => p[c] !== null).length, 0);
}

function nextDraftPick(state: GameState): Decision | null {
    const pool = state.board.draft!;
    const order = draftOrder(state);
    const k = draftPicksMade(pool);
    if (k >= order.length) return null;
    const seat = order[k];
    return { id: `draftPick-${k}`, seat, kind: "draftPick", options: draftOptions(pool, seat) };
}

export function validateDraftPick(state: GameState, seat: Seat, item: DraftItem): RuleError | null {
    const d = state.pending[0];
    if (state.phase !== "setup" || d === undefined || d.kind !== "draftPick") return "wrong-phase";
    if (d.seat !== seat) return "not-your-decision";
    if (!d.options.some((o) => o.category === item.category && o.id === item.id)) return "invalid-choice";
    return null;
}

/** 把一样东西从池子里拿走，记到这个座位名下 */
function takeFromPool(pool: DraftPool, seat: Seat, item: DraftItem): DraftPool {
    const picks = [...pool.picks];
    const mine = picks[seat];
    switch (item.category) {
        case "planning":
            picks[seat] = { ...mine, planning: item.id };
            return { ...pool, picks, planning: pool.planning.filter((id) => id !== item.id) };
        case "faction":
            picks[seat] = { ...mine, faction: item.id };
            return { ...pool, picks, faction: pool.faction.filter((id) => id !== item.id) };
        case "bonusTile":
            picks[seat] = { ...mine, bonusTile: item.id };
            return { ...pool, picks, bonusTile: pool.bonusTile.filter((id) => id !== item.id) };
        case "palaceTile":
            picks[seat] = { ...mine, palaceTile: item.id };
            return { ...pool, picks, palaceTile: pool.palaceTile.filter((id) => id !== item.id) };
    }
}

/** 拿一样东西。调用前先用 validateDraftPick 检查 */
export function applyDraftPick(state: GameState, seat: Seat, item: DraftItem): GameState {
    const pool = takeFromPool(state.board.draft!, seat, item);
    const next: GameState = { ...state, board: { ...state.board, draft: pool } };

    const decision = nextDraftPick(next);
    if (decision !== null) return { ...next, pending: [decision] };

    // 所有人都拿完了：按座位建立玩家，宫殿板块先拿在手上（宫殿建好后才生效）
    const players = pool.picks.map((p, s) => ({
        ...createPlayer(s, { planning: p.planning!, faction: p.faction!, bonusTile: p.bonusTile! }),
        palaceTile: p.palaceTile,
    }));
    // 剩下的回合奖励板块放到场上，各放 1 金币；其他剩下的收回盒子
    const leftover: DraftPool = { ...pool, bonusTile: [] };
    const board = { ...next.board, draft: leftover, bonusTiles: pool.bonusTile.map((id) => ({ id, coins: 1 })) };
    return startInitialWorkshops({ ...next, board, players });
}

// ---------- 建立玩家 ----------

/** 建立一个玩家需要知道的三样东西 */
export type SetupChoice = Pick<SetupSet, "planning" | "faction" | "bonusTile">;

/** 根据选到的规划板、派系、回合奖励板块建立玩家：开局资源 = 规划板 + 派系 */
export function createPlayer(seat: Seat, choice: SetupChoice): PlayerState {
    const display = PLANNING_DISPLAYS[choice.planning];
    const faction = FACTIONS[choice.faction];
    const science = { banking: 0, law: 0, engineering: 0, medicine: 0 };
    for (const d of DISCIPLINES) {
        science[d] = (display.startScience[d] ?? 0) + (faction.startScience[d] ?? 0);
    }
    const blank: PlayerState = {
        seat,
        faction: choice.faction,
        planning: choice.planning,
        homeTerrain: choice.planning,
        vp: STARTING_VP,
        coins: 0,
        tools: 0,
        scholars: 0,
        scholarsInSupply: SCHOLARS_TOTAL,
        books: { banking: 0, law: 0, engineering: 0, medicine: 0 },
        power: STARTING_POWER[choice.planning],
        bridges: BRIDGES_TOTAL,
        sailing: display.startSailing,
        terraforming: 0,
        science,
        keys: 0,
        buildingsLeft: { ...BUILDINGS_TOTAL },
        palaceTile: null,
        innovations: [],
        competencies: [],
        cityTiles: [],
        bonusTile: choice.bonusTile,
        specialsUsed: [],
        passed: false,
    };
    // 任选颜色的书（荒地）在这里先不加，放完工坊后再让玩家选
    return gainResources(blank, addBundles(display.start, faction.start)).player;
}

// ---------- 放初始工坊 ----------

/** 放初始工坊的顺序：按行动顺序每人放一个，再倒过来每人放一个 */
export function initialWorkshopOrder(state: GameState): Seat[] {
    return [...state.turnOrder, ...[...state.turnOrder].reverse()];
}

/** 已经放了几个初始工坊：从每人规划板上少了几座工坊算出来，不用另外记 */
function workshopsPlaced(state: GameState): number {
    return state.players.reduce((sum, p) => sum + BUILDINGS_TOTAL.workshop - p.buildingsLeft.workshop, 0);
}

function nextInitialWorkshop(state: GameState): Decision | null {
    const order = initialWorkshopOrder(state);
    const k = workshopsPlaced(state);
    if (k >= order.length) return null;
    return { id: `initialWorkshop-${k}`, seat: order[k], kind: "initialWorkshop" };
}

/** 两种开局方式选完后都从这里接着走：开始放初始工坊 */
function startInitialWorkshops(state: GameState): GameState {
    return { ...state, pending: [nextInitialWorkshop(state)!] };
}

export function validateInitialWorkshop(state: GameState, seat: Seat, hex: HexId): RuleError | null {
    const d = state.pending[0];
    if (state.phase !== "setup" || d === undefined || d.kind !== "initialWorkshop") return "wrong-phase";
    if (d.seat !== seat) return "not-your-decision";
    const h = state.hexes[hex];
    if (h === undefined) return "invalid-choice"; // 不存在的格子，或者是河流
    if (h.structure !== null) return "hex-occupied";
    if (h.terrain !== state.players[seat].homeTerrain) return "not-home-terrain";
    return null;
}

/** 放一个初始工坊（不花钱、不吸能）。调用前先用 validateInitialWorkshop 检查 */
export function applyInitialWorkshop(state: GameState, seat: Seat, hex: HexId): GameState {
    const hexes: Record<HexId, HexState> = {
        ...state.hexes,
        [hex]: {
            ...state.hexes[hex],
            structure: { owner: seat, type: "workshop", neutral: false, annex: false, city: null },
        },
    };
    const players = state.players.map((p) =>
        p.seat === seat ? { ...p, buildingsLeft: { ...p.buildingsLeft, workshop: p.buildingsLeft.workshop - 1 } } : p,
    );
    const next: GameState = { ...state, hexes, players };

    const decision = nextInitialWorkshop(next);
    if (decision !== null) return { ...next, pending: [decision] };
    return finishSetup(next);
}

/**
 * 工坊都放完了：开局设置结束，进入第 1 轮的收入阶段。
 * 开局时要自己选的东西排进待决策队列，按行动顺序：
 *  - 荒地：1 本任选颜色的书
 *  - 蜥蜴：任选学科前进 1 级，共 2 次
 *  - 沙漠：1 把免费铲子，不能顺带建工坊
 * 这些决策怎么处理在 M1-4 写。
 */
function finishSetup(state: GameState): GameState {
    const pending: Decision[] = [];
    for (const seat of state.turnOrder) {
        const p = state.players[seat];
        const display = PLANNING_DISPLAYS[p.planning];
        const faction = FACTIONS[p.faction];
        const books = (display.start.books?.gray ?? 0) + (faction.start.books?.gray ?? 0);
        if (books > 0) pending.push({ id: `setup-book-${seat}`, seat, kind: "bookColor", count: books });
        for (let i = 0; i < faction.scienceChoices; i++) {
            pending.push({ id: `setup-level-${seat}-${i}`, seat, kind: "scienceLevels", levels: 1 });
        }
        if (display.startSpades > 0) {
            pending.push({ id: `setup-spade-${seat}`, seat, kind: "spades", spades: display.startSpades, canBuild: false });
        }
    }
    return { ...state, round: 1, phase: "income", pending };
}