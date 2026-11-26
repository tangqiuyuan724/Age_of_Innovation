import "./aoi.css";
import { useEffect, useRef, useState } from "react";
import { getLegalMoves, type Seat } from "@aoi/engine/aoi";
import { clearError, leaveRoom, sendMove, startGame, useOnline } from "../net.ts";
import { pickRandomMove } from "./autoPlay.ts";
import { actingSeat } from "./options.ts";
import { Table } from "./Table.tsx";

/**
 * 联机：进了房间以后的页面。
 *  - 还没开局：等人的房间（座位、房间码、房主选开局方式）
 *  - 开局以后：整张桌面。和本地试玩是同一个 Table，只是指令发给服务器，我只能操作自己的座位
 */
export function OnlinePlay() {
    const room = useOnline((s) => s.room)!;
    const meta = useOnline((s) => s.meta);
    const state = useOnline((s) => s.state);
    const steps = useOnline((s) => s.steps);
    const error = useOnline((s) => s.error);
    const reconnecting = useOnline((s) => s.reconnecting);
    const [autoPlay, setAutoPlay] = useState(false);

    const seats = meta ? Object.values(meta.players) : [];
    const me = meta?.players[room.sessionId]?.seat ?? null;
    const myTurn = state !== null && me !== null && state.phase !== "ended" && actingSeat(state) === me;

    useTurnTitle(myTurn);
    useAutoPlay(autoPlay && myTurn, me);

    if (meta === null) return <Waiting text="正在进入房间…" />;
    if (meta.phase === "waiting") return <WaitingRoom />;
    if (state === null || me === null) return <Waiting text="正在同步局面…" />;

    const name = (seat: Seat) => seats.find((p) => p.seat === seat)?.nickname ?? `座位 ${seat + 1}`;
    const offline = seats.filter((p) => !p.connected).map((p) => p.seat);

    return (
        <Table
            state={state}
            name={name}
            me={me}
            meLabel="你"
            send={sendMove}
            log={steps}
            notice={error}
            onCloseNotice={clearError}
            offline={offline}
            lobbyLink={false}
            tools={
                <>
                    {reconnecting && <span className="online-status" role="status">连接断了，正在重连…</span>}
                    <span className="online-code" title="房间码">房间 {room.roomId}</span>
                    {state.phase !== "ended" && (
                        <button
                            type="button" className={autoPlay ? "btn btn-quiet autoplay-running" : "btn btn-quiet"} aria-pressed={autoPlay}
                            title="测试用：轮到你的时候，电脑替你随机走一步" onClick={() => setAutoPlay(!autoPlay)}
                        >
                            {autoPlay ? "停止自动走" : "自动替我走"}
                        </button>
                    )}
                    <button type="button" className="btn btn-quiet" onClick={leaveRoom}>离开房间</button>
                </>
            }
        />
    );
}

/** 轮到我的时候，浏览器标签页的标题变成"【轮到你】"，切到别的窗口也能看到 */
function useTurnTitle(myTurn: boolean) {
    useEffect(() => {
        document.title = myTurn ? "【轮到你】大创造时代" : "大创造时代";
    }, [myTurn]);
}

/**
 * 测试用的"自动替我走"：轮到我时，从 getLegalMoves 里随机挑一条发给服务器。
 * 每个标签页都打开，几个标签页就会自己把一局打完
 */
function useAutoPlay(on: boolean, me: Seat | null) {
    const state = useOnline((s) => s.state);
    // 每个版本只发一次，免得服务器还没回、局面还没变的时候又发一遍
    const sentVersion = useRef(-1);
    useEffect(() => {
        if (!on || state === null || me === null || sentVersion.current === state.version) return;
        const timer = setTimeout(() => {
            sentVersion.current = state.version;
            const moves = getLegalMoves(state, me);
            if (moves.length > 0) void sendMove(pickRandomMove(state, moves));
        }, 300);
        return () => clearTimeout(timer);
    }, [on, state, me]);
}

function Waiting({ text }: { text: string }) {
    return (
        <div className="aoi-root start-root">
            <main className="start"><p role="status">{text}</p></main>
        </div>
    );
}

/** 开局前：等人的房间 */
function WaitingRoom() {
    const room = useOnline((s) => s.room)!;
    const meta = useOnline((s) => s.meta)!;
    const error = useOnline((s) => s.error);
    const [mode, setMode] = useState<"sets" | "draft">("sets");
    const [copied, setCopied] = useState<string | null>(null);

    const seats = Object.entries(meta.players).sort(([, a], [, b]) => a.seat - b.seat);
    const isHost = meta.hostSessionId === room.sessionId;
    const invite = `来玩大创造时代：打开 ${location.origin}${location.pathname}，输入房间码 ${room.roomId}`;

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(invite);
            setCopied("已复制，发给朋友吧");
        } catch {
            setCopied("浏览器不让复制，请手动复制房间码");
        }
    };

    return (
        <div className="aoi-root start-root">
            <main className="start waitroom">
                <header className="waitroom-head">
                    <h1>房间 <span className="waitroom-code">{room.roomId}</span></h1>
                    <button type="button" onClick={() => void copy()}>复制邀请</button>
                </header>
                <p className="start-intro">{copied ?? "把房间码发给朋友，他们在首页填上名字和房间码就能进来。"}</p>
                {error && <p className="notice" role="alert">{error}</p>}

                <section aria-label="座位">
                    <h2>座位（{seats.length} / 5）</h2>
                    <ol className="waitroom-seats">
                        {seats.map(([id, p]) => (
                            <li key={id} className={p.connected ? undefined : "waitroom-offline"}>
                                <span className="waitroom-name">{p.nickname}</span>
                                {id === meta.hostSessionId && <span className="waitroom-tag">房主</span>}
                                {id === room.sessionId && <span className="waitroom-tag waitroom-me">你</span>}
                                {!p.connected && <span className="waitroom-tag">离线</span>}
                            </li>
                        ))}
                    </ol>
                </section>

                {isHost ? (
                    <fieldset>
                        <legend>开局方式</legend>
                        <label className="radio">
                            <input type="radio" name="mode" checked={mode === "sets"} onChange={() => setMode("sets")} />
                            固定组合：7 组"规划板 + 派系 + 回合奖励板块"，每人选一组
                        </label>
                        <label className="radio">
                            <input type="radio" name="mode" checked={mode === "draft"} onChange={() => setMode("draft")} />
                            轮抽：4 类东西分开摆，蛇形顺序轮流拿
                        </label>
                    </fieldset>
                ) : (
                    <p className="waitroom-wait">等房主开始…</p>
                )}

                <p className="start-buttons">
                    {isHost && (
                        <button type="button" className="primary" disabled={seats.length < 2} onClick={() => void startGame(mode)}>
                            {seats.length < 2 ? "至少 2 个人才能开始" : `开始游戏（${seats.length} 人）`}
                        </button>
                    )}
                    <button type="button" onClick={leaveRoom}>离开房间</button>
                </p>
                <p className="start-note">开局以后新的人就进不来了。刷新页面不会丢座位；关掉了也能在首页"回到房间"。</p>
            </main>
        </div>
    );
}
