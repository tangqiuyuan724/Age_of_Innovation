// 把引擎里的数据写成一句中文：资源、待决策、指令、事件。
// labels.ts 放"一个 id 对应一个名字"的表，这里放"拼句子"的函数。
import {
    DISCIPLINES,
    type BonusTileId, type BookColor, type Decision, type DraftItem, type GameEvent, type HexId, type Move, type ResourceBundle, type Seat,
} from "@aoi/engine/aoi";
import {
    BONUS_TILE_LABEL, BOOK_ACTION_LABEL, BOOK_NAME, COMPETENCY_LABEL, CONVERSION_LABEL, DISCIPLINE_NAME,
    DRAFT_CATEGORY_NAME, PHASE_NAME, POWER_ACTION_LABEL, STRUCTURE_NAME, TERRAIN_NAME, factionName,
} from "./labels.ts";

/** 把座位号换成名字、把引擎格子编号换成版图上印的编号 */
export interface Namer {
    name: (seat: Seat) => string;
    hex: (id: HexId) => string;
}

const BOOK_ORDER: BookColor[] = [...DISCIPLINES, "gray"];

/** 一组资源写成"2 金币、1 工具、3 能量"。负数写成"-2 金币"。空的资源写成"无" */
export function describeBundle(b: ResourceBundle): string {
    const parts: string[] = [];
    const add = (n: number | undefined, unit: string) => {
        if (n !== undefined && n !== 0) parts.push(`${n} ${unit}`);
    };
    add(b.coins, "金币");
    add(b.tools, "工具");
    add(b.scholars, "学者");
    add(b.vp, "分");
    add(b.power, "能量");
    add(b.spades, "铲");
    for (const color of BOOK_ORDER) {
        const n = b.books?.[color];
        if (n) parts.push(color === "gray" ? `${n} 本任选颜色的书` : `${n} 本${BOOK_NAME[color]}书`);
    }
    return parts.length === 0 ? "无" : parts.join("、");
}

/** 收益和付出一起写：正数前面加"+"，负数前面是"-" */
export function describeDelta(b: ResourceBundle): string {
    const text = describeBundle(b);
    return text.replace(/(^|、)(\d)/g, "$1+$2");
}

/** 资源事件的原因（引擎里的 reason 字段） */
const REASON: Record<string, string> = {
    build: "建造",
    terraform: "改造",
    upgrade: "升级",
    science: "学科升级拿能量",
    sendScholar: "派学者",
    advanceTrack: "推进轨道",
    trackReward: "轨道奖励",
    competency: "能力板块",
    income: "收入",
    bookColor: "选书",
    powerAction: "能量行动",
    bookAction: "书本行动",
    pass: "pass 奖励",
    bonusTile: "回合奖励板块上的金币",
};

/** 特殊行动的来源 "bonus:板块编号" 写成人看的名字；以后别的来源（M3）在这里加 */
function specialSourceName(source: string): string {
    const id = source.startsWith("bonus:") ? source.slice("bonus:".length) : "";
    return id in BONUS_TILE_LABEL ? `回合奖励板块「${BONUS_TILE_LABEL[id as BonusTileId].short}」` : source;
}

function draftItemName(item: DraftItem): string {
    switch (item.category) {
        case "planning": return `${TERRAIN_NAME[item.id]}规划板`;
        case "faction": return factionName(item.id);
        case "bonusTile": return `回合奖励板块「${BONUS_TILE_LABEL[item.id].short}」`;
        case "palaceTile": return `宫殿板块 #${item.id}`;
    }
}

/** 把一条待决策写成一句话 */
export function describeDecision(d: Decision, name: (seat: Seat) => string): string {
    switch (d.kind) {
        case "pickSet": return "选择开局组合（派系、规划板、回合奖励板块）";
        case "initialWorkshop": return "放置一个初始工坊";
        case "leech":
            return `${name(d.from)}在旁边建造：可以获得 ${d.power} 点能量，扣 ${d.vpCost} 分`;
        case "spades": return `使用 ${d.spades} 把免费铲子${d.canBuild ? "，可以顺带建工坊" : ""}`;
        case "bridge": return "选择桥的位置";
        case "scienceLevels": return `选择一门学科前进 ${d.levels} 级`;
        case "competency": return "选择一个能力板块";
        case "palaceTile": return "选择一个宫殿板块";
        case "cityTile": return "选择一个城市板块";
        case "bookColor": return `获得 ${d.count} 本书，选择颜色`;
        case "draftPick": return "轮抽：从规划板、派系、回合奖励板块、宫殿板块里拿一样";
        default: {
            // 穷尽检查：接口里新增了一种决策而这里没处理时，这一行会报类型错误
            const unhandled: never = d;
            return unhandled;
        }
    }
}

/** 把一条指令写成一句话（日志里用）。不含"谁"，调用的地方自己加 */
export function describeMove(m: Move, n: Namer): string {
    switch (m.t) {
        case "convert":
            return `转换 ${CONVERSION_LABEL[m.conversion]}${m.times > 1 ? ` ×${m.times}` : ""}${m.color ? `（${BOOK_NAME[m.color]}）` : ""}`;
        case "sacrificePower": return `牺牲能量 ×${m.times}`;
        case "terraformAndBuild":
            if (m.spades === 0) return `在 ${n.hex(m.hex)} 建工坊`;
            return `改造 ${n.hex(m.hex)}（${m.spades} 铲）${m.build ? "并建工坊" : ""}`;
        case "upgrade": return `把 ${n.hex(m.hex)} 升级成${STRUCTURE_NAME[m.to]}`;
        case "advanceTrack": return `推进${m.track === "sailing" ? "航行" : "改造"}轨`;
        case "sendScholar":
            return m.space === "return"
                ? `派学者：${DISCIPLINE_NAME[m.discipline]}，学者退回供应区`
                : `派学者：${DISCIPLINE_NAME[m.discipline]}第 ${m.space + 1} 格`;
        case "developInnovation": return `研发创新板块 ${m.tile}`;
        case "powerAction": return `能量行动：${POWER_ACTION_LABEL[m.id]}`;
        case "bookAction": {
            const guild = m.id !== "freeGuild" ? "" : m.hex ? `（${n.hex(m.hex)}）` : "（放弃升级）";
            return `书本行动：${BOOK_ACTION_LABEL[m.id]}${guild}，付 ${describeBundle({ books: m.books })}`;
        }
        case "specialAction": return `特殊行动：${specialSourceName(m.source)}`;
        case "pass": return m.bonusTile ? `pass，拿回合奖励板块「${BONUS_TILE_LABEL[m.bonusTile].short}」` : "pass（最后一轮）";
        case "endTurn": return "结束回合";
        case "decide": {
            const c = m.choice;
            switch (c.kind) {
                case "pickSet": return `选了第 ${c.set + 1} 组`;
                case "draftPick": return `轮抽拿了${DRAFT_CATEGORY_NAME[c.item.category]}：${draftItemName(c.item)}`;
                case "initialWorkshop": return `在 ${n.hex(c.hex)} 放初始工坊`;
                case "leech": return c.accept ? "接受吸能" : "不要这次吸能";
                case "spades": return "skip" in c ? "不用免费铲子" : `用免费铲子改造 ${n.hex(c.hex)}${c.build ? "并建工坊" : ""}`;
                case "bridge": return "skip" in c ? "放弃建桥" : `在 ${n.hex(c.a)} 和 ${n.hex(c.b)} 之间建桥`;
                case "scienceLevels": return "skip" in c ? "放弃学科前进" : `选学科：${DISCIPLINE_NAME[c.discipline]}`;
                case "bookColor": return `选书：${describeBundle({ books: c.books })}`;
                case "competency": return `拿能力板块「${COMPETENCY_LABEL[c.tile].short}」`;
                case "palaceTile": return `拿宫殿板块 #${c.tile}`;
                case "cityTile": return `拿城市板块 ${c.tile}`;
            }
        }
    }
}

const TILE_KIND: Record<Extract<GameEvent, { type: "tileTaken" }>["kind"], string> = {
    palace: "宫殿板块", innovation: "创新板块", competency: "能力板块", city: "城市板块", bonus: "回合奖励板块",
};

/** 把一个事件写成一句话 */
export function describeEvent(e: GameEvent, n: Namer): string {
    switch (e.type) {
        case "phase": return `第 ${e.round} 轮：${PHASE_NAME[e.phase]}`;
        case "turn": return `轮到${n.name(e.seat)}`;
        case "resources": return `${n.name(e.seat)} ${describeDelta(e.delta)}（${REASON[e.reason] ?? e.reason}）`;
        case "terraformed": return `${n.hex(e.hex)}：${TERRAIN_NAME[e.from]} → ${TERRAIN_NAME[e.to]}`;
        case "built": return `${n.name(e.seat)}在 ${n.hex(e.hex)} 建了${STRUCTURE_NAME[e.structure]}`;
        case "upgraded": return `${n.hex(e.hex)}：${STRUCTURE_NAME[e.from]} → ${STRUCTURE_NAME[e.to]}`;
        case "bridgeBuilt": return `${n.name(e.seat)}在 ${n.hex(e.a)} 和 ${n.hex(e.b)} 之间建了桥`;
        case "leech":
            return e.accepted
                ? `${n.name(e.seat)}吸了 ${e.power} 能量${e.vpCost > 0 ? `，扣 ${e.vpCost} 分` : ""}`
                : `${n.name(e.seat)}没要这 ${e.power} 能量`;
        case "science": return `${n.name(e.seat)}的${DISCIPLINE_NAME[e.discipline]}：${e.from} → ${e.to} 级`;
        case "cityFounded": return `${n.name(e.seat)}组成了城市（${e.hexes.length} 个格子）`;
        case "tileTaken": {
            const tile = e.kind === "competency" && e.tile in COMPETENCY_LABEL
                ? `「${COMPETENCY_LABEL[e.tile as keyof typeof COMPETENCY_LABEL].short}」`
                : e.kind === "bonus" && e.tile in BONUS_TILE_LABEL
                    ? `「${BONUS_TILE_LABEL[e.tile as BonusTileId].short}」`
                    : e.tile;
            return `${n.name(e.seat)}拿了${TILE_KIND[e.kind]} ${tile}`;
        }
        case "passed": return `${n.name(e.seat)}结束本轮`;
        case "gameEnded": return "游戏结束";
    }
}
