import { build } from 'vite';
import { resolve } from 'node:path';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const plugins = [
  'python-runner',
  'asset-viewer',
  'ai-assistant',
  'custom-lint',
  'zzmi-support',
];

const webCompatiblePlugins = [
  'asset-viewer',
  'ai-assistant',
  'custom-lint',
  'zzmi-support',
];

async function buildDefaultPlugins() {
  const rootDir = process.cwd();

  for (const id of plugins) {
    const srcDir = resolve(rootDir, 'default-plugins', id);
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

    // Bundle standalone ES module with Vite (keep readable without minification for reference)
    const tempOutDir = resolve(rootDir, '.toolchain/tmp/plugins', id);
    await build({
      configFile: false,
      logLevel: 'warn',
      build: {
        outDir: tempOutDir,
        emptyOutDir: true,
        minify: false,
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

    if (webCompatiblePlugins.includes(id)) {
      targetDirs.push(resolve(rootDir, 'public/default-plugins', id));
    }

    if (process.env.APPDATA) {
      const appDataDir = resolve(process.env.APPDATA, 'MigotoStudio', 'plugins', id);
      targetDirs.push(appDataDir);
    }

    for (const dir of targetDirs) {
      await mkdir(dir, { recursive: true });
      const jsonPath = resolve(dir, 'plugin.json');
      const jsPath = resolve(dir, 'plugin.js');

      if (!existsSync(jsonPath) || (await readFile(jsonPath, 'utf8')) !== manifestJson) {
        await writeFile(jsonPath, manifestJson, 'utf8');
      }
      if (!existsSync(jsPath) || (await readFile(jsPath, 'utf8')) !== bundledCode) {
        await writeFile(jsPath, bundledCode, 'utf8');
      }

      // Remove legacy placeholder main.js if it exists in data folder
      const legacyMain = resolve(dir, 'main.js');
      if (existsSync(legacyMain)) {
        await rm(legacyMain, { force: true });
      }
    }

    console.log(`[build-default-plugins] Built ${id} -> plugin.json + plugin.js`);
  }

  // Ensure desktop-only plugins or legacy renamed plugins are pruned
  const pruneDirs = [
    resolve(rootDir, 'public/default-plugins', 'python-runner'),
    resolve(rootDir, 'public/default-plugins', 'resource-checker'),
    resolve(rootDir, 'src-tauri/default-plugins', 'resource-checker'),
    resolve(rootDir, 'data/plugins', 'resource-checker'),
  ];
  if (process.env.APPDATA) {
    pruneDirs.push(resolve(process.env.APPDATA, 'MigotoStudio', 'plugins', 'resource-checker'));
  }
  for (const dir of pruneDirs) {
    if (existsSync(dir)) {
      await rm(dir, { recursive: true, force: true });
    }
  }

  // Write index.json for web discovery if changed
  await mkdir(resolve(rootDir, 'public/default-plugins'), { recursive: true });
  const indexJson = JSON.stringify(webCompatiblePlugins, null, 2);
  const indexPath = resolve(rootDir, 'public/default-plugins/index.json');
  if (!existsSync(indexPath) || (await readFile(indexPath, 'utf8')) !== indexJson) {
    await writeFile(indexPath, indexJson, 'utf8');
  }
  console.log('[build-default-plugins] Generated public/default-plugins/index.json');
}

buildDefaultPlugins().catch((err) => {
  console.error('[build-default-plugins] Failed:', err);
  process.exit(1);
});
