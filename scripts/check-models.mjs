#!/usr/bin/env node
// The model calibration harness. Run: `npm run check:models`
//
// WHY THIS EXISTS
// Zeromander's numbers make claims — about the literature, about the law, about
// what the game itself does. A metric can be wired up correctly and still be
// wrong: calibrated to the wrong scale, drifting from the paper it cites, or
// quietly violating an invariant the copy asserts to the player. The board
// generator in particular can pass every numeric test and still look wrong (and
// vice versa: the vote-share invariant below is invisible on screen but the UI
// says "X% of the vote", so it has to stay honest).
//
// So: every model spec lands with its calibration targets asserted here, and
// those targets are renegotiated in the spec document first — never silently in
// code. This is the contract from the MODEL-SPECS appendix.
//
// ADDING CHECKS
// Drop a file at scripts/models/<name>.check.mjs exporting:
//   export const spec = 'Spec 1 — Metrics v2';   // what this file covers
//   export function run({ assert }) { ... }      // call assert.* per target
// It is discovered automatically. Assertions collect rather than throw, so one
// run reports every failing target instead of just the first.

import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = join(HERE, 'models');

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const num = (v) => (typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(4)) : String(v));

// Collecting assertion API. Every method records a target result; none throw.
// `detail` is the measured evidence — always printed on failure, and printed on
// success too, because a target that passes by a hair is worth seeing.
function makeAssert(results) {
  const record = (pass, label, detail) => results.push({ pass, label, detail });
  return {
    ok(label, condition, detail = '') {
      record(!!condition, label, detail);
    },
    equal(label, actual, expected) {
      record(Object.is(actual, expected), label, `${num(actual)} ${Object.is(actual, expected) ? '==' : '!='} ${num(expected)}`);
    },
    // |actual - expected| <= tolerance
    close(label, actual, expected, tolerance, unit = '') {
      const delta = Math.abs(actual - expected);
      record(delta <= tolerance, label, `${num(actual)}${unit} vs ${num(expected)}${unit} — off by ${num(delta)}${unit} (tol ${num(tolerance)}${unit})`);
    },
    // lo <= actual <= hi — the shape most MODEL-SPECS calibration targets take
    range(label, actual, lo, hi, unit = '') {
      record(actual >= lo && actual <= hi, label, `${num(actual)}${unit} in [${num(lo)}, ${num(hi)}]${unit}`);
    },
  };
}

let files = [];
try {
  files = readdirSync(MODELS_DIR).filter((f) => f.endsWith('.check.mjs')).sort();
} catch {
  files = [];
}

console.log(bold('\nModel calibration checks\n'));

if (files.length === 0) {
  console.log(dim('No checks registered yet — add scripts/models/<name>.check.mjs as specs land.\n'));
  process.exit(0);
}

let totalPass = 0;
let totalFail = 0;

for (const file of files) {
  const mod = await import(pathToFileURL(join(MODELS_DIR, file)).href);
  const results = [];
  const assert = makeAssert(results);
  const started = Date.now();

  try {
    await mod.run({ assert });
  } catch (err) {
    results.push({ pass: false, label: `${file} threw`, detail: err?.stack || String(err) });
  }

  const failed = results.filter((r) => !r.pass).length;
  const elapsed = Date.now() - started;
  console.log(`${failed === 0 ? green('✓') : red('✗')} ${bold(mod.spec || file)} ${dim(`(${elapsed}ms)`)}`);
  for (const r of results) {
    console.log(`   ${r.pass ? green('ok') : red('FAIL')}  ${r.label}`);
    if (r.detail) console.log(`         ${dim(r.detail)}`);
  }
  console.log('');

  totalPass += results.length - failed;
  totalFail += failed;
}

if (totalFail > 0) {
  console.log(red(bold(`✗ ${totalFail} target${totalFail === 1 ? '' : 's'} failed, ${totalPass} passed\n`)));
  console.log('A calibration target is a claim this game makes about its own model.');
  console.log('If the model changed on purpose, renegotiate the target in MODEL-SPECS');
  console.log('first, then update the check — never the other way round.\n');
  process.exit(1);
}

console.log(green(bold(`✓ ${totalPass} calibration targets hold\n`)));
