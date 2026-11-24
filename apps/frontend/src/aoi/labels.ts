// 界面上的中文文案。引擎只用英文 id，翻译统一放在这里。
// 派系、学科的中文名是暂定译名，拿到中文版规则书后再统一校对。
import type {
    BookActionId, BookColor, BuildingType, Decision, Discipline, Phase,
    PowerActionId, RuleError, StructureType, Terrain,
} from "@aoi/engine/aoi";

export const TERRAIN_NAME: Record<Terrain, string> = {
    desert: "沙漠", plains: "平原", swamp: "沼泽", lake: "湖泊",
    forest: "森林", mountain: "山脉", wasteland: "荒地",
};

export const DISCIPLINE_NAME: Record<Discipline, string> = {
    banking: "银行", law: "法律", engineering: "工程", medicine: "医学",
};

export const BOOK_NAME: Record<BookColor, string> = {
    ...DISCIPLINE_NAME,
    gray: "通用",
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

/** 暂定译名；未收录的派系直接显示英文 id */
const FACTION_NAME: Record<string, string> = {
    blessed: "受祝福者", felines: "猫族", goblins: "哥布林", illusionists: "幻术师",
    inventors: "发明家", lizards: "蜥蜴人", moles: "鼹鼠", monks: "僧侣",
    navigators: "航海家", omar: "奥马尔", philosophers: "哲学家", psychics: "灵能者",
};

export function factionName(id: string): string {
    return FACTION_NAME[id] ?? id;
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
    "invalid-choice": "选择无效",
    "bad-move": "操作格式不对",
};

/** 把一条待决策写成一句话，name 用来把座位号换成昵称 */
export function describeDecision(d: Decision, name: (seat: number) => string): string {
    switch (d.kind) {
        case "pickSet": return "选择开局组合（派系、规划板、回合奖励板块）";
        case "initialWorkshop": return "放置一个初始工坊";
        case "leech":
            return `${name(d.from)}在旁边建造：可以获得 ${d.power} 点能量，扣 ${d.vpCost} 分`;
        case "spades": return `使用 ${d.spades} 把免费铲子${d.canBuild ? "，可以顺带建工坊" : ""}`;
        case "bridge": return "选择桥的位置";
        case "scienceLevels": return `选择一门学科前进 ${d.levels} 级`;
        case "trackReward": return "轨道奖励：拿分数，还是拿一本书";
        case "competency": return "选择一个能力板块";
        case "palaceTile": return "选择一个宫殿板块";
        case "cityTile": return "选择一个城市板块";
        default: {
            // 穷尽检查：接口里新增了一种决策而这里没处理时，这一行会报类型错误
            const unhandled: never = d;
            return unhandled;
        }
    }
}
