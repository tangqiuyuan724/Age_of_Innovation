// 指令的统一入口：服务端收到一条指令，先 validateMove，通过了再 applyMove。
// 资源转换、牺牲能量这两种自由行动很短，也直接写在这里。
import { applyBookAction, validateBookAction } from "./bookActions.js";
import { applyTerraformAndBuild, validateTerraformAndBuild } from "./build.js";
import { updateCities } from "./city.js";
import { DISCIPLINES } from "./constants.js";
import { convert } from "./convert.js";
import { applyDecide, validateDecide } from "./decide.js";
import { applyEndTurn, validateEndTurn } from "./endturn.js";
import { applyPass, validatePass } from "./pass.js";
import { sacrificePower } from "./power.js";
import { applyPowerAction, validatePowerAction } from "./powerActions.js";
import { autoAdvance } from "./round.js";
import { actionPoints } from "./roundScore.js";
import { applySendScholar, validateSendScholar } from "./scholar.js";
import { applySpecialAction, validateSpecialAction } from "./specialActions.js";
import { applyAdvanceTrack, validateAdvanceTrack } from "./tracks.js";
import { checkFreeAction, type Applied } from "./turn.js";
import { applyUpgrade, validateUpgrade } from "./upgrade.js";
import type { GameEvent, GameState, Move, RuleError, Seat } from "./types.js";

/** 这条指令现在能不能执行？能返回 null，不能返回原因 */
export function validateMove(state: GameState, seat: Seat, move: Move): RuleError | null {
    switch (move.t) {
        case "convert": return validateConvert(state, seat, move);
        case "sacrificePower": return validateSacrifice(state, seat, move.times);
        case "terraformAndBuild": return validateTerraformAndBuild(state, seat, move.hex, move.spades, move.build);
        case "upgrade": return validateUpgrade(state, seat, move.hex, move.to);
        case "endTurn": return validateEndTurn(state, seat);
        case "decide": return validateDecide(state, seat, move.id, move.choice);
        case "sendScholar": return validateSendScholar(state, seat, move.discipline, move.space);
        case "advanceTrack": return validateAdvanceTrack(state, seat, move.track);
        case "powerAction": return validatePowerAction(state, seat, move.id);
        case "bookAction": return validateBookAction(state, seat, move.id, move.books, move.hex);
        case "specialAction": return validateSpecialAction(state, seat, move.source);
        case "pass": return validatePass(state, seat, move.bonusTile);
        // 研发创新板块在 M3 实现
        case "developInnovation":
            return "bad-move";
        default: {
            const unhandled: never = move;
            return unhandled;
        }
    }
}

/**
 * 执行指令。调用前必须先用 validateMove 检查。执行完以后：
 *  1. 建了建筑、升级了建筑、建了桥的人，整理城市（可能组成新城市）
 *  2. 按这一步发生的事件加行动分（回合计分板块、回合奖励板块）
 *  3. 自动推进（开始第 1 轮、一轮结束、进入下一轮……）
 * 最后把 version 加 1
 */
export function applyMove(state: GameState, seat: Seat, move: Move): Applied {
    const result = dispatch(state, seat, move);
    const cities = settleCities(result.state, result.events);
    const points = actionPoints(cities.state, [...result.events, ...cities.events]);
    const next = autoAdvance(points.state);
    return {
        state: { ...next.state, version: state.version + 1 },
        events: [...result.events, ...cities.events, ...points.events, ...next.events],
    };
}

/** 这一步建了建筑、升级了建筑或者建了桥的人，整理他们的城市 */
function settleCities(state: GameState, events: GameEvent[]): Applied {
    const seats = new Set<Seat>();
    for (const e of events) {
        if (e.type === "built" || e.type === "upgraded" || e.type === "bridgeBuilt") seats.add(e.seat);
    }
    let next = state;
    const founded: GameEvent[] = [];
    for (const seat of seats) {
        const result = updateCities(next, seat);
        next = result.state;
        founded.push(...result.events);
    }
    return { state: next, events: founded };
}

function dispatch(state: GameState, seat: Seat, move: Move): Applied {
    switch (move.t) {
        case "convert": return applyConvert(state, seat, move);
        case "sacrificePower": return applySacrifice(state, seat, move.times);
        case "terraformAndBuild": return applyTerraformAndBuild(state, seat, move.hex, move.spades, move.build);
        case "upgrade": return applyUpgrade(state, seat, move.hex, move.to);
        case "endTurn": return applyEndTurn(state, seat);
        case "decide": return applyDecide(state, seat, move.choice);
        case "sendScholar": return applySendScholar(state, seat, move.discipline, move.space);
        case "advanceTrack": return applyAdvanceTrack(state, seat, move.track);
        case "powerAction": return applyPowerAction(state, seat, move.id);
        case "bookAction": return applyBookAction(state, seat, move.id, move.books, move.hex);
        case "specialAction": return applySpecialAction(state, seat, move.source);
        case "pass": return applyPass(state, seat, move.bonusTile);
        default:
            throw new Error(`还没实现的指令：${move.t}`);
    }
}

// ---------- 自由行动：资源转换、牺牲能量 ----------

type ConvertMove = Extract<Move, { t: "convert" }>;

function validateConvert(state: GameState, seat: Seat, move: ConvertMove): RuleError | null {
    const error = checkFreeAction(state, seat);
    if (error !== null) return error;
    if (!Number.isInteger(move.times) || move.times < 1) return "bad-move";
    const needsColor = move.conversion === "power5ToBook" || move.conversion === "bookToCoin";
    if (needsColor && (move.color === undefined || !DISCIPLINES.includes(move.color))) return "bad-move";
    if (convert(state.players[seat], move.conversion, move.times, move.color) === null) return "insufficient-resources";
    return null;
}

function applyConvert(state: GameState, seat: Seat, move: ConvertMove): Applied {
    const player = convert(state.players[seat], move.conversion, move.times, move.color)!;
    return {
        state: { ...state, players: state.players.map((p) => (p.seat === seat ? player : p)) },
        events: [],
    };
}

function validateSacrifice(state: GameState, seat: Seat, times: number): RuleError | null {
    const error = checkFreeAction(state, seat);
    if (error !== null) return error;
    if (!Number.isInteger(times) || times < 1) return "bad-move";
    if (sacrificePower(state.players[seat].power, times) === null) return "insufficient-power";
    return null;
}

function applySacrifice(state: GameState, seat: Seat, times: number): Applied {
    const players = state.players.map((p) =>
        p.seat === seat ? { ...p, power: sacrificePower(p.power, times)! } : p,
    );
    return { state: { ...state, players }, events: [] };
}