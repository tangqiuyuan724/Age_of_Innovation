// "现在能做什么"：把可能的指令一条条列出来，交给引擎的 validateMove 判断行不行。
// 前端自己不写任何规则：费用用引擎的函数算，能不能做由 validateMove 说了算。
// 引擎还没实现的指令，validateMove 会返回 "bad-move"，界面上就显示"引擎还没实现"。
import {
    BUILD_WORKSHOP_COST, DISCIPLINES, SCHOLAR_SPACE_LEVELS, UPGRADE_FROM,
    addBundles, spadeCost, terrainDistance, terraformToward, upgradeCost, validateMove,
    type Discipline, type GameState, type HexId, type MapGeometry, type Move, type ResourceBundle, type RuleError,
    type Seat, type Terrain,
} from "@aoi/engine/aoi";
import { STRUCTURE_NAME, TERRAIN_NAME, reasonText } from "./labels.ts";
import { reachableEmpty } from "./mapView.ts";

/** 现在该谁操作：队列里有待决策就是第一个决策的人，否则是当前回合的人；都没有返回 null */
export function actingSeat(state: GameState): Seat | null {
    if (state.pending.length > 0) return state.pending[0].seat;
    return state.turn?.seat ?? null;
}

/** 一个可以点的选项：按钮上的字、对应的指令、要付什么，以及引擎说能不能做 */
export interface Choice {
    label: string;
    move: Move;
    cost: ResourceBundle;
    /** null 表示可以做；否则是引擎给的原因 */
    error: RuleError | null;
}

function choice(state: GameState, seat: Seat, label: string, move: Move, cost: ResourceBundle = {}): Choice {
    return { label, move, cost, error: validateMove(state, seat, move) };
}

/** 能升级成的建筑：UPGRADE_FROM 的键 */
const UPGRADE_TARGETS = Object.keys(UPGRADE_FROM) as (keyof typeof UPGRADE_FROM)[];

/**
 * 点了地图上的一个格子以后，seat 在这里能做的事：
 *  - 待决策是"放初始工坊""用免费铲子"时：在这一格回应决策
 *  - 自己的回合：空地可以改造（改几铲都行）、改完可以建工坊；自己的建筑可以升级
 */
export function hexChoices(state: GameState, seat: Seat, hex: HexId): Choice[] {
    const h = state.hexes[hex];
    const p = state.players[seat];
    if (h === undefined || p === undefined) return [];

    const d = state.pending[0];
    if (d !== undefined) {
        if (d.seat !== seat) return [];
        if (d.kind === "initialWorkshop") {
            return [choice(state, seat, "在这里放初始工坊", { t: "decide", id: d.id, choice: { kind: "initialWorkshop", hex } })];
        }
        if (d.kind === "spades") {
            const result = [choice(state, seat, `用免费铲子改造这里（最多 ${d.spades} 铲）`,
                { t: "decide", id: d.id, choice: { kind: "spades", hex, build: false } })];
            if (d.canBuild) {
                result.push(choice(state, seat, "用免费铲子改造并建工坊",
                    { t: "decide", id: d.id, choice: { kind: "spades", hex, build: true } }));
            }
            return result;
        }
        return [];
    }
    if (state.turn?.seat !== seat) return [];

    if (h.structure === null) {
        const distance = terrainDistance(h.terrain, p.homeTerrain);
        const result: Choice[] = [];
        for (let spades = 1; spades <= distance; spades++) {
            const after = terraformToward(h.terrain, p.homeTerrain, spades);
            result.push(choice(state, seat, `改造 ${spades} 铲，变成${TERRAIN_NAME[after]}`,
                { t: "terraformAndBuild", hex, spades, build: false }, spadeCost(p, spades)));
        }
        result.push(choice(state, seat, distance === 0 ? "建工坊" : `改造 ${distance} 铲并建工坊`,
            { t: "terraformAndBuild", hex, spades: distance, build: true },
            addBundles(spadeCost(p, distance), BUILD_WORKSHOP_COST)));
        return result;
    }
    if (h.structure.owner === seat && !h.structure.neutral) {
        const from = h.structure.type;
        return UPGRADE_TARGETS
            .filter((to) => UPGRADE_FROM[to] === from)
            .map((to) => choice(state, seat, `升级成${STRUCTURE_NAME[to]}`, { t: "upgrade", hex, to },
                upgradeCost(state, seat, hex, to)));
    }
    return [];
}

/** 待决策是"放初始工坊""用免费铲子"时，地图上哪些格子可以点 */
export function decisionTargets(state: GameState, geo: MapGeometry, seat: Seat): Set<HexId> {
    const d = state.pending[0];
    const targets = new Set<HexId>();
    if (d === undefined || d.seat !== seat || (d.kind !== "initialWorkshop" && d.kind !== "spades")) return targets;
    for (const h of geo.hexes) {
        if (h.river) continue;
        if (hexChoices(state, seat, h.id).some((c) => c.error === null)) targets.add(h.id);
    }
    return targets;
}

/** 一门学科能派学者的选项：放到 4 个学者格里的某一格（格子被占了引擎会说 space-occupied），或者退回供应区 */
export function scholarChoices(state: GameState, seat: Seat, d: Discipline): Choice[] {
    const result = SCHOLAR_SPACE_LEVELS.map((levels, space) =>
        choice(state, seat, `第 ${space + 1} 格 +${levels} 级`, { t: "sendScholar", discipline: d, space }));
    result.push(choice(state, seat, "退回 +1 级", { t: "sendScholar", discipline: d, space: "return" }));
    return result;
}

/**
 * 假装现在轮到 seat，而且 TA 还没做主行动、也没有人在等决定。
 * 用来回答"TA 现在能做什么"：对这个假想的局面调用 validateMove，引擎就会按 TA 手上的资源判断。
 * 开局还没选完（玩家还不存在）时返回 null
 */
export function asIfActive(state: GameState, seat: Seat): GameState | null {
    if (state.players[seat] === undefined || state.phase === "ended") return null;
    return { ...state, phase: "actions", pending: [], turn: { seat, mainActionDone: false, builtHexes: [] } };
}

/** "TA 现在能做什么"里的一行 */
export interface SummaryLine {
    label: string;
    /** 能做时写数量或者说明；不能做时写原因 */
    detail: string;
    ok: boolean;
}

/**
 * 一位玩家现在能做的主行动，一类一行。
 * state 应该是"轮到 TA、还没做主行动"的局面（用 asIfActive 得到）
 */
export function actionSummary(state: GameState, geo: MapGeometry, seat: Seat): SummaryLine[] {
    const lines: SummaryLine[] = [];
    const p = state.players[seat];

    // 改造并建造：只检查够得着的空地，每格看"改到底并建工坊"和"只改 1 铲"两种
    let buildable = 0;
    let terraformOnly = 0;
    for (const r of reachableEmpty(geo, state, seat)) {
        const build = validateMove(state, seat, { t: "terraformAndBuild", hex: r.id, spades: r.spades, build: true });
        if (build === null) { buildable++; continue; }
        if (r.spades > 0 && validateMove(state, seat, { t: "terraformAndBuild", hex: r.id, spades: 1, build: false }) === null) {
            terraformOnly++;
        }
    }
    lines.push({
        label: "改造并建造",
        ok: buildable + terraformOnly > 0,
        detail: buildable + terraformOnly === 0
            ? "资源不够，或者够得着的空地都改不了"
            : `能建工坊的格子 ${buildable} 个${terraformOnly > 0 ? `，只能改造的 ${terraformOnly} 个` : ""}`,
    });

    // 升级：数一数每种目标各有几座能升
    const upgrades = new Map<string, number>();
    for (const [hex, h] of Object.entries(state.hexes)) {
        if (h.structure?.owner !== seat) continue;
        for (const to of UPGRADE_TARGETS) {
            if (validateMove(state, seat, { t: "upgrade", hex, to }) === null) {
                upgrades.set(STRUCTURE_NAME[to], (upgrades.get(STRUCTURE_NAME[to]) ?? 0) + 1);
            }
        }
    }
    lines.push({
        label: "升级建筑",
        ok: upgrades.size > 0,
        detail: upgrades.size === 0 ? "现在没有能升级的" : [...upgrades].map(([to, n]) => `升${to} ${n} 处`).join("，"),
    });

    for (const track of ["sailing", "terraforming"] as const) {
        const error = validateMove(state, seat, { t: "advanceTrack", track });
        lines.push({
            label: track === "sailing" ? "推进航行轨" : "推进改造轨",
            ok: error === null,
            detail: error === null ? `现在 ${p[track]} 级` : reasonText(error),
        });
    }

    const scholar = DISCIPLINES.flatMap((d) => scholarChoices(state, seat, d));
    const scholarOk = scholar.filter((c) => c.error === null);
    lines.push({
        label: "派学者",
        ok: scholarOk.length > 0,
        detail: scholarOk.length > 0
            ? `手上 ${p.scholars} 个学者`
            : reasonText(scholar[scholar.length - 1].error!),
    });

    // 能量行动、书本行动、pass 在引擎 M1-6 才实现。拿"能量行动：7 金币"问一下引擎，还没实现就说一声
    if (validateMove(state, seat, { t: "powerAction", id: "coins7" }) === "bad-move") {
        lines.push({ label: "其他行动", ok: false, detail: "能量行动、书本行动、pass：引擎还没实现（M1-6）" });
    }
    return lines;
}

/** 改造的预览：从现在的地形开始，每多一铲变成什么，直到变成家园地形 */
export function terraformSteps(from: Terrain, home: Terrain): Terrain[] {
    const steps = [from];
    for (let s = 1; s <= terrainDistance(from, home); s++) steps.push(terraformToward(from, home, s));
    return steps;
}
