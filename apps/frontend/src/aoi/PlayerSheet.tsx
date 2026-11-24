import { DISCIPLINES, SCIENCE_KEY_THRESHOLD, SCIENCE_MAX, type BuildingType, type PlayerState } from "@aoi/engine/aoi";
import { TERRAIN_COLOR, DISCIPLINE_COLOR, inkOn } from "./colors.ts";
import { BOOK_NAME, BUILDING_TOTAL, DISCIPLINE_NAME, STRUCTURE_NAME, TERRAIN_NAME, factionName } from "./labels.ts";
import { PowerBowls } from "./PowerBowls.tsx";

const BUILDINGS: BuildingType[] = ["workshop", "guild", "school", "university", "palace"];

/** 自己的完整玩家板 */
export function PlayerSheet({ p, name, active }: { p: PlayerState; name: string; active: boolean }) {
    const color = TERRAIN_COLOR[p.homeTerrain];
    const books = (Object.keys(p.books) as (keyof typeof p.books)[]).filter((c) => p.books[c] > 0);
    return (
        <section className="sheet" style={{ borderColor: color }}>
            <header className="sheet-head" style={{ background: color, color: inkOn(p.homeTerrain) }}>
                <div>
                    <h2 className="sheet-name">{name}</h2>
                    <p className="sheet-faction">{factionName(p.faction)}，家园地形是{TERRAIN_NAME[p.homeTerrain]}</p>
                </div>
                <div className="sheet-vp"><span className="num">{p.vp}</span>分</div>
            </header>

            {active && <p className="sheet-flag">正在行动</p>}
            {p.passed && <p className="sheet-flag">本轮已结束</p>}

            <div className="sheet-body">
                <dl className="stock">
                    <div><dt>金币</dt><dd className="num">{p.coins}</dd></div>
                    <div><dt>工具</dt><dd className="num">{p.tools}</dd></div>
                    <div><dt>学者</dt><dd className="num">{p.scholars}</dd></div>
                    <div><dt>钥匙</dt><dd className="num">{p.keys}</dd></div>
                </dl>
                <p className="books">
                    {books.length === 0 ? "没有书" : books.map((c) => (
                        <span key={c} className="book" style={{ background: c === "gray" ? "#8C9396" : DISCIPLINE_COLOR[c] }}>
                            {BOOK_NAME[c]} {p.books[c]}
                        </span>
                    ))}
                </p>

                <h3>能量</h3>
                <PowerBowls bowls={p.power} />

                <h3>学科</h3>
                <ul className="science">
                    {DISCIPLINES.map((d) => (
                        <li key={d}>
                            <span className="science-name">{DISCIPLINE_NAME[d]}</span>
                            <span className="science-track" aria-hidden>
                                {Array.from({ length: SCIENCE_MAX }, (_, i) => (
                                    <span
                                        key={i}
                                        className={i === SCIENCE_KEY_THRESHOLD ? "step step-key" : "step"}
                                        style={i < p.science[d] ? { background: DISCIPLINE_COLOR[d] } : undefined}
                                    />
                                ))}
                            </span>
                            <span className="num">{p.science[d]}</span>
                        </li>
                    ))}
                </ul>

                <h3>轨道</h3>
                <p className="tracks">
                    航行 <span className="num">{p.sailing}</span>　改造 <span className="num">{p.terraforming}</span>　剩余桥 <span className="num">{p.bridges}</span>
                </p>

                <h3>规划板上还没建出去的建筑</h3>
                <ul className="supply">
                    {BUILDINGS.map((b) => (
                        <li key={b}>
                            <span>{STRUCTURE_NAME[b]}</span>
                            <span className="pips" aria-label={`还剩 ${p.buildingsLeft[b]} 座，共 ${BUILDING_TOTAL[b]} 座`}>
                                {Array.from({ length: BUILDING_TOTAL[b] }, (_, i) => (
                                    <span key={i} className={i < p.buildingsLeft[b] ? "pip" : "pip pip-built"} />
                                ))}
                            </span>
                        </li>
                    ))}
                </ul>

                <h3>板块</h3>
                <p className="tiles">
                    宫殿：{p.palaceTile === null ? "还没有" : `#${p.palaceTile}`}<br />
                    创新：{p.innovations.length} / 3　能力：{p.competencies.length}　城市：{p.cityTiles.length}<br />
                    回合奖励：{p.bonusTile ?? "无"}
                </p>
            </div>
        </section>
    );
}

/** 其他玩家的摘要 */
export function OpponentRow({ p, name, active }: { p: PlayerState; name: string; active: boolean }) {
    return (
        <li className={active ? "opp opp-active" : "opp"}>
            <span className="swatch" style={{ background: TERRAIN_COLOR[p.homeTerrain] }} />
            <div className="opp-main">
                <p className="opp-name">
                    {name}<span className="opp-faction">{factionName(p.faction)}</span>
                    {active && <span className="opp-tag">正在行动</span>}
                    {p.passed && <span className="opp-tag">已结束本轮</span>}
                </p>
                <p className="opp-stock">
                    金币 <span className="num">{p.coins}</span>　工具 <span className="num">{p.tools}</span>　学者 <span className="num">{p.scholars}</span>
                </p>
            </div>
            <PowerBowls bowls={p.power} compact />
            <div className="opp-vp"><span className="num">{p.vp}</span>分</div>
        </li>
    );
}
