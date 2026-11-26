// 存档：每一局的开局设置、座位和每一步指令，存在一个 SQLite 文件里。
// 局面本身不存：要用的时候用引擎从头重放（replay.ts）。这就是计划书 2.1 节的"事件溯源"：
// 一局游戏 = 开局设置 + 随机种子 + 指令日志。本地试玩存在浏览器里的也是这几样。
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { CONTRACT_VERSION, type Move, type Seat, type SetupOptions } from "@aoi/engine/aoi";

/** 开局时坐在一个座位上的人。令牌只存在服务器上，凭它回到这个座位 */
export interface SavedSeat {
    seat: Seat;
    nickname: string;
    seatToken: string;
}

/** 存下来的一局 */
export interface SavedGame {
    code: string;
    options: SetupOptions;
    seed: string;
    seats: SavedSeat[];
    /** 开局时的接口版本。以后规则改了，靠它认出旧存档 */
    contractVersion: number;
    /** 从开局到现在的每一步，按顺序 */
    moves: { seat: Seat; move: Move }[];
}

export class GameStore {
    private db: DatabaseSync;

    /** file 是存档文件的路径；":memory:" 表示存在内存里（测试用，程序结束就没了） */
    constructor(file: string) {
        if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
        this.db = new DatabaseSync(file);
        // 两张表：games 一局一行；moves 一步一行，(code, seq) 不能重复
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS games (
                code TEXT PRIMARY KEY,
                options TEXT NOT NULL,
                seed TEXT NOT NULL,
                seats TEXT NOT NULL,
                contract_version INTEGER NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS moves (
                code TEXT NOT NULL REFERENCES games (code),
                seq INTEGER NOT NULL,
                seat INTEGER NOT NULL,
                move TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                PRIMARY KEY (code, seq)
            );
        `);
    }

    /** 开局时记下这一局 */
    createGame(code: string, options: SetupOptions, seed: string, seats: SavedSeat[]): void {
        this.db
            .prepare("INSERT INTO games (code, options, seed, seats, contract_version) VALUES (?, ?, ?, ?, ?)")
            .run(code, JSON.stringify(options), seed, JSON.stringify(seats), CONTRACT_VERSION);
    }

    /**
     * 记下一步。seq 是执行完这一步以后的版本号：第 1 步是 1，第 2 步是 2……
     * 同一局同一个 seq 只能写一次，写第二次会抛错
     */
    appendMove(code: string, seq: number, seat: Seat, move: Move): void {
        this.db
            .prepare("INSERT INTO moves (code, seq, seat, move) VALUES (?, ?, ?, ?)")
            .run(code, seq, seat, JSON.stringify(move));
    }

    /** 这个房间码有没有存档 */
    has(code: string): boolean {
        return this.db.prepare("SELECT 1 FROM games WHERE code = ?").get(code) !== undefined;
    }

    /** 读出一局；没有存档是 null */
    load(code: string): SavedGame | null {
        const row = this.db
            .prepare("SELECT options, seed, seats, contract_version FROM games WHERE code = ?")
            .get(code) as { options: string; seed: string; seats: string; contract_version: number } | undefined;
        if (row === undefined) return null;
        const moves = this.db
            .prepare("SELECT seat, move FROM moves WHERE code = ? ORDER BY seq")
            .all(code) as { seat: number; move: string }[];
        return {
            code,
            options: JSON.parse(row.options),
            seed: row.seed,
            seats: JSON.parse(row.seats),
            contractVersion: row.contract_version,
            moves: moves.map((m) => ({ seat: m.seat, move: JSON.parse(m.move) })),
        };
    }
}

/**
 * 服务器用的存档：apps/backend/data/aoi.sqlite（data 文件夹不提交）。
 * 跑测试的时候（vitest 会设 VITEST 这个环境变量）存在内存里，不碰真的存档
 */
const SAVE_FILE = fileURLToPath(new URL("../../data/aoi.sqlite", import.meta.url));
export const store = new GameStore(process.env.VITEST ? ":memory:" : SAVE_FILE);