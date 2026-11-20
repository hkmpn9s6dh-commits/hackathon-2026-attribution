import { extractFeatures, FEATURE_NAMES, TARGET_FEATURES, TIMING_FEATURES } from '../features.js';
import { accuracy, aucBinary, balancedAccuracy, confusion, macroAuc, macroF1, spearman, withinOne } from '../model/metrics.js';
import { argmax, expectedLevel, trainGbm, trainLogReg, type ProbModel } from '../model/models.js';
import { CONTROL, NONBENIGN, type ActorClass, type Trace } from '../schema.js';

export type FeatureSet = 'timing' | 'target' | 'both';
export type ModelKind = 'logreg' | 'gbm';
export type Head = 'five' | 'control' | 'intent';

export interface Metrics {
  five: { acc: number; macroF1: number; balAcc: number; confusion: number[][]; recall: number[] };
  control: { acc: number; within1: number; rho: number; confusion: number[][] };
  intent: { auc: number; acc: number; balAcc: number; confusion: number[][] };
}

const FOLD_COUNT = 5;
const LEVELS = [0, 1, 2, 3];

export function columnsFor(set: FeatureSet): number[] {
  if (set === 'timing') return TIMING_FEATURES.map((n) => FEATURE_NAMES.indexOf(n));
  if (set === 'target') return TARGET_FEATURES.map((n) => FEATURE_NAMES.indexOf(n));
  return FEATURE_NAMES.map((_, i) => i);
}

export function buildX(traces: Trace[], set: FeatureSet): number[][] {
  const cols = columnsFor(set);
  return traces.map((t) => {
    const f = extractFeatures(t.events);
    return cols.map((c) => f.values[c]);
  });
}

function train(kind: ModelKind, X: number[][], y: number[], k: number, seed = 11): ProbModel {
  return kind === 'logreg' ? trainLogReg(X, y, k) : trainGbm(X, y, k, { seed, rounds: 45 });
}

export interface FoldBundle {
  y5: number[]; p5: number[][];
  y4: number[]; p4: number[][];
  y2: number[]; p2: number[][];
  fold: number[];
}

function foldsOf(traces: Trace[]): Map<string, number> {
  const orgs = [...new Set(traces.map((t) => t.org))].sort();
  return new Map(orgs.map((o, i) => [o, i % FOLD_COUNT]));
}

function labelsFor(
  traces: Trace[], shuffleSeed?: number,
): { y5: number[]; y4: number[]; y2: number[]; classes: ActorClass[] } {
  const classes: ActorClass[] = [...new Set(traces.map((t) => t.klass))].sort();
  if (shuffleSeed === undefined) {
    return {
      classes,
      y5: traces.map((t) => classes.indexOf(t.klass)),
      y4: traces.map((t) => CONTROL[t.klass]),
      y2: traces.map((t) => (NONBENIGN[t.klass] ? 1 : 0)),
    };
  }
  const orgs = [...new Set(traces.map((t) => t.org))].sort();
  const klassOf = new Map(traces.map((t) => [t.org, t.klass]));
  const labels = orgs.map((o) => klassOf.get(o)!);
  let s = shuffleSeed;
  for (let i = labels.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const j = s % (i + 1);
    const tmp = labels[i]; labels[i] = labels[j]; labels[j] = tmp;
  }
  const permuted = new Map(orgs.map((o, i) => [o, labels[i]]));
  return {
    classes,
    y5: traces.map((t) => classes.indexOf(permuted.get(t.org)!)),
    y4: traces.map((t) => CONTROL[permuted.get(t.org)!]),
    y2: traces.map((t) => (NONBENIGN[permuted.get(t.org)!] ? 1 : 0)),
  };
}

const ALL_HEADS: Head[] = ['five', 'control', 'intent'];

/** Grouped k-fold: an org is never split across train and test. */
export function crossValidate(
  traces: Trace[], set: FeatureSet, kind: ModelKind,
  opts: { heads?: Head[]; shuffleSeed?: number } = {},
): FoldBundle {
  const heads = opts.heads ?? ALL_HEADS;
  const X = buildX(traces, set);
  const foldOf = foldsOf(traces);
  const { y5, y4, y2, classes } = labelsFor(traces, opts.shuffleSeed);
  const p5: number[][] = [], p4: number[][] = [], p2: number[][] = [];
  const fold: number[] = new Array(traces.length).fill(-1);

  for (let f = 0; f < FOLD_COUNT; f++) {
    const tr: number[] = [], te: number[] = [];
    traces.forEach((t, i) => (foldOf.get(t.org) === f ? te : tr).push(i));
    if (te.length === 0 || tr.length === 0) continue;
    const Xtr = tr.map((i) => X[i]), Xte = te.map((i) => X[i]);
    te.forEach((i) => (fold[i] = f));

    if (heads.includes('five')) {
      const out = train(kind, Xtr, tr.map((i) => y5[i]), classes.length).predictProba(Xte);
      te.forEach((i, j) => (p5[i] = out[j]));
    }
    if (heads.includes('control')) {
      const out = train(kind, Xtr, tr.map((i) => y4[i]), 4).predictProba(Xte);
      te.forEach((i, j) => (p4[i] = out[j]));
    }
    if (heads.includes('intent')) {
      const out = train(kind, Xtr, tr.map((i) => y2[i]), 2).predictProba(Xte);
      te.forEach((i, j) => (p2[i] = out[j]));
    }
  }

  return { y5, p5, y4, p4, y2, p2, fold };
}

/** Train on one level, score on another: the transfer test. */
export function trainEval(
  trainTraces: Trace[], testTraces: Trace[], set: FeatureSet, kind: ModelKind,
): FoldBundle {
  const Xtr = buildX(trainTraces, set);
  const Xte = buildX(testTraces, set);
  const trLab = labelsFor(trainTraces);
  const teLab = labelsFor(testTraces);
  const p5: number[][] = [], p4: number[][] = [], p2: number[][] = [];

  {
    const m = train(kind, Xtr, trLab.y5, trLab.classes.length);
    const out = m.predictProba(Xte);
    out.forEach((row, i) => {
      const remapped = new Array(teLab.classes.length).fill(0);
      trLab.classes.forEach((c, j) => {
        const idx = teLab.classes.indexOf(c);
        if (idx >= 0) remapped[idx] = row[j];
      });
      p5[i] = remapped;
    });
  }
  {
    const m = train(kind, Xtr, trLab.y4, 4);
    m.predictProba(Xte).forEach((row, i) => (p4[i] = row));
  }
  {
    const m = train(kind, Xtr, trLab.y2, 2);
    m.predictProba(Xte).forEach((row, i) => (p2[i] = row));
  }

  return { y5: teLab.y5, p5, y4: teLab.y4, p4, y2: teLab.y2, p2, fold: new Array(testTraces.length).fill(0) };
}

export function scoreBundle(b: FoldBundle): Metrics {
  const k5 = b.p5.length ? b.p5[0].length : 5;
  const c5 = b.p5.length ? confusion(b.y5, b.p5.map(argmax), k5) : [];
  const recall = c5.map((row, i) => {
    const s = row.reduce((a, v) => a + v, 0);
    return s === 0 ? 0 : row[i] / s;
  });
  const y4hat = b.p4.map((p) => argmax(p));
  const y4exp = b.p4.map((p) => expectedLevel(p, LEVELS));
  const y2p = b.p2.map((p) => argmax(p));

  return {
    five: b.p5.length
      ? {
        acc: accuracy(b.y5, b.p5.map(argmax)),
        macroF1: macroF1(b.y5, b.p5.map(argmax), k5),
        balAcc: balancedAccuracy(b.y5, b.p5.map(argmax), k5),
        confusion: c5,
        recall,
      }
      : { acc: 0, macroF1: 0, balAcc: 0, confusion: [], recall: [] },
    control: b.p4.length
      ? {
        acc: accuracy(b.y4, y4hat),
        within1: withinOne(b.y4, y4hat),
        rho: spearman(y4exp, b.y4),
        confusion: confusion(b.y4, y4hat, 4),
      }
      : { acc: 0, within1: 0, rho: 0, confusion: [] },
    intent: b.p2.length
      ? {
        auc: macroAuc(b.p2, b.y2, 2),
        acc: accuracy(b.y2, y2p),
        balAcc: balancedAccuracy(b.y2, y2p, 2),
        confusion: confusion(b.y2, y2p, 2),
      }
      : { auc: 0, acc: 0, balAcc: 0, confusion: [] },
  };
}

export function evalConfig(
  traces: Trace[], set: FeatureSet, kind: ModelKind,
  opts: { heads?: Head[]; shuffleSeed?: number } = {},
): Metrics {
  return scoreBundle(crossValidate(traces, set, kind, opts));
}

/** Separability of one ordered pair, read off the ordinal control model. */
export function pairwiseAuc(b: FoldBundle, lowLevel: number, highLevel: number): number {
  const scores: number[] = [], labels: number[] = [];
  for (let i = 0; i < b.y4.length; i++) {
    if (b.y4[i] === lowLevel) { scores.push(expectedLevel(b.p4[i], LEVELS)); labels.push(0); }
    else if (b.y4[i] === highLevel) { scores.push(expectedLevel(b.p4[i], LEVELS)); labels.push(1); }
  }
  return aucBinary(scores, labels);
}

/** Permutation importance: macro-F1 drop when one column is rotated on the test fold. */
export function permutationImportance(
  traces: Trace[], set: FeatureSet, kind: ModelKind, repeats = 2,
): { name: string; drop: number }[] {
  const X = buildX(traces, set);
  const names = columnsFor(set).map((i) => FEATURE_NAMES[i]);
  const foldOf = foldsOf(traces);
  const { y5, classes } = labelsFor(traces);
  const drops = new Array(names.length).fill(0);
  let foldsUsed = 0;

  for (let f = 0; f < FOLD_COUNT; f++) {
    const tr: number[] = [], te: number[] = [];
    traces.forEach((t, i) => (foldOf.get(t.org) === f ? te : tr).push(i));
    if (te.length === 0 || tr.length === 0) continue;
    const Xtr = tr.map((i) => X[i]);
    const Xte = te.map((i) => X[i]);
    const yTe = te.map((i) => y5[i]);
    const m = train(kind, Xtr, tr.map((i) => y5[i]), classes.length);
    const base = macroF1(yTe, m.predictProba(Xte).map(argmax), classes.length);
    for (let j = 0; j < names.length; j++) {
      for (let r = 0; r < repeats; r++) {
        const Xp = Xte.map((row) => [...row]);
        const col = Xp.map((row) => row[j]);
        const shift = 1 + ((r * 7 + f * 3) % Math.max(1, col.length - 1));
        for (let i = 0; i < Xp.length; i++) Xp[i][j] = col[(i + shift) % col.length];
        const f1 = macroF1(yTe, m.predictProba(Xp).map(argmax), classes.length);
        drops[j] += (base - f1) / repeats;
      }
    }
    foldsUsed++;
  }

  return names.map((name, j) => ({ name, drop: foldsUsed ? drops[j] / foldsUsed : 0 }))
    .sort((a, b) => b.drop - a.drop);
}
