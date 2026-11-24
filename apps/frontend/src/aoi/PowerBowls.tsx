import { powerCapacity, type PowerBowls as Bowls } from "@aoi/engine/aoi";

/** 三个能量碗：碗里每个圆点是一个能量指示物 */
export function PowerBowls({ bowls, compact = false }: { bowls: Bowls; compact?: boolean }) {
    const names = ["I", "II", "III"];
    return (
        <div className={compact ? "bowls bowls-compact" : "bowls"}>
            <div className="bowls-row">
                {bowls.map((count, i) => (
                    <div key={i} className="bowl-wrap">
                        <div className={i === 2 ? "bowl bowl-ready" : "bowl"} title={`碗 ${names[i]}：${count} 个`}>
                        {compact ? (
                            <span className="bowl-count num">{count}</span>
                        ) : (
                            <div className="bowl-tokens">
                                {Array.from({ length: count }, (_, k) => <span key={k} className="token" />)}
                            </div>
                        )}
                        </div>
                        <span className="bowl-name">{names[i]}</span>
                    </div>
                ))}
            </div>
            {!compact && (
                <p className="bowls-note">
                    可用 <strong>{bowls[2]}</strong> 点，还能获得 <strong>{powerCapacity(bowls)}</strong> 点
                </p>
            )}
        </div>
    );
}
