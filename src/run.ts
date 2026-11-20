import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { FEATURE_NAMES } from './features.js';
import { genDataset } from './gen.js';
import { aucBinary, spearman } from './model/metrics.js';
import { expectedLevel } from './model/models.js';
import { CLASSES, CLASS_LABEL, CONTROL, EVASION_LABEL, NONBENIGN, type EvasionLevel, type Trace } from './schema.js';
import {
  buildX, crossValidate, evalConfig, pairwiseAuc, permutationImportance, scoreBundle, trainEval,
  type FeatureSet, type Metrics, type ModelKind,
} from './exp/core.js';
import { trainGbm } from './model/models.js';

const ORGS = 30;
const TRACES_PER_ORG = 4;
const LEVELS: EvasionLevel[] = [0, 1, 2, 3, 4];
const FEATURE_SETS: FeatureSet[] = ['timing', 'target', 'both'];

function hashEvents(traces: Trace[]): string {
  const h = createHash('sha256');
  for (const t of traces) {
    h.update(`${t.id}|`);
    for (const e of t.events) {
      h.update(`${e.t.toFixed(3)},${e.type},${e.tool ?? ''},${e.target ?? ''},${e.chain ?? ''},${e.size ?? ''};`);
    }
    h.update('\n');
  }
  return h.digest('hex');
}

function stamp(t0: number, label: string): void {
  console.error(`${label} ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

function main(): void {
  const t0 = Date.now();
  const report: Record<string, any> = {
    meta: {
      title: 'The leash, not the hand',
      orgs_per_class: ORGS,
      traces_per_org: TRACES_PER_ORG,
      traces_per_level: CLASSES.length * ORGS * TRACES_PER_ORG,
      fold_count: 5,
      features: FEATURE_NAMES,
      class_order: [...CLASSES].sort(),
      classes: CLASSES.map((c) => ({ key: c, label: CLASS_LABEL[c], control: CONTROL[c] })),
      evasion_levels: LEVELS.map((l) => ({ level: l, label: EVASION_LABEL[l] })),
    },
  };

  const sets = new Map<EvasionLevel, Trace[]>();
  const hashes: Record<string, string> = {};
  for (const level of LEVELS) {
    const traces = genDataset({ orgsPerClass: ORGS, tracesPerOrg: TRACES_PER_ORG, level }, CLASSES);
    sets.set(level, traces);
    hashes[`L${level}`] = hashEvents(traces);
  }
  report.dataset = {
    hashes,
    events_per_level: sets.get(0)!.reduce((s, t) => s + t.events.length, 0),
    paired: true,
  };
  stamp(t0, 'dataset');

  // --- Main comparison at L0 -------------------------------------------------
  const main: Record<string, Metrics> = {};
  const spreads: Record<string, { auc: number[]; rho: number[] }> = {};
  for (const set of FEATURE_SETS) {
    for (const kind of ['logreg', 'gbm'] as ModelKind[]) {
      const b = crossValidate(sets.get(0)!, set, kind);
      main[`${set}/${kind}`] = scoreBundle(b);
      const folds = [...new Set(b.fold)].sort((x, y) => x - y);
      spreads[`${set}/${kind}`] = {
        rho: folds.map((f) => {
          const idx = b.fold.map((v, i) => (v === f ? i : -1)).filter((i) => i >= 0);
          return spearman(idx.map((i) => expectedLevel(b.p4[i], [0, 1, 2, 3])), idx.map((i) => b.y4[i]));
        }),
        auc: folds.map((f) => {
          const idx = b.fold.map((v, i) => (v === f ? i : -1)).filter((i) => i >= 0);
          return aucBinary(idx.map((i) => b.p2[i][1]), idx.map((i) => b.y2[i]));
        }),
      };
    }
  }
  report.main = { level: 0, results: main, fold_spread: spreads };
  stamp(t0, 'main');

  // --- Evasion ladder: retrained in-distribution + transferred from L0 -------
  const ladder: Record<string, any> = {};
  for (const level of LEVELS) {
    const traces = sets.get(level)!;
    const row: Record<string, any> = {};
    for (const set of FEATURE_SETS) {
      const b = crossValidate(traces, set, 'gbm', { heads: ['control', 'intent'] });
      row[`${set}/gbm`] = scoreBundle(b);
      row[`${set}/pairs`] = {
        none_vs_tight: pairwiseAuc(b, 0, 3),
        none_vs_loose: pairwiseAuc(b, 0, 2),
        loose_vs_tight: pairwiseAuc(b, 2, 3),
      };
    }
    // transfer: a detector fitted at L0 and deployed unchanged
    const tr = trainEval(sets.get(0)!, traces, 'both', 'gbm');
    row.transfer_both = scoreBundle(tr);
    row.transfer_pairs = {
      none_vs_tight: pairwiseAuc(tr, 0, 3),
      none_vs_loose: pairwiseAuc(tr, 0, 2),
      loose_vs_tight: pairwiseAuc(tr, 2, 3),
    };
    ladder[`L${level}`] = row;
  }
  report.ladder = ladder;
  stamp(t0, 'ladder');

  // --- Price of the disguise -------------------------------------------------
  const cost: Record<string, any> = {};
  for (const level of LEVELS) {
    const traces = sets.get(level)!;
    const byClass: Record<string, { delay: number; per_hour: number; sensitive: number }> = {};
    for (const k of CLASSES) {
      const rows = traces.filter((t) => t.klass === k);
      const avg = (f: (t: Trace) => number) => rows.reduce((s, t) => s + f(t), 0) / rows.length;
      byClass[k] = {
        delay: avg((t) => t.cost.mean_delay_s),
        per_hour: avg((t) => t.cost.actions_per_hour),
        sensitive: avg((t) => t.cost.sensitive_share),
      };
    }
    cost[`L${level}`] = byClass;
  }
  report.cost = cost;

  // --- Matched pairs: same mixture weight, different actor -------------------
  function matchedPair(a: Trace[], b: Trace[], set: FeatureSet): number {
    const rows = [...a.map((t) => ({ t, y: 0 })), ...b.map((t) => ({ t, y: 1 }))];
    const X = buildX(rows.map((r) => r.t), set);
    const y = rows.map((r) => r.y);
    const orgs = [...new Set(rows.map((r) => r.t.org))].sort();
    const even = new Set(orgs.filter((_, i) => i % 2 === 0));
    const tr = rows.map((_, i) => i).filter((i) => even.has(rows[i].t.org));
    const te = rows.map((_, i) => i).filter((i) => !even.has(rows[i].t.org));
    const m = trainGbm(tr.map((i) => X[i]), tr.map((i) => y[i]), 2, { rounds: 45 });
    const p = m.predictProba(te.map((i) => X[i]));
    return aucBinary(p.map((r) => r[1]), te.map((i) => y[i]));
  }
  const byClass = (level: EvasionLevel, k: (typeof CLASSES)[number]) => sets.get(level)!.filter((t) => t.klass === k);
  report.matched_pairs = {
    rogue_L1_vs_tight_L0: {
      timing: matchedPair(byClass(1, 'rogue'), byClass(0, 'tight_nonbenign'), 'timing'),
      both: matchedPair(byClass(1, 'rogue'), byClass(0, 'tight_nonbenign'), 'both'),
    },
    tight_L2_vs_rogue_L0: {
      timing: matchedPair(byClass(2, 'tight_nonbenign'), byClass(0, 'rogue'), 'timing'),
      both: matchedPair(byClass(2, 'tight_nonbenign'), byClass(0, 'rogue'), 'both'),
    },
  };
  stamp(t0, 'matched');

  // --- Intent inside a fixed leash: the matched comparison -------------------
  const looseOnly = sets.get(0)!.filter((t) => CONTROL[t.klass] === 2);
  report.matched_intent = {
    note: 'restricted to the two classes that share a leash (C and E)',
    n: looseOnly.length,
    timing: evalConfig(looseOnly, 'timing', 'gbm', { heads: ['intent'] }).intent.auc,
    target: evalConfig(looseOnly, 'target', 'gbm', { heads: ['intent'] }).intent.auc,
    both: evalConfig(looseOnly, 'both', 'gbm', { heads: ['intent'] }).intent.auc,
  };
  stamp(t0, 'matched-intent');

  const nonbenignOnly = sets.get(0)!.filter((t) => NONBENIGN[t.klass]);
  report.matched_control = {
    note: 'restricted to the three non-benign classes (leash 0/2/3), intent held fixed',
    n: nonbenignOnly.length,
    timing: evalConfig(nonbenignOnly, 'timing', 'gbm', { heads: ['control'] }).control.rho,
    target: evalConfig(nonbenignOnly, 'target', 'gbm', { heads: ['control'] }).control.rho,
  };
  stamp(t0, 'matched-control');

  // --- How many actions do you need? ----------------------------------------
  const counts = [10, 20, 40, 80, 160];
  const curve: Record<string, any[]> = {};
  for (const level of [0, 3] as EvasionLevel[]) {
    const traces = sets.get(level)!;
    const rows: any[] = [];
    for (const k of counts) {
      const sub = traces.map((t) => ({ ...t, events: prefixEvents(t, k) }));
      const m = evalConfig(sub, 'both', 'gbm', { heads: ['control', 'intent'] });
      rows.push({ actions: k, control_rho: m.control.rho, intent_auc: m.intent.auc });
    }
    curve[`L${level}`] = rows;
  }
  report.curve = curve;
  stamp(t0, 'curve');

  // --- Chance floor ----------------------------------------------------------
  const perm: any[] = [];
  for (let s = 1; s <= 5; s++) {
    const m = evalConfig(sets.get(0)!, 'both', 'gbm', { heads: ['control', 'intent'], shuffleSeed: s * 977 });
    perm.push({ seed: s * 977, control_rho: m.control.rho, intent_auc: m.intent.auc });
  }
  report.permutation = perm;
  stamp(t0, 'perm');

  report.importance = permutationImportance(sets.get(0)!, 'both', 'gbm', 2);
  stamp(t0, 'importance');

  const L = (l: string, k: string) => ladder[l][k] as Metrics;
  const T = (l: string) => ladder[l].transfer_both as Metrics;
  report.summary = {
    control_rho_timing_L0: L('L0', 'timing/gbm').control.rho,
    control_rho_target_L0: L('L0', 'target/gbm').control.rho,
    control_rho_both_L0: L('L0', 'both/gbm').control.rho,
    intent_auc_timing_L0: L('L0', 'timing/gbm').intent.auc,
    intent_auc_target_L0: L('L0', 'target/gbm').intent.auc,
    intent_auc_both_L0: L('L0', 'both/gbm').intent.auc,
    five_f1_both_L0: main['both/gbm'].five.macroF1,
    control_rho_both_L2: L('L2', 'both/gbm').control.rho,
    control_rho_both_L3: L('L3', 'both/gbm').control.rho,
    control_rho_timing_L3: L('L3', 'timing/gbm').control.rho,
    control_rho_transfer_L1: T('L1').control.rho,
    control_rho_transfer_L2: T('L2').control.rho,
    control_rho_transfer_L3: T('L3').control.rho,
    intent_auc_both_L4: L('L4', 'both/gbm').intent.auc,
    intent_auc_target_L4: L('L4', 'target/gbm').intent.auc,
    none_vs_tight_timing_L0: ladder.L0['timing/pairs'].none_vs_tight,
    none_vs_tight_timing_L1: ladder.L1['timing/pairs'].none_vs_tight,
    none_vs_tight_timing_L2: ladder.L2['timing/pairs'].none_vs_tight,
    none_vs_tight_timing_L3: ladder.L3['timing/pairs'].none_vs_tight,
    intent_auc_perm_mean: perm.reduce((s, p) => s + p.intent_auc, 0) / perm.length,
    control_rho_perm_mean: perm.reduce((s, p) => s + p.control_rho, 0) / perm.length,
    delay_rogue_L0: cost.L0.rogue.delay,
    delay_rogue_L1: cost.L1.rogue.delay,
    sensitive_nonbenign_L0: (cost.L0.loose_nonbenign.sensitive + cost.L0.tight_nonbenign.sensitive + cost.L0.rogue.sensitive) / 3,
    sensitive_nonbenign_L4: (cost.L4.loose_nonbenign.sensitive + cost.L4.tight_nonbenign.sensitive + cost.L4.rogue.sensitive) / 3,
    control_rho_matched_target: report.matched_control.target,
    intent_auc_matched_timing: report.matched_intent.timing,
    intent_auc_matched_target: report.matched_intent.target,
    matched_rogueL1_vs_tightL0_timing: report.matched_pairs.rogue_L1_vs_tight_L0.timing,
    matched_tightL2_vs_rogueL0_timing: report.matched_pairs.tight_L2_vs_rogue_L0.timing,
    dataset_hash: hashes.L0,
    runtime_s: 0,
  };
  report.summary.runtime_s = (Date.now() - t0) / 1000;

  mkdirSync('out', { recursive: true });
  writeFileSync('out/results.json', JSON.stringify(report, null, 2));
  console.log(`wrote out/results.json in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(JSON.stringify(report.summary, null, 2));
}

function prefixEvents(t: Trace, k: number) {
  const actions = t.events.filter((e) => e.type === 'action');
  if (actions.length <= k) return t.events;
  const cutoff = actions[k - 1].t;
  return t.events.filter((e) => e.t <= cutoff);
}

main();
