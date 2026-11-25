// 7 块规划板。数据照中文版规划板抄录（你 Images 文件夹里的扫描图）。
// 规划板的编号就是它的家园地形。
import type { BuildingType, Discipline, PlanningId, ResourceBundle } from "../types.js";

export interface PlanningDisplay {
    id: PlanningId;
    /** 开局资源：规划板右上角印的 */
    start: ResourceBundle;
    /** 开局学科等级 */
    startScience: Partial<Record<Discipline, number>>;
    /** 开局航行等级：湖泊的航行轨从 1 开始，其他从 0 开始 */
    startSailing: number;
    /** 开局的免费铲子：所有建筑放完后使用，不能顺带建工坊（只有沙漠有） */
    startSpades: number;
    /** 一直都有的收入：工坊那一行最左边印的 */
    baseIncome: ResourceBundle;
    /**
     * 每种建筑每一格下面印的收入。建出去第 k 座，就露出第 k 格（下标 k-1）。
     * 升级时旧建筑放回这一行最右边的空格，所以"露出的格子"永远是前面几格。
     */
    income: Record<BuildingType, ResourceBundle[]>;
    /** 航行轨、改造轨前进一格的费用：印在两条轨道下面 */
    sailingCost: ResourceBundle;
    terraformingCost: ResourceBundle;
    /**
     * 前进到每一格的奖励，下标 = 等级。下标 0 是起点，没有奖励。
     * 灰色的书表示"任选颜色"。数组长度减 1 就是这条轨道的最高等级
     */
    sailingRewards: ResourceBundle[];
    terraformingRewards: ResourceBundle[];
}

const TOOL: ResourceBundle = { tools: 1 };

/** 7 块规划板里 6 块一样的收入。山脉稍有不同，见下面 */
const STANDARD_INCOME: Record<BuildingType, ResourceBundle[]> = {
    // 第 5 格是空的：建第 5 座工坊没有收入
    workshop: [TOOL, TOOL, TOOL, TOOL, {}, TOOL, TOOL, TOOL, TOOL],
    guild: [{ power: 1, coins: 2 }, { power: 1, coins: 2 }, { power: 2, coins: 2 }, { power: 2, coins: 2 }],
    school: [{ scholars: 1 }, { scholars: 1 }, { scholars: 1 }],
    university: [{ scholars: 1 }], // 旁边的三格六边形不是收入：有大学的城市只要 3 座建筑（M1-2 的组城判定已处理）
    palace: [{}], // 宫殿的收入印在宫殿板块上，不在规划板上
};

/** 先填好最常见的值，再用 overrides 覆盖不一样的地方 */
function display(id: PlanningId, overrides: Partial<PlanningDisplay> = {}): PlanningDisplay {
    return {
        id,
        start: { tools: 3, coins: 15 },
        startScience: {},
        startSailing: 0,
        startSpades: 0,
        baseIncome: TOOL,
        income: STANDARD_INCOME,
        sailingCost: { coins: 4, scholars: 1 },
        terraformingCost: { coins: 5, tools: 1, scholars: 1 },
        sailingRewards: [{}, { vp: 2 }, { books: { gray: 2 } }, { vp: 4 }],
        terraformingRewards: [{}, { books: { gray: 2 } }, { vp: 6 }],
        ...overrides,
    };
}

export const PLANNING_DISPLAYS: Record<PlanningId, PlanningDisplay> = {
    desert: display("desert", { startSpades: 1 }),
    plains: display("plains", { terraformingCost: { coins: 1, tools: 1, scholars: 1 } }),
    swamp: display("swamp", { start: { scholars: 1, tools: 3, coins: 15 } }),
    // 湖泊的航行轨从 1 开始，后面两格的奖励也和别人不一样
    lake: display("lake", { startSailing: 1, sailingRewards: [{}, {}, { vp: 3 }, { books: { gray: 2 } }] }),
    forest: display("forest", { startScience: { banking: 1, law: 1, engineering: 1, medicine: 1 } }),
    mountain: display("mountain", {
        baseIncome: { tools: 1, coins: 2 },
        income: {
            ...STANDARD_INCOME,
            guild: [{ power: 1, coins: 3 }, ...STANDARD_INCOME.guild.slice(1)],
        },
    }),
    wasteland: display("wasteland", { start: { books: { gray: 1 }, tools: 4, coins: 15 } }),
};

/** 7 块规划板的编号，顺序和地形轮一样 */
export const PLANNING_IDS: readonly PlanningId[] = [
    "desert", "plains", "swamp", "lake", "forest", "mountain", "wasteland",
];