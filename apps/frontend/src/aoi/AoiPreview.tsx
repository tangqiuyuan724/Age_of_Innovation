import "./aoi.css";
import { TERRAIN_WHEEL } from "@aoi/engine/aoi";
import { TERRAIN_COLOR, inkOn } from "./colors.ts";
import { TERRAIN_NAME } from "./labels.ts";
import { MOCK_MY_SEAT, MOCK_NAMES, MOCK_STATE } from "./mock.ts";
import { TopBar } from "./TopBar.tsx";
import { SharedBoard } from "./SharedBoard.tsx";
import { PlayerSheet, OpponentRow } from "./PlayerSheet.tsx";
import { PendingBar } from "./PendingBar.tsx";

/** 大创造时代的界面预览：用假数据把整张桌面摆出来 */
export function AoiPreview() {
    const state = MOCK_STATE;
    const mySeat = MOCK_MY_SEAT;
    const name = (seat: number) => MOCK_NAMES[seat] ?? `座位 ${seat}`;
    const me = state.players[mySeat];
    const others = state.players.filter((p) => p.seat !== mySeat);

    return (
        <div className="aoi-root">
            <p className="preview-note">
                界面预览：这里显示的是假数据，按钮都不可用。<a href="#">回到抢 21</a>
            </p>
            <TopBar state={state} name={name} />
            <div className="table">
                <div className="table-main">
                    <div className="map-slot">
                        <p className="map-slot-title">地图区域</p>
                        <p className="map-slot-note">等引擎的地图函数（M1-2）完成后，在这里画出六边形地图。下面是地形轮，相邻两种地形之间改造只要 1 铲。</p>
                        <ol className="wheel" aria-label="地形轮">
                            {TERRAIN_WHEEL.map((t) => (
                                <li key={t} style={{ background: TERRAIN_COLOR[t], color: inkOn(t) }}>{TERRAIN_NAME[t]}</li>
                            ))}
                        </ol>
                    </div>
                    <SharedBoard state={state} name={name} />
                </div>
                <aside className="table-side">
                    <PlayerSheet p={me} name={name(mySeat)} active={state.turn?.seat === mySeat} />
                    <ul className="opps">
                        {others.map((p) => (
                            <OpponentRow key={p.seat} p={p} name={name(p.seat)} active={state.turn?.seat === p.seat} />
                        ))}
                    </ul>
                </aside>
            </div>
            <PendingBar state={state} mySeat={mySeat} name={name} />
        </div>
    );
}
