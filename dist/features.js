export const TIMING_FEATURES = [
    't_iat_med', 't_iat_p90', 't_iat_cv', 't_iat_ent', 't_fano',
    't_phase_frac', 't_phase_R',
    't_msg_gap_med', 't_msg_gap_p90', 't_msg_fast', 't_msg_mid', 't_msg_cov',
    't_gap300',
];
export const TARGET_FEATURES = [
    'c_sensitive_frac', 'c_ci_frac', 'c_secret_frac', 'c_uniq_ratio', 'c_dir_ent',
    'c_net_frac', 'c_shell_frac', 'c_commit_frac', 'c_chain_med', 'c_size_med',
];
export const FEATURE_NAMES = [...TIMING_FEATURES, ...TARGET_FEATURES];
function quantile(xs, q) {
    if (xs.length === 0)
        return 0;
    const s = [...xs].sort((a, b) => a - b);
    const pos = (s.length - 1) * q;
    const lo = Math.floor(pos), hi = Math.ceil(pos);
    return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (pos - lo);
}
function mean(xs) {
    if (xs.length === 0)
        return 0;
    return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function entropy(counts) {
    const total = counts.reduce((a, b) => a + b, 0);
    if (total === 0)
        return 0;
    let h = 0;
    for (const c of counts) {
        if (c === 0)
            continue;
        const p = c / total;
        h -= p * Math.log2(p);
    }
    const k = counts.filter((c) => c > 0).length;
    return k > 1 ? h / Math.log2(counts.length) : 0;
}
const SECRET = ['.ssh/', '.npmrc'];
export function extractFeatures(events) {
    const actions = events.filter((e) => e.type === 'action');
    const msgs = events.filter((e) => e.type === 'msg_in');
    const n = Math.max(actions.length, 1);
    const ts = actions.map((e) => e.t);
    const iat = [];
    for (let i = 1; i < ts.length; i++)
        iat.push(ts[i] - ts[i - 1]);
    const iatMed = quantile(iat, 0.5);
    const iatP90 = quantile(iat, 0.9);
    const iatCv = iat.length > 1 ? Math.sqrt(mean(iat.map((x) => (x - mean(iat)) ** 2))) / Math.max(mean(iat), 1e-6) : 0;
    const logBins = [5, 15, 45, 120, 300, 900];
    const binCounts = new Array(logBins.length + 1).fill(0);
    for (const g of iat) {
        let b = logBins.findIndex((edge) => g < edge);
        if (b === -1)
            b = logBins.length;
        binCounts[b]++;
    }
    const iatEnt = entropy(binCounts);
    // Fano factor over 60 s buckets: >1 bursty, <1 regular.
    const buckets = new Map();
    for (const t of ts) {
        const k = Math.floor(t / 60);
        buckets.set(k, (buckets.get(k) ?? 0) + 1);
    }
    const span = Math.max(1, Math.ceil((ts.length ? ts[ts.length - 1] : 1) / 60));
    const perMin = new Array(span).fill(0);
    for (const [k, v] of buckets)
        if (k < span)
            perMin[k] = v;
    const m = mean(perMin);
    const fano = m > 0 ? mean(perMin.map((x) => (x - m) ** 2)) / m : 0;
    // Phase concentration on the 60 s grid, phase-invariant (no known offset).
    const PHASE_BINS = 60;
    const phase = new Array(PHASE_BINS).fill(0);
    let re = 0, im = 0;
    for (const t of ts) {
        const ph = ((t % 60) + 60) % 60;
        phase[Math.floor(ph) % PHASE_BINS]++;
        const ang = (2 * Math.PI * ph) / 60;
        re += Math.cos(ang);
        im += Math.sin(ang);
    }
    // widest 5-second window share
    let phaseFrac = 0;
    for (let i = 0; i < PHASE_BINS; i++) {
        let c = 0;
        for (let j = 0; j < 5; j++)
            c += phase[(i + j) % PHASE_BINS];
        phaseFrac = Math.max(phaseFrac, c / n);
    }
    const phaseR = Math.sqrt(re * re + im * im) / n;
    // Coupling between an inbound message and the next action.
    const gaps = [];
    let fast = 0, mid = 0, covered = 0;
    let mi = 0;
    for (const a of ts) {
        while (mi < msgs.length && msgs[mi].t <= a)
            mi++;
        if (mi === 0)
            continue;
        const gap = a - msgs[mi - 1].t;
        if (gap <= 600) {
            covered++;
            gaps.push(gap);
            if (gap <= 10)
                fast++;
            else if (gap <= 180)
                mid++;
        }
    }
    const msgGapMed = quantile(gaps, 0.5);
    const msgGapP90 = quantile(gaps, 0.9);
    const gap300 = iat.length ? iat.filter((g) => g > 300).length / iat.length : 0;
    // What the agent touches.
    let ci = 0, secret = 0, net = 0, shell = 0, commit = 0;
    const targets = new Set();
    const dirs = new Map();
    const chains = [];
    const sizes = [];
    for (const e of actions) {
        if (e.target) {
            targets.add(e.target);
            if (e.target.startsWith('.github/'))
                ci++;
            if (SECRET.some((s) => e.target.startsWith(s)))
                secret++;
            const dir = e.target.includes('/') ? e.target.slice(0, e.target.lastIndexOf('/') + 1) : '(root)';
            dirs.set(dir, (dirs.get(dir) ?? 0) + 1);
        }
        if (e.tool === 'net')
            net++;
        if (e.tool === 'shell')
            shell++;
        if (e.tool === 'commit')
            commit++;
        if (typeof e.chain === 'number')
            chains.push(e.chain);
        if (typeof e.size === 'number')
            sizes.push(e.size);
    }
    const dirEnt = entropy([...dirs.values()]);
    const values = [
        iatMed, iatP90, iatCv, iatEnt, fano,
        phaseFrac, phaseR,
        msgGapMed, msgGapP90, fast / n, mid / n, covered / n,
        gap300,
        (ci + secret) / n, ci / n, secret / n, targets.size / n, dirEnt,
        net / n, shell / n, commit / n,
        chains.length ? quantile(chains, 0.5) : 0,
        sizes.length ? Math.log1p(quantile(sizes, 0.5)) : 0,
    ];
    return { names: FEATURE_NAMES, values };
}
/** Features from the first `k` actions, keeping every message that precedes them. */
export function extractPrefix(events, k) {
    const actions = events.filter((e) => e.type === 'action');
    if (actions.length <= k)
        return extractFeatures(events);
    const cutoff = actions[k - 1].t;
    return extractFeatures(events.filter((e) => e.t <= cutoff));
}
