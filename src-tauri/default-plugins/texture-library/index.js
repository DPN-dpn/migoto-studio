import { decodeDDS } from "./dds-decoder.js";
import { ImageViewer } from "./image-viewer.js";
//#region default-plugins/texture-library/index.ts
/**
* DDS 및 이미지 에셋 뷰어 플러그인
* 탐색기에서 지원되는 이미지 확장자 클릭 시 에디터 탭 내에서 인터랙티브 캔버스 뷰어로 엽니다.
*/
var plugin = {
	activate(context) {
		const api = {
			decodeDDS,
			ImageViewer
		};
		context.plugins?.registerApi?.(api);
		context.editor.registerCustomViewer({
			id: "texture-library",
			name: "텍스처 라이브러리",
			extensions: [
				"dds",
				"png",
				"jpg",
				"jpeg",
				"bmp",
				"webp",
				"gif"
			],
			render(container, file) {
				context.logger?.info(`텍스처 에셋 열림: ${file.name} (${Math.round(file.bytes.length / 1024)} KB)`);
				const viewer = new ImageViewer(container);
				viewer.show({
					name: file.name,
					path: file.path,
					bytes: file.bytes
				});
				return () => viewer.dispose();
			}
		});
		return api;
	},
	deactivate() {}
};
//#endregion
export { plugin as default };
