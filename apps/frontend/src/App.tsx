import { useStore } from "./net.ts";
import { Lobby } from "./Lobby.tsx";
import { GameView } from "./GameView.tsx";

export function App() {
    const room = useStore((s) => s.room);
    const error = useStore((s) => s.error);

    return (
        <main>
            <h1>抢 21 · 联机测试</h1>
            {room ? <GameView /> : <Lobby />}
            {error && <p className="error">{error}</p>}
        </main>
    );
}