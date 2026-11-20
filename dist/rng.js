export function mulberry32(seed) {
    let a = seed >>> 0;
    const next = () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const norm = (mu = 0, sd = 1) => {
        // Box-Muller with a fixed pairing; guarded against u=0
        const u = Math.max(next(), 1e-12);
        const v = next();
        return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    return {
        next,
        int: (n) => Math.floor(next() * n),
        norm,
        lognorm: (median, sigma) => Math.exp(Math.log(median) + sigma * norm(0, 1)),
        pick: (xs) => xs[Math.floor(next() * xs.length)],
        bern: (p) => next() < p,
    };
}
export function hashString(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
}
export function seedOf(...parts) {
    return hashString(parts.join('|'));
}
