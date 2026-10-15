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

    if (webCompatiblePlugins.includes(id)) {
      targetDirs.push(resolve(rootDir, 'public/default-plugins', id));
    }

    if (process.env.APPDATA) {
      const appDataDir = resolve(process.env.APPDATA, 'MigotoStudio', 'plugins', id);
      targetDirs.push(appDataDir);
    }

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

  // Write index.json for web discovery
  await mkdir(resolve(rootDir, 'public/default-plugins'), { recursive: true });
  await writeFile(
    resolve(rootDir, 'public/default-plugins/index.json'),
    JSON.stringify(webCompatiblePlugins, null, 2),
    'utf8',
  );
  console.log('[build-default-plugins] Generated public/default-plugins/index.json');
}

buildDefaultPlugins().catch((err) => {
  console.error('[build-default-plugins] Failed:', err);
  process.exit(1);
});
