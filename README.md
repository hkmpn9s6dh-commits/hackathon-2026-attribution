# Discipline is a choice

A replayable testbed for **agent attribution**: given only a behaviour trace, can you tell
who is steering an AI agent — and how tightly?

Submission to the [Agent Attribution Hackathon](https://apartresearch.com/sprints/agent-attribution-2026)
(Apart Research, 11–13 December 2026), Track 2.

> **Claim.** Timing recovers how tightly a human is in the loop (ρ = 0.95) and appears to
> recover intent (AUC = 0.90) — until the leash is held fixed, where it falls to chance (0.48).
> Target choice shows the mirror image. Disguises have measurable prices, and a detector
> fitted on the honest fleet *inverts* (ρ = −0.72) instead of decaying.

- Report: [`docs/report.pdf`](docs/report.pdf) (6 pages)
- Project page: <https://hkmpn9s6dh-commits.github.io/hackathon-2026-attribution/>
- Video: [`docs/attribution.mp4`](docs/attribution.mp4) (3–5 min)

## Reproduce

```bash
npm ci
npm run all      # build -> run (~3 min) -> figures -> report.pdf -> site
npm run verify   # 31 assertions, exit code is the answer
```

Everything in the report is generated from `out/results.json`; `npm run report -- --check`
fails if the HTML was edited by hand.

## What is here

| Path | What it is |
|---|---|
| `SPEC.md` | Gate A: the sprint rules quoted verbatim, the acceptance criteria (AC-01…AC-15) |
| `src/gen.ts` | The testbed: five actor types, two channels, five evasion levels. Seeds exclude the level, so L0–L4 are the same actor with different discipline |
| `src/features.ts` | 13 timing features, 10 target features. Takes `Event[]` only — never a label |
| `src/model/` | Multinomial logistic regression and a small GBM, both deterministic |
| `src/exp/core.ts` | Grouped five-fold CV, transfer evaluation, permutation importance |
| `src/run.ts` | The experiments; writes `out/results.json` |
| `verify.mjs` | Assertions: determinism, leakage, chance floor, direction of every claim |
| `scripts/` | Figures, report, site, slides and video — all driven by `results.json` |

## Design decisions worth knowing

1. **Two random streams.** Timing and content are drawn independently. With one stream,
   choosing a different target file shifts later timing draws and leaks the label into the
   timing channel — a first version of this testbed scored AUC 0.90 on intent for that reason.
2. **No label in any event.** There is no `approved_by` field: a detector that can read it
   is not a detector.
3. **Tools follow targets, not labels.** A workflow file gets edited, a key gets read.
4. **Chance is measured.** Labels are permuted across orgs; the floor is reported.

## Limits

Synthetic traces from an explicit supervision model, not recorded deployments. There is no
leaderboard number here: the organisers' held-out set is not ours. The model is ~200 lines
in `src/gen.ts` — where it is wrong, the numbers are wrong in a way a reader can check.
