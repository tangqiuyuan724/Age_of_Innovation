// 12 个派系。M1 只用到开局资源和开局学科等级；派系能力在 M3 实现。
// 数据照中文版派系板块右侧一栏抄录。
import type { Discipline, FactionId, ResourceBundle } from "../types.js";

export interface FactionDef {
    id: FactionId;
    /** 开局资源 */
    start: ResourceBundle;
    /** 开局学科等级 */
    startScience: Partial<Record<Discipline, number>>;
    /** 开局要自己选的学科等级：每次 1 级，共几次（只有蜥蜴有，M1-4 处理） */
    scienceChoices: number;
    /** 开局还有特殊物品（奥马尔的塔、发明家的板块、僧侣的建筑），M3 实现 */
    specialSetup: boolean;
}

function faction(id: FactionId, overrides: Partial<FactionDef> = {}): FactionDef {
    return { id, start: {}, startScience: {}, scienceChoices: 0, specialSetup: false, ...overrides };
}

export const FACTIONS: Record<FactionId, FactionDef> = {
    blessed: faction("blessed", { startScience: { banking: 1, law: 1, engineering: 1, medicine: 1 } }),
    felines: faction("felines", { startScience: { banking: 1, medicine: 1 } }),
    goblins: faction("goblins", { start: { tools: 1 }, startScience: { banking: 1, engineering: 1 } }),
    illusionists: faction("illusionists", { startScience: { medicine: 2 } }),
    inventors: faction("inventors", { specialSetup: true }),
    lizards: faction("lizards", { scienceChoices: 2 }),
    moles: faction("moles", { startScience: { engineering: 2 } }),
    monks: faction("monks", { startScience: { law: 1 }, specialSetup: true }),
    navigators: faction("navigators", { startScience: { law: 3 } }),
    omar: faction("omar", { startScience: { banking: 1, engineering: 1 }, specialSetup: true }),
    philosophers: faction("philosophers", { startScience: { banking: 2 } }),
    psychics: faction("psychics", { start: { tools: 1 }, startScience: { banking: 1, medicine: 1 } }),
};

export const FACTION_IDS = Object.keys(FACTIONS) as FactionId[];