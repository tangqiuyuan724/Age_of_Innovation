import {
    BONUS_TILE_IDS, PALACE_TILE_INCOME,
    type BonusTileId, type CityTileId, type GameState, type Move, type PalaceTileId, type Seat,
} from "@aoi/engine/aoi";
import { TERRAIN_COLOR } from "./colors.ts";
import { describeBundle } from "./describe.ts";
import { CoinIcon } from "./icons.tsx";
import { BONUS_TILE_LABEL, CITY_TILE_LABEL, CITY_TILES_IN_ORDER, reasonText } from "./labels.ts";
import type { Choice } from "./options.ts";
import { Art, CubeIcon } from "./pieces.tsx";

interface BonusProps {
    state: GameState;
    name: (seat: Seat) => string;
    /** pass 时选板块：场上每块板块对应的 pass 指令和引擎的判断。不在选的时候为 null */
    passing: Choice[] | null;
    send?: (move: Move) => void;
}

/**
 * 回合奖励区：本局用到的回合奖励板块排成一排（顺序固定，不会跳来跳去）。
 *  - 有人拿着的板块垫一层木框，右上角放一个那个人颜色的木头方块
 *  - 方块旁边有红色数字的：这个人这一轮已经 pass，数字是 TA 下一轮的行动顺序
 *  - 只有方块、没有数字的：这个人这一轮还没 pass，这是 TA 手上本轮的板块
 *  - 没有方块的：场上没人拿的，上面累积的金币画成金币。pass 的时候这些板块会亮，点一块就带着它 pass
 */
export function BonusTiles({ state, name, passing, send }: BonusProps) {
    const available = state.board.bonusTiles;
    const holder = (id: BonusTileId) => state.players.find((p) => p !== undefined && p.bonusTile === id);
    const inPlay = BONUS_TILE_IDS.filter((id) => available.some((t) => t.id === id) || holder(id) !== undefined);

    return (
        <section className="supply" aria-label="回合奖励板块">
            <h3 className="supply-title">回合奖励板块{passing && <span className="supply-hint">点一块没人拿的，带着它 pass</span>}</h3>
            <ul className="bonus-row">
                {inPlay.map((id) => {
                    const label = BONUS_TILE_LABEL[id];
                    const owner = holder(id);
                    if (owner !== undefined) {
                        const color = TERRAIN_COLOR[owner.homeTerrain];
                        const next = owner.passed ? state.nextTurnOrder.indexOf(owner.seat) : -1;
                        const who = next >= 0
                            ? `${name(owner.seat)}已 pass，拿了这块，下一轮第 ${next + 1} 个行动`
                            : `${name(owner.seat)}本轮的板块（还没 pass）`;
                        return (
                            <li key={id} className="bonus bonus-taken" title={`${who}。${label.text}`}>
                                <Art kind="bonus" id={id} alt={`${who}：${label.text}`} />
                                <span className="bonus-cube"><CubeIcon color={color} size={22} /></span>
                                {next >= 0 && <span className="bonus-next num">{next + 1}</span>}
                            </li>
                        );
                    }
                    const index = available.findIndex((t) => t.id === id);
                    const coins = available[index].coins;
                    const c = passing?.[index];
                    const inner = (
                        <>
                            <Art kind="bonus" id={id} alt={label.text} />
                            {coins > 0 && (
                                <span className="bonus-coins" title={`上面有 ${coins} 金币`}>
                                    {Array.from({ length: coins }, (_, k) => <CoinIcon key={k} size={20} />)}
                                </span>
                            )}
                        </>
                    );
                    if (c === undefined) return <li key={id} className="bonus">{inner}</li>;
                    return (
                        <li key={id} className={c.error === null ? "bonus bonus-can" : "bonus"}>
                            <button type="button" disabled={c.error !== null} title={c.error === null ? `带着「${label.short}」pass` : reasonText(c.error)} onClick={() => send!(c.move)}>
                                {inner}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

interface TilesProps {
    state: GameState;
    /** 等这个人选城市板块 / 宫殿板块；没有时为 null */
    choosingCity: { id: string; options: CityTileId[] } | null;
    choosingPalace: { id: string; options: PalaceTileId[] } | null;
    send?: (move: Move) => void;
}

/** 城市板块（每种一叠，写着还剩几张）和还没人拿的宫殿板块 */
export function CityAndPalaceTiles({ state, choosingCity, choosingPalace, send }: TilesProps) {
    const left = state.board.cityTilesLeft;
    const palaces = state.board.palaceTilesAvailable;
    return (
        <section className="supply" aria-label="城市板块和宫殿板块">
            <h3 className="supply-title">城市板块{choosingCity && <span className="supply-hint">点一种拿走</span>}</h3>
            <ul className="city-row">
                {CITY_TILES_IN_ORDER.map((id) => {
                    const count = left[id];
                    const can = choosingCity !== null && send !== undefined && choosingCity.options.includes(id);
                    const text = `${CITY_TILE_LABEL[id]}，再拿 1 把钥匙${count === undefined ? "" : `。还剩 ${count} 张`}`;
                    const inner = (
                        <>
                            <Art kind="cityTile" id={id} alt={text} />
                            {count !== undefined && <span className="stack-count num">{count}</span>}
                        </>
                    );
                    return (
                        <li key={id} className={"city" + (count === 0 ? " city-gone" : "") + (can ? " city-can" : "")}>
                            {can ? (
                                <button type="button" title={`拿这张：${text}`} onClick={() => send!({ t: "decide", id: choosingCity!.id, choice: { kind: "cityTile", tile: id } })}>
                                    {inner}
                                </button>
                            ) : inner}
                        </li>
                    );
                })}
            </ul>

            {palaces.length > 0 && (
                <>
                    <h3 className="supply-title">宫殿板块{choosingPalace && <span className="supply-hint">点一块拿走</span>}</h3>
                    <ul className="palace-row">
                        {palaces.map((id) => {
                            const can = choosingPalace !== null && send !== undefined && choosingPalace.options.includes(id);
                            const text = `宫殿板块 #${id}，收入 ${describeBundle(PALACE_TILE_INCOME[id])}`;
                            return (
                                <li key={id} className={can ? "palace palace-can" : "palace"}>
                                    {can ? (
                                        <button type="button" title={`拿这块：${text}`} onClick={() => send!({ t: "decide", id: choosingPalace!.id, choice: { kind: "palaceTile", tile: id } })}>
                                            <Art kind="palace" id={id} alt={text} />
                                        </button>
                                    ) : <Art kind="palace" id={id} alt={text} />}
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}
        </section>
    );
}
