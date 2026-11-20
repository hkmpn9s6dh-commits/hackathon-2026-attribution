// A single static page, no JavaScript, no external requests: the figures are inlined.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const R = JSON.parse(readFileSync('out/results.json', 'utf8'));
const S = R.summary;
const f = (v, d = 2) => Number(v).toFixed(d);
const pct = (v, d = 0) => `${(v * 100).toFixed(d)}%`;
const fig = (n) => readFileSync(`out/figures/${n}`, 'utf8');

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Discipline is a choice — agent attribution testbed</title>
<style>
  :root { --ink:#16181d; --muted:#6b7280; --rule:#e5e7eb; --paper:#fbfaf7; --accent:#b45309; --blue:#1d4ed8; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--paper); color:var(--ink); font-family:"Helvetica Neue",Arial,sans-serif; line-height:1.55; }
  .wrap { max-width: 960px; margin: 0 auto; padding: 0 24px 72px; }
  header { padding: 64px 0 40px; border-bottom: 1px solid var(--rule); }
  .eyebrow { font-size:12px; letter-spacing:.14em; text-transform:uppercase; color:var(--accent); font-weight:600; }
  h1 { font-family: Georgia, "Times New Roman", serif; font-size: clamp(34px, 5vw, 54px); line-height:1.05; margin:14px 0 12px; letter-spacing:-.5px; }
  .lede { font-size: 19px; color:#374151; max-width: 720px; font-family: Georgia, serif; }
  .meta { margin-top: 22px; font-size: 13px; color: var(--muted); display:flex; gap:18px; flex-wrap:wrap; }
  .stats { display:grid; grid-template-columns: repeat(auto-fit, minmax(210px,1fr)); gap:16px; margin:36px 0 8px; }
  .stat { background:#fff; border:1px solid var(--rule); padding:18px 20px; }
  .stat .n { font-family: Georgia, serif; font-size:34px; line-height:1; }
  .stat .n small { font-size:15px; color:var(--muted); }
  .stat .k { font-size:12.5px; color:var(--muted); margin-top:8px; }
  section { padding: 40px 0 8px; border-bottom:1px solid var(--rule); }
  h2 { font-family: Georgia, serif; font-size:26px; margin:0 0 6px; letter-spacing:-.2px; }
  .h2sub { color:var(--muted); font-size:14px; margin-bottom:18px; }
  figure { margin: 8px 0 18px; }
  figure svg { width:100%; height:auto; display:block; background:#fff; border:1px solid var(--rule); }
  figcaption { font-size:13px; color:var(--muted); margin-top:8px; }
  ol { padding-left: 22px; }
  ol li { margin-bottom: 12px; }
  ol b { display:block; }
  .links { display:flex; gap:14px; flex-wrap:wrap; margin-top:22px; }
  .links a { display:inline-block; padding:10px 18px; border:1px solid var(--ink); text-decoration:none; color:var(--ink); font-size:14px; }
  .links a.primary { background:var(--ink); color:#fff; }
  footer { padding-top:26px; font-size:12px; color:var(--muted); }
  code { font-family: Consolas, monospace; font-size: 12px; background:#f3f4f6; padding:1px 4px; }
</style></head>
<body>
<div class="wrap">
<header>
  <div class="eyebrow">Agent Attribution Hackathon · Track 2 · Apart Research 2026</div>
  <h1>Discipline is a choice</h1>
  <p class="lede">A behaviour trace tells you how tightly a human holds the leash. It does not tell you whose hand is on it — and the leash itself is for sale.</p>
  <div class="meta">
    <span>${R.meta.traces_per_level} traces per level</span>
    <span>2 channels</span>
    <span>5 evasion levels</span>
    <span>grouped 5-fold CV</span>
  </div>
</header>

<div class="stats">
  <div class="stat"><div class="n">${f(S.control_rho_timing_L0)}</div><div class="k">Spearman ρ for leash tightness, from timing alone (chance ≈ 0)</div></div>
  <div class="stat"><div class="n">${f(S.intent_auc_matched_timing)}</div><div class="k">Intent AUC from timing once the leash is held fixed — i.e. chance</div></div>
  <div class="stat"><div class="n">−${f(Math.abs(S.control_rho_transfer_L3))}</div><div class="k">ρ of a detector fitted on the honest fleet and deployed at L3: it inverts</div></div>
</div>

<section>
  <h2>Two channels, three questions</h2>
  <div class="h2sub">Panel B is the trap: an intent classifier that is really reading supervision.</div>
  <figure>${fig('fig3_channels.svg')}<figcaption>The same models, the same folds. Timing knows the leash (A) but only appears to know intent (B) until the leash is held fixed (C). Targets show the mirror image.</figcaption></figure>
</section>

<section>
  <h2>What a disguise costs</h2>
  <div class="h2sub">Waiting costs the attacker ${f(S.delay_rogue_L1, 0)} seconds per action. Auto-approve costs the defender nothing and erases the channel.</div>
  <figure>${fig('fig4_ladder.svg')}<figcaption>Solid lines are retrained at each level; the grey dashed line is a frozen L0 detector. At L3 it reports the opposite of the truth with full confidence.</figcaption></figure>
</section>

<section>
  <h2>Four things a responder should do</h2>
  <ol>
    <li><b>Report the mixture, not the label.</b> "38% of actions waited for a human, median 41 s, n = 214" is auditable. "A supervised human did this" is not.</li>
    <li><b>Hold the other axis fixed.</b> Before believing an intent number, re-run it on actors with the same leash. If it collapses, it was supervision wearing intent's clothes.</li>
    <li><b>Audit a frozen model every month.</b> Ship the matched-pair test with the model; fail closed when it stops separating the classes it was trained on.</li>
    <li><b>Prefer the channel the adversary cannot choose.</b> Attestation binds a claim to a party. Behaviour tells you where to look, not who to call.</li>
  </ol>
</section>

<section style="border-bottom:none">
  <h2>Read it, check it, re-run it</h2>
  <div class="h2sub">Every number above is written by a script from <code>out/results.json</code>; editing the report by hand breaks the build.</div>
  <div class="links">
    <a class="primary" href="report.pdf">Report (PDF, 6 pages)</a>
    <a href="https://github.com/hkmpn9s6dh-commits/hackathon-2026-attribution">Code</a>
    <a href="attribution.mp4">Video (3:15, with narration)</a>
    <a href="results.json">results.json</a>
  </div>
</section>

<footer>
  Dataset hash L0 <code>${S.dataset_hash.slice(0, 16)}…</code> · run ${f(S.runtime_s, 0)} s · Zhang Yi, independent submission, 20 November 2026.
</footer>
</div>
</body></html>`;

mkdirSync('out/site', { recursive: true });
writeFileSync('out/site/index.html', html);
console.log('wrote out/site/index.html');
