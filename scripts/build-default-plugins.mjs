import { build } from 'vite';
import { resolve } from 'node:path';
import { readFile, writeFile, mkdir, rm, readdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const plugins = [
  'custom-lint',
  'zzmi-support',
  'texture-library',
  'python-runner',
  'ai-assistant',
];

const webCompatiblePlugins = [
  'custom-lint',
  'zzmi-support',
  'texture-library',
  'ai-assistant',
];

/**
 * Copies all files from srcDir to destDir recursively.
 */
async function copyDir(srcDir, destDir) {
  await mkdir(destDir, { recursive: true });
  const entries = await readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = resolve(srcDir, entry.name);
    const destPath = resolve(destDir, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else if (entry.isFile()) {
      await copyFile(srcPath, destPath);
    }
  }
}

async function buildDefaultPlugins() {
  const rootDir = process.cwd();

  for (const id of plugins) {
    const srcDir = resolve(rootDir, 'default-plugins', id);
    const entryFile = resolve(srcDir, 'index.ts');
    const manifestFile = resolve(srcDir, 'plugin.json');
    const iconFile = resolve(srcDir, 'icon.svg');
    const readmeFile = resolve(srcDir, 'README.md');

    if (!existsSync(entryFile) || !existsSync(manifestFile)) {
      console.warn(`[build-default-plugins] Skipping ${id}: missing index.ts or plugin.json`);
      continue;
    }

    const baseManifest = JSON.parse(await readFile(manifestFile, 'utf8'));

    // Embed raw SVG icon into manifest for immediate rendering
    if (existsSync(iconFile)) {
      baseManifest.icon = (await readFile(iconFile, 'utf8')).trim();
    }

    // 1. Build modular ES modules for Desktop (preserving separate module files)
    const tempOutDirModular = resolve(rootDir, '.toolchain/tmp/plugins-modular', id);
    await build({
      configFile: false,
      publicDir: false,
      logLevel: 'warn',
      build: {
        outDir: tempOutDirModular,
        emptyOutDir: true,
        minify: false,
        lib: {
          entry: entryFile,
          formats: ['es'],
        },
        rollupOptions: {
          output: {
            preserveModules: true,
            preserveModulesRoot: srcDir,
            entryFileNames: '[name].js',
          },
        },
      },
    });

    // 2. Build standalone bundled plugin.js for Web & Fallback
    const tempOutDirBundled = resolve(rootDir, '.toolchain/tmp/plugins-bundled', id);
    await build({
      configFile: false,
      publicDir: false,
      logLevel: 'warn',
      build: {
        outDir: tempOutDirBundled,
        emptyOutDir: true,
        minify: false,
        lib: {
          entry: entryFile,
          formats: ['es'],
          fileName: () => 'plugin.js',
        },
      },
    });

    const bundledCode = await readFile(resolve(tempOutDirBundled, 'plugin.js'), 'utf8');

    // Desktop Manifest: main -> index.js
    const desktopManifest = { ...baseManifest, main: 'index.js' };
    const desktopManifestJson = JSON.stringify(desktopManifest, null, 2);

    // Web Manifest: main -> plugin.js
    const webManifest = { ...baseManifest, main: 'plugin.js' };
    const webManifestJson = JSON.stringify(webManifest, null, 2);

    // 3. Write Web Distribution (single bundle for network efficiency)
    if (webCompatiblePlugins.includes(id)) {
      const webDir = resolve(rootDir, 'public/default-plugins', id);
      await mkdir(webDir, { recursive: true });
      await writeFile(resolve(webDir, 'plugin.json'), webManifestJson, 'utf8');
      await writeFile(resolve(webDir, 'plugin.js'), bundledCode, 'utf8');
      if (existsSync(iconFile)) {
        await copyFile(iconFile, resolve(webDir, 'icon.svg'));
      }
    }

    // 4. Write Desktop Distributions (modular files + single bundle fallback + index.js entry)
    const desktopDirs = [
      resolve(rootDir, 'src-tauri/default-plugins', id),
      resolve(rootDir, 'default-plugins', id),
      resolve(rootDir, 'data/plugins', id),
    ];

    if (process.env.APPDATA) {
      desktopDirs.push(resolve(process.env.APPDATA, 'MigotoStudio', 'plugins', id));
    }

    for (const dir of desktopDirs) {
      await mkdir(dir, { recursive: true });

      // Copy all modular files (*.js)
      await copyDir(tempOutDirModular, dir);

      // Write desktop manifest
      await writeFile(resolve(dir, 'plugin.json'), desktopManifestJson, 'utf8');

      // Also write bundled plugin.js as fallback (used by rust include_str and standalone imports)
      await writeFile(resolve(dir, 'plugin.js'), bundledCode, 'utf8');

      // Copy README & icon if present
      if (existsSync(readmeFile)) {
        await copyFile(readmeFile, resolve(dir, 'README.md'));
      }
      if (existsSync(iconFile)) {
        await copyFile(iconFile, resolve(dir, 'icon.svg'));
      }

      // Remove legacy placeholder main.js if it exists
      const legacyMain = resolve(dir, 'main.js');
      if (existsSync(legacyMain)) {
        await rm(legacyMain, { force: true });
      }
    }

    console.log(`[build-default-plugins] Built ${id} (Desktop modular index.js + Web bundled plugin.js)`);
  }

  // Ensure desktop-only plugins or legacy renamed plugins are pruned
  const pruneDirs = [
    resolve(rootDir, 'public/default-plugins', 'python-runner'),
    resolve(rootDir, 'public/default-plugins', 'resource-checker'),
    resolve(rootDir, 'src-tauri/default-plugins', 'resource-checker'),
    resolve(rootDir, 'data/plugins', 'resource-checker'),
    resolve(rootDir, 'public/default-plugins', 'asset-viewer'),
    resolve(rootDir, 'src-tauri/default-plugins', 'asset-viewer'),
    resolve(rootDir, 'data/plugins', 'asset-viewer'),
  ];
  if (process.env.APPDATA) {
    pruneDirs.push(resolve(process.env.APPDATA, 'MigotoStudio', 'plugins', 'resource-checker'));
    pruneDirs.push(resolve(process.env.APPDATA, 'MigotoStudio', 'plugins', 'asset-viewer'));
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
