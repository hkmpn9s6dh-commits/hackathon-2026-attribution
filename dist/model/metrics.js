export function confusion(yTrue, yPred, k) {
    const m = Array.from({ length: k }, () => new Array(k).fill(0));
    for (let i = 0; i < yTrue.length; i++)
        m[yTrue[i]][yPred[i]]++;
    return m;
}
export function accuracy(yTrue, yPred) {
    if (yTrue.length === 0)
        return 0;
    let c = 0;
    for (let i = 0; i < yTrue.length; i++)
        if (yTrue[i] === yPred[i])
            c++;
    return c / yTrue.length;
}
export function macroF1(yTrue, yPred, k) {
    const m = confusion(yTrue, yPred, k);
    let total = 0, used = 0;
    for (let c = 0; c < k; c++) {
        let tp = m[c][c], fp = 0, fn = 0;
        for (let j = 0; j < k; j++) {
            if (j !== c) {
                fp += m[j][c];
                fn += m[c][j];
            }
        }
        if (tp + fp + fn === 0)
            continue;
        const p = tp + fp === 0 ? 0 : tp / (tp + fp);
        const r = tp + fn === 0 ? 0 : tp / (tp + fn);
        total += p + r === 0 ? 0 : (2 * p * r) / (p + r);
        used++;
    }
    return used === 0 ? 0 : total / used;
}
export function balancedAccuracy(yTrue, yPred, k) {
    const m = confusion(yTrue, yPred, k);
    let total = 0, used = 0;
    for (let c = 0; c < k; c++) {
        const support = m[c].reduce((a, b) => a + b, 0);
        if (support === 0)
            continue;
        total += m[c][c] / support;
        used++;
    }
    return used === 0 ? 0 : total / used;
}
/** Probabilities that a random positive outranks a random negative (ties count half). */
export function aucBinary(scores, labels) {
    const pos = [], neg = [];
    for (let i = 0; i < scores.length; i++)
        (labels[i] === 1 ? pos : neg).push(scores[i]);
    if (pos.length === 0 || neg.length === 0)
        return 0.5;
    const sorted = scores.map((s, i) => ({ s, y: labels[i] })).sort((a, b) => a.s - b.s);
    // average ranks for ties
    const ranks = new Array(sorted.length).fill(0);
    let i = 0;
    while (i < sorted.length) {
        let j = i;
        while (j + 1 < sorted.length && sorted[j + 1].s === sorted[i].s)
            j++;
        const avg = (i + j) / 2 + 1;
        for (let k = i; k <= j; k++)
            ranks[k] = avg;
        i = j + 1;
    }
    let rankSumPos = 0;
    for (let k = 0; k < sorted.length; k++)
        if (sorted[k].y === 1)
            rankSumPos += ranks[k];
    const n1 = pos.length, n0 = neg.length;
    return (rankSumPos - (n1 * (n1 + 1)) / 2) / (n1 * n0);
}
export function macroAuc(probs, y, k) {
    let total = 0;
    for (let c = 0; c < k; c++) {
        const labels = y.map((v) => (v === c ? 1 : 0));
        total += aucBinary(probs.map((p) => p[c]), labels);
    }
    return total / k;
}
function rank(xs) {
    const idx = xs.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
    const r = new Array(xs.length).fill(0);
    let i = 0;
    while (i < idx.length) {
        let j = i;
        while (j + 1 < idx.length && idx[j + 1].v === idx[i].v)
            j++;
        const avg = (i + j) / 2 + 1;
        for (let k = i; k <= j; k++)
            r[idx[k].i] = avg;
        i = j + 1;
    }
    return r;
}
export function spearman(a, b) {
    if (a.length < 3)
        return 0;
    const ra = rank(a), rb = rank(b);
    const ma = ra.reduce((x, y) => x + y, 0) / ra.length;
    const mb = rb.reduce((x, y) => x + y, 0) / rb.length;
    let num = 0, da = 0, db = 0;
    for (let i = 0; i < ra.length; i++) {
        num += (ra[i] - ma) * (rb[i] - mb);
        da += (ra[i] - ma) ** 2;
        db += (rb[i] - mb) ** 2;
    }
    return da === 0 || db === 0 ? 0 : num / Math.sqrt(da * db);
}
export function withinOne(yTrue, yPred) {
    if (yTrue.length === 0)
        return 0;
    let c = 0;
    for (let i = 0; i < yTrue.length; i++)
        if (Math.abs(yTrue[i] - yPred[i]) <= 1)
            c++;
    return c / yTrue.length;
}
/** Deterministic percentile bootstrap over the given index space. */
export function bootstrapCi(values, q = [0.025, 0.975]) {
    if (values.length === 0)
        return [0, 0];
    const s = [...values].sort((a, b) => a - b);
    const pick = (p) => s[Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * p)))];
    return [pick(q[0]), pick(q[1])];
}
