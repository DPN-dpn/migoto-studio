# 10. 플러그인 생명주기 및 상태 관리 API (`context.plugins`)

Migoto Studio에 설치된 **플러그인들의 상태 조회 및 생명주기(활성화, 비활성화, 설치, 삭제) 이벤트**를 감지하고 상호작용하기 위한 API입니다.

플러그인이 켜지거나 꺼질 때, 새로운 기능 플러그인이 설치되거나 제거될 때 다른 플러그인이나 기능들이 즉시 감지하여 UI나 내부 동작을 동기화할 수 있습니다.

---

## 1. 플러그인 상태 조회

### `context.plugins.getPlugins()`
현재 설치/등록된 모든 플러그인 목록과 각 플러그인의 활성화 여부(`enabled`), 빌트인 여부(`isBuiltin`)를 반환합니다.

```typescript
const allPlugins = context.plugins.getPlugins();

for (const plugin of allPlugins) {
  context.logger.info(`- [${plugin.id}] ${plugin.name} (v${plugin.version}): ${plugin.enabled ? '활성' : '비활성'}`);
}
```

### `context.plugins.isEnabled(pluginId)`
특정 플러그인의 활성화 여부를 `boolean`으로 확인합니다.

```typescript
const isZzmiActive = context.plugins.isEnabled('zzmi-support');
if (isZzmiActive) {
  context.logger.info('ZZMI 지원 플러그인이 현재 활성화되어 있습니다.');
}
```

---

## 2. 플러그인 생명주기 이벤트 감지

### `context.plugins.onDidChangePlugins(listener)`
플러그인이 **활성화(`activated`)**, **비활성화(`deactivated`)**, **설치(`installed`)**, **삭제(`uninstalled`)**될 때 호출되는 이벤트 리스너를 등록합니다.  
플러그인이 비활성화되면 자동으로 리스너가 해제됩니다.

- **반환값**: 리스너 등록 해제 함수 `() => void`

```typescript
const unlisten = context.plugins.onDidChangePlugins((event) => {
  context.logger.info(`[플러그인 변경 감지] 동작: ${event.action}, 플러그인: ${event.manifest.name} (${event.pluginId})`);

  switch (event.action) {
    case 'activated':
      // 특정 플러그인이 활성화되었을 때 연동 설정 활성화
      if (event.pluginId === 'asset-viewer') {
        context.logger.info('3D 에셋 뷰어가 활성화되어 연동 기능을 준비합니다.');
      }
      break;

    case 'deactivated':
      // 플러그인이 비활성화되었을 때 연동 캐시 정리
      break;

    case 'installed':
      // 신규 플러그인 설치 알림
      context.ui.showToast(`새 플러그인 "${event.manifest.name}"이(가) 설치되었습니다.`, 'info');
      break;

    case 'uninstalled':
      // 플러그인 삭제 알림
      break;
  }
});
```

---

## 3. GitHub 플러그인 설치 및 업데이트 확인

### `context.plugins.installFromGitHub(url)`
GitHub 저장소 링크(예: `https://github.com/owner/repo` 또는 `owner/repo`)로부터 플러그인을 다운로드하여 설치합니다.
최신 Release의 ZIP 에셋을 우선 탐색하며, Release가 없는 경우 기본 브랜치의 아카이브 ZIP을 자동으로 추출하여 설치합니다.

```typescript
// GitHub 저장소로부터 직접 플러그인 설치
await context.plugins.installFromGitHub('https://github.com/DPN-dpn/migoto-custom-plugin');
```

### `context.plugins.checkUpdates()`
GitHub 출처가 등록된 모든 플러그인의 최신 릴리스 버전을 비동기로 확인하고, 새 버전이 발견되면 업데이트 가능 상태를 갱신합니다.

```typescript
// 업데이트 확인 수동 트리거 (보통 플러그인 패널 새로고침 시 자동 실행)
await context.plugins.checkUpdates();
```

### `context.plugins.getGitHubSource(pluginId)`
특정 플러그인의 GitHub 출처 정보(`owner`, `repo`, `installedVersion`, `updateAvailable` 등)를 조회합니다.

```typescript
const source = context.plugins.getGitHubSource('my-custom-plugin');
if (source?.updateAvailable) {
  context.logger.info(`업데이트 가능: v${source.installedVersion} -> v${source.lastCheckedVersion}`);
}
```

---

## 4. 플러그인 간 API 공유 및 종속성 관리

### `context.plugins.registerApi<T>(api: T)`
현재 플러그인의 공개 API 객체를 등록하여 다른 플러그인이 사용할 수 있도록 공유합니다.  
(`activate(context)` 함수에서 객체를 `return`해도 자동으로 동일하게 등록됩니다.)

```typescript
// 플러그인 A (라이브러리 제공자)
export default {
  activate(context) {
    context.plugins.registerApi({
      calculateMeshBoundingBox: (meshData) => { /* ... */ },
    });
  }
};
```

### `context.plugins.getPluginApi<T>(pluginId: string): T | undefined`
다른 플러그인이 공개한 API 객체를 안전하게 가져옵니다. 대상 플러그인이 활성화되어 있지 않거나 API를 등록하지 않았다면 `undefined`를 반환합니다.

```typescript
// 플러그인 B (소비자)
const mathLib = context.plugins.getPluginApi<{ calculateMeshBoundingBox: Function }>('mesh-math-lib');
if (mathLib) {
  const bbox = mathLib.calculateMeshBoundingBox(mesh);
}
```

### `context.plugins.hasPluginApi(pluginId: string): boolean`
특정 플러그인의 공개 API 등록 여부를 확인합니다.

### `context.plugins.checkDependencies(pluginId: string): DependencyCheckResult[]`
특정 플러그인의 매니페스트에 선언된 모든 종속성(`dependencies`)의 충족 상태(정상, 누락, 비활성화, 버전 불일치)를 검사합니다.

```typescript
const depResults = context.plugins.checkDependencies('my-tool');
for (const res of depResults) {
  if (!res.satisfied) {
    context.logger.warn(`종속성 문제 [${res.id}]: ${res.message} (상태: ${res.status})`);
  }
}
```

### `context.plugins.installDependency(dependencyId: string, spec?: string): Promise<boolean>`
필요한 종속성 플러그인을 GitHub 또는 지정된 스펙 경로로부터 비동기로 다운로드하여 설치합니다.

```typescript
// 원격 종속성 자동 설치 시도
await context.plugins.installDependency('shared-lib', 'https://github.com/owner/shared-lib#>=1.0.0');
```

---

## 5. 주요 데이터 타입 정의

```typescript
export type PluginLifecycleAction = 'activated' | 'deactivated' | 'installed' | 'uninstalled';

export interface PluginLifecycleEvent {
  action: PluginLifecycleAction;
  pluginId: string;
  manifest: PluginManifest;
}

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  isBuiltin: boolean;
}

export interface PluginGitHubSource {
  owner: string;
  repo: string;
  url: string;
  installedVersion: string;
  lastCheckedVersion?: string;
  updateAvailable?: boolean;
  latestZipUrl?: string;
  checkedAt?: number;
}

export type DependencyStatusReason =
  | 'ok'
  | 'missing'
  | 'disabled'
  | 'version_mismatch'
  | 'circular';

export interface DependencyCheckResult {
  id: string;
  satisfied: boolean;
  status: DependencyStatusReason;
  installedVersion?: string;
  message: string;
}
```

