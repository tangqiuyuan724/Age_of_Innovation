import { getLegalMoves } from "@aoi/engine";
import { useStore, startGame, sendMove, leaveRoom } from "./net.ts";

export function GameView() {
    const room = useStore((s) => s.room)!;
    const meta = useStore((s) => s.meta);
    const snapshot = useStore((s) => s.snapshot);
    const reconnecting = useStore((s) => s.reconnecting);

    if (!meta) return <p>加载中…</p>;

    const players = Object.entries(meta.players).sort(([, a], [, b]) => a.seat - b.seat);
    const me = meta.players[room.sessionId];
    const isHost = meta.hostSessionId === room.sessionId;
    const game = snapshot?.state;
    // 用同一份规则引擎在本地算出"我现在能做什么"，按钮据此启用/禁用
    const legal = game && me ? getLegalMoves(game, me.seat) : [];

    return (
        <section>
            {reconnecting && <p className="banner">连接中断，正在重连…</p>}
            <p>房间码：<b>{room.roomId}</b>（发给朋友）</p>

            <h2>玩家</h2>
            <ul>
                {players.map(([id, p]) => (
                    <li key={id}>
                        {p.seat === meta.activeSeat ? "👉 " : ""}
                        {p.nickname}
                        {id === meta.hostSessionId ? "（房主）" : ""}
                        {id === room.sessionId ? "（你）" : ""}
                        {p.connected ? "" : " · 离线"}
                    </li>
                ))}
            </ul>

            {meta.phase === "waiting" && (
                isHost
                    ? <button onClick={() => startGame()}>开始游戏</button>
                    : <p>等待房主开始…</p>
            )}

            {game && (
                <>
                    <h2>当前总数：{game.total} / {game.target}</h2>
                    {game.winner !== null ? (
                        <p>🎉 {players.find(([, p]) => p.seat === game.winner)?.[1].nickname} 赢了！</p>
                    ) : (
                        <p>
                            {[1, 2, 3].map((n) => (
                                <button
                                    key={n}
                                    disabled={!legal.some((m) => m.n === n)}
                                    onClick={() => sendMove({ t: "add", n })}
                                >
                                    +{n}
                                </button>
                            ))}
                        </p>
                    )}
                </>
            )}

            <p><button onClick={leaveRoom}>离开房间</button></p>
        </section>
    );
}