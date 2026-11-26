import { useEffect } from "react";
import { resumeAfterReload, useOnline } from "./net.ts";
import { Lobby } from "./Lobby.tsx";
import { AoiPreview } from "./aoi/AoiPreview.tsx";
import { LocalPlay } from "./aoi/LocalPlay.tsx";
import { OnlinePlay } from "./aoi/OnlinePlay.tsx";
import { useHash } from "./useHash.ts";

/**
 * 网址 # 后面是什么就显示哪一页：
 *   #aoi-preview  界面预览（假数据）
 *   #aoi-local    本地试玩（一台电脑轮流操作）
 *   其他          联机：在房间里就是房间，不在就是首页
 */
export function App() {
    const room = useOnline((s) => s.room);
    const hash = useHash();

    // 刷新页面以后：这个标签页刚才在一个房间里，自动带着座位令牌回去
    useEffect(() => {
        if (hash !== "#aoi-preview" && hash !== "#aoi-local") resumeAfterReload();
    }, []);   // 空数组：只在页面刚打开时做一次

    if (hash === "#aoi-preview") return <AoiPreview />;
    if (hash === "#aoi-local") return <LocalPlay />;
    return room ? <OnlinePlay /> : <Lobby />;
}
