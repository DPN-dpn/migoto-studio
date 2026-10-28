//#region default-plugins/custom-lint/srmi/templates.ts
var SRMI_TEMPLATES = [{
	id: "srmi_vertex_count",
	group: "SRMI (붕괴: 스타레일)",
	label: "SRMI 버텍스 카운트 ($SRMI\vertex_count)",
	description: "SRMI 모델 버텍스 수 지정 구문 (포지션 .buf 파일 크기 / stride)",
	body: ["; SRMI Vertex Count Override", "$\\SRMI\\vertex_count = ${1:41428}"].join("\n") + "\n"
}, {
	id: "srmi_buffer_override",
	group: "SRMI (붕괴: 스타레일)",
	label: "SRMI 버퍼 오버라이드 (Position & Blend)",
	description: "SRMI 컴퓨트 셰이더 버퍼 및 버텍스 수 매핑 구문",
	body: [
		"; SRMI Compute Shader Buffer Override",
		"Resource\\SRMI\\PositionBuffer = ref Resource${1:Model}PositionCS",
		"Resource\\SRMI\\BlendBuffer = ref Resource${1:Model}BlendCS",
		"$\\SRMI\\vertex_count = ${2:41428}"
	].join("\n") + "\n"
}];
//#endregion
export { SRMI_TEMPLATES };
