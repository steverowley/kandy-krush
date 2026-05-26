// Service worker SHELL hygiene tests.
// Pulls the SHELL array out of service-worker.js and verifies every
// path actually exists on disk + no duplicates slipped in + every
// source-tree JS file is precached (so offline cold-boot stays
// complete as new modules ship).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..');

const sw = readFileSync(join(repoRoot, 'service-worker.js'), 'utf8');

// Extract the SHELL array literal. Cheap & cheerful regex — we own
// the file so the format is stable.
const match = sw.match(/const SHELL = \[([\s\S]*?)\];/);
if (!match) throw new Error('Could not find SHELL in service-worker.js');
const SHELL = match[1]
  .split(',')
  .map((line) => line.trim().replace(/^['"`]|['"`]$/g, ''))
  .filter((s) => s && !s.startsWith('//'));

test('every SHELL path resolves to a real file on disk', () => {
  for (const rel of SHELL) {
    if (rel === './') continue; // the SW serves index.html for the root request
    const abs = join(repoRoot, rel.replace(/^\.\//, ''));
    assert.ok(existsSync(abs), `SHELL entry missing on disk: ${rel}`);
  }
});

test('SHELL has no duplicates', () => {
  const seen = new Set();
  for (const rel of SHELL) {
    assert.ok(!seen.has(rel), `Duplicate SHELL entry: ${rel}`);
    seen.add(rel);
  }
});

test('SHELL includes index.html + main.js (sanity)', () => {
  assert.ok(SHELL.includes('./index.html'));
  assert.ok(SHELL.includes('./src/main.js'));
});

// Walk every .js file under src/ and verify the SHELL list precaches
// it. If this fails after adding a new module, add the file to
// SHELL in service-worker.js — otherwise an offline cold-boot will
// fail when that module is import()ed.
test('every src/ JS file is in SHELL', () => {
  function walk(dir, out = []) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) walk(full, out);
      else if (entry.endsWith('.js')) out.push(full);
    }
    return out;
  }
  const srcDir = join(repoRoot, 'src');
  const srcFiles = walk(srcDir).map((abs) => {
    const rel = relative(repoRoot, abs).replaceAll('\\', '/');
    return `./${rel}`;
  });
  const shellSet = new Set(SHELL);
  const missing = srcFiles.filter((f) => !shellSet.has(f));
  assert.deepEqual(
    missing,
    [],
    `src/ files not precached by SHELL — add them to service-worker.js:\n${missing.join('\n')}`
  );
});
