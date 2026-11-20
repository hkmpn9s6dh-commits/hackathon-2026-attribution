// Writes the slide deck as standalone HTML (1920x1080), one file per slide.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const R = JSON.parse(readFileSync('out/results.json', 'utf8'));
const S = R.summary;
const f = (v, d = 2) => Number(v).toFixed(d);
const fig = (n) => readFileSync(`out/figures/${n}`, 'utf8');

const css = `
  * { box-sizing: border-box; margin: 0; }
  body { width:1920px; height:1080px; background:#fbfaf7; color:#16181d;
         font-family:"Helvetica Neue",Arial,sans-serif; overflow:hidden; }
  .slide { width:1920px; height:1080px; padding:96px 120px 84px; display:flex; flex-direction:column; }
  .eyebrow { font-size:22px; letter-spacing:.18em; text-transform:uppercase; color:#b45309; font-weight:600; }
  h1 { font-family:Georgia,serif; font-size:104px; line-height:1.02; letter-spacing:-2px; margin-top:26px; }
  h2 { font-family:Georgia,serif; font-size:64px; line-height:1.08; letter-spacing:-1px; }
  .lede { font-family:Georgia,serif; font-size:40px; line-height:1.35; color:#374151; margin-top:34px; max-width:1500px; }
  .byline { margin-top:auto; font-size:24px; color:#6b7280; }
  .body { font-size:32px; line-height:1.45; color:#1f2937; margin-top:34px; }
  .body b { color:#111827; }
  .fig { margin-top:26px; background:#fff; border:1px solid #e5e7eb; padding:18px 22px; }
  .fig svg { width:100%; height:auto; display:block; }
  .foot { margin-top:auto; display:flex; justify-content:space-between; font-size:20px; color:#9ca3af; }
  .big { display:flex; gap:56px; margin-top:54px; }
  .kpi { flex:1; border-top:3px solid #16181d; padding-top:20px; }
  .kpi .n { font-family:Georgia,serif; font-size:88px; line-height:1; }
  .kpi .k { font-size:23px; color:#6b7280; margin-top:14px; line-height:1.35; }
  ul { margin:26px 0 0 34px; }
  li { font-size:31px; line-height:1.5; margin-bottom:14px; }
  .cols { display:flex; gap:60px; align-items:flex-start; }
  .cols > div { flex:1; }
`;

function page(inner, n) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
<div class="slide">${inner}<div class="foot"><span>Discipline is a choice · Agent Attribution Hackathon 2026</span><span>${n}/7</span></div></div>
</body></html>`;
}

const slides = [
  page(`
    <div class="eyebrow">Agent Attribution Hackathon · Track 2 · Apart Research</div>
    <h1>Discipline<br>is a choice</h1>
    <div class="lede">Behavioural attribution measures the leash, not the hand — and the leash is for sale.</div>
    <div class="byline">A replayable testbed · ${R.meta.traces_per_level} traces per level · 2 channels · 5 evasion levels</div>
  `, 1),

  page(`
    <div class="eyebrow">1 · The question</div>
    <h2>Three incidents. Same logs. Three different responses.</h2>
    <div class="body">A human reachable by phone, a human who has not opened the logs in a week, and an agent nobody is watching.
    In all three cases <b>the text was written by the AI</b>, so text detectors and assistant fingerprinting cannot separate them.</div>
    <ul>
      <li>Contact — a person is steering, and can be reached</li>
      <li>Escalate — a person is nominally in the loop, and is not looking</li>
      <li>Contain — nobody is in the loop at all</li>
    </ul>
    <div class="byline">The sprint brief proposes three ways out: causal timing, identity probes, vendor attestation. This is about the first.</div>
  `, 2),

  page(`
    <div class="eyebrow">2 · The testbed</div>
    <h2>Five actor types, one ordinal axis, two channels</h2>
    <div class="fig">${fig('fig1_testbed.svg')}</div>
    <div class="body">Intent is latent and never observed. The only thing timing can see is <b>the share of actions that waited for a human</b>.</div>
  `, 3),

  page(`
    <div class="eyebrow">3 · The result</div>
    <h2>Timing knows the leash. Targets know the hand.</h2>
    <div class="fig">${fig('fig3_channels.svg')}</div>
    <div class="body">An intent AUC of ${f(S.intent_auc_timing_L0)} from timing looks excellent — until the leash is held fixed, where it falls to <b>${f(S.intent_auc_matched_timing)}</b>, i.e. chance.</div>
  `, 4),

  page(`
    <div class="eyebrow">4 · The ladder</div>
    <h2>Disguise collapses a pair — and inverts a frozen model</h2>
    <div class="fig">${fig('fig4_ladder.svg')}</div>
    <div class="body">A detector fitted on the honest fleet reports ρ = <b>${f(S.control_rho_transfer_L3)}</b> at L3: it has learned the sign, and the sign is wrong.</div>
  `, 5),

  page(`
    <div class="eyebrow">5 · The price list</div>
    <h2>Every disguise has a price. One is paid by the defender.</h2>
    <div class="big">
      <div class="kpi"><div class="n">+${f(S.delay_rogue_L1, 0)}s</div><div class="k">per action for an agent that waits like a supervised one</div></div>
      <div class="kpi"><div class="n">${f((1 - S.sensitive_nonbenign_L4 / S.sensitive_nonbenign_L0) * 100, 0)}%</div><div class="k">of the sensitive surface given up by camouflage</div></div>
      <div class="kpi"><div class="n">0</div><div class="k">cost of auto-approve, which erases the timing channel outright</div></div>
    </div>
    <div class="body" style="margin-top:52px">Report the mixture, not the label · hold the other axis fixed · audit frozen models · prefer attestation.</div>
  `, 6),

  page(`
    <div class="eyebrow">6 · What is checkable</div>
    <h2>One command, one hash, thirty-one assertions</h2>
    <div class="body">Every number in the report is generated from <b>results.json</b>. Editing a figure by hand breaks the build.
    The dataset regenerates bit-for-bit from seeds that exclude the evasion level, so L0 to L4 are the same actor with different discipline.</div>
    <div class="big">
      <div class="kpi"><div class="n">${f(S.runtime_s, 0)}s</div><div class="k">full run on a laptop, no GPU</div></div>
      <div class="kpi"><div class="n">31</div><div class="k">assertions, including the direction of every claim</div></div>
      <div class="kpi"><div class="n">${R.meta.traces_per_level}</div><div class="k">traces per level, grouped by org</div></div>
    </div>
    <div class="byline">github.com/hkmpn9s6dh-commits/hackathon-2026-attribution</div>
  `, 7),
];

mkdirSync('out/video', { recursive: true });
slides.forEach((html, i) => writeFileSync(`out/video/slide-${i + 1}.html`, html));
console.log(`wrote ${slides.length} slide files`);
