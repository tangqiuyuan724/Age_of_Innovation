// 界面上的中文文案。引擎只用英文 id，翻译统一放在这里。
// 派系、地形的中文名照中文版配件；学科的中文名还是暂定译名。
import type {
    BonusTileId, BookActionId, BookColor, BuildingType, CompetencyId, ConversionId, Discipline, DraftCategory,
    FactionId, Phase, PowerActionId, RuleError, StructureType, Terrain,
} from "@aoi/engine/aoi";

export const TERRAIN_NAME: Record<Terrain, string> = {
    desert: "沙漠", plains: "平原", swamp: "沼泽", lake: "湖泊",
    forest: "森林", mountain: "山脉", wasteland: "荒地",
};

export const DISCIPLINE_NAME: Record<Discipline, string> = {
    banking: "银行", law: "法律", engineering: "工程", medicine: "医学",
};

/** gray 表示"任选颜色"，只出现在收益和费用里 */
export const BOOK_NAME: Record<BookColor, string> = {
    ...DISCIPLINE_NAME,
    gray: "任选颜色",
};

export const STRUCTURE_NAME: Record<StructureType, string> = {
    workshop: "工坊", guild: "行会", school: "学校", university: "大学",
    palace: "宫殿", tower: "塔楼", monument: "纪念碑",
};

/** 每种建筑一开始在规划板上有几座 */
export const BUILDING_TOTAL: Record<BuildingType, number> = {
    workshop: 9, guild: 4, school: 3, university: 1, palace: 1,
};

export const POWER_ACTION_LABEL: Record<PowerActionId, string> = {
    bridge: "建一座桥",
    scholar: "获得 1 学者",
    tools2: "获得 2 工具",
    coins7: "获得 7 金币",
    spade1: "免费 1 铲，改造并建造",
    spade2: "免费 2 铲，改造并建造",
};

export const BOOK_ACTION_LABEL: Record<BookActionId, string> = {
    power5: "获得 5 能量",
    levels2: "一门学科前进 2 级",
    coins6: "获得 6 金币",
    freeGuild: "免费把工坊升级为行会",
    guildVp: "每个行会得 2 分",
    spade3: "免费 3 铲，改造并建造",
};

export const PHASE_NAME: Record<Phase, string> = {
    setup: "开局设置", income: "收入阶段", actions: "行动阶段",
    scienceBonus: "科学奖励", ended: "游戏结束",
};

/** 派系的中文名：照中文版派系板块上印的名字 */
const FACTION_NAME: Record<FactionId, string> = {
    blessed: "圣者", felines: "猫人族", goblins: "哥布林", illusionists: "魔术师",
    inventors: "发明家", lizards: "蜥蜴", moles: "鼹鼠", monks: "僧侣",
    navigators: "航海家", omar: "奥马尔", philosophers: "哲学家", psychics: "通灵者",
};

export function factionName(id: FactionId): string {
    return FACTION_NAME[id];
}

/** 违规原因 → 中文提示（对应接口约定第 8 节） */
export const RULE_ERROR_TEXT: Record<RuleError, string> = {
    "game-over": "游戏已经结束",
    "wrong-phase": "现在不能做这个",
    "not-your-turn": "还没轮到你",
    "not-your-decision": "这不是你的决定",
    "decision-pending": "还有待处理的选择",
    "main-action-done": "本回合已经做过主行动了",
    "main-action-missing": "还没做主行动，不能结束回合",
    "insufficient-resources": "资源不够",
    "insufficient-power": "能量不够",
    "not-in-reach": "这个格子不在你的范围内",
    "not-home-terrain": "只能在家园地形上建造",
    "hex-occupied": "这里已经有建筑了",
    "no-own-building": "这里没有你的建筑",
    "cannot-upgrade": "这个建筑不能这样升级",
    "limit-reached": "已经达到上限",
    "action-taken": "这个行动本轮已经被用过了",
    "tile-unavailable": "这个板块已经没有了",
    "space-occupied": "这个学者格已经有人了",
    "invalid-choice": "选择无效",
    "bad-move": "操作格式不对",
};

/**
 * 按钮不能点的原因。界面上的按钮发出的指令格式一定是对的，
 * 所以引擎返回 bad-move 只有一种可能：这种指令引擎还没实现（比如 M1-5 时的能量行动）
 */
export function reasonText(e: RuleError): string {
    return e === "bad-move" ? "引擎还没实现" : RULE_ERROR_TEXT[e];
}

/**
 * 12 种能力板块：short 是放在小格子里的短名字（自己起的，不是官方译名），text 是效果。
 * 效果在 M3 实现，现在只是给人看的说明
 */
export const COMPETENCY_LABEL: Record<CompetencyId, { short: string; text: string }> = {
    incomeBookPower: { short: "书和能量", text: "收入：1 本任选颜色的书、1 能量" },
    bonusToolVpCoins: { short: "工具、分、金币", text: "立即：1 工具、5 分、2 金币" },
    passLowestScience: { short: "最低学科", text: "pass 时：按自己最低的学科等级得分" },
    incomeToolLevel: { short: "工具和学科", text: "收入：1 工具，任选学科前进 1 级" },
    bonusSpades: { short: "两把铲子", text: "立即：一次改造并建造，带 2 把免费铲子" },
    tower: { short: "塔楼", text: "立即：建一座中立塔楼；收入 2 能量、2 金币" },
    incomeVpCoins: { short: "分和金币", text: "收入：3 分、2 金币" },
    passCityVp: { short: "城市得分", text: "pass 时：每个城市板块 2 分" },
    borderWorkshopVp: { short: "边缘工坊", text: "在版图边缘的格子上建工坊得 3 分" },
    actionPower4: { short: "4 能量", text: "特殊行动：获得 4 能量" },
    scholarVp: { short: "学者得分", text: "派学者（含退回学者）得 2 分" },
    annexes: { short: "附楼", text: "立即：2 个中立附楼" },
};

/** 10 个回合奖励板块：short 是短名字（自己起的），text 是板块上印的内容 */
export const BONUS_TILE_LABEL: Record<BonusTileId, { short: string; text: string }> = {
    riverWorkshop: { short: "河边工坊", text: "在河边建工坊得 2 分；航行范围 +1" },
    scholarSend: { short: "派学者", text: "派学者得 2 分；收入 1 学者" },
    guildBuild: { short: "建行会", text: "建行会得 3 分；收入 3 能量" },
    bigBuildingsPass: { short: "大建筑", text: "pass 时每座大学、宫殿得 4 分；收入 1 工具" },
    spadeAction: { short: "铲子", text: "特殊行动：1 铲改造并建造；收入 1 本任选颜色的书" },
    bridgeAction: { short: "建桥", text: "特殊行动：免费建桥；收入 1 本任选颜色的书" },
    levelAction: { short: "学科", text: "特殊行动：任选学科前进 1 级；收入 2 工具" },
    schoolsPass: { short: "学校", text: "pass 时每座学校任选学科前进 1 级；收入 4 金币" },
    power4coins2: { short: "能量和金币", text: "收入 4 能量、2 金币" },
    coins6: { short: "6 金币", text: "收入 6 金币" },
};

/** 7 种资源转换 */
export const CONVERSION_LABEL: Record<ConversionId, string> = {
    power5ToScholar: "5 能量 → 1 学者",
    power5ToBook: "5 能量 → 1 本书",
    power3ToTool: "3 能量 → 1 工具",
    power1ToCoin: "1 能量 → 1 金币",
    scholarToTool: "1 学者 → 1 工具",
    toolToCoin: "1 工具 → 1 金币",
    bookToCoin: "1 本书 → 1 金币",
};

/** 轮抽的 4 类东西 */
export const DRAFT_CATEGORY_NAME: Record<DraftCategory, string> = {
    planning: "规划板", faction: "派系", bonusTile: "回合奖励板块", palaceTile: "宫殿板块",
};
