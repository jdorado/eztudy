import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = name => readFileSync(join(root, name), 'utf8');
const packageJson = JSON.parse(read('package.json'));
const pluginJson = JSON.parse(read('ez-plugin.json'));
const pyproject = read('pyproject.toml');
const lockfile = read('uv.lock');
const dockerfile = read('Dockerfile');
const readme = read('README.md').toLowerCase();

const firstMatch = (text, pattern, label) => {
  const match = text.match(pattern);
  assert.ok(match, `Missing ${label}`);
  return match[1];
};

const packageVersion = firstMatch(pyproject, /^version\s*=\s*"([^"]+)"/m, 'project version');
const lockedVersion = firstMatch(
  lockfile,
  /\[\[package\]\]\s+name\s*=\s*"eztudy-publishing"\s+version\s*=\s*"([^"]+)"/m,
  'locked project version',
);
const setuptoolsVersion = firstMatch(
  pyproject,
  /^requires\s*=\s*\["setuptools==([^"\]]+)"\]/m,
  'exact setuptools build pin',
);

assert.equal(packageJson.name, '@jc_stack/ez-eztudy');
assert.equal(packageJson.private, true, 'local Eztudy package must remain private');
assert.equal(packageJson.version, packageVersion);
assert.equal(packageJson.version, pluginJson.version);
assert.equal(packageJson.version, lockedVersion);
assert.match(setuptoolsVersion, /^\d+\.\d+\.\d+$/);
assert.equal(packageJson.bin?.eztudy, 'bin/eztudy');
assert.equal(packageJson.repository?.directory, 'plugin');
assert.equal(packageJson.repository?.url, 'git+https://github.com/jdorado/eztudy.git');
assert.equal(packageJson.engines?.node, '>=22');
assert.equal(packageJson.packageManager, 'pnpm@10.30.3');

const requiredFiles = [
  '.dockerignore',
  'Dockerfile',
  'LICENSE',
  'README.md',
  'THIRD_PARTY_NOTICES.md',
  'ez-deployment.json',
  'ez-plugin.json',
  'pyproject.toml',
  'uv.lock',
  'bin/eztudy',
  'eztudy_publishing/cli.py',
  'eztudy_publishing/schema.py',
  'scripts/release-check.mjs',
  'tests/test_schema.py',
  'skills/authoring/SKILL.md',
];
for (const file of requiredFiles) {
  assert.ok(packageJson.files.includes(file),
    `package.json files must allowlist ${file}`);
  assert.ok(existsSync(join(root, file)), `Missing package file ${file}`);
}

assert.match(dockerfile, /COPY pyproject\.toml uv\.lock/);
assert.match(dockerfile, /FROM python:3\.12-slim-trixie@sha256:[0-9a-f]{64}/);
assert.match(dockerfile, /COPY --from=ghcr\.io\/astral-sh\/uv:0\.11\.15@sha256:[0-9a-f]{64} \/uv \/uvx \/bin\//);
assert.match(dockerfile, /uv sync --locked/);
assert.ok(readme.includes('uv.lock'));
assert.ok(readme.includes('uv lock --check'));

const lockCheck = spawnSync('uv', ['lock', '--check'], {
  cwd: root,
  encoding: 'utf8',
});
assert.equal(lockCheck.status, 0, `uv lock --check failed:\n${lockCheck.stderr || lockCheck.stdout}`);

const pack = spawnSync('npm', ['pack', '--dry-run', '--ignore-scripts', '--json'], {
  cwd: root,
  encoding: 'utf8',
});
assert.equal(pack.status, 0, `npm pack --dry-run failed:\n${pack.stderr || pack.stdout}`);
const report = JSON.parse(pack.stdout)[0];
const packedFiles = new Set(report.files.map(file => file.path));
for (const file of [
  'THIRD_PARTY_NOTICES.md',
  'uv.lock',
  'Dockerfile',
  'ez-plugin.json',
  'scripts/release-check.mjs',
  'tests/test_schema.py',
]) {
  assert.ok(packedFiles.has(file), `Packed artifact is missing ${file}`);
}
for (const file of packedFiles) {
  assert.ok(!/(^|\/)(\.venv|__pycache__|[^/]+\.egg-info)(\/|$)/.test(file),
    `Generated environment leaked into package: ${file}`);
  assert.ok(!/(\.pyc$|(^|\/)\.env(?:\.|$))/.test(file),
    `Generated or secret file leaked into package: ${file}`);
}

console.log(JSON.stringify({
  ok: true,
  package: packageJson.name,
  version: packageJson.version,
  lockedVersion,
  setuptoolsVersion,
  packedFileCount: packedFiles.size,
}, null, 2));
