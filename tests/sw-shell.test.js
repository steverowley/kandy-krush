// Service worker SHELL hygiene tests.
// Pulls the SHELL array out of service-worker.js and verifies every
// path actually exists on disk + no duplicates slipped in.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

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
