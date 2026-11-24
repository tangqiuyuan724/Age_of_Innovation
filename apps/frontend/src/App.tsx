import { useStore } from "./net.ts";
import { Lobby } from "./Lobby.tsx";
import { GameView } from "./GameView.tsx";
import { AoiPreview } from "./aoi/AoiPreview.tsx";
import { useHash } from "./useHash.ts";

export function App() {
    const room = useStore((s) => s.room);
    const error = useStore((s) => s.error);
    const hash = useHash();

    if (hash === "#aoi-preview") return <AoiPreview />;

    return (
        <main>
            <h1>抢 21 · 联机测试</h1>
            {room ? <GameView /> : <Lobby />}
            {error && <p className="error">{error}</p>}
        </main>
    );
}