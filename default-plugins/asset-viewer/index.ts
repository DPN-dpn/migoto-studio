import { definePlugin, type PluginContext } from '../../src/plugins/api.ts';
import { ImageViewer } from './image-viewer.ts';

/**
 * DDS 및 이미지 에셋 뷰어 플러그인
 * 탐색기에서 지원되는 이미지 확장자 클릭 시 에디터 탭 내에서 인터랙티브 캔버스 뷰어로 엽니다.
 */
export default definePlugin({
  activate(context: PluginContext) {
    // 1. 에디터 커스텀 뷰어 등록
    context.editor.registerCustomViewer({
      id: 'asset-viewer',
      name: 'DDS / 텍스처 뷰어',
      extensions: ['dds', 'png', 'jpg', 'jpeg', 'bmp', 'webp', 'gif'],
      render(container, file) {
        const viewer = new ImageViewer(container);
        viewer.show({
          name: file.name,
          path: file.path,
          bytes: file.bytes,
        });
        return () => viewer.dispose();
      },
    });

    // 2. 상단 [플러그인] 메뉴: 파일 선택기를 통한 텍스처 열기
    context.ui.registerMenuItem({
      label: '텍스처/DDS 이미지 열기…',
      action: async () => {
        try {
          const filePath = await context.workspace.pickFile({
            title: '텍스처/이미지 파일 선택',
            filters: [
              { name: 'Textures & Images', extensions: ['dds', 'png', 'jpg', 'jpeg', 'bmp', 'webp', 'gif'] },
            ],
          });
          if (filePath) {
            await context.workspace.openFile(filePath);
          }
        } catch (err) {
          context.ui.showToast(`이미지 열기 오류: ${err}`, 'error');
        }
      },
    });
  },
  deactivate() {},
});
