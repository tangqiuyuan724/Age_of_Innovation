import { useState } from "react";
import { createRoom, joinRoom } from "./net.ts";

export function Lobby() {
    const [nickname, setNickname] = useState("");
    const [code, setCode] = useState("");

    return (
        <section>
            <p>
                昵称：
                <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={12} />
            </p>
            <p>
                <button disabled={!nickname} onClick={() => createRoom(nickname)}>创建房间</button>
            </p>
            <p>
                房间码：
                <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={5} />
                <button disabled={!nickname || code.length !== 5} onClick={() => joinRoom(code, nickname)}>
                    加入
                </button>
            </p>
            <p>
                <a href="#aoi-preview">查看大创造时代界面预览（假数据）</a>
            </p>
            <p>
                <a href="#aoi-local">大创造时代本地试玩（一台电脑轮流操作，用你写的引擎）</a>
            </p>
        </section>
    );
}