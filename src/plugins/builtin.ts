import type { MigotoPlugin, PluginManifest } from './types.ts';

// 1. Python Runner
import pythonRunnerManifestData from './builtin/python-runner/plugin.json' with { type: 'json' };
import pythonRunnerPlugin from './builtin/python-runner/index.ts';
import { standaloneScript as pythonRunnerStandalone } from './builtin/python-runner/standalone.ts';

// 2. Asset Viewer
import assetViewerManifestData from './builtin/asset-viewer/plugin.json' with { type: 'json' };
import assetViewerPlugin from './builtin/asset-viewer/index.ts';
import { standaloneScript as assetViewerStandalone } from './builtin/asset-viewer/standalone.ts';

// 3. AI Assistant
import aiAssistantManifestData from './builtin/ai-assistant/plugin.json' with { type: 'json' };
import aiAssistantPlugin from './builtin/ai-assistant/index.ts';
import { standaloneScript as aiAssistantStandalone } from './builtin/ai-assistant/standalone.ts';

export interface BuiltinPluginDef {
  manifest: PluginManifest;
  createPlugin: () => MigotoPlugin;
  standaloneScript: string;
}

export const BUILTIN_PLUGINS: BuiltinPluginDef[] = [
  {
    manifest: pythonRunnerManifestData as PluginManifest,
    createPlugin: () => pythonRunnerPlugin,
    standaloneScript: pythonRunnerStandalone,
  },
  {
    manifest: assetViewerManifestData as PluginManifest,
    createPlugin: () => assetViewerPlugin,
    standaloneScript: assetViewerStandalone,
  },
  {
    manifest: aiAssistantManifestData as PluginManifest,
    createPlugin: () => aiAssistantPlugin,
    standaloneScript: aiAssistantStandalone,
  },
];
