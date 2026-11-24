import {
    BRIDGES_TOTAL, DISCIPLINES, MAX_INNOVATIONS,
    type BuildingType, type PlayerState,
} from "@aoi/engine/aoi";
import { DISCIPLINE_COLOR, TERRAIN_COLOR, inkOn } from "./colors.ts";
import { BOOK_NAME, BUILDING_TOTAL, STRUCTURE_NAME, TERRAIN_NAME, factionName } from "./labels.ts";
import { BookIcon, CoinIcon, KeyIcon, ScholarIcon, ToolIcon } from "./icons.tsx";
import { PowerBowls } from "./PowerBowls.tsx";

const BUILDINGS: BuildingType[] = ["workshop", "guild", "school", "university", "palace"];

/** 底部的玩家板：正在查看的那位玩家的全部家当，横着排开 */
export function PlayerSheet({ p, name, isMe }: { p: PlayerState; name: string; isMe: boolean }) {
    const color = TERRAIN_COLOR[p.homeTerrain];
    return (
        <section className="sheet" aria-label={`${name}的玩家板`}>
            <div className="sheet-id" style={{ background: color, color: inkOn(p.homeTerrain) }}>
                <p className="sheet-name">{name}{isMe ? "（你）" : ""}</p>
                <p className="sheet-faction">{factionName(p.faction)}<br />家园地形：{TERRAIN_NAME[p.homeTerrain]}</p>
                <p className="sheet-vp"><span className="num">{p.vp}</span> 分</p>
            </div>

            <div className="sheet-col">
                <h3>资源</h3>
                <ul className="stock">
                    <li title="金币"><CoinIcon /><span className="num">{p.coins}</span><span className="stock-name">金币</span></li>
                    <li title="工具"><ToolIcon /><span className="num">{p.tools}</span><span className="stock-name">工具</span></li>
                    <li title={`学者：手上 ${p.scholars}，供应区还有 ${p.scholarsInSupply}`}>
                        <ScholarIcon /><span className="num">{p.scholars}</span><span className="stock-name">学者<small>（供应区 {p.scholarsInSupply}）</small></span>
                    </li>
                    <li title="钥匙"><KeyIcon /><span className="num">{p.keys}</span><span className="stock-name">钥匙</span></li>
                </ul>
                <ul className="books" aria-label="书">
                    {DISCIPLINES.map((c) => (
                        <li key={c} className={p.books[c] === 0 ? "book-none" : ""} title={`${BOOK_NAME[c]}书 ${p.books[c]} 本`}>
                            <BookIcon color={DISCIPLINE_COLOR[c]} /><span className="num">{p.books[c]}</span>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="sheet-col">
                <h3>能量</h3>
                <PowerBowls bowls={p.power} />
            </div>

            <div className="sheet-col">
                <h3>规划板上剩下的建筑</h3>
                <ul className="supply">
                    {BUILDINGS.map((b) => (
                        <li key={b}>
                            <span className="supply-name">{STRUCTURE_NAME[b]}</span>
                            <span className="pips" aria-label={`还剩 ${p.buildingsLeft[b]} 座，共 ${BUILDING_TOTAL[b]} 座`}>
                                {Array.from({ length: BUILDING_TOTAL[b] }, (_, i) => (
                                    <span key={i} className={i < p.buildingsLeft[b] ? "pip" : "pip pip-built"} />
                                ))}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="sheet-col">
                <h3>轨道与板块</h3>
                <dl className="facts">
                    <div><dt>航行</dt><dd><span className="num">{p.sailing}</span> 级</dd></div>
                    <div><dt>改造</dt><dd><span className="num">{p.terraforming}</span> 级</dd></div>
                    <div><dt>桥</dt><dd>剩 <span className="num">{p.bridges}</span> / {BRIDGES_TOTAL}</dd></div>
                    <div><dt>宫殿</dt><dd>{p.palaceTile === null ? "还没有" : `#${p.palaceTile}`}</dd></div>
                    <div><dt>创新</dt><dd><span className="num">{p.innovations.length}</span> / {MAX_INNOVATIONS}</dd></div>
                    <div><dt>能力</dt><dd>{p.competencies.length === 0 ? "无" : p.competencies.join("、")}</dd></div>
                    <div><dt>城市</dt><dd>{p.cityTiles.length === 0 ? "无" : p.cityTiles.join("、")}</dd></div>
                    <div><dt>回合奖励</dt><dd>{p.bonusTile ?? "无"}</dd></div>
                </dl>
            </div>
        </section>
    );
}
