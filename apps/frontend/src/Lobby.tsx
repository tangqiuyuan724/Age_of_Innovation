import "./aoi/aoi.css";
import { useState } from "react";
import { createRoom, joinRoom, recentSeats, rejoinRoom, useOnline } from "./net.ts";

const NICKNAME_KEY = "aoi-nickname";

function savedNickname(): string {
    try {
        return localStorage.getItem(NICKNAME_KEY) ?? "";
    } catch {
        return "";
    }
}

/** 首页：起个名字，开房间或者用房间码加入；也能回到最近进过的房间 */
export function Lobby() {
    const joining = useOnline((s) => s.joining);
    const error = useOnline((s) => s.error);
    const [nickname, setNickname] = useState(savedNickname);
    const [code, setCode] = useState("");
    const recent = recentSeats();
    const name = nickname.trim();

    const rememberName = () => {
        try {
            localStorage.setItem(NICKNAME_KEY, name);
        } catch {
            // 存不了就算了
        }
    };

    return (
        <div className="aoi-root start-root">
            <main className="start lobby">
                <h1>大创造时代</h1>
                <p className="start-intro">一个人开房间，把房间码发给朋友；大家都进来以后，房主点"开始游戏"。</p>
                {error && <p className="notice" role="alert">{error}</p>}
                {joining && <p className="lobby-joining" role="status">正在进入房间…</p>}

                <label className="lobby-name">
                    你的名字
                    <input value={nickname} maxLength={12} placeholder="比如 秋源" onChange={(e) => setNickname(e.target.value)} />
                </label>

                <div className="lobby-actions">
                    <button
                        type="button" className="primary" disabled={!name || joining}
                        onClick={() => { rememberName(); void createRoom(name); }}
                    >
                        创建房间
                    </button>
                    <span className="lobby-or">或者</span>
                    <form
                        className="lobby-join"
                        onSubmit={(e) => { e.preventDefault(); rememberName(); void joinRoom(code, name); }}
                    >
                        <input
                            value={code} maxLength={5} placeholder="房间码" aria-label="房间码"
                            onChange={(e) => setCode(e.target.value.toUpperCase())}
                        />
                        <button type="submit" disabled={!name || code.trim().length !== 5 || joining}>加入</button>
                    </form>
                </div>
                {!name && <p className="start-note">先填名字，大家在桌上看到的就是这个名字。</p>}

                {recent.length > 0 && (
                    <section className="lobby-recent" aria-label="最近的房间">
                        <h2>回到最近的房间</h2>
                        <p className="start-note">关掉了页面、换了一个标签页，点这里回到原来的座位。</p>
                        <ul>
                            {recent.map((seat) => (
                                <li key={seat.code}>
                                    <button type="button" disabled={joining} onClick={() => void rejoinRoom(seat)}>
                                        房间 <b>{seat.code}</b>（{seat.nickname}）
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                <p className="lobby-offline">
                    不联机：<a href="#aoi-local">本地试玩</a>（一台电脑轮流操作）　<a href="#aoi-preview">界面预览</a>
                </p>
            </main>
        </div>
    );
}
