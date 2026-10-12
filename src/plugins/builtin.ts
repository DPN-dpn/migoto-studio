import type { MigotoPlugin, PluginManifest } from './types.ts';

// 1. Python Runner
import pythonRunnerManifestData from './builtin/python-runner/plugin.json' with { type: 'json' };
import pythonRunnerPlugin from './builtin/python-runner/index.ts';

// 2. Asset Viewer
import assetViewerManifestData from './builtin/asset-viewer/plugin.json' with { type: 'json' };
import assetViewerPlugin from './builtin/asset-viewer/index.ts';

// 3. AI Assistant
import aiAssistantManifestData from './builtin/ai-assistant/plugin.json' with { type: 'json' };
import aiAssistantPlugin from './builtin/ai-assistant/index.ts';

// 4. Resource Checker
import resourceCheckerManifestData from './builtin/resource-checker/plugin.json' with { type: 'json' };
import resourceCheckerPlugin from './builtin/resource-checker/index.ts';

// 5. ZZMI Support
import zzmiSupportManifestData from './builtin/zzmi-support/plugin.json' with { type: 'json' };
import zzmiSupportPlugin from './builtin/zzmi-support/index.ts';

export interface BuiltinPluginDef {
  manifest: PluginManifest;
  createPlugin: () => MigotoPlugin;
  standaloneScript?: string;
}

export const BUILTIN_PLUGINS: BuiltinPluginDef[] = [
  {
    manifest: pythonRunnerManifestData as PluginManifest,
    createPlugin: () => pythonRunnerPlugin,
  },
  {
    manifest: assetViewerManifestData as PluginManifest,
    createPlugin: () => assetViewerPlugin,
  },
  {
    manifest: aiAssistantManifestData as PluginManifest,
    createPlugin: () => aiAssistantPlugin,
  },
  {
    manifest: resourceCheckerManifestData as PluginManifest,
    createPlugin: () => resourceCheckerPlugin,
  },
  {
    manifest: zzmiSupportManifestData as PluginManifest,
    createPlugin: () => zzmiSupportPlugin,
  },
];
