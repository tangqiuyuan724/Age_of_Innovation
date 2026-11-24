import { gainResources, payResources, scaleBundle } from "./resources.js";
import type { ConversionId, Discipline, PlayerState, ResourceBundle } from "./types.js";

/** 每种转换做一次：付出什么、得到什么。灰色的书在转换时换成玩家指定的颜色 */
export const CONVERSIONS: Record<ConversionId, { cost: ResourceBundle; gain: ResourceBundle }> = {
    power5ToScholar: { cost: { power: 5 }, gain: { scholars: 1 } },
    power5ToBook: { cost: { power: 5 }, gain: { books: { gray: 1 } } },
    power3ToTool: { cost: { power: 3 }, gain: { tools: 1 } },
    power1ToCoin: { cost: { power: 1 }, gain: { coins: 1 } },
    scholarToTool: { cost: { scholars: 1 }, gain: { tools: 1 } },
    toolToCoin: { cost: { tools: 1 }, gain: { coins: 1 } },
    bookToCoin: { cost: { books: { gray: 1 } }, gain: { coins: 1 } },
};

/** 把灰色的书换成指定颜色 */
function paintBooks(b: ResourceBundle, color: Discipline): ResourceBundle {
    if (!b.books?.gray) return b;
    return { ...b, books: { [color]: b.books.gray } };
}

/**
 * 资源转换做 times 次。做不了时返回 null：
 * 次数不是正整数、需要颜色却没给、资源不够、学者供应区不够。
 */
export function convert(
    p: PlayerState,
    conversion: ConversionId,
    times: number,
    color?: Discipline,
): PlayerState | null {
    if (!Number.isInteger(times) || times < 1) return null;
    const needsColor = conversion === "power5ToBook" || conversion === "bookToCoin";
    if (needsColor && color === undefined) return null;
    if (conversion === "power5ToScholar" && p.scholarsInSupply < times) return null;

    let { cost, gain } = CONVERSIONS[conversion];
    if (color !== undefined) {
        cost = paintBooks(cost, color);
        gain = paintBooks(gain, color);
    }
    const paid = payResources(p, scaleBundle(cost, times));
    if (paid === null) return null;
    return gainResources(paid, scaleBundle(gain, times)).player;
}