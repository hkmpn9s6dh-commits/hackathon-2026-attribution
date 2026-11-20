import { mulberry32, seedOf } from '../rng.js';
function softmax(z) {
    const m = Math.max(...z);
    const e = z.map((v) => Math.exp(v - m));
    const s = e.reduce((a, b) => a + b, 0);
    return e.map((v) => v / s);
}
function standardise(X) {
    const d = X[0].length;
    const mu = new Array(d).fill(0);
    const sd = new Array(d).fill(0);
    for (const row of X)
        for (let j = 0; j < d; j++)
            mu[j] += row[j];
    for (let j = 0; j < d; j++)
        mu[j] /= X.length;
    for (const row of X)
        for (let j = 0; j < d; j++)
            sd[j] += (row[j] - mu[j]) ** 2;
    for (let j = 0; j < d; j++)
        sd[j] = Math.sqrt(sd[j] / X.length) || 1;
    const Z = X.map((row) => row.map((v, j) => (v - mu[j]) / sd[j]));
    return { Z, mu, sd };
}
/** Multinomial logistic regression, full-batch Adam on flat arrays. Deterministic. */
export function trainLogReg(X, y, k, opts = {}) {
    const { epochs = 300, lr = 0.06, l2 = 1e-3 } = opts;
    const { Z, mu, sd } = standardise(X);
    const n = Z.length, d = Z[0].length;
    const flat = new Float64Array(n * d);
    for (let i = 0; i < n; i++)
        for (let j = 0; j < d; j++)
            flat[i * d + j] = Z[i][j];
    const W = new Float64Array(k * d);
    const b = new Float64Array(k);
    const mW = new Float64Array(k * d), vW = new Float64Array(k * d);
    const mb = new Float64Array(k), vb = new Float64Array(k);
    const gW = new Float64Array(k * d), gb = new Float64Array(k);
    const logits = new Float64Array(k);
    const probs = new Float64Array(k);
    const beta1 = 0.9, beta2 = 0.999, eps = 1e-8;
    for (let ep = 1; ep <= epochs; ep++) {
        gW.fill(0);
        gb.fill(0);
        for (let i = 0; i < n; i++) {
            const base = i * d;
            for (let c = 0; c < k; c++) {
                let z = b[c];
                const off = c * d;
                for (let j = 0; j < d; j++)
                    z += W[off + j] * flat[base + j];
                logits[c] = z;
            }
            let mx = -Infinity;
            for (let c = 0; c < k; c++)
                if (logits[c] > mx)
                    mx = logits[c];
            let sum = 0;
            for (let c = 0; c < k; c++) {
                probs[c] = Math.exp(logits[c] - mx);
                sum += probs[c];
            }
            const inv = 1 / sum;
            for (let c = 0; c < k; c++) {
                const g = probs[c] * inv - (y[i] === c ? 1 : 0);
                gb[c] += g;
                const off = c * d;
                for (let j = 0; j < d; j++)
                    gW[off + j] += g * flat[base + j];
            }
        }
        const c1 = 1 / n;
        const bc1 = 1 - beta1 ** ep, bc2 = 1 - beta2 ** ep;
        for (let c = 0; c < k; c++) {
            const off = c * d;
            for (let j = 0; j < d; j++) {
                const idx = off + j;
                const grad = gW[idx] * c1 + l2 * W[idx];
                mW[idx] = beta1 * mW[idx] + (1 - beta1) * grad;
                vW[idx] = beta2 * vW[idx] + (1 - beta2) * grad * grad;
                W[idx] -= (lr * (mW[idx] / bc1)) / (Math.sqrt(vW[idx] / bc2) + eps);
            }
            const gradB = gb[c] * c1;
            mb[c] = beta1 * mb[c] + (1 - beta1) * gradB;
            vb[c] = beta2 * vb[c] + (1 - beta2) * gradB * gradB;
            b[c] -= (lr * (mb[c] / bc1)) / (Math.sqrt(vb[c] / bc2) + eps);
        }
    }
    return {
        name: `logreg(e${epochs},l2=${l2})`,
        predictProba(Xn) {
            return Xn.map((row) => {
                const z = [];
                for (let c = 0; c < k; c++) {
                    let acc = b[c];
                    const off = c * d;
                    for (let j = 0; j < d; j++)
                        acc += W[off + j] * ((row[j] - mu[j]) / sd[j]);
                    z.push(acc);
                }
                return softmax(z);
            });
        },
    };
}
function leaf(value) {
    return { feat: -1, thr: 0, left: null, right: null, value };
}
function fitTree(X, residual, idx, depth, maxDepth, minLeaf) {
    const n = idx.length;
    const mean = idx.reduce((s, i) => s + residual[i], 0) / Math.max(n, 1);
    if (depth >= maxDepth || n < 2 * minLeaf)
        return leaf(mean);
    const d = X[0].length;
    let best = null;
    const sse0 = idx.reduce((s, i) => s + (residual[i] - mean) ** 2, 0);
    for (let j = 0; j < d; j++) {
        const vals = idx.map((i) => X[i][j]).sort((a, b) => a - b);
        const cands = new Set();
        for (let q = 1; q <= 8; q++) {
            const pos = Math.floor((vals.length - 1) * (q / 9));
            const v = vals[pos];
            cands.add((v + vals[Math.min(pos + 1, vals.length - 1)]) / 2);
        }
        for (const thr of cands) {
            const left = [], right = [];
            for (const i of idx)
                (X[i][j] <= thr ? left : right).push(i);
            if (left.length < minLeaf || right.length < minLeaf)
                continue;
            const ml = left.reduce((s, i) => s + residual[i], 0) / left.length;
            const mr = right.reduce((s, i) => s + residual[i], 0) / right.length;
            const sse = left.reduce((s, i) => s + (residual[i] - ml) ** 2, 0)
                + right.reduce((s, i) => s + (residual[i] - mr) ** 2, 0);
            const gain = sse0 - sse;
            if (!best || gain > best.gain)
                best = { feat: j, thr, gain, left, right };
        }
    }
    if (!best || best.gain <= 1e-9)
        return leaf(mean);
    return {
        feat: best.feat,
        thr: best.thr,
        left: fitTree(X, residual, best.left, depth + 1, maxDepth, minLeaf),
        right: fitTree(X, residual, best.right, depth + 1, maxDepth, minLeaf),
        value: mean,
    };
}
function treeEval(node, row) {
    let cur = node;
    while (cur.feat >= 0)
        cur = row[cur.feat] <= cur.thr ? cur.left : cur.right;
    return cur.value;
}
/** One-vs-rest gradient boosting on logistic loss, then softmax over margins. */
export function trainGbm(X, y, k, opts = {}) {
    const { rounds = 90, lr = 0.12, maxDepth = 2, minLeaf = 12, seed = 7 } = opts;
    const rng = mulberry32(seedOf('gbm', seed));
    const trees = [];
    const priors = [];
    for (let c = 0; c < k; c++) {
        const p0 = Math.min(0.98, Math.max(0.02, y.filter((v) => v === c).length / y.length));
        priors.push(Math.log(p0 / (1 - p0)));
        let f = new Array(X.length).fill(priors[c]);
        const forest = [];
        for (let r = 0; r < rounds; r++) {
            const residual = new Array(X.length).fill(0);
            for (let i = 0; i < X.length; i++) {
                const p = 1 / (1 + Math.exp(-f[i]));
                residual[i] = (y[i] === c ? 1 : 0) - p;
            }
            const idx = [];
            for (let i = 0; i < X.length; i++)
                if (rng.next() < 0.85)
                    idx.push(i);
            if (idx.length < 2 * minLeaf)
                idx.push(...Array.from({ length: X.length }, (_, i) => i).slice(0, 2 * minLeaf));
            const tree = fitTree(X, residual, idx, 0, maxDepth, minLeaf);
            forest.push(tree);
            for (let i = 0; i < X.length; i++)
                f[i] += lr * treeEval(tree, X[i]);
        }
        trees.push(forest);
    }
    return {
        name: `gbm(r${rounds},d${maxDepth})`,
        predictProba(Xn) {
            return Xn.map((row) => {
                const margins = trees.map((forest, c) => {
                    let f = priors[c];
                    for (const t of forest)
                        f += lr * treeEval(t, row);
                    return f;
                });
                return softmax(margins);
            });
        },
    };
}
export function argmax(p) {
    let best = 0;
    for (let i = 1; i < p.length; i++)
        if (p[i] > p[best])
            best = i;
    return best;
}
/** Ordinal read-out: expected level under the class distribution. */
export function expectedLevel(p, levels) {
    return p.reduce((s, v, i) => s + v * levels[i], 0);
}
