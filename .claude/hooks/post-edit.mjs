// PostToolUse hook (Edit|Write): format and lint the edited file, and for engine/AI files run the
// related Vitest suites. Exit code 2 sends the problems back to Claude.
// Binaries are launched with `node <entry>` because npm's .cmd shims are awkward to spawn on Windows.
// Paths are passed relative to the project root: on Windows the tool may report `c:\...` while
// Vitest's root is `C:/...`, and that casing mismatch loads Vitest twice and breaks the run.
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const input = JSON.parse(readFileSync(0, 'utf8'));
const file = input.tool_input?.file_path;
// Upper-case the Windows drive letter: a `c:\` root makes Vitest load itself twice.
const root = (process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd()).replace(
  /^([a-z]):/,
  (_, d) => `${d.toUpperCase()}:`,
);
if (!file || !existsSync(file)) process.exit(0);

const rel = path.relative(root, file).split(path.sep).join('/');
if (rel.startsWith('..') || /^(node_modules|dist|docs\/.*\.pdf)/.test(rel)) process.exit(0);

const run = (entry, args) =>
  spawnSync(process.execPath, [path.join(root, 'node_modules', entry), ...args], {
    cwd: root,
    encoding: 'utf8',
  });
const problems = [];

if (/\.(ts|tsx|js|mjs|json|css|md|html)$/.test(rel)) {
  const r = run('prettier/bin/prettier.cjs', ['--write', '--log-level', 'warn', rel]);
  if (r.status !== 0) problems.push(`prettier ${rel}:\n${r.stderr || r.stdout}`);
}

if (/\.(ts|tsx)$/.test(rel)) {
  const r = run('eslint/bin/eslint.js', ['--fix', rel]);
  if (r.status !== 0) problems.push(`eslint ${rel}:\n${r.stdout || r.stderr}`);
}

// Fast feedback on rules: skip the slow property suites here; `npm run check` runs everything.
if (/^src\/(engine|ai)\/.*\.ts$/.test(rel)) {
  const r = run('vitest/vitest.mjs', [
    'related',
    rel,
    '--run',
    '--reporter=agent',
    '--exclude',
    '**/*.property.test.ts',
    '--passWithNoTests',
  ]);
  if (r.status !== 0)
    problems.push(`vitest related ${rel}:\n${(r.stdout + r.stderr).slice(-4000)}`);
}

if (problems.length > 0) {
  process.stderr.write(problems.join('\n\n'));
  process.exit(2);
}
