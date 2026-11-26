// ============================================================
// 大创造时代 · 前后端接口约定（类型部分）
// 这个文件是前后端共用的"合同"。改动前先更新 docs/接口约定.md，
// 并把 CONTRACT_VERSION 加 1。
// 所有类型都必须能直接 JSON 序列化：不用 class、Map、Set、Date。
// ============================================================

export const CONTRACT_VERSION = 8;

// ---------- 基础 ----------

/** 座位号：0 ~ 4 */
export type Seat = number;

/** 7 种地形（terrain） */
export type Terrain = "desert" | "plains" | "swamp" | "lake" | "forest" | "mountain" | "wasteland";

/** 4 门学科（discipline） */
export type Discipline = "banking" | "law" | "engineering" | "medicine";

/**
 * 书的颜色：4 门学科各一种。
 * "gray" 只出现在收益和费用里，表示"任选颜色"：
 *  - 在收益里：由玩家自己选颜色（会产生一个 bookColor 决策）
 *  - 在费用里：任意颜色都可以付
 * 玩家手上的书一定有具体颜色，没有灰色书。
 */
export type BookColor = Discipline | "gray";

/** 玩家自己的 5 种建筑 */
// 工坊｜工会｜学校｜大学｜宫殿
export type BuildingType = "workshop" | "guild" | "school" | "university" | "palace";

/** 地图上可能出现的所有建筑：玩家建筑 + 只能以中立方式获得的塔楼、纪念碑 */
export type StructureType = BuildingType | "tower" | "monument";

/** 格子编号：行字母 + 列号（从 1 开始，河流格也计数），例如 "E7" */
export type HexId = string;

/** 一组资源，用于费用、收益、事件 */
export interface ResourceBundle {
    coins?: number;  // 钱币
    tools?: number;  // 工具
    scholars?: number;   // 学者
    vp?: number; // 分数
    /** 获得能量（按能量碗规则流动），不是能量指示物个数 */
    power?: number;
    books?: Partial<Record<BookColor, number>>;   // 书
    spades?: number; // 铲子
}

// ---------- 内容 ID ----------

/** 12 个派系 */
export type FactionId =
    | "blessed"      // 圣者
    | "felines"      // 猫人族
    | "goblins"      // 哥布林
    | "illusionists" // 魔术师
    | "inventors"    // 发明家
    | "lizards"      // 蜥蜴
    | "moles"        // 鼹鼠
    | "monks"        // 僧侣
    | "navigators"   // 航海家
    | "omar"         // 奥马尔
    | "philosophers" // 哲学家
    | "psychics";    // 通灵者
/** 规划板：7 块，每块对应一种家园地形，所以直接用地形当编号 */
export type PlanningId = Terrain;
export type PalaceTileId = number; // 宫殿板块
export type InnovationId = string;  // 大创板块
/** 12 种能力板块（每种 4 张）。效果在 M3 实现，这一课只用到编号。顺序和图片编号 #1~#12 一样 */
export type CompetencyId =
    | "incomeBookPower"   // #1 收入：1 本任选颜色的书、1 能量
    | "bonusToolVpCoins"  // #2 立即：1 工具、5 分、2 金币
    | "passLowestScience" // #3 pass 时：按自己最低的学科等级得分
    | "incomeToolLevel"   // #4 收入：1 工具，任选学科前进 1 级
    | "bonusSpades"       // #5 立即：一次"改造并建造"，带 2 把免费铲子
    | "tower"             // #6 立即：建一座中立塔楼；收入 2 能量、2 金币
    | "incomeVpCoins"     // #7 收入：3 分、2 金币
    | "passCityVp"        // #8 pass 时：每个城市板块 2 分
    | "borderWorkshopVp"  // #9 在版图边缘的格子上建工坊得 3 分
    | "actionPower4"      // #10 特殊行动：获得 4 能量
    | "scholarVp"         // #11 派学者（含退回学者）得 2 分
    | "annexes";          // #12 立即：2 个中立附楼
/** 7 种城市板块（每种 3 张）。每张都给 1 把钥匙，再加上这里写的分数和奖励 */
export type CityTileId =
    | "tools"    // 4 分、3 工具
    | "spades"   // 5 分、一次"改造并建造"，带 2 把免费铲子
    | "books"    // 5 分、2 本任选颜色的书
    | "coins"    // 6 分、6 金币
    | "levels"   // 7 分、每门学科前进 1 级
    | "power"    // 8 分、8 能量
    | "scholar"; // 8 分、1 学者
/** 10 个回合奖励板块 */
export type BonusTileId =
    | "riverWorkshop"    // 行动：在河边建工坊得 2 分；航行范围 +1
    | "scholarSend"      // 行动：派学者得 2 分；收入 1 学者
    | "guildBuild"       // 行动：建行会得 3 分；收入 3 能量
    | "bigBuildingsPass" // pass 时每座大学、宫殿得 4 分；收入 1 工具
    | "spadeAction"      // 特殊行动：1 铲改造并建造；收入 1 本任选颜色的书
    | "bridgeAction"     // 特殊行动：免费建桥；收入 1 本任选颜色的书
    | "levelAction"      // 特殊行动：任选学科前进 1 级；收入 2 工具
    | "schoolsPass"      // pass 时每座学校任选学科前进 1 级；收入 4 金币
    | "power4coins2"     // 收入 4 能量、2 金币
    | "coins6";          // 收入 6 金币
/**
 * 12 个回合计分板块。名字 = 左半边（这一轮做什么行动得分）+ 右半边（轮末按哪门学科给科学奖励）。
 * 具体分数和奖励见 content/roundScores.ts
 */
export type RoundScoreId =
    | "workshopLaw"      // 建工坊 2 分；法律每 3 级 1 学者
    | "workshopBanking"  // 建工坊 2 分；银行每 3 级 4 能量
    | "guildLaw"         // 建行会 3 分；法律每 3 级 1 本书
    | "guildMedicine"    // 建行会 3 分；医学每 4 级 1 铲
    | "schoolBanking"    // 建学校 4 分；银行每 1 级 1 金币
    | "bigMedicine"      // 建宫殿或大学 5 分；医学每 2 级 1 工具
    | "bigBanking"       // 建宫殿或大学 5 分；银行每 2 级 1 工具
    | "spadeEngineering" // 每用 1 把铲子 2 分；工程每 1 级 1 金币
    | "levelMedicine"    // 学科每前进 1 级 1 分；医学每 3 级 1 本书
    | "cityEngineering"  // 拿城市板块 5 分；工程每 4 级 1 铲
    | "trackEngineering" // 推进航行轨或改造轨 3 分；工程每 3 级 1 学者
    | "innovationLaw";   // 拿创新板块 5 分；法律每 2 级 3 能量
/** 4 个终局回合计分板块：第 6 轮盖在回合计分板块的右半边（Images 117~120） */
export type FinalRoundScoreId =
    | "guild"           // 建行会 3 分
    | "borderWorkshop"  // 在版图边缘建工坊 3 分
    | "school"          // 建学校 4 分
    | "workshop";       // 建工坊 2 分
/** 开局时一组"派系 + 规划板 + 回合奖励板块"的编号 */
export type SetupSetId = number;

/** 6 个能量行动（固定） */
export type PowerActionId =
    | "bridge"   // 3 能量：建一座桥
    | "scholar"  // 3 能量：1 学者
    | "tools2"   // 4 能量：2 工具
    | "coins7"   // 4 能量：7 金币
    | "spade1"   // 4 能量：免费 1 铲改造并建造
    | "spade2";  // 6 能量：免费 2 铲改造并建造

/** 6 个书本行动（每局翻开 3 个） */
export type BookActionId =
    | "power5"   // 1 书：5 能量
    | "levels2"  // 1 书：某学科前进 2 级
    | "coins6"   // 2 书：6 金币
    | "freeGuild"// 2 书：免费把一个工坊升级为行会
    | "guildVp"  // 2 书：每个行会 2 分
    | "spade3";  // 3 书：免费 3 铲改造并建造

/** 资源转换（free action） */
export type ConversionId =
    | "power5ToScholar" // 5 能量 → 1 学者
    | "power5ToBook"    // 5 能量 → 1 本书（需指定 color）
    | "power3ToTool"    // 3 能量 → 1 工具
    | "power1ToCoin"    // 1 能量 → 1 金币
    | "scholarToTool"   // 1 学者 → 1 工具
    | "toolToCoin"      // 1 工具 → 1 金币
    | "bookToCoin";     // 1 本书 → 1 金币（需指定 color）

// ---------- 地图（静态数据） ----------

/** 地形代码：地图文件里每个字符代表一格 */
export type TerrainCode = "D" | "P" | "S" | "L" | "F" | "M" | "W";

/**
 * 地图定义。rows 的每个字符是一格：地形代码，或 "~" 表示河流。
 * 六边形尖头朝上（pointy-top），奇数行（第 2、4、6… 行，即 B、D、F…）整体向右错开半格。
 */
export interface MapDef {
    id: string;
    name: string;
    rows: string[];
}

/** 解析后的一个格子（静态） */
export interface HexInfo {
    id: HexId;
    /** 行下标，从 0 开始（A 行是 0） */
    row: number;
    /** 列下标，从 0 开始（第 1 列是 0） */
    col: number;
    river: boolean;
    /** 河流格为 null */
    terrain: Terrain | null;
}

/** 解析后的地图：引擎用它算邻接和可达范围，前端用 row/col 画格子 */
export interface MapGeometry {
    id: string;
    name: string;
    rowCount: number;
    /** 按行、再按列的顺序 */
    hexes: HexInfo[];
    byId: Record<HexId, HexInfo>;
}

// ---------- 地图（动态状态） ----------

export interface Structure {
    owner: Seat;
    type: StructureType;
    /** 中立建筑：通过创新板块等获得，算作 owner 的建筑，但不能升级 */
    neutral: boolean;
    /** 附楼：能量值 +1 */
    annex: boolean;
    /** 所属城市编号；还没组成城市时为 null */
    city: number | null;
}

export interface HexState {
    terrain: Terrain;
    structure: Structure | null;
}

export interface Bridge {
    owner: Seat;
    a: HexId;
    b: HexId;
}

export interface City {
    id: number;
    owner: Seat;
    hexes: HexId[];
    tile: CityTileId | null;   // 选城市板块之前为 null
}

// ---------- 玩家 ----------

/** 能量碗 I、II、III 里的指示物个数 */
export type PowerBowls = [number, number, number];

export interface PlayerState {
    seat: Seat; // 座位号
    faction: FactionId; // 派系
    planning: PlanningId;   // 规划板块
    homeTerrain: Terrain;   // 地形

    vp: number; // 分数
    coins: number;  // 钱币
    tools: number;  // 工具
    /** 手上可用的学者 */
    scholars: number;
    /** 还在个人供应区、尚未获得的学者（每人共 7 个） */
    scholarsInSupply: number;
    books: Record<Discipline, number>;   // 书（没有灰色，颜色和学科对应）
    power: PowerBowls;  // 能量

    /** 剩余可建的桥（每人 3 座） */
    bridges: number;
    sailing: number;    // 航行等级
    terraforming: number;   // 改造等级
    /** 学科等级 0 ~ 12 */
    science: Record<Discipline, number>;
    /** 城市钥匙数 */
    keys: number;

    /** 规划板上还没建出去的建筑；空出来的格子决定收入 */
    buildingsLeft: Record<BuildingType, number>;

    /** 宫殿板块。固定组合开局：升级宫殿时才选；轮抽开局：一开始就有，宫殿建好后才生效 */
    palaceTile: PalaceTileId | null;
    innovations: InnovationId[];    // 大创板块
    competencies: CompetencyId[];   // 能力板块
    cityTiles: CityTileId[];    // 城市板块
    bonusTile: BonusTileId | null;  // 奖励板块

    /** 本轮已经用过的特殊行动（填来源 id） */
    specialsUsed: string[];
    passed: boolean;
}

// ---------- 公共版图 ----------

export interface BonusTileOnBoard {
    id: BonusTileId;
    coins: number;
}

/** 开局时摆出的一组"规划板 + 派系 + 回合奖励板块"，玩家从中选一组 */
export interface SetupSet {
    id: SetupSetId;
    planning: PlanningId;
    faction: FactionId;
    bonusTile: BonusTileId;
    /** 被哪个座位选走了；还没人选为 null */
    takenBy: Seat | null;
}

/** 轮抽开局时可以拿的 4 类东西 */
export type DraftCategory = "planning" | "faction" | "bonusTile" | "palaceTile";

/** 轮抽时拿的一样东西：哪一类、哪一个 */
export type DraftItem =
    | { category: "planning"; id: PlanningId }
    | { category: "faction"; id: FactionId }
    | { category: "bonusTile"; id: BonusTileId }
    | { category: "palaceTile"; id: PalaceTileId };

/** 一个座位在轮抽里已经拿到的东西，还没拿的是 null */
export interface DraftPicks {
    planning: PlanningId | null;
    faction: FactionId | null;
    bonusTile: BonusTileId | null;
    palaceTile: PalaceTileId | null;
}

/** 轮抽开局时摆出来的东西 */
export interface DraftPool {
    /** 还没被拿走的 */
    planning: PlanningId[];
    faction: FactionId[];
    bonusTile: BonusTileId[];
    palaceTile: PalaceTileId[];
    /** 每个座位已经拿到的东西，下标 = 座位号 */
    picks: DraftPicks[];
}

export interface BoardState {
    /** 固定组合开局的 7 组选择（选完后留着，前端可以显示谁选了什么）；轮抽开局时为空数组 */
    setupSets: SetupSet[];
    /** 轮抽开局摆出来的东西；固定组合开局时为 null */
    draft: DraftPool | null;
    powerActionsUsed: PowerActionId[];   // 已用的能量行动
    /** 本局翻开的 3 个书本行动 */
    bookActions: BookActionId[];
    bookActionsUsed: BookActionId[];  // 已用的书本行动
    /** 每门学科下的 4 个学者格，记录放在那里的座位 */
    scholarSpaces: Record<Discipline, (Seat | null)[]>;
    /** 每门学科第 12 级被谁占了 */
    level12: Record<Discipline, Seat | null>;
    /** 第 1~6 轮的回合计分板块 */
    roundScores: RoundScoreId[];
    finalRoundScore: FinalRoundScoreId; // 终局回合计分板块
    /** 场上可选的回合奖励板块（含上面累积的金币） */
    bonusTiles: BonusTileOnBoard[];
    innovationsAvailable: InnovationId[];   // 可选的大创板块
    /**
     * 能力板块展示区：每门学科一列，每列从上到下 3 格，开局随机摆放。
     * 从第 1、2、3 行拿，分别得到这一列学科的 3 级 / 2 级 + 1 本书 / 1 级 + 2 本书
     */
    competencyGrid: Record<Discipline, CompetencyId[]>;
    competenciesLeft: Record<CompetencyId, number>; // 剩余的能力板块（开局各 4 张）
    palaceTilesAvailable: PalaceTileId[];   // 可选的宫殿板块
    cityTilesLeft: Record<CityTileId, number>;  // 剩余的城市板块
}

// ---------- 流程 ----------

export type Phase = "setup" | "income" | "actions" | "scienceBonus" | "ended";

export interface TurnInfo {
    seat: Seat;
    /** 本回合是否已经做过主行动 */
    mainActionDone: boolean;
    /** 本回合新建或升级了建筑的格子。回合结束时，从这些格子向邻居发起吸能 */
    builtHexes: HexId[];
}

/**
 * 轮抽的顺序。现在只有蛇形（1-2-3-3-2-1-1-2-3…）；
 * 以后要加别的顺序，在这里加一个名字，再在引擎的 draftOrder 里加一种排法。
 */
export type DraftOrder = "snake";

/** 开局方式 */
export type SetupMode =
    | { kind: "sets" }                       // 固定组合：7 块规划板各配 1 个派系、1 个回合奖励板块，每人选一组
    | { kind: "draft"; order: DraftOrder };  // 轮抽：规划板、派系、回合奖励板块、宫殿板块分开摆，轮流拿

export interface SetupOptions {
    playerCount: number; // 2~5
    mapId: string;
    setupMode: SetupMode;
}

export interface FinalScore {
    seat: Seat;
    total: number;
    /** 计分明细：{ game: 游戏中拿到的分, area: 区域, science: 学科, resources: 剩下的资源 }，total 是四项之和 */
    breakdown: Record<string, number>;
}

export interface GameState {
    contractVersion: number;
    /** 每执行一条指令 +1 */
    version: number;
    options: SetupOptions;
    /** 随机数生成器的内部状态 */
    rng: number;

    round: number; // 0 = 开局设置，1~6
    phase: Phase;
    turnOrder: Seat[];
    nextTurnOrder: Seat[];
    turn: TurnInfo | null;
    pending: Decision[];

    hexes: Record<HexId, HexState>; // 只含陆地格
    bridges: Bridge[];
    cities: City[];
    players: PlayerState[]; // 下标 = 座位号
    board: BoardState;

    finalScores: FinalScore[] | null;
}

// ---------- 待决策（可能不是当前行动的玩家来做） ----------

interface DecisionBase {
    id: string;
    seat: Seat;
}

export type Decision =
    | (DecisionBase & { kind: "pickSet"; options: SetupSetId[] })   // 选择开局组合
    | (DecisionBase & { kind: "initialWorkshop" })  // 放初始工坊
    | (DecisionBase & { kind: "leech"; from: Seat; power: number; vpCost: number }) // 吸能
    | (DecisionBase & { kind: "spades"; spades: number; canBuild: boolean })    // 使用免费铲子
    | (DecisionBase & { kind: "bridge" })   // 建桥
    | (DecisionBase & { kind: "scienceLevels"; levels: number })    // 选科学轨前进
    // | (DecisionBase & { kind: "trackReward" })  // 航行/改造轨奖励
    | (DecisionBase & { kind: "competency"; options: CompetencyId[] })  // 选能力板块
    | (DecisionBase & { kind: "palaceTile"; options: PalaceTileId[] })  // 选宫殿板块
    | (DecisionBase & { kind: "cityTile"; cityId: number; options: CityTileId[] }) // 选城市板块
    | (DecisionBase & { kind: "bookColor"; count: number })   // 获得 count 本任选颜色的书，选颜色
    | (DecisionBase & { kind: "draftPick"; options: DraftItem[] }); // 轮抽开局：从还能拿的东西里拿一样

export type DecisionChoice =
    | { kind: "pickSet"; set: SetupSetId }
    | { kind: "initialWorkshop"; hex: HexId }
    | { kind: "leech"; accept: boolean }
    | { kind: "spades"; hex: HexId; build: boolean }
    | { kind: "spades"; skip: true }
    | { kind: "bridge"; a: HexId; b: HexId }
    | { kind: "bridge"; skip: true } // 放弃建桥
    | { kind: "scienceLevels"; discipline: Discipline }
    | { kind: "scienceLevels"; skip: true } // 放弃前进
    | { kind: "bookColor"; books: Partial<Record<Discipline, number>> }
    | { kind: "draftPick"; item: DraftItem }
    | { kind: "competency"; tile: CompetencyId }
    | { kind: "palaceTile"; tile: PalaceTileId }
    | { kind: "cityTile"; tile: CityTileId };

// ---------- 指令（客户端发给服务器的 move） ----------

/** 付书时写清楚每种颜色各付几本 */
export type BookPayment = Partial<Record<Discipline, number>>;

export type Move =
    // 自由行动：自己回合内，主行动前后都能做
    | { t: "convert"; conversion: ConversionId; times: number; color?: Discipline } // 资源转换
    | { t: "sacrificePower"; times: number }    // 爆能
    // 主行动：每回合一个
    | { t: "terraformAndBuild"; hex: HexId; spades: number; build: boolean }    // 改造和建筑
    | { t: "upgrade"; hex: HexId; to: "guild" | "school" | "palace" | "university" }    // 升级建筑
    | { t: "advanceTrack"; track: "sailing" | "terraforming" }  // 升级航行/改造轨
    | { t: "sendScholar"; discipline: Discipline; space: number | "return" }    // 学者爬轨
    | { t: "developInnovation"; tile: InnovationId; books: BookPayment }    // 买大创
    | { t: "powerAction"; id: PowerActionId }   // 能量行动
    /** freeGuild（免费把工坊升成行会）要用 hex 说明升哪一个；别的书本行动不填 hex */
    | { t: "bookAction"; id: BookActionId; books: BookPayment; hex?: HexId }
    /** source：特殊行动从哪来。回合奖励板块上的写成 "bonus:板块编号"，比如 "bonus:spadeAction" */
    | { t: "specialAction"; source: string }
    | { t: "pass"; bonusTile: BonusTileId | null } // 过轮，第 6 轮传 null
    // 回合控制与决策
    | { t: "endTurn" }
    | { t: "decide"; id: string; choice: DecisionChoice };

// ---------- 事件（服务器随快照下发，用于日志和动画） ----------

export type GameEvent =
    | { type: "phase"; round: number; phase: Phase }    // 阶段切换
    | { type: "turn"; seat: Seat }  // 轮到某人
    | { type: "resources"; seat: Seat; delta: ResourceBundle; reason: string }  // 资源变化
    | { type: "terraformed"; seat: Seat; hex: HexId; from: Terrain; to: Terrain }   // 改造地形
    | { type: "built"; seat: Seat; hex: HexId; structure: StructureType }   // 建造
    | { type: "upgraded"; seat: Seat; hex: HexId; from: BuildingType; to: BuildingType }    // 建筑升级
    | { type: "bridgeBuilt"; seat: Seat; a: HexId; b: HexId }   // 建桥
    | { type: "leech"; seat: Seat; from: Seat; power: number; vpCost: number; accepted: boolean }   // 吸能结果
    | { type: "science"; seat: Seat; discipline: Discipline; from: number; to: number } // 学科前进
    | { type: "cityFounded"; seat: Seat; cityId: number; hexes: HexId[] }   // 组成城市
    | { type: "track"; seat: Seat; track: "sailing" | "terraforming"; from: number; to: number }   // 航行轨、改造轨前进
    | { type: "scholarSent"; seat: Seat; discipline: Discipline; space: number | "return" }   // 派学者
    | { type: "tileTaken"; seat: Seat; tile: string; kind: "palace" | "innovation" | "competency" | "city" | "bonus" }  // 拿了板块
    | { type: "passed"; seat: Seat; bonusTile: BonusTileId | null } // 结束本轮
    | { type: "gameEnded"; scores: FinalScore[] };  // 游戏结束

// ---------- 违规原因（服务器 ctx.reject 的 reason） ----------

export type RuleError =
    | "game-over"   // 游戏已经结束	
    | "wrong-phase" // 阶段不对，现在不能做这个
    | "not-your-turn"   // 不是你的回合
    | "not-your-decision"   // 这不是你的决定
    | "decision-pending"    // 有决策没处理完
    | "main-action-done"    // 本回合已经做过主行动了
    | "main-action-missing" // 还没做主行动，不能结束回合	
    | "insufficient-resources"  // 资源不够
    | "insufficient-power"  // 能量不够
    | "not-in-reach"    // 目标格离你的建筑太远
    | "not-home-terrain"    // 只能在家园地形上建造
    | "hex-occupied"    // 这里已经有建筑了
    | "no-own-building" // 这里没有你的建筑
    | "cannot-upgrade"  // 这个建筑不能这样升级
    | "limit-reached"   // 已经达到上限
    | "action-taken"    // 这个行动本轮已经被用过了
    | "tile-unavailable"    // 这个板块已经没有了
    | "space-occupied"  // 这个学者格已经有人了
    | "invalid-choice"  // 选择无效	
    | "bad-move";   // 操作格式不对