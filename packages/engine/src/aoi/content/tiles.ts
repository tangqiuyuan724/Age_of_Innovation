// 其他开局要随机摆放的板块。这一课只用到编号；效果在用到它们的那一课再补。
import type { BookActionId, FinalRoundScoreId, RoundScoreId } from "../types.js";

export const BOOK_ACTION_IDS: readonly BookActionId[] = [
    "power5", "levels2", "coins6", "freeGuild", "guildVp", "spade3",
];

/** 12 个回合计分板块。编号是临时的，M1-5 做回合计分时换成正式内容 */
export const ROUND_SCORE_IDS: readonly RoundScoreId[] = Array.from({ length: 12 }, (_, i) => `rs-${i + 1}`);
/** 4 个终局回合计分板块（同上，临时编号） */
export const FINAL_ROUND_SCORE_IDS: readonly FinalRoundScoreId[] = ["frs-1", "frs-2", "frs-3", "frs-4"];