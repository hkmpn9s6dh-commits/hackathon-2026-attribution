// Gate B: assertions, not vibes. Every claim in the report is tied to a key in
// out/results.json or to a property of the code that can be re-derived here.
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { genDataset } from './dist/gen.js';
import { extractFeatures } from './dist/features.js';
import { crossValidate } from './dist/exp/core.js';
import { CLASSES, CONTROL } from './dist/schema.js';

const results = JSON.parse(readFileSync('out/results.json', 'utf8'));
const S = results.summary;
let pass = 0, fail = 0;
const failures = [];

function ok(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ok   ${name}${detail ? ` — ${detail}` : ''}`); }
  else { fail++; failures.push(`${name}${detail ? ` — ${detail}` : ''}`); console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`); }
}
function near(a, b, tol = 1e-9) { return Math.abs(a - b) <= tol; }

console.log('\nAC-01 reproducibility');
{
  const traces = genDataset({ orgsPerClass: results.meta.orgs_per_class, tracesPerOrg: results.meta.traces_per_org, level: 0 }, CLASSES);
  const h = createHash('sha256');
  for (const t of traces) {
    h.update(`${t.id}|`);
    for (const e of t.events) h.update(`${e.t.toFixed(3)},${e.type},${e.tool ?? ''},${e.target ?? ''},${e.chain ?? ''},${e.size ?? ''};`);
    h.update('\n');
  }
  ok('dataset L0 hash reproduces', h.digest('hex') === S.dataset_hash, S.dataset_hash.slice(0, 12));
  ok('report holds the same hash', results.dataset.hashes.L0 === S.dataset_hash);
}

console.log('\nAC-02 no leakage through the feature API');
{
  const traces = genDataset({ orgsPerClass: 4, tracesPerOrg: 2, level: 0 }, CLASSES);
  const stripped = traces.map((t) => ({ ...t, latent: undefined, cost: undefined }));
  let same = true, checked = 0;
  for (let i = 0; i < traces.length; i++) {
    const a = extractFeatures(traces[i].events).values;
    const b = extractFeatures(stripped[i].events).values;
    checked++;
    if (a.length !== b.length || a.some((v, j) => v !== b[j])) same = false;
  }
  ok('features identical with latent/cost removed', same, `${checked} traces`);
  const allowed = new Set(['t', 'type', 'tool', 'target', 'chain', 'size', 'textLen']);
  const keys = new Set(traces.flatMap((t) => t.events.flatMap((e) => Object.keys(e))));
  ok('event schema has no hidden label field', [...keys].every((k) => allowed.has(k)), [...keys].join(','));
}

console.log('\nAC-03 grouped folds');
{
  const traces = genDataset({ orgsPerClass: 6, tracesPerOrg: 2, level: 0 }, CLASSES);
  const b = crossValidate(traces, 'timing', 'gbm', { heads: ['control'] });
  const byOrg = new Map();
  traces.forEach((t, i) => {
    const f = b.fold[i];
    if (!byOrg.has(t.org)) byOrg.set(t.org, new Set());
    byOrg.get(t.org).add(f);
  });
  ok('every org lives in exactly one fold', [...byOrg.values()].every((s) => s.size === 1), `${byOrg.size} orgs`);
}

console.log('\nAC-04 chance is measured, not assumed');
ok('permuted intent AUC near 0.5', Math.abs(S.intent_auc_perm_mean - 0.5) <= 0.08, S.intent_auc_perm_mean.toFixed(3));
ok('permuted control rho near 0', Math.abs(S.control_rho_perm_mean) <= 0.12, S.control_rho_perm_mean.toFixed(3));

console.log('\nAC-05 the two channels carry different questions');
ok('timing recovers the leash', S.control_rho_timing_L0 >= 0.85, S.control_rho_timing_L0.toFixed(3));
ok('timing cannot recover intent inside a fixed leash', S.intent_auc_matched_timing <= 0.60, S.intent_auc_matched_timing.toFixed(3));
ok('targets recover intent', S.intent_auc_target_L0 >= 0.80, S.intent_auc_target_L0.toFixed(3));
ok('targets cannot recover the leash with intent fixed', S.control_rho_matched_target <= 0.25, S.control_rho_matched_target.toFixed(3));

console.log('\nAC-06 the naive read is inflated by the confound');
ok('naive timing-on-intent beats matched by >= 0.20', S.intent_auc_timing_L0 - S.intent_auc_matched_timing >= 0.20,
  `${S.intent_auc_timing_L0.toFixed(2)} vs ${S.intent_auc_matched_timing.toFixed(2)}`);

console.log('\nAC-07 evasion collapses the pair, and the frozen detector inverts');
ok('none vs tight separable at L0', S.none_vs_tight_timing_L0 >= 0.95, S.none_vs_tight_timing_L0.toFixed(2));
ok('none vs tight collapses at L1', S.none_vs_tight_timing_L1 <= 0.65, S.none_vs_tight_timing_L1.toFixed(2));
ok('frozen detector inverts at L3', S.control_rho_transfer_L3 <= -0.3, S.control_rho_transfer_L3.toFixed(2));
ok('matched pair (rogue L1 vs tight L0) is at chance', Math.abs(S.matched_rogueL1_vs_tightL0_timing - 0.5) <= 0.12,
  S.matched_rogueL1_vs_tightL0_timing.toFixed(2));

console.log('\nAC-08 disguises have a measurable price');
ok('waiting costs at least 30 s per action', S.delay_rogue_L1 - S.delay_rogue_L0 >= 30, `${S.delay_rogue_L1.toFixed(1)} s`);
ok('camouflage gives up at least a fifth of the sensitive surface',
  S.sensitive_nonbenign_L4 <= S.sensitive_nonbenign_L0 * 0.8,
  `${(S.sensitive_nonbenign_L0 * 100).toFixed(0)}% -> ${(S.sensitive_nonbenign_L4 * 100).toFixed(0)}%`);

console.log('\nAC-09 five-way is plausible, not perfect');
ok('macro-F1 in a believable band', S.five_f1_both_L0 >= 0.7 && S.five_f1_both_L0 <= 0.99, S.five_f1_both_L0.toFixed(3));

console.log('\nAC-10 report is a pure function of results.json');
try {
  execFileSync(process.execPath, ['scripts/report.mjs', '--check'], { stdio: 'pipe' });
  ok('report.html matches a fresh render', true);
} catch (e) {
  ok('report.html matches a fresh render', false, String(e.stdout || e.message).slice(0, 120));
}

console.log('\nAC-11 figures are real');
{
  const figs = ['fig1_testbed.svg', 'fig2_confusion.svg', 'fig3_channels.svg', 'fig4_ladder.svg', 'fig5_curve.svg'];
  for (const f of figs) {
    const p = `out/figures/${f}`;
    const exists = existsSync(p) && statSync(p).size > 2000;
    const texts = exists ? (readFileSync(p, 'utf8').match(/<text/g) || []).length : 0;
    ok(`${f} exists and has labels`, exists && texts >= 3, exists ? `${texts} labels` : 'missing');
  }
}

console.log('\nAC-12 the PDF fits the sprint limit');
{
  ok('report.pdf exists', existsSync('out/report.pdf'));
  if (existsSync('out/report.pdf')) {
    const buf = readFileSync('out/report.pdf');
    const pages = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    ok('at most 8 pages', pages > 0 && pages <= 8, `${pages} pages`);
  }
}

console.log('\nAC-13 the site is built and self-contained');
{
  const p = 'out/site/index.html';
  ok('site exists', existsSync(p) && statSync(p).size > 5000);
  if (existsSync(p)) {
    const html = readFileSync(p, 'utf8');
    ok('no external script tags', !/<script[^>]+src=/.test(html));
    ok('shows the headline number', html.includes(S.control_rho_timing_L0.toFixed(2)));
  }
}

console.log('\nAC-14 runtime stays inside a coffee break');
ok('full run under 400 s', S.runtime_s < 400, `${S.runtime_s.toFixed(0)} s`);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log(failures.map((f) => ` - ${f}`).join('\n')); process.exit(1); }
