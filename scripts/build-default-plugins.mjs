import { build } from 'vite';
import { resolve } from 'node:path';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const plugins = [
  'python-runner',
  'asset-viewer',
  'ai-assistant',
  'resource-checker',
  'zzmi-support',
];

async function buildDefaultPlugins() {
  const rootDir = process.cwd();

  for (const id of plugins) {
    const srcDir = resolve(rootDir, 'src/plugins/builtin', id);
    const entryFile = resolve(srcDir, 'index.ts');
    const manifestFile = resolve(srcDir, 'plugin.json');
    const iconFile = resolve(srcDir, 'icon.svg');

    if (!existsSync(entryFile) || !existsSync(manifestFile)) {
      console.warn(`[build-default-plugins] Skipping ${id}: missing index.ts or plugin.json`);
      continue;
    }

    const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));

    // Embed raw SVG icon into manifest for immediate rendering
    if (existsSync(iconFile)) {
      manifest.icon = (await readFile(iconFile, 'utf8')).trim();
    }
    manifest.main = 'plugin.js';

    // Bundle standalone ES module with Vite
    const tempOutDir = resolve(rootDir, '.toolchain/tmp/plugins', id);
    await build({
      configFile: false,
      logLevel: 'warn',
      build: {
        outDir: tempOutDir,
        emptyOutDir: true,
        lib: {
          entry: entryFile,
          formats: ['es'],
          fileName: () => 'plugin.js',
        },
      },
    });

    const bundledCode = await readFile(resolve(tempOutDir, 'plugin.js'), 'utf8');
    const manifestJson = JSON.stringify(manifest, null, 2);

    const targetDirs = [
      resolve(rootDir, 'src-tauri/default-plugins', id),
      resolve(rootDir, 'default-plugins', id),
      resolve(rootDir, 'data/plugins', id),
    ];

    for (const dir of targetDirs) {
      await mkdir(dir, { recursive: true });
      await writeFile(resolve(dir, 'plugin.json'), manifestJson, 'utf8');
      await writeFile(resolve(dir, 'plugin.js'), bundledCode, 'utf8');

      // Remove legacy placeholder main.js if it exists in data folder
      const legacyMain = resolve(dir, 'main.js');
      if (existsSync(legacyMain)) {
        await rm(legacyMain, { force: true });
      }
    }

    console.log(`[build-default-plugins] Built ${id} -> plugin.json + plugin.js`);
  }
}

buildDefaultPlugins().catch((err) => {
  console.error('[build-default-plugins] Failed:', err);
  process.exit(1);
});
