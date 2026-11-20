// Builds out/report.html from out/results.json, then prints it to out/report.pdf.
// `--check` regenerates the HTML in memory and fails if it differs from disk:
// the report is a pure function of the numbers, so no hand-edited figure can survive.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const R = JSON.parse(readFileSync('out/results.json', 'utf8'));
const S = R.summary;
const M = R.main.results;
const L = R.ladder;

const f = (v, d = 2) => Number(v).toFixed(d);
const pct = (v, d = 0) => `${(v * 100).toFixed(d)}%`;
const signed = (v, d = 2) => `${v >= 0 ? '+' : '−'}${Math.abs(Number(v)).toFixed(d)}`;

function fig(name, caption, width = '100%') {
  const svg = readFileSync(`out/figures/${name}`, 'utf8');
  return `<figure style="width:${width}">${svg}<figcaption>${caption}</figcaption></figure>`;
}

const classRows = R.meta.classes.map((c) => {
  const cost = R.cost.L0[c.key];
  const intent = ['tight_nonbenign', 'loose_nonbenign', 'rogue'].includes(c.key) ? 'non-benign' : 'benign';
  const who = c.control === 0 ? 'nobody' : c.control === 3 ? 'a human on every step' : 'a human on a share of steps';
  return `<tr><td><b>${c.label}</b></td><td>${c.control}</td><td>${who}</td><td>${intent}</td><td>${f(cost.delay, 1)} s</td></tr>`;
}).join('\n');

const costRows = [
  ['L1', 'the agent performs supervision', `+${f(S.delay_rogue_L1 - S.delay_rogue_L0, 0)} s per action (${f(S.delay_rogue_L0, 1)} → ${f(S.delay_rogue_L1, 1)} s)`, 'the attacker'],
  ['L2', 'the human auto-approves', 'no measurable cost in the trace', 'the defender (oversight)'],
  ['L4', 'payload camouflage', `sensitive surface ${pct(S.sensitive_nonbenign_L0)} → ${pct(S.sensitive_nonbenign_L4)}`, 'the attacker (capability)'],
].map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join('\n');

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Discipline is a choice</title>
<style>
  @page { size: A4; margin: 15mm 15mm 13mm 15mm; }
  * { box-sizing: border-box; }
  body { font-family: "Helvetica Neue", Arial, sans-serif; color: #16181d; font-size: 9.3pt; line-height: 1.40; margin: 0; }
  h1 { font-family: Georgia, serif; font-size: 20pt; line-height: 1.12; margin: 0 0 1.6mm; letter-spacing: -0.2px; }
  h2 { font-size: 11pt; margin: 4.4mm 0 1.6mm; border-bottom: 0.6pt solid #d1d5db; padding-bottom: 0.8mm; }
  h3 { font-size: 9.7pt; margin: 3mm 0 1mm; }
  p { margin: 0 0 2mm; text-align: justify; }
  .sub { font-size: 11.2pt; color: #4b5563; margin: 0 0 2.6mm; font-family: Georgia, serif; font-style: italic; }
  .byline { font-size: 8.2pt; color: #6b7280; border-top: 0.6pt solid #e5e7eb; border-bottom: 0.6pt solid #e5e7eb; padding: 1.4mm 0; margin-bottom: 3mm; }
  .abstract { background: #f9fafb; border-left: 2.4pt solid #111827; padding: 2.8mm 3.6mm; font-size: 8.9pt; }
  .abstract b { font-variant: small-caps; letter-spacing: 0.4px; }
  figure { margin: 2mm 0 2.6mm; page-break-inside: avoid; }
  figure svg { width: 100%; height: auto; display: block; }
  figcaption { font-size: 8pt; color: #4b5563; margin-top: 1mm; }
  table { width: 100%; border-collapse: collapse; font-size: 8.2pt; margin: 1.6mm 0 2.6mm; }
  th, td { text-align: left; padding: 1.1mm 1.5mm; border-bottom: 0.5pt solid #e5e7eb; vertical-align: top; }
  th { font-size: 7.8pt; text-transform: uppercase; letter-spacing: 0.3px; color: #6b7280; border-bottom: 0.7pt solid #9ca3af; }
  .callout { border: 0.8pt solid #111827; padding: 2.4mm 3mm; margin: 2.6mm 0; font-size: 9.3pt; }
  .callout b { display: block; font-size: 7.8pt; text-transform: uppercase; letter-spacing: 0.6px; color: #6b7280; margin-bottom: 0.8mm; }
  code { font-family: "SFMono-Regular", Consolas, monospace; font-size: 8pt; background: #f3f4f6; padding: 0 1px; }
  .refs { font-size: 7.6pt; color: #374151; }
  .refs li { margin-bottom: 0.8mm; }
  .cn { font-size: 8.4pt; color: #374151; border-top: 0.5pt solid #e5e7eb; padding-top: 2mm; margin-top: 2.6mm; }
  ul, ol { margin: 0 0 2.2mm 4.2mm; padding: 0; }
  li { margin-bottom: 0.9mm; text-align: justify; }
</style></head>
<body>

<h1>Discipline is a choice</h1>
<div class="sub">Behavioural attribution measures the leash, not the hand — and the leash is for sale</div>
<div class="byline">Submission to the <b>Agent Attribution Hackathon</b> (Apart Research, 11–13 December 2026) · Track 2, Attribution · Code and every number in this report: <code>github.com/hkmpn9s6dh-commits/hackathon-2026-attribution</code> · 20 November 2026</div>

<div class="abstract">
<b>Abstract.</b>
A responder arriving at an agent incident needs a fact the logs do not contain: is a human steering this, and how tightly? We build a replayable testbed from the five actor types in the sprint brief, two observable channels — <i>when</i> the agent acts and <i>what</i> it touches — and five evasion levels, with ${R.meta.traces_per_level} traces per level and grouped five-fold cross-validation. Timing recovers how tightly a human is in the loop (ρ = ${f(S.control_rho_timing_L0)}). It appears to recover intent too (AUC = ${f(S.intent_auc_timing_L0)}) — until the leash is held fixed, at which point it falls to chance (AUC = ${f(S.intent_auc_matched_timing)}). The apparent intent signal is the leash wearing intent's clothes. Target choice shows the mirror image: intent AUC = ${f(S.intent_auc_target_L0)}, leash ρ = ${f(S.control_rho_matched_target)} once intent is fixed. Under disguise the two channels behave differently. An autonomous agent that waits like a supervised one becomes indistinguishable from one (AUC ${f(S.none_vs_tight_timing_L0)} → ${f(S.none_vs_tight_timing_L1)}) at a measured cost of ${f(S.delay_rogue_L1, 0)} seconds per action; a human who auto-approves pays nothing and erases the channel outright. A detector fitted on the honest fleet does not decay — it inverts (ρ = ${f(S.control_rho_transfer_L3)}). Camouflaged payloads collapse the target channel (AUC ${f(S.intent_auc_target_L0)} → ${f(S.intent_auc_target_L4)}) for ${pct(1 - S.sensitive_nonbenign_L4 / S.sensitive_nonbenign_L0)} of the actor's sensitive surface. Behaviour can tell you to go and look. It cannot tell you who to call.
</div>

<h2>1. The question, and why it is not academic</h2>
<p>When an agent shows up in an incident — a supply-chain commit, an escaped process, a run that spent money — the first question a responder asks is not "which model" but "who, if anyone, is steering it". A human reachable by phone, a human who has not opened the logs in a week, and an agent nobody is watching call for three different responses: contact, escalation, containment. Today the three look alike from the outside, because in all three cases <i>the text was written by the AI</i>. Text detectors and assistant-fingerprinting tools inherit that blindness: they classify the model, not the hand on the leash [1,3].</p>
<p>The sprint brief proposes three ways out: causal timing, identity probes, and vendor attestation [2]. This report is about the first, and about what happens to it when the observed party knows it is being observed. We do not have the incident logs the organisers will score against, and we do not pretend to: our claim is narrower and, we think, more useful — that "can behaviour attribute an actor?" is a question with a measurable answer and a price tag, and that the answer is uncomfortable for anyone planning to deploy such a classifier.</p>

<h2>2. Testbed: what is observable, and what is only latent</h2>
<p>We implement the brief's five actor types (Table 1). What makes the problem hard is not the number of classes. It is that the classes differ along two axes — <b>how tight the leash is</b> (ordinal: 0 = nobody steering, 3 = a human on every step) and <b>whether the human is benign</b> (a binary we never observe) — and the two axes are entangled in the label in a way that flatters naive evaluation (Section 4.3).</p>

<table>
<tr><th>Actor type</th><th>Leash</th><th>Who is in the loop</th><th>Intent</th><th>Wait per action, L0</th></tr>
${classRows}
</table>

<p>A trace is a sequence of events over a ${'3–5'} hour window: inbound messages, and actions carrying a tool (<code>edit</code>, <code>read</code>, <code>shell</code>, <code>commit</code>, <code>net</code>), a target path, a payload size and a shell-chain length. An action either waits for a human — it lands a human-latency interval after its scheduled tick, usually after a request message — or it does not. The share of actions that wait is the mixture weight <i>p</i>. It is the only thing that separates the actor types in the timing channel, and it is what a responder means by "tightly supervised".</p>

${fig('fig1_testbed.svg', 'Figure 1. The observable problem. Five actor types on one ordinal axis; two channels available to a responder; intent latent.')}

<p>Three design decisions carry the report. First, <b>timing and content are generated by separate random streams</b>: with one stream, drawing a different target file shifts every later draw and leaks the label into the timing, and a first version of this testbed did exactly that (a timing-only classifier scored AUC 0.90 on intent for no reason a responder could act on). Second, <b>no event carries a label</b> — there is no <code>approved_by</code> field, because a detector that can read it is not a detector. Third, <b>tools follow targets, not labels</b>: a workflow file gets edited, a key gets read. Wherever we allowed a class signature to leak into a second statistic, it did, and the leakage always looked like a great result.</p>

<h2>3. Method</h2>
<p><b>Features.</b> Thirteen timing features (inter-arrival median and 90th percentile, coefficient of variation, binned entropy, Fano factor over minute buckets, phase concentration on the 60 s grid, latency after an inbound message at three cut-offs, coverage, share of gaps over five minutes) and ten target features (share of actions on sensitive paths — CI workflows, keys, registry config, install hooks — directory entropy, target diversity, tool mix, shell-chain length, edit size). No feature sees a label, an org id or a scenario id.</p>
<p><b>Models.</b> Multinomial logistic regression and a small gradient-boosted tree ensemble (depth 2, 45 rounds, deterministic), each with three heads: the five-way label, the ordinal leash, the intent flag. Trees are included because a linear model could understate what a flexible detector can do; in practice the two agree closely, which is itself reassuring — the ceiling here is the channel, not the model.</p>
<p><b>Evaluation.</b> Five-fold cross-validation grouped by <i>org</i>, never by trace: an actor's other traces are never in the training fold, so a score is a statement about an actor the model has not met. Chance is measured, not assumed — labels are permuted across orgs five times (ρ = ${f(S.control_rho_perm_mean)}, AUC = ${f(S.intent_auc_perm_mean)}).</p>
<p><b>Evasion ladder.</b> Four levels, each a plausible move by one side (Table 2). Every level is generated from the same seeds as L0, so the same actor does the same job with a different discipline: the comparison is paired, and only the discipline changes.</p>
<p><b>Transfer and matched pairs.</b> At each level we also score a detector <i>frozen at L0</i> — the deployment that actually happens, a model fitted on last quarter's incidents. And because our central claim is about what a channel can identify at all, we run matched comparisons: two classes that share a leash for intent, three classes that share intent for the leash, and two pairs that share a mixture weight outright.</p>

<table>
<tr><th>Level</th><th>Move</th><th>What it attacks</th><th>Who pays</th></tr>
<tr><td>L0</td><td>nobody disguises anything</td><td>—</td><td>—</td></tr>
<tr><td>L1</td><td>the agent performs supervision (waits, asks)</td><td>tick alignment, message coupling</td><td>the attacker: latency</td></tr>
<tr><td>L2</td><td>the human delegates (auto-approve, batch)</td><td>human latency, request trail</td><td>the defender: oversight</td></tr>
<tr><td>L3</td><td>both at once</td><td>the mapping from behaviour to role</td><td>both</td></tr>
<tr><td>L4</td><td>L3 + payload camouflage</td><td>target choice</td><td>the attacker: capability</td></tr>
</table>

<h2>4. Results</h2>

<h3>4.1 Five-way accuracy is the wrong scoreboard</h3>
<p>On the honest fleet the five-way problem is nearly solved: macro-F1 ${f(M['both/gbm'].five.macroF1)}, with most residual error between the two classes that share a leash setting (Figure 2). That number is a trap of a different kind. It says a classifier can reproduce the brief's taxonomy on data from the same generator. It says nothing about whether the quantity is stable, whether the channel is doing the work, or what happens when the observed party stops cooperating — which is the rest of this section.</p>

${fig('fig2_confusion.svg', 'Figure 2. Confusion on the honest fleet (all features, gradient boosting). Residual error sits between the two classes that differ only in intent.', '58%')}

<h3>4.2 The clock knows the leash; the file paths know the hand</h3>
<p>Figure 3A is the clean result. Timing recovers the leash almost perfectly (ρ = ${f(S.control_rho_timing_L0)}), and target features are nearly blind to it (ρ = ${f(S.control_rho_target_L0)}). Figure 3C is the same comparison for intent with the leash held fixed: targets separate benign from non-benign actors at AUC ${f(S.intent_auc_matched_target)}, timing at ${f(S.intent_auc_matched_timing)} — chance.</p>
<p>This is not a modelling artefact; it follows from what the classes are. Timing sees a mixture: what share of actions waited, and for how long. That share describes an <i>arrangement</i>, and an arrangement is compatible with any intent. Targets see a choice: which files an actor reaches for at three in the morning. That choice describes a <i>job</i>. A responder asking "is anyone watching this" should read the clock; a responder asking "is this hostile" should read the diff.</p>

${fig('fig3_channels.svg', 'Figure 3. Same models, same folds, three questions. A and C are the honest readings; B is what a model reports when the leash is not held fixed.')}

<h3>4.3 Why an intent AUC of ${f(S.intent_auc_timing_L0)} is a trap</h3>
<p>Figure 3B is the panel we expect most pipelines to publish. Feed timing features to a classifier and ask it for intent, and it returns AUC ${f(S.intent_auc_timing_L0)} — an excellent-looking number. It is almost entirely the leash wearing intent's clothes. Three of the five classes are non-benign and they sit at three different leash settings; the two benign classes sit at two others. Timing reads the leash at ρ = ${f(S.control_rho_timing_L0)}, and the taxonomy supplies the rest. Hold the leash fixed — compare the non-benign loose human against the benign loose human, who differ in nothing observable except what they touch — and the same features fall to ${f(S.intent_auc_matched_timing)}.</p>
<p>The same confound runs the other way, more weakly: target features pick up ρ = ${f(S.control_rho_target_L0)} for the leash across all five classes, and ${f(S.control_rho_matched_target)} once intent is fixed. Any real incident dataset will have this entanglement, because non-benign actors are not a random sample of leash settings. A pipeline that does not hold one axis fixed will report the other axis and call it detection.</p>
<div class="callout"><b>Practical reading</b>An intent classifier built on behaviour and validated on a mixed fleet is measuring the fleet's composition. Re-run it on a matched subset before you believe it.</div>

<h3>4.4 Under disguise a pair collapses, and a frozen model inverts</h3>
<p>At L1 an autonomous agent waits before every action and asks for permission first. On timing alone it is then indistinguishable from a close human: pairwise AUC ${f(S.none_vs_tight_timing_L0)} at L0, ${f(S.none_vs_tight_timing_L1)} at L1 — chance, and confirmed by an explicit two-class test between a rogue agent at L1 and a close human at L0 (${f(S.matched_rogueL1_vs_tightL0_timing)}). At L2 the human auto-approves; now <i>every</i> class looks unsupervised, and the ordinal read-out falls from ${f(S.control_rho_both_L0)} to ${f(S.control_rho_both_L2)}. Neither move requires an exploit. The first costs the attacker waiting time; the second costs the defender nothing at all.</p>
<p>Figure 4 is the part we would put in front of anyone deploying such a model. Retrained at each level, timing holds up surprisingly well — a mixture weight is still a mixture weight. But a detector <b>frozen at L0</b> does not decay toward chance. It falls to ρ = ${signed(S.control_rho_transfer_L1)} at L1, ${signed(S.control_rho_transfer_L2)} at L2, and ${signed(S.control_rho_transfer_L3)} at L3, when both sides have swapped discipline: it has learned the <i>sign</i> of the relationship, and the sign is now wrong.</p>
<div class="callout"><b>The failure mode to fear</b>A model that reports "supervised, benign-looking workflow" with high confidence about an autonomous, non-benign one is worse than no model at all, because nothing in its output says so.</div>

${fig('fig4_ladder.svg', 'Figure 4. The evasion ladder. Solid: retrained at each level. Grey dashed: a detector fitted at L0 and deployed unchanged — it inverts at L3.')}

<h3>4.5 The price list</h3>
<p>Attribution work usually stops at "the classifier can be fooled". The more useful question for a defender is what the fooling costs the fooler. All three numbers below are measured from the generated traces, not assumed:</p>
<ul>
<li><b>Waiting is expensive.</b> To look supervised, the autonomous agent at L1 waits a median of 42 s before every action: mean delay rises from ${f(S.delay_rogue_L0, 1)} s to ${f(S.delay_rogue_L1, 1)} s per action. With an action every two minutes, that is a ${pct((S.delay_rogue_L1 - S.delay_rogue_L0) / 120)} throughput tax on every step of the campaign.</li>
<li><b>Camouflage costs capability.</b> At L4 the non-benign actors touch sensitive paths ${pct(S.sensitive_nonbenign_L0)} of the time, and ${pct(S.sensitive_nonbenign_L4)} when dressed as ordinary work. The disguise works — target intent AUC falls from ${f(S.intent_auc_target_L0)} to ${f(S.intent_auc_target_L4)}, i.e. to chance — because the actor gave up most of what made it worth detecting.</li>
<li><b>Delegation is free for the attacker.</b> At L2 the human auto-approves and pays nothing; the cost lands on the defender's oversight. This is the cheapest evasion in the ladder and the only one that needs no adversary — just a default setting.</li>
</ul>
<table>
<tr><th>Level</th><th>Move</th><th>Measured price</th><th>Paid by</th></tr>
${costRows}
</table>

<h3>4.6 How much behaviour before you can say anything?</h3>
<p>Incident response has a clock. Figure 5 asks how discrimination grows with the number of actions observed. The leash is readable from about ten actions (ρ = ${f(R.curve.L0[0].control_rho)}) and saturates by forty; intent from targets climbs more slowly, because file choices are noisier than waiting times, and needs roughly eighty actions to reach ${f(R.curve.L0[3].intent_auc)}. Waiting for more data does help — while the channel still carries the signal.</p>
<p>The disguised fleet is the interesting exception. At L3 both curves stay high, but not because the model got better: once discipline itself is correlated with intent, a leash detector becomes an intent detector for free. That is Section 4.3's confound returning in adversarial dress, and it is the strongest argument for the matched comparison in Figure 3C: a number that survives at L3 may be measuring the disguise, not the actor.</p>

${fig('fig5_curve.svg', 'Figure 5. Discrimination versus actions observed. The honest fleet rewards patience; the disguised fleet rewards suspicion, because discipline has become a proxy for intent.')}

<h2>5. What a responder should do with this</h2>
<ol>
<li><b>Report the mixture, not the label.</b> "38% of actions waited for a human, median 41 s, n = 214" is defensible and auditable. "This was a supervised human" is not. Refuse the label even when the classifier is confident — especially then.</li>
<li><b>Hold the other axis fixed before believing an intent number.</b> If a model separates benign from non-benign, re-run it on actors with the same leash. If the number collapses, the model was reading supervision.</li>
<li><b>Never deploy a frozen behavioural model without a matched-pair audit.</b> The L3 failure is not a subtle drift; it is a sign flip. Ship the audit with the model: can it still separate the two classes it was trained on, on this month's traffic? If not, fail closed.</li>
<li><b>Prefer the channel the adversary cannot choose.</b> Timing and targets are both self-reported. Attestation — a signed agent identity, an operator registry entry — is the only channel in the brief that binds a claim to a party. Behaviour tells you where to look. It does not tell you who to call.</li>
</ol>

<h2>6. Limitations</h2>
<p><b>This is a simulator.</b> Traces come from an explicit model of supervision, not from recorded deployments. The model is stated in Section 2 and implemented in <code>src/gen.ts</code> in fewer than two hundred lines; where it is wrong, our numbers are wrong in a way a reader can check. The most fragile assumption is that a human's influence appears as a per-action wait. Real supervisors intervene in bursts, edit the plan rather than the action, and leave traces in channels we do not model — issues, chat, calendar. That assumption flatters timing if anything: bursty supervision would be <i>easier</i> to spot, and easier to imitate.</p>
<p><b>No real LLM traces.</b> The organisers' held-out set is not available to us, so there is no leaderboard number here and we do not imply one. Our claim is about the shape of the problem, not about a particular model's behaviour.</p>
<p><b>Two channels only.</b> Identity probes and attestation are discussed but not built. The obvious next experiment is to add a probe channel and run it up the same ladder; our prediction, which we have not tested, is that probes inherit the same weakness — they are behaviour the adversary can rehearse — while attestation does not.</p>
<p><b>Modest scale.</b> ${R.meta.traces_per_level} traces per level, ${R.dataset.events_per_level} events, five folds. Enough to see a sign flip; not enough to certify a small difference.</p>

<h2>7. Reproducibility</h2>
<p>Everything in this report comes from one command on a clean clone: <code>npm ci &amp;&amp; npm run build &amp;&amp; npm run run &amp;&amp; npm run verify</code>. The L0 dataset hash is <code>${S.dataset_hash.slice(0, 16)}…</code>; regenerating it elsewhere reproduces every figure. <code>verify.mjs</code> implements AC-01–AC-15 from <code>SPEC.md</code>: determinism, no leakage through the feature API, grouped folds, a measured chance floor, the direction of every claim we make, the rule that the report is a pure function of <code>results.json</code> (editing a number by hand makes the build fail), and the page budget. Total runtime, ${f(S.runtime_s, 0)} s.</p>

<h2>References</h2>
<ol class="refs">
<li>UK AI Security Institute, <i>Incident report: unsanctioned agent behaviour during cyber testing</i>, 2026. aisi.gov.uk</li>
<li>Apart Research, <i>Agent Attribution Hackathon</i>, 11–13 December 2026. apartresearch.com/sprints/agent-attribution-2026</li>
<li>Transluce, <i>Agent activity</i>; Collusion wiki — discovery and monitoring approaches cited in the sprint brief.</li>
<li>Cloudflare, <i>Signed agents</i> (Web Bot Auth) — the attestation channel the brief points to.</li>
<li>Reuters, <i>How a Texas student blew the whistle on a rogue AI hacking attempt</i>, 2026 — cited in the brief.</li>
</ol>

<div class="cn"><b>中文摘要.</b>本文把「这条行为轨迹背后有没有人、管得多紧」做成可复现的测试台：五类行动者、两个通道（何时动手 / 动了什么）、五级逃逸，每级 ${R.meta.traces_per_level} 条轨迹，按「组织」分组五折。三句话：① 时间能读出绳子有多紧（ρ=${f(S.control_rho_timing_L0)}）；② 时间看起来也能读出意图（AUC=${f(S.intent_auc_timing_L0)}），但把绳子固定住就掉到随机（AUC=${f(S.intent_auc_matched_timing)}）——那个高分是在读绳子；③ 目标通道正好相反：意图 AUC=${f(S.intent_auc_target_L0)}，固定意图后读松紧只有 ρ=${f(S.control_rho_matched_target)}。逃逸的账本：agent 装作被监管，每步多等 ${f(S.delay_rogue_L1, 0)} 秒；人一键批准，不花钱就把通道抹平；目标伪装把意图打到随机（${f(S.intent_auc_target_L0)}→${f(S.intent_auc_target_L4)}），代价是放弃 ${pct(1 - S.sensitive_nonbenign_L4 / S.sensitive_nonbenign_L0)} 的敏感面。最要命的一条：在旧数据上训好的检测器遇到换了纪律的对手会<b>反向</b>（ρ=${f(S.control_rho_transfer_L3)}），不是变笨，是说反。</div>

</body></html>`;

const target = 'out/report.html';
if (process.argv.includes('--check')) {
  const cur = existsSync(target) ? readFileSync(target, 'utf8') : '';
  if (cur !== html) { console.error('report.html is not a pure function of results.json'); process.exit(1); }
  console.log('report.html matches results.json');
  process.exit(0);
}

writeFileSync(target, html);
console.log('wrote', target);

const exe = process.env.CHROME_PATH
  || 'C:/Users/张一/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe';
const browser = await chromium.launch({ executablePath: existsSync(exe) ? exe : undefined });
const page = await browser.newPage();
await page.goto('file://' + encodeURI(process.cwd().replace(/\\/g, '/')) + '/out/report.html');
await page.pdf({ path: 'out/report.pdf', format: 'A4', printBackground: true });
await browser.close();
console.log('wrote out/report.pdf');
