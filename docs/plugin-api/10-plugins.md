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

## 3. 주요 데이터 타입 정의

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
```
