import iconSvg from "./icon.js";
import { executePythonScript } from "./runner.js";
import { buildPythonRunnerView } from "./ui.js";
//#region default-plugins/python-runner/index.ts
/**
* Python 스크립트 실행기 플러그인
* 파이썬 코드를 직접 입력하거나 외부 .py 파일을 불러와 실행하고,
* 표준 출력 결과 확인 및 사용자 입력(stdin) 전달, 에디터 본문 삽입을 지원합니다.
*/
var plugin = {
	activate(context) {
		context.ui.registerSidebarView({
			id: "python-runner",
			title: "Python 실행기",
			icon: iconSvg,
			render(container) {
				container.className = "sidebar-panel dynamic-plugin-panel plugin-subview python-runner-panel";
				container.replaceChildren();
				buildPythonRunnerView(context, container);
			}
		});
	},
	deactivate() {}
};
//#endregion
export { buildPythonRunnerView, plugin as default, executePythonScript };
