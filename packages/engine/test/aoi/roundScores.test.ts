import { describe, it, expect } from "vitest";
import {
    CITY_TILE_IDS, DISCIPLINES, ROUND_SCORE_IDS, ROUND_SCORE_TILES, createGame, pickRoundScores,
    type RoundScoreId,
} from "../../src/aoi/index.ts";

/** 第 1~5 轮里，每门学科的科学奖励出现了几次 */
function disciplineCounts(rounds: RoundScoreId[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const id of rounds.slice(0, 5)) {
        const d = ROUND_SCORE_TILES[id].science.discipline;
        counts[d] = (counts[d] ?? 0) + 1;
    }
    return counts;
}

describe("回合计分板块的数据", () => {
    it("12 块，编号和 id 一致", () => {
        expect(ROUND_SCORE_IDS).toHaveLength(12);
        for (const id of ROUND_SCORE_IDS) expect(ROUND_SCORE_TILES[id].id).toBe(id);
    });
    it("每门学科的科学奖励正好 3 块", () => {
        for (const d of DISCIPLINES) {
            expect(ROUND_SCORE_IDS.filter((id) => ROUND_SCORE_TILES[id].science.discipline === d)).toHaveLength(3);
        }
    });
    it("核对几块：建学校 4 分、银行每 1 级 1 金币；拿城市板块 5 分、工程每 4 级 1 铲", () => {
        expect(ROUND_SCORE_TILES.schoolBanking).toEqual({
            id: "schoolBanking", action: "school", vp: 4,
            science: { discipline: "banking", per: 1, reward: { coins: 1 } },
        });
        expect(ROUND_SCORE_TILES.cityEngineering.science).toEqual({ discipline: "engineering", per: 4, reward: { spades: 1 } });
    });
});

describe("开局摆回合计分板块", () => {
    it("没有限制要遵守时：洗好的前 6 块从第 6 轮往下摆", () => {
        const shuffled: RoundScoreId[] = [
            "workshopLaw", "workshopBanking", "guildMedicine", "trackEngineering", "schoolBanking", "levelMedicine",
            "guildLaw", "bigMedicine", "bigBanking", "spadeEngineering", "cityEngineering", "innovationLaw",
        ];
        expect(pickRoundScores(shuffled)).toEqual([
            "levelMedicine", "schoolBanking", "trackEngineering", "guildMedicine", "workshopBanking", "workshopLaw",
        ]);
    });
    it("铲子那块先翻出来：跳过第 6、5 轮，放在第 4 轮", () => {
        const shuffled: RoundScoreId[] = [
            "spadeEngineering", "workshopLaw", "workshopBanking", "guildMedicine", "trackEngineering", "schoolBanking",
            "levelMedicine", "guildLaw", "bigMedicine", "bigBanking", "cityEngineering", "innovationLaw",
        ];
        const rounds = pickRoundScores(shuffled);
        expect(rounds[5]).toBe("workshopLaw");
        expect(rounds[4]).toBe("workshopBanking");
        expect(rounds[3]).toBe("spadeEngineering");
    });
    it("第 1~5 轮已经有 2 块法律：第 3 块法律跳过，换下一块", () => {
        const shuffled: RoundScoreId[] = [
            "workshopBanking", "workshopLaw", "guildLaw", "innovationLaw", "guildMedicine", "trackEngineering",
            "schoolBanking", "levelMedicine", "bigMedicine", "bigBanking", "spadeEngineering", "cityEngineering",
        ];
        expect(pickRoundScores(shuffled)).toEqual([
            "schoolBanking", "trackEngineering", "guildMedicine", "guildLaw", "workshopLaw", "workshopBanking",
        ]);
    });
    it("第 6 轮的科学奖励被盖住，不算：3 块法律可以都上场", () => {
        const shuffled: RoundScoreId[] = [
            "workshopLaw", "guildLaw", "innovationLaw", "workshopBanking", "guildMedicine", "trackEngineering",
            "schoolBanking", "levelMedicine", "bigMedicine", "bigBanking", "spadeEngineering", "cityEngineering",
        ];
        expect(pickRoundScores(shuffled)).toEqual([
            "trackEngineering", "guildMedicine", "workshopBanking", "innovationLaw", "guildLaw", "workshopLaw",
        ]);
    });
    it("随便开 200 局：铲子那块不在第 5、6 轮；第 1~5 轮同一门学科最多 2 块；6 块都不一样", () => {
        for (let i = 0; i < 200; i++) {
            const game = createGame({ playerCount: 3, mapId: "aoi-base", setupMode: { kind: "sets" } }, `rs-${i}`);
            const rounds = game.board.roundScores;
            expect(new Set(rounds).size).toBe(6);
            expect(rounds.slice(4)).not.toContain("spadeEngineering");
            for (const n of Object.values(disciplineCounts(rounds))) expect(n).toBeLessThanOrEqual(2);
        }
    });
});

describe("开局的城市板块", () => {
    it("7 种，每种 3 张", () => {
        const game = createGame({ playerCount: 4, mapId: "aoi-base", setupMode: { kind: "sets" } }, "city");
        expect(Object.keys(game.board.cityTilesLeft).sort()).toEqual([...CITY_TILE_IDS].sort());
        for (const id of CITY_TILE_IDS) expect(game.board.cityTilesLeft[id]).toBe(3);
    });
});