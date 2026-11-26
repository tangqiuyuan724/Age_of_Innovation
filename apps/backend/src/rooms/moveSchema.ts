// 客户端发来的指令先过这一关：只检查"形状"对不对——该有的字段都在、类型对、编号是认识的。
// 合不合规则（轮没轮到你、资源够不够）是引擎 validateMove 的事。
//
// 为什么还要这一关：validateMove 相信传进来的一定是 Move。可客户端发来的可能是任何东西
// （少了字段、数字写成字符串、编号拼错），引擎读到 undefined 会算出奇怪的结果，甚至抛错。
// 先用 zod 把形状不对的挡在外面，引擎就只会看到真正的 Move。
import z from "zod";
import {
    BONUS_TILE_IDS, BOOK_ACTION_IDS, CITY_TILE_IDS, COMPETENCY_IDS, CONVERSIONS, DISCIPLINES, FACTION_IDS,
    POWER_ACTION_COST, TERRAIN_WHEEL, UPGRADE_FROM,
    type ConversionId, type Move, type PowerActionId,
} from "@aoi/engine/aoi";

const CONVERSION_IDS = Object.keys(CONVERSIONS) as ConversionId[];
const POWER_ACTION_IDS = Object.keys(POWER_ACTION_COST) as PowerActionId[];
const UPGRADE_TO = Object.keys(UPGRADE_FROM) as (keyof typeof UPGRADE_FROM)[];

const Discipline = z.enum(DISCIPLINES);
/** 格子编号：一个大写字母 + 1~2 位数字，比如 "E7"、"C12" */
const HexId = z.string().regex(/^[A-Z][1-9][0-9]?$/);
/** 做几次（转换、牺牲能量） */
const Times = z.number().int().min(1).max(100);
/** 付书 / 选书：每种颜色几本 */
const Books = z.partialRecord(Discipline, z.number().int().min(0).max(100));

const DraftItem = z.discriminatedUnion("category", [
    z.object({ category: z.literal("planning"), id: z.enum(TERRAIN_WHEEL) }),
    z.object({ category: z.literal("faction"), id: z.enum(FACTION_IDS) }),
    z.object({ category: z.literal("bonusTile"), id: z.enum(BONUS_TILE_IDS) }),
    z.object({ category: z.literal("palaceTile"), id: z.number().int() }),
]);

/**
 * 回应决定的选择。同一种决定可能有两种写法（比如 spades 可以是"用在哪一格"或者"放弃"），
 * 所以用 z.union 一个个试，而不是按 kind 直接分
 */
const DecisionChoice = z.union([
    z.object({ kind: z.literal("pickSet"), set: z.number().int() }),
    z.object({ kind: z.literal("initialWorkshop"), hex: HexId }),
    z.object({ kind: z.literal("leech"), accept: z.boolean() }),
    z.object({ kind: z.literal("spades"), hex: HexId, build: z.boolean() }),
    z.object({ kind: z.literal("spades"), skip: z.literal(true) }),
    z.object({ kind: z.literal("bridge"), a: HexId, b: HexId }),
    z.object({ kind: z.literal("bridge"), skip: z.literal(true) }),
    z.object({ kind: z.literal("scienceLevels"), discipline: Discipline }),
    z.object({ kind: z.literal("scienceLevels"), skip: z.literal(true) }),
    z.object({ kind: z.literal("bookColor"), books: Books }),
    z.object({ kind: z.literal("draftPick"), item: DraftItem }),
    z.object({ kind: z.literal("competency"), tile: z.enum(COMPETENCY_IDS) }),
    z.object({ kind: z.literal("palaceTile"), tile: z.number().int() }),
    z.object({ kind: z.literal("cityTile"), tile: z.enum(CITY_TILE_IDS) }),
]);

/** 一条指令。按 t 分成 13 种，和接口里的 Move 一一对应 */
export const MoveSchema = z.discriminatedUnion("t", [
    z.object({ t: z.literal("convert"), conversion: z.enum(CONVERSION_IDS), times: Times, color: Discipline.optional() }),
    z.object({ t: z.literal("sacrificePower"), times: Times }),
    z.object({ t: z.literal("terraformAndBuild"), hex: HexId, spades: z.number().int().min(0).max(7), build: z.boolean() }),
    z.object({ t: z.literal("upgrade"), hex: HexId, to: z.enum(UPGRADE_TO) }),
    z.object({ t: z.literal("advanceTrack"), track: z.enum(["sailing", "terraforming"]) }),
    z.object({ t: z.literal("sendScholar"), discipline: Discipline, space: z.union([z.number().int().min(0).max(3), z.literal("return")]) }),
    z.object({ t: z.literal("developInnovation"), tile: z.string().max(40), books: Books }),
    z.object({ t: z.literal("powerAction"), id: z.enum(POWER_ACTION_IDS) }),
    z.object({ t: z.literal("bookAction"), id: z.enum(BOOK_ACTION_IDS), books: Books, hex: HexId.optional() }),
    z.object({ t: z.literal("specialAction"), source: z.string().max(40) }),
    z.object({ t: z.literal("pass"), bonusTile: z.enum(BONUS_TILE_IDS).nullable() }),
    z.object({ t: z.literal("endTurn") }),
    z.object({ t: z.literal("decide"), id: z.string().max(80), choice: DecisionChoice }),
]);

// 下面两个函数不会被调用，只给类型检查看：
//  - 第一个说"通过 zod 检查的东西一定是 Move"
//  - 第二个说"每一种 Move 都能写成 zod 检查通过的样子"
// 两个方向都成立，说明这里写的和接口里的 Move 是同一个形状。
// 以后接口里的 Move 改了而这里没跟着改，npm run typecheck 会在这里报错。
type CheckedMove = z.infer<typeof MoveSchema>;
export function checkedIsMove(m: CheckedMove): Move {
    return m;
}
export function moveIsChecked(m: Move): CheckedMove {
    return m;
}