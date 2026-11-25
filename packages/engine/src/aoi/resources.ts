import { gainPower, spendPower } from "./power.js";
import type { BookColor, PlayerState, ResourceBundle } from "./types.js";

/** 书以外的 6 种数量 */
const AMOUNT_KEYS = ["coins", "tools", "scholars", "vp", "power", "spades"] as const;

/** 两组资源相加。书按颜色分别相加；结果里不保留 0 */
export function addBundles(a: ResourceBundle, b: ResourceBundle): ResourceBundle {
    const result: ResourceBundle = {};
    for (const key of AMOUNT_KEYS) {
        const n = (a[key] ?? 0) + (b[key] ?? 0);
        if (n !== 0) result[key] = n;
    }
    const books: Partial<Record<BookColor, number>> = {};
    for (const source of [a.books ?? {}, b.books ?? {}]) {
        for (const [color, n] of Object.entries(source) as [BookColor, number][]) {
            books[color] = (books[color] ?? 0) + n;
        }
    }
    if (Object.keys(books).length > 0) result.books = books;
    return result;
}

/** 每一项都乘以 times，例如"转换 3 次" */
export function scaleBundle(b: ResourceBundle, times: number): ResourceBundle {
    let result: ResourceBundle = {};
    for (let i = 0; i < times; i++) result = addBundles(result, b);
    return result;
}

/**
 * 获得一组资源。
 * - 学者从个人供应区拿，供应区不够就能拿几个拿几个
 * - 能量按能量碗的规则流动
 * - 灰色的书（任选颜色）不直接加，算进 bookChoices，由调用的人生成 bookColor 决策
 */
export function gainResources(
    p: PlayerState,
    bundle: ResourceBundle,
): { player: PlayerState; bookChoices: number } {
    if (bundle.spades) throw new Error("铲子不能存起来，要用 spades 决策处理");
    const scholars = Math.min(bundle.scholars ?? 0, p.scholarsInSupply);
    const books = { ...p.books };
    let bookChoices = 0;
    for (const [color, n] of Object.entries(bundle.books ?? {}) as [BookColor, number][]) {
        if (color === "gray") bookChoices += n;
        else books[color] += n;
    }
    return {
        player: {
            ...p,
            coins: p.coins + (bundle.coins ?? 0),
            tools: p.tools + (bundle.tools ?? 0),
            vp: p.vp + (bundle.vp ?? 0),
            scholars: p.scholars + scholars,
            scholarsInSupply: p.scholarsInSupply - scholars,
            power: gainPower(p.power, bundle.power ?? 0).bowls,
            books,
        },
        bookChoices,
    };
}

/**
 * 支付一组资源，不够付时返回 null。
 * - 付出去的学者回到个人供应区
 * - 能量从碗 III 花
 * - 付书必须写清楚颜色，出现灰色说明调用的地方写错了
 */
export function payResources(p: PlayerState, bundle: ResourceBundle): PlayerState | null {
    if (bundle.spades) throw new Error("铲子不能用来付费");
    const coins = p.coins - (bundle.coins ?? 0);
    const tools = p.tools - (bundle.tools ?? 0);
    const vp = p.vp - (bundle.vp ?? 0);
    const scholars = p.scholars - (bundle.scholars ?? 0);
    if (coins < 0 || tools < 0 || vp < 0 || scholars < 0) return null;

    const power = spendPower(p.power, bundle.power ?? 0);
    if (power === null) return null;

    const books = { ...p.books };
    for (const [color, n] of Object.entries(bundle.books ?? {}) as [BookColor, number][]) {
        if (color === "gray") throw new Error("付书时要写清楚颜色");
        books[color] -= n;
        if (books[color] < 0) return null;
    }

    return {
        ...p,
        coins, tools, vp, scholars, power, books,
        scholarsInSupply: p.scholarsInSupply + (bundle.scholars ?? 0),
    };
}

/** 每一项取相反数。费用写进事件时用负数，表示"少了这么多" */
export function negateBundle(b: ResourceBundle): ResourceBundle {
    const result: ResourceBundle = {};
    for (const key of AMOUNT_KEYS) {
        const n = b[key];
        if (n) result[key] = -n;
    }
    if (b.books !== undefined) {
        const books: Partial<Record<BookColor, number>> = {};
        for (const [color, n] of Object.entries(b.books) as [BookColor, number][]) books[color] = -n;
        result.books = books;
    }
    return result;
}