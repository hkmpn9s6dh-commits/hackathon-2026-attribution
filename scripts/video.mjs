// Renders the slides, synthesises narration, and assembles out/video/attribution.mp4.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const NARRATION = [
  `When an AI agent shows up in an incident, the first question is not which model. It is who, if anyone, is steering it.
   A human on the phone, a human who has not opened the logs in a week, and nobody at all call for three different responses.
   Today they look the same from the outside, because in all three cases the text was written by the AI.
   This is a testbed for that question.`,

  `We take the five actor types from the sprint brief. They differ along two axes: how tight the leash is, and whether the human is benign.
   Intent is latent. You never see it. Two channels are observable: when the agent acts, and what it touches.`,

  `Timing recovers the leash almost perfectly: a rank correlation of ${Number(0.95).toFixed(2)}.
   It also looks like it recovers intent, at an A U C of ${Number(0.90).toFixed(2)}. But hold the leash fixed, and it falls to ${Number(0.48).toFixed(2)} — chance.
   The intent signal was the leash wearing intent's clothes. Targets do the mirror image: ${Number(0.95).toFixed(2)} for intent, and nothing for the leash once intent is fixed.`,

  `Now let the fleet disguise itself. At level one, an autonomous agent waits before every action and asks permission first.
   On timing alone it is indistinguishable from a close human: the pairwise A U C falls from one point zero to zero point five one.
   At level two, the human auto-approves. Now everyone looks unsupervised, and the ordinal read-out collapses. Neither move needs an exploit.`,

  `The part that should worry anyone deploying such a model: a detector fitted on the honest fleet does not decay toward chance. It inverts.
   At level three, when both sides have swapped discipline, it reports minus zero point seven two.
   It has learned the sign of the relationship, and the sign is now wrong. A confident, backwards answer is worse than no answer at all.`,

  `Disguises have prices. Waiting costs the attacker sixty seconds per action. Camouflage costs about two thirds of the sensitive surface.
   And auto-approve costs the defender nothing at all — it is a default setting.
   So: report the mixture, not the label. Hold the other axis fixed. Audit frozen models. And prefer attestation, because behaviour tells you where to look, not who to call.`,

  `Everything here is reproducible from one command, and every number in the report is generated from a single results file.
   The dataset regenerates bit for bit from seeds that never include the evasion level, so each level is the same actor with a different discipline.
   If you take one thing away: behaviour tells you to go and look. Then go and look somewhere else.`,
];

const exe = process.env.CHROME_PATH || 'C:/Users/张一/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe';
const base = process.cwd().replace(/\\/g, '/');

const browser = await chromium.launch({ executablePath: existsSync(exe) ? exe : undefined });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
for (let i = 1; i <= NARRATION.length; i++) {
  await page.goto('file://' + encodeURI(base) + `/out/video/slide-${i}.html`);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `out/video/slide-${i}.png` });
  console.log('shot slide', i);
}
await browser.close();

// Narration: one mp3 per slide, then pad each segment so the voice can breathe.
for (let i = 0; i < NARRATION.length; i++) {
  const txt = NARRATION[i].replace(/\s+/g, ' ').trim();
  execFileSync('py', ['-3', '-m', 'edge_tts', '--voice', 'en-US-AriaNeural', '--rate=-4%',
    '--text', txt, '--write-media', `out/video/vo-${i + 1}.mp3`], { stdio: 'pipe' });
  console.log('vo', i + 1);
}

const duration = (file) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
  '-of', 'default=noprint_wrappers=1:nokey=1', file]).toString().trim());

const segs = [];
for (let i = 1; i <= NARRATION.length; i++) {
  const d = duration(`out/video/vo-${i}.mp3`);
  const seg = `out/video/seg-${i}.mp4`;
  const pad = 1.2;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error',
    '-loop', '1', '-i', `out/video/slide-${i}.png`,
    '-i', `out/video/vo-${i}.mp3`,
    '-af', `adelay=300|300,apad=pad_dur=${pad}`,
    '-t', String(d + pad + 0.3),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', '30',
    '-c:a', 'aac', '-b:a', '160k', '-shortest', seg]);
  segs.push(seg);
  console.log(`segment ${i}: ${(d + pad + 0.3).toFixed(1)}s`);
}

const list = 'out/video/list.txt';
execFileSync('node', ['-e', `require('fs').writeFileSync(${JSON.stringify(list)}, ${JSON.stringify(segs.map((s) => `file '${s}'`).join('\n'))})`]);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list,
  '-c', 'copy', '-movflags', '+faststart', 'out/video/attribution.mp4']);

const total = duration('out/video/attribution.mp4');
console.log(`wrote out/video/attribution.mp4 (${total.toFixed(1)} s)`);
