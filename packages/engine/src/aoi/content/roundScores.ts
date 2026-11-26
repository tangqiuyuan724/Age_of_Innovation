// 12 个回合计分板块。每局随机选 6 个，第 1~6 轮各用一个。
//  - 左半边：这一轮每做一次某种行动，马上得几分（只在行动阶段算）
//  - 右半边：这一轮结束时的科学奖励：某门学科每有 per 级，拿一份 reward（第 6 轮没有）
// 来源：规则书附录 IX，和 Images 里的 105~116 号图核对过。
import type { Discipline, ResourceBundle, RoundScoreId } from "../types.js";

/**
 * 能得分的行动。回合计分板块、回合奖励板块（以后还有能力板块、创新板块）都用这些名字：
 *  - workshop：建工坊；riverWorkshop：在河边建工坊
 *  - guild / school：建行会 / 学校；bigBuilding：建宫殿或大学
 *  - spade：每用 1 把铲子（改造一步）
 *  - level：学科每前进 1 级
 *  - scholar：派学者（包括退回学者）
 *  - city：拿城市板块；innovation：拿创新板块
 *  - track：推进航行轨或改造轨
 */
export type ScoreAction =
    | "workshop" | "riverWorkshop" | "guild" | "school" | "bigBuilding"
    | "spade" | "level" | "scholar" | "city" | "innovation" | "track";

export interface RoundScoreDef {
    id: RoundScoreId;
    /** 左半边：这一轮每做一次 action 得 vp 分 */
    action: ScoreAction;
    vp: number;
    /** 右半边：轮末 discipline 每 per 级拿一份 reward。reward 里的 spades 是免费铲子，books 里的 gray 是任选颜色的书 */
    science: { discipline: Discipline; per: number; reward: ResourceBundle };
}

export const ROUND_SCORE_TILES: Record<RoundScoreId, RoundScoreDef> = {
    workshopLaw: {
        id: "workshopLaw", action: "workshop", vp: 2,
        science: { discipline: "law", per: 3, reward: { scholars: 1 } },
    },
    workshopBanking: {
        id: "workshopBanking", action: "workshop", vp: 2,
        science: { discipline: "banking", per: 3, reward: { power: 4 } },
    },
    guildLaw: {
        id: "guildLaw", action: "guild", vp: 3,
        science: { discipline: "law", per: 3, reward: { books: { gray: 1 } } },
    },
    guildMedicine: {
        id: "guildMedicine", action: "guild", vp: 3,
        science: { discipline: "medicine", per: 4, reward: { spades: 1 } },
    },
    schoolBanking: {
        id: "schoolBanking", action: "school", vp: 4,
        science: { discipline: "banking", per: 1, reward: { coins: 1 } },
    },
    bigMedicine: {
        id: "bigMedicine", action: "bigBuilding", vp: 5,
        science: { discipline: "medicine", per: 2, reward: { tools: 1 } },
    },
    bigBanking: {
        id: "bigBanking", action: "bigBuilding", vp: 5,
        science: { discipline: "banking", per: 2, reward: { tools: 1 } },
    },
    spadeEngineering: {
        id: "spadeEngineering", action: "spade", vp: 2,
        science: { discipline: "engineering", per: 1, reward: { coins: 1 } },
    },
    levelMedicine: {
        id: "levelMedicine", action: "level", vp: 1,
        science: { discipline: "medicine", per: 3, reward: { books: { gray: 1 } } },
    },
    cityEngineering: {
        id: "cityEngineering", action: "city", vp: 5,
        science: { discipline: "engineering", per: 4, reward: { spades: 1 } },
    },
    trackEngineering: {
        id: "trackEngineering", action: "track", vp: 3,
        science: { discipline: "engineering", per: 3, reward: { scholars: 1 } },
    },
    innovationLaw: {
        id: "innovationLaw", action: "innovation", vp: 5,
        science: { discipline: "law", per: 2, reward: { power: 3 } },
    },
};

export const ROUND_SCORE_IDS = Object.keys(ROUND_SCORE_TILES) as RoundScoreId[];

/**
 * 开局摆回合计分板块：从洗好的 shuffled 里，依次给第 6、5、4、3、2、1 轮挑第一块能放的：
 *  - "每用 1 把铲子 2 分"那块不能放在第 5、6 轮
 *  - 第 1~5 轮里，同一门学科的科学奖励最多 2 块（第 6 轮的右半边被盖住，不算）
 * 返回第 1~6 轮的板块
 */
export function pickRoundScores(shuffled: readonly RoundScoreId[]): RoundScoreId[] {
    const rounds: (RoundScoreId | null)[] = [null, null, null, null, null, null]; // rounds[r - 1] 是第 r 轮的板块
    const rest = [...shuffled];
    for (let round = 6; round >= 1; round--) {
        const i = rest.findIndex((id) => fitsRound(id, round, rounds));
        rounds[round - 1] = rest[i];
        rest.splice(i, 1);
    }
    return rounds as RoundScoreId[];
}

/** id 能不能放在第 round 轮（rounds 里是已经摆好的，没摆的是 null） */
function fitsRound(id: RoundScoreId, round: number, rounds: (RoundScoreId | null)[]): boolean {
    const tile = ROUND_SCORE_TILES[id];
    if (round >= 5 && tile.action === "spade") return false;
    if (round <= 5) {
        const discipline = tile.science.discipline;
        const same = rounds.slice(0, 5).filter((other) => other !== null && ROUND_SCORE_TILES[other].science.discipline === discipline);
        if (same.length >= 2) return false;
    }
    return true;
}