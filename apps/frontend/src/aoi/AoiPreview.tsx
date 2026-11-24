import "./aoi.css";
import { useMemo, useState } from "react";
import type { Seat } from "@aoi/engine/aoi";
import { TERRAIN_COLOR } from "./colors.ts";
import { MOCK_MY_SEAT, MOCK_NAMES, MOCK_STATE } from "./mock.ts";
import { AOI_BASE, reachableEmpty } from "./mapView.ts";
import { TopBar } from "./TopBar.tsx";
import { HexMap } from "./HexMap.tsx";
import { PendingBar } from "./PendingBar.tsx";
import { SharedBoard } from "./SharedBoard.tsx";
import { PlayerSheet } from "./PlayerSheet.tsx";
import { ActionPanel } from "./ActionPanel.tsx";

/** 大创造时代的界面预览：用假数据把整张桌面摆出来 */
export function AoiPreview() {
    const state = MOCK_STATE;
    const mySeat = MOCK_MY_SEAT;
    const name = (seat: Seat) => MOCK_NAMES[seat] ?? `座位 ${seat}`;

    // 正在查看谁的玩家板。默认看自己；点顶栏的玩家卡片切换
    const [viewed, setViewed] = useState<Seat>(mySeat);
    const reach = useMemo(() => reachableEmpty(AOI_BASE, state, viewed), [state, viewed]);
    const viewedPlayer = state.players[viewed];

    return (
        <div className={viewed === mySeat ? "aoi-root" : "aoi-root aoi-viewing-other"}>
            <TopBar state={state} mySeat={mySeat} viewed={viewed} onView={setViewed} name={name} />

            <main className="map-area">
                <PendingBar state={state} mySeat={mySeat} name={name} />
                <div className="map-frame">
                    <HexMap geo={AOI_BASE} state={state} name={name} reach={reach} />
                </div>
                <p className="map-legend">
                    <span className="legend-dash" aria-hidden />
                    {viewed === mySeat ? "你" : name(viewed)}能到达的空格，数字是改造成家园地形要几铲
                    <span className="legend-sep">预览：假数据</span>
                </p>
            </main>

            <SharedBoard state={state} name={name} />

            <div className="bottom" style={{ ["--seat-color" as string]: TERRAIN_COLOR[viewedPlayer.homeTerrain] }}>
                <PlayerSheet p={viewedPlayer} name={name(viewed)} isMe={viewed === mySeat} />
                <ActionPanel state={state} mySeat={mySeat} viewed={viewed} name={name} reach={reach} onBack={() => setViewed(mySeat)} />
            </div>
        </div>
    );
}
