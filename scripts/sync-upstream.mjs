// Sync grammar/snippets/language-config from the upstream VS Code extension (Open VSX: agmg.migoto-ini).
// Usage: node scripts/sync-upstream.mjs [--check]
//   --check : only report whether a newer upstream version exists (exit code 10 if so)
// Upstream files are stored verbatim in ./upstream and must never be edited by hand.

import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';

const NAMESPACE = 'agmg';
const NAME = 'migoto-ini';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'upstream');
const checkOnly = process.argv.includes('--check');

const meta = await (await fetch(`https://open-vsx.org/api/${NAMESPACE}/${NAME}/latest`)).json();
const latest = meta.version;
const versionFile = join(OUT, 'VERSION');
const current = existsSync(versionFile) ? (await readFile(versionFile, 'utf8')).trim() : null;

console.log(`[upstream] current=${current ?? 'none'} latest=${latest}`);
if (current === latest) {
  console.log('[upstream] up to date.');
  process.exit(0);
}
if (checkOnly) {
  console.log('[upstream] newer version available.');
  process.exit(10);
}

const res = await fetch(meta.files.download);
if (!res.ok) throw new Error(`download failed: ${res.status}`);
const files = unzipSync(new Uint8Array(await res.arrayBuffer()));
const text = (p) => new TextDecoder().decode(files[p]);

const pkg = JSON.parse(text('extension/package.json'));
const wanted = new Set(['extension/package.json', 'extension/LICENSE.txt', 'extension/readme.md', 'extension/changelog.md']);
for (const l of pkg.contributes?.languages ?? []) if (l.configuration) wanted.add(posix.join('extension', l.configuration));
for (const g of pkg.contributes?.grammars ?? []) wanted.add(posix.join('extension', g.path));
for (const s of pkg.contributes?.snippets ?? []) wanted.add(posix.join('extension', s.path));

await rm(OUT, { recursive: true, force: true });
for (const p of wanted) {
  if (!files[p]) { console.warn(`[upstream] missing in vsix: ${p}`); continue; }
  const dest = join(OUT, p.replace(/^extension\//, ''));
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, files[p]);
  console.log(`[upstream] wrote ${dest.replace(ROOT, '.')}`);
}
await writeFile(versionFile, latest + '\n');
console.log(`[upstream] synced to ${latest}`);
