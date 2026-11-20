// Builds out/report.html from out/results.json, then prints it to out/report.pdf.
// `--check` regenerates the HTML in memory and fails if it differs from disk:
// the report is a pure function of the numbers, so no hand-edited figure can survive.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const R = JSON.parse(readFileSync('out/results.json', 'utf8'));
const S = R.summary;
const M = R.main.results;
const CI = R.ci;

const f = (v, d = 2) => Number(v).toFixed(d);
const pct = (v, d = 0) => `${(v * 100).toFixed(d)}%`;
const ci = (k) => `[${f(CI[k][0])}, ${f(CI[k][1])}]`;

function fig(name, caption, width = '100%') {
  // a raster image: Chromium fragments vector content across page breaks but not bitmaps
  const png = readFileSync(`out/figures/${name}`, 'utf8');
  void png;
  const src = 'data:image/png;base64,' + readFileSync(`out/figures/${name}`, 'base64');
  return `<figure style="width:${width}"><img alt="${name}" src="${src}"><figcaption>${caption}</figcaption></figure>`;
}

const classRows = R.meta.classes.map((c) => {
  const cost = R.cost.L0[c.key];
  const intent = ['tight_nonbenign', 'loose_nonbenign', 'rogue'].includes(c.key) ? 'non-benign' : 'benign';
  const who = c.control === 0 ? 'nobody' : c.control === 3 ? 'a human on every step' : 'a human on a share of steps';
  return `<tr><td><b>${c.label}</b></td><td>${c.control}</td><td>${who}</td><td>${intent}</td><td>${f(cost.delay, 1)} s</td></tr>`;
}).join('\n');

const costRows = [
  ['L1', 'the agent performs supervision', `mean wait per action ${f(S.delay_rogue_L0, 1)} s → ${f(S.delay_rogue_L1, 1)} s`, 'the attacker: responsiveness'],
  ['L2', 'the human auto-approves', 'no cost in the trace; oversight is what is spent', 'the defender'],
  ['L4', 'payload camouflage', `sensitive surface ${pct(S.sensitive_nonbenign_L0)} → ${pct(S.sensitive_nonbenign_L4)}`, 'the attacker: capability'],
].map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join('\n');

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Discipline is a choice</title>
<style>
  @page { size: A4; margin: 15mm 15mm 13mm 15mm; }
  * { box-sizing: border-box; }
  body { font-family: "Helvetica Neue", Arial, sans-serif; color: #16181d; font-size: 9.2pt; line-height: 1.40; margin: 0; }
  h1 { font-family: Georgia, serif; font-size: 20pt; line-height: 1.12; margin: 0 0 1.4mm; letter-spacing: -0.2px; }
  h2 { font-size: 10.8pt; margin: 4.2mm 0 1.4mm; border-bottom: 0.6pt solid #d1d5db; padding-bottom: 0.8mm; }
  h3 { font-size: 9.6pt; margin: 2.8mm 0 1mm; }
  p { margin: 0 0 1.9mm; text-align: justify; }
  .sub { font-size: 11pt; color: #4b5563; margin: 0 0 2.4mm; font-family: Georgia, serif; font-style: italic; }
  .byline { font-size: 8.1pt; color: #6b7280; border-top: 0.6pt solid #e5e7eb; border-bottom: 0.6pt solid #e5e7eb; padding: 1.3mm 0; margin-bottom: 2.6mm; }
  .abstract { background: #f9fafb; border-left: 2.4pt solid #111827; padding: 2.6mm 3.4mm; font-size: 8.8pt; }
  .abstract b { font-variant: small-caps; letter-spacing: 0.4px; }
  .scope { border: 0.8pt solid #b45309; padding: 2.4mm 3mm; margin: 2.4mm 0; font-size: 8.8pt; background: #fffdf8; }
  .scope b { display: block; font-size: 7.6pt; text-transform: uppercase; letter-spacing: 0.6px; color: #b45309; margin-bottom: 0.8mm; }
  figure { margin: 1.8mm 0 2.4mm; page-break-inside: avoid; }
  figure img { width: 100%; height: auto; display: block; break-inside: avoid; page-break-inside: avoid; }
  figure { break-inside: avoid; page-break-inside: avoid; }
  figcaption { font-size: 7.9pt; color: #4b5563; margin-top: 1mm; }
  table { width: 100%; border-collapse: collapse; font-size: 8.1pt; margin: 1.4mm 0 2.4mm; }
  th, td { text-align: left; padding: 1mm 1.4mm; border-bottom: 0.5pt solid #e5e7eb; vertical-align: top; }
  th { font-size: 7.7pt; text-transform: uppercase; letter-spacing: 0.3px; color: #6b7280; border-bottom: 0.7pt solid #9ca3af; }
  .callout { border: 0.8pt solid #111827; padding: 2.2mm 3mm; margin: 2.4mm 0; font-size: 9.1pt; }
  .callout b { display: block; font-size: 7.6pt; text-transform: uppercase; letter-spacing: 0.6px; color: #6b7280; margin-bottom: 0.7mm; }
  code { font-family: "SFMono-Regular", Consolas, monospace; font-size: 7.9pt; background: #f3f4f6; padding: 0 1px; }
  .refs { font-size: 7.5pt; color: #374151; }
  .refs li { margin-bottom: 0.7mm; }
  .cn { font-size: 8.3pt; color: #374151; border-top: 0.5pt solid #e5e7eb; padding-top: 2mm; margin-top: 2.4mm; }
  ul, ol { margin: 0 0 2mm 4mm; padding: 0; }
  li { margin-bottom: 0.8mm; text-align: justify; }
</style></head>
<body>

<h1>Discipline is a choice</h1>
<div class="sub">An identifiability analysis of behavioural agent attribution — and what a disguise costs</div>
<div class="byline">Submission to the <b>Agent Attribution Hackathon</b> (Apart Research, 11–13 December 2026) · Track 2, Attribution · Code and every number in this report: <code>github.com/hkmpn9s6dh-commits/hackathon-2026-attribution</code> · 20 November 2026</div>

<div class="abstract">
<b>Abstract.</b>
A responder at an agent incident needs a fact the logs do not contain: is a human steering this, and how tightly? We build an executable testbed from the five actor types in the sprint brief — two observable channels (<i>when</i> the agent acts, <i>what</i> it touches), five discipline levels, ${R.meta.actors_total} actors and ${R.meta.traces_per_level} traces per level, actors kept whole across folds. On it we demonstrate three things. <b>First, an identifiability result:</b> when supervision shows up only as a mixture weight, timing recovers the leash (ρ = ${f(S.control_rho_timing_L0)} ${ci('control_rho_timing_L0')}) and carries no intent signal once the leash is fixed (AUC = ${f(S.intent_auc_matched_timing)} ${ci('intent_auc_matched_timing')}); target choice shows the mirror image (AUC = ${f(S.intent_auc_target_L0)}; leash ρ = ${f(S.control_rho_matched_target)}). <b>Second, an evaluation trap:</b> without holding the leash fixed the same timing features report intent AUC = ${f(S.intent_auc_timing_L0)} — the confound, not the hand. <b>Third, a price list with a warning:</b> an agent that waits like a supervised one becomes indistinguishable from one (pairwise AUC ${f(S.none_vs_tight_timing_L0)} → ${f(S.none_vs_tight_timing_L1)}) at ${f(S.delay_rogue_L1, 0)} s of added latency per action; camouflage collapses intent detection from ${f(S.intent_auc_target_L0)} to ${f(S.intent_auc_target_L4)} for ${pct(1 - S.sensitive_nonbenign_L4 / S.sensitive_nonbenign_L0)} of the sensitive surface; and a detector fitted on the honest fleet does not decay — it inverts (ρ = ${f(S.control_rho_transfer_L3)} ${ci('control_rho_transfer_L3')}).
</div>

<div class="scope"><b>What this is, and what it is not</b>
This is a <i>simulator</i>, and the identification is an identity of the construction, not an estimate from deployed agents. That is the point: it is the cheapest way to show <i>what a detector can possibly recover</i> when supervision is real but only weakly observable, and to put a number on the disguises. The two claims that do not depend on our generator are (i) the confound in Section 4.3 — any labelled fleet whose leash and intent are correlated as the brief's taxonomy makes them will inflate a behavioural intent score — and (ii) the inversion in Section 4.4, which follows for any monotone "who is in the loop" detector once the roles swap. Everything else is a demonstration, and Section 6 says what would break it.
</div>

<h2>1. The question, and why it is not academic</h2>
<p>When an agent shows up in an incident — a supply-chain commit, an escaped process, a run that spent money — the first question a responder asks is not "which model" but "who, if anyone, is steering it". A human reachable by phone, a human who has not opened the logs in a week, and an agent nobody is watching call for three different responses: contact, escalation, containment. Today the three look alike from the outside, because in all three cases <i>the text was written by the AI</i>. Text detectors and assistant fingerprinting inherit that blindness: they classify the model, not the hand on the leash [1,3].</p>
<p>The sprint brief proposes three ways out: causal timing, identity probes, vendor attestation [2]. This report is about the first. Its existing evaluations are of the form "does the classifier separate the classes we drew?"; ours asks the prior question — <i>what is identifiable at all, and at what price does an adversary make it unidentifiable?</i></p>

<h2>2. Testbed: what is observable, and what is only latent</h2>
<p>We implement the brief's five actor types (Table 1). What makes the problem hard is not the number of classes. It is that the classes differ along two axes — <b>how tight the leash is</b> (ordinal: 0 = nobody steering, 3 = a human on every step) and <b>whether the human is benign</b> (a binary we never observe) — and the two axes are entangled in the label (Table 2), which is exactly how a naive score gets flattered.</p>

<table>
<tr><th>Actor type</th><th>Leash</th><th>Who is in the loop</th><th>Intent</th><th>Wait per action, L0</th></tr>
${classRows}
</table>

<p><b>Population.</b> ${R.meta.actors_per_class} actors per class, ${R.meta.actors_total} actors per level, four traces each (${R.meta.traces_per_level} traces), ${R.dataset.events_per_level} events. One actor is one org; an actor's four traces never straddle a train/test boundary, so every score is about an actor the model has not met. Intervals are bootstrap over actors (400 resamples), not over traces.</p>

<p>A trace is a sequence of events over a 3–5 hour window: inbound messages, and actions carrying a tool (<code>edit</code>, <code>read</code>, <code>shell</code>, <code>commit</code>, <code>net</code>), a target path, a payload size and a shell-chain length. An action either waits for a human — it lands a human-latency interval after its scheduled tick, usually after a request message — or it does not. The share of actions that wait is the mixture weight <i>p</i>: the only thing that separates the actor types in the timing channel, and what a responder means by "tightly supervised".</p>

${fig('fig1_testbed.png', 'Figure 1. The observable problem. Five actor types on one ordinal axis; two channels available to a responder; intent latent.')}

<p>Three design decisions carry the report. First, <b>timing and content are generated by separate random streams</b>: with one stream, drawing a different target file shifts every later draw and leaks the label into the timing, and a first version of this testbed did exactly that (a timing-only classifier scored AUC 0.90 on intent for no reason a responder could act on). Second, <b>no event carries a label</b> — there is no <code>approved_by</code> field, because a detector that can read it is not a detector. Third, <b>tools follow targets, not labels</b>: a workflow file gets edited, a key gets read. Wherever a class signature leaked into a second statistic, the leak looked like a great result.</p>

<h2>3. Method</h2>
<p><b>Features.</b> Thirteen timing features (inter-arrival median and 90th percentile, coefficient of variation, binned entropy, Fano factor over minute buckets, phase concentration on the 60 s grid, latency after an inbound message at three cut-offs, coverage, share of gaps over five minutes) and ten target features (share of actions on sensitive paths — CI workflows, keys, registry config, install hooks — directory entropy, target diversity, tool mix, shell-chain length, edit size). No feature sees a label, an org id or a scenario id.</p>
<p><b>Models.</b> Multinomial logistic regression and a small gradient-boosted tree ensemble (depth 2, 45 rounds, deterministic), each with three heads: the five-way label, the ordinal leash, the intent flag. Trees are included because a linear model could understate what a flexible detector can do; they agree closely, so the ceiling here is the channel, not the model.</p>
<p><b>Evaluation.</b> Five-fold cross-validation grouped by actor; likelihood-free chance floor from ${'20'} label permutations across actors (ρ = ${f(S.control_rho_perm_mean)}, AUC = ${f(S.intent_auc_perm_mean)}). Headline numbers carry actor-bootstrap 95% intervals.</p>
<p><b>Ladder.</b> L0 is the honest fleet. Four moves follow (Table 3), each generated from the same seeds as L0: the same actor does the same job with a different discipline, so the comparison is paired. We also score a detector <i>frozen at L0</i> on every level — the deployment that actually happens, a model fitted on last quarter's incidents.</p>
<p><b>Matched comparisons.</b> Because the claim is about what a channel can identify, we compare classes that share one axis: the two loose classes (C and E) for intent, the three non-benign classes for the leash, and two pairs that share a mixture weight outright (a rogue at L1 against a close human at L0; an auto-approving human at L2 against an autonomous agent at L0).</p>

<table>
<tr><th>Level</th><th>Move</th><th>What it attacks</th><th>Who pays</th></tr>
<tr><td>L0</td><td>nobody disguises anything</td><td>—</td><td>—</td></tr>
<tr><td>L1</td><td>the agent performs supervision (waits, asks)</td><td>tick alignment, message coupling</td><td>the attacker: responsiveness</td></tr>
<tr><td>L2</td><td>the human delegates (auto-approve, batch)</td><td>the supervision itself</td><td>the defender: oversight</td></tr>
<tr><td>L3</td><td>both at once</td><td>the mapping from behaviour to role</td><td>both</td></tr>
<tr><td>L4</td><td>L3 + payload camouflage</td><td>target choice</td><td>the attacker: capability</td></tr>
</table>

<h2>4. Results</h2>

<h3>4.1 Five-way accuracy is the wrong scoreboard</h3>
<p>On the honest fleet the five-way problem is nearly solved: macro-F1 ${f(M['both/gbm'].five.macroF1)}, with residual error between the two classes that share a leash setting (Figure 2). That number says a classifier can reproduce the taxonomy on data from the same generator. It says nothing about whether the quantity is stable, which channel is doing the work, or what happens when the observed party stops cooperating — which is the rest of this section.</p>

${fig('fig2_confusion.png', 'Figure 2. Confusion on the honest fleet (all features, gradient boosting). Residual error sits between the two classes that differ only in intent.', '52%')}

<h3>4.2 The clock knows the leash; the file paths know the hand</h3>
<p>Figure 3(i) is the identifiability result. Timing recovers the leash at ρ = ${f(S.control_rho_timing_L0)} ${ci('control_rho_timing_L0')}; target features are nearly blind to it (ρ = ${f(S.control_rho_target_L0)}). Figure 3(iii) holds the leash fixed and compares benign against non-benign actors: targets separate them at AUC ${f(S.intent_auc_matched_target)}, timing at ${f(S.intent_auc_matched_timing)} — chance.</p>
<p>This is what the construction guarantees, and what we wanted to show rather than assume: if supervision enters behaviour only as a share of waiting actions, then a timing detector can at best estimate that share. The value is in the demonstration being executable and in the price attached to changing the share (Section 4.5). A real deployment would also see supervisors who intervene in bursts, edit plans rather than actions, or leave traces in chat; we return to that in Section 6.</p>

${fig('fig3_channels.png', 'Figure 3. Same models, same folds, three questions. (i) and (iii) are the honest readings; (ii) is what a model reports when the leash is not held fixed.')}

<h3>4.3 Why an intent AUC of ${f(S.intent_auc_timing_L0)} is a trap</h3>
<p>Figure 3(ii) is the panel we expect most pipelines to publish. Feed timing features to a classifier and ask for intent, and it returns AUC ${f(S.intent_auc_timing_L0)}. It is almost entirely the leash wearing intent's clothes. Three of the five classes are non-benign and they sit at three different leash settings; the two benign classes sit at two others (Table 2). Timing reads the leash at ρ = ${f(S.control_rho_timing_L0)}, and the taxonomy supplies the rest. Hold the leash fixed — compare C against E, which differ in nothing observable except what they touch — and the same features fall to ${f(S.intent_auc_matched_timing)}.</p>
<p>The same confound runs the other way, more weakly: target features pick up ρ = ${f(S.control_rho_target_L0)} for the leash across all five classes, and ${f(S.control_rho_matched_target)} once intent is fixed. Any labelled fleet will have this entanglement, because non-benign actors are not a random sample of leash settings. A pipeline that does not hold one axis fixed will report the other axis and call it detection.</p>
<div class="callout"><b>Practical reading</b>An intent classifier built on behaviour and validated on a mixed fleet is measuring the fleet's composition. Re-run it on a matched subset before you believe it.</div>

<h3>4.4 Under disguise a pair collapses, and a frozen model inverts</h3>
<p>At L1 an autonomous agent waits before every action and asks for permission first. On timing alone it is then indistinguishable from a close human: pairwise AUC ${f(S.none_vs_tight_timing_L0)} at L0, ${f(S.none_vs_tight_timing_L1)} at L1 — chance, confirmed by an explicit two-class test between a rogue agent at L1 and a close human at L0 (${f(S.matched_rogueL1_vs_tightL0_timing)}).</p>
<p>L2 is a different kind of event and should be described as such: when the human auto-approves, the supervision is not hidden, it is <i>gone</i>. The ordinal read-out falls from ${f(S.control_rho_both_L0)} to ${f(S.control_rho_both_L2)} because there is nothing left to read, and that is the point — the cheapest way to become unattributable is to stop supervising, and it costs the defender a configuration change rather than the attacker an exploit.</p>
<p>Figure 4 is the part we would put in front of anyone deploying such a model. Retrained at each level, timing holds up surprisingly well — a mixture weight is still a mixture weight. But a detector <b>frozen at L0</b> does not decay toward chance. It falls to ρ = ${f(S.control_rho_transfer_L1)} at L1, ${f(S.control_rho_transfer_L2)} at L2, and ${f(S.control_rho_transfer_L3)} ${ci('control_rho_transfer_L3')} at L3, when both sides have swapped discipline: it has learned the <i>sign</i> of the relationship, and the sign is now wrong.</p>
<div class="callout"><b>The failure mode to fear</b>A model that reports "supervised, benign-looking workflow" with high confidence about an autonomous, non-benign one is worse than no model, because nothing in its output says so.</div>

${fig('fig4_ladder.png', 'Figure 4. The evasion ladder. Top: leash tightness. Bottom: intent from targets only, which is the channel the camouflage attacks. Grey dashed: a detector fitted at L0 and deployed unchanged — it inverts at L3.')}

<h3>4.5 The price list</h3>
<p>Attribution work usually stops at "the classifier can be fooled". The more useful question for a defender is what the fooling costs the fooler. Three numbers, all measured from the generated traces:</p>
<ul>
<li><b>Waiting is expensive in latency, not volume.</b> To look supervised, the autonomous agent at L1 waits a mean of ${f(S.delay_rogue_L1, 1)} s before each action (median wait 42 s), against ${f(S.delay_rogue_L0, 1)} s at L0. Its action count per hour is unchanged (${f(S.per_hour_rogue_L0, 1)} vs ${f(S.per_hour_rogue_L1, 1)}) because in this model ticks keep firing; a deployment that serialised the agent behind each approval would instead lose about a third of its throughput at a two-minute cadence. We report the latency, and flag the throughput figure as conditional.</li>
<li><b>Camouflage costs capability.</b> Non-benign actors touch sensitive paths ${pct(S.sensitive_nonbenign_L0)} of the time at L0 and ${pct(S.sensitive_nonbenign_L4)} at L4: a ${pct(1 - S.sensitive_nonbenign_L4 / S.sensitive_nonbenign_L0)} relative drop. Intent detection from targets falls from ${f(S.intent_auc_target_L0)} to ${f(S.intent_auc_target_L4)} — chance — because the actor gave up most of what made it worth detecting.</li>
<li><b>Delegation is free for the attacker.</b> At L2 the human auto-approves and pays nothing; the cost lands on the defender's oversight. It is the only move in the ladder that needs no adversary at all.</li>
</ul>
<table>
<tr><th>Level</th><th>Move</th><th>Measured price</th><th>Paid by</th></tr>
${costRows}
</table>

<h3>4.6 How much behaviour before you can say anything?</h3>
<p>Incident response has a clock. Figure 5 asks how discrimination grows with the number of actions observed. The leash is readable from about ten actions (ρ = ${f(R.curve.L0[0].control_rho)}) and saturates by forty; intent from targets climbs more slowly, because file choices are noisier than waiting times, and reaches ${f(R.curve.L0[3].intent_auc)} by eighty actions.</p>
<p>The disguised fleet is the instructive exception. At L3 both curves stay high, not because the model got better: once discipline is correlated with intent, a leash detector becomes an intent detector for free. That is Section 4.3's confound returning in adversarial dress, and it is the strongest argument for the matched comparison in Figure 3(iii) — a number that survives at L3 may be measuring the disguise, not the actor.</p>

${fig('fig5_curve.png', 'Figure 5. Discrimination versus actions observed. The honest fleet rewards patience; the disguised fleet rewards suspicion, because discipline has become a proxy for intent.')}

<h2>5. What a responder should do with this</h2>
<ol>
<li><b>Report the mixture, not the label.</b> "38% of actions waited for a human, median 41 s, n = 214" is auditable. "A supervised human did this" is not. Refuse the label even when the classifier is confident — especially then.</li>
<li><b>Hold the other axis fixed.</b> Before believing an intent number, re-run it on actors with the same leash. If it collapses, it was supervision.</li>
<li><b>Never deploy a frozen behavioural model without a matched-pair audit.</b> The L3 failure is not subtle drift; it is a sign flip. Ship the audit with the model and fail closed when it stops separating the classes it was trained on.</li>
<li><b>Prefer the channel the adversary cannot choose.</b> Timing and targets are both self-reported. Attestation — a signed agent identity, an operator registry entry — is the only channel in the brief that binds a claim to a party. Behaviour tells you where to look, not who to call.</li>
</ol>

<h2>6. What would falsify this, and other limits</h2>
<p><b>The invariance is ours.</b> Section 4.2 holds because supervision enters the trace only as a per-action wait. Real supervisors do something else as well: they intervene in bursts, edit the plan rather than the action, respond faster to risky actions, and leave traces in channels we do not model. Each of those would give timing a genuine intent signal — and would also make a competent attacker's job harder. <b>The experiment that would break our claim</b> is a real trace set in which human latency depends on the action's content; we cannot run it here, and we would expect it to raise the matched timing AUC above chance. Our number is the floor for that experiment, not its answer.</p>
<p><b>No real LLM traces.</b> The organisers' held-out set is not ours, so there is no leaderboard number here and we do not imply one.</p>
<p><b>Two channels only.</b> Identity probes and attestation are discussed, not built. Our prediction — untested — is that probes inherit the same weakness, since a probe is behaviour the adversary can rehearse; attestation does not.</p>
<p><b>Modest scale.</b> ${R.meta.actors_total} actors per level, five folds. Enough to see a sign flip and to bound it with an interval; not enough to certify a small difference.</p>

<h2>7. Reproducibility</h2>
<p>Everything here comes from one command on a clean clone: <code>npm ci &amp;&amp; npm run build &amp;&amp; npm run run &amp;&amp; npm run figs &amp;&amp; npm run report &amp;&amp; npm run verify</code>. The L0 dataset hash is <code>${S.dataset_hash.slice(0, 16)}…</code>; regenerating it elsewhere reproduces every figure. <code>verify.mjs</code> implements AC-01–AC-15 from <code>SPEC.md</code>: determinism, no leakage through the feature API, actor-grouped folds, a measured chance floor, the direction of every claim, the rule that the report is a pure function of <code>results.json</code> (editing a number by hand fails the build), and the page budget. Runtime, ${f(S.runtime_s, 0)} s on a laptop, no GPU.</p>

<h2>References</h2>
<ol class="refs">
<li>UK AI Security Institute, <i>Incident report: unsanctioned agent behaviour during cyber testing</i>, 2026. aisi.gov.uk</li>
<li>Apart Research, <i>Agent Attribution Hackathon</i>, 11–13 December 2026. apartresearch.com/sprints/agent-attribution-2026</li>
<li>Transluce, <i>Agent activity</i>; Collusion wiki — discovery and monitoring approaches cited in the sprint brief.</li>
<li>Cloudflare, <i>Signed agents</i> (Web Bot Auth) — the attestation channel the brief points to.</li>
<li>Reuters, <i>How a Texas student blew the whistle on a rogue AI hacking attempt</i>, 2026 — cited in the brief.</li>
</ol>

<div class="cn"><b>中文摘要.</b>本文把「这条轨迹背后有没有人、管得多紧」做成可复现的测试台：五类行动者、两个通道（何时动手 / 动了什么）、五级纪律。结论分三层：① <b>可识别性</b>——当监督只表现为「等待的比例」，时间通道能读出绳子有多紧（ρ=${f(S.control_rho_timing_L0)}），把绳子固定住就读不出意图（AUC=${f(S.intent_auc_matched_timing)}）；目标通道正好相反（AUC=${f(S.intent_auc_target_L0)}，松紧 ρ=${f(S.control_rho_matched_target)}）。② <b>评估陷阱</b>——不固定绳子时同一批时间特征会报出意图 AUC=${f(S.intent_auc_timing_L0)}，那是绳子穿着意图的衣服。③ <b>代价清单</b>——agent 装作被监管，每步多等 ${f(S.delay_rogue_L1, 0)} 秒；目标伪装把意图打到随机（${f(S.intent_auc_target_L0)}→${f(S.intent_auc_target_L4)}），代价是放弃 ${pct(1 - S.sensitive_nonbenign_L4 / S.sensitive_nonbenign_L0)} 的敏感面；人一键批准不花钱，却把通道抹平。最要命的是：在旧数据上训好的检测器换了对手会<b>反向</b>（ρ=${f(S.control_rho_transfer_L3)}），不是变笨，是说反。</div>

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
