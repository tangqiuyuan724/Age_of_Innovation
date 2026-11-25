// 指令的统一入口：服务端收到一条指令，先 validateMove，通过了再 applyMove。
// 资源转换、牺牲能量这两种自由行动很短，也直接写在这里。
import { applyTerraformAndBuild, validateTerraformAndBuild } from "./build.js";
import { DISCIPLINES } from "./constants.js";
import { convert } from "./convert.js";
import { applyDecide, validateDecide } from "./decide.js";
import { applyEndTurn, validateEndTurn } from "./endturn.js";
import { sacrificePower } from "./power.js";
import { advance, checkFreeAction, type Applied } from "./turn.js";
import { applyUpgrade, validateUpgrade } from "./upgrade.js";
import type { GameState, Move, RuleError, Seat } from "./types.js";

/** 这条指令现在能不能执行？能返回 null，不能返回原因 */
export function validateMove(state: GameState, seat: Seat, move: Move): RuleError | null {
    switch (move.t) {
        case "convert": return validateConvert(state, seat, move);
        case "sacrificePower": return validateSacrifice(state, seat, move.times);
        case "terraformAndBuild": return validateTerraformAndBuild(state, seat, move.hex, move.spades, move.build);
        case "upgrade": return validateUpgrade(state, seat, move.hex, move.to);
        case "endTurn": return validateEndTurn(state, seat);
        case "decide": return validateDecide(state, seat, move.id, move.choice);
        // 下面几种主行动在 M1-5 实现
        case "advanceTrack":
        case "sendScholar":
        case "developInnovation":
        case "powerAction":
        case "bookAction":
        case "specialAction":
        case "pass":
            return "bad-move";
        default: {
            const unhandled: never = move;
            return unhandled;
        }
    }
}

/**
 * 执行指令。调用前必须先用 validateMove 检查。
 * 执行完以后自动推进（比如开局的决策都处理完了，就开始第 1 轮），再把 version 加 1
 */
export function applyMove(state: GameState, seat: Seat, move: Move): Applied {
    const result = dispatch(state, seat, move);
    return { state: { ...advance(result.state), version: state.version + 1 }, events: result.events };
}

function dispatch(state: GameState, seat: Seat, move: Move): Applied {
    switch (move.t) {
        case "convert": return applyConvert(state, seat, move);
        case "sacrificePower": return applySacrifice(state, seat, move.times);
        case "terraformAndBuild": return applyTerraformAndBuild(state, seat, move.hex, move.spades, move.build);
        case "upgrade": return applyUpgrade(state, seat, move.hex, move.to);
        case "endTurn": return applyEndTurn(state, seat);
        case "decide": return applyDecide(state, seat, move.choice);
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