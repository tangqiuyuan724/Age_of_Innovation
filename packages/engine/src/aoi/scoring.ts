/**
 * 名次分：values 从高到低排名，第 1、2、3… 名分别得 points[0]、points[1]…。
 * 并列的人把他们占据的名次的分数加起来平分，向下取整。
 * 小于 minValue 的不参与排名（例如学科 0 级不得分）。
 */
export function rankPoints(values: number[], points: readonly number[], minValue = 1): number[] {
    const result = values.map(() => 0);
    const ranked = values
        .map((value, index) => ({ value, index }))
        .filter((x) => x.value >= minValue)
        .sort((a, b) => b.value - a.value);

    let place = 0;
    while (place < ranked.length && place < points.length) {
        const group = ranked.filter((x) => x.value === ranked[place].value);
        let pool = 0;
        for (let p = place; p < place + group.length && p < points.length; p++) pool += points[p];
        const share = Math.floor(pool / group.length);
        for (const x of group) result[x.index] = share;
        place += group.length;
    }
    return result;
}