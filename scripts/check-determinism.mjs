#!/usr/bin/env node
// The determinism guard. Run: `npm run check:determinism`
//
// WHY THIS EXISTS
// The Daily Heist promises "one board, everyone" — every player worldwide gets
// a byte-identical map for a given date, and every shared challenge link
// reproduces its board forever. Nothing enforced that promise except code
// comments and a manual checklist. This script enforces it: it rebuilds known
// past boards and fails if a single byte moved.
//
// A failure is not a flaky test. It means a change re-rolled boards that
// players have already played. Read the failure output before touching this
// file — updating a hash to make CI pass silently rewrites history.
//
// Flags:
//   --update    Rewrite determinism-refs.json from current code. ONLY legitimate
//               when deliberately opening a new versioned era (and then the old
//               era's anchors must be kept, not replaced).
//   --today     Also smoke-test today's board (generation must not crash; the
//               hash is informational — today's date has no frozen reference).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildDailyBoards, hashBoard, utcDate } from './lib/board.mjs';
import { getDailyChallenge } from '../src/utils/dailyChallenge.js';
import { utcDateString } from '../src/utils/rng.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REFS_PATH = join(HERE, 'determinism-refs.json');
const TIERS = ['small', 'full'];

const args = new Set(process.argv.slice(2));
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

const refs = JSON.parse(readFileSync(REFS_PATH, 'utf8'));

if (args.has('--update')) {
  const boards = {};
  for (const date of Object.keys(refs.boards)) {
    const built = buildDailyBoards(date);
    const entry = { party: built.party, dayNumber: built.dayNumber };
    if (refs.boards[date]._note) entry._note = refs.boards[date]._note;
    for (const tier of TIERS) {
      entry[tier] = { seed: built[tier].seed, ...hashBoard(built[tier]) };
    }
    boards[date] = entry;
  }
  writeFileSync(REFS_PATH, JSON.stringify({ ...refs, boards }, null, 2) + '\n');
  console.log(`${bold('Rewrote')} ${REFS_PATH}`);
  console.log(dim('If this changed any hash, you just redefined a board players have seen.'));
  process.exit(0);
}

console.log(bold(`\nDeterminism check ${dim(`(era ${refs.era})`)}\n`));

let failures = 0;
let checked = 0;

for (const [date, expected] of Object.entries(refs.boards)) {
  const built = buildDailyBoards(date);

  // The board's identity depends on the assigned party (it sets bluePercentage)
  // and on the day number (Daily #N, derived from LAUNCH_UTC) — so drift in
  // either is a determinism break in its own right, even if hashes still match.
  const meta = [];
  if (built.party !== expected.party) meta.push(`party ${built.party} != ${expected.party}`);
  if (built.dayNumber !== expected.dayNumber) meta.push(`dayNumber ${built.dayNumber} != ${expected.dayNumber}`);
  if (meta.length) {
    failures++;
    console.log(`${red('FAIL')} ${date} ${red(meta.join(', '))}`);
  }

  for (const tier of TIERS) {
    const actual = hashBoard(built[tier]);
    const want = expected[tier];
    checked++;

    if (built[tier].seed !== want.seed) {
      failures++;
      console.log(`${red('FAIL')} ${date} ${tier.padEnd(5)} seed ${built[tier].seed} != ${want.seed}`);
      continue;
    }

    const popOk = actual.pop === want.pop;
    const fullOk = actual.full === want.full;

    if (popOk && fullOk) {
      console.log(`${green('ok')}   ${date} ${tier.padEnd(5)} ${dim(`seed ${want.seed}  ${actual.pop.slice(0, 12)}…`)}`);
      continue;
    }

    failures++;
    console.log(`${red('FAIL')} ${date} ${tier}`);
    if (!popOk) {
      console.log(`       ${red('population map changed')} — mapGenerator.js / rng.js / dailyChallenge.js`);
      console.log(`         expected ${want.pop}`);
      console.log(`         actual   ${actual.pop}`);
    } else if (!fullOk) {
      // pop matched but full didn't ⇒ the divergence is downstream of the
      // population map, i.e. in the county layer.
      console.log(`       ${red('counties changed')} (population map intact) — countyGenerator.js`);
      console.log(`         expected ${want.full}`);
      console.log(`         actual   ${actual.full}`);
    }
  }
}

if (args.has('--today')) {
  // Not an assertion — today's board has no frozen reference. This only proves
  // generation still runs on the live date and prints the hash for the record.
  const today = utcDateString(new Date());
  const daily = getDailyChallenge(utcDate(today));
  const built = buildDailyBoards(today);
  console.log(dim(`\ntoday ${today} — Daily #${daily.dayNumber}, ${daily.party}`));
  for (const tier of TIERS) {
    console.log(dim(`      ${tier.padEnd(5)} ${hashBoard(built[tier]).pop.slice(0, 24)}…`));
  }
}

if (failures > 0) {
  console.log(red(bold(`\n✗ ${failures} determinism failure${failures === 1 ? '' : 's'} across ${checked} boards\n`)));
  console.log('A past board changed. Every player who replays that daily, and every');
  console.log('shared challenge link for it, now gets a different map.\n');
  console.log(`${bold('If this was NOT intended')} — revert the change to the generation path`);
  console.log('(mapGenerator.js, countyGenerator.js, fairMapGenerator.js, rng.js,');
  console.log('dailyChallenge.js). Watch for reordered rng draws: the draw ORDER is');
  console.log('as frozen as the values, and a new draw in an old position re-rolls');
  console.log('everything after it.\n');
  console.log(`${bold('If this WAS intended')} — it is a new scoring era, not a hash update.`);
  console.log('Version-gate it by date (see LAUNCH_UTC in rng.js), keep the old era');
  console.log('generating the old boards, and add the new era alongside these anchors.\n');
  process.exit(1);
}

console.log(green(bold(`\n✓ ${checked} boards byte-identical\n`)));
