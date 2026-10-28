import { decodeDDS } from "./dds-decoder.js";
//#region default-plugins/texture-library/image-viewer.ts
var SRGB_TO_LINEAR_LUT = /* @__PURE__ */ new Uint8Array(256);
var LINEAR_TO_SRGB_LUT = /* @__PURE__ */ new Uint8Array(256);
for (let i = 0; i < 256; i++) {
	const c = i / 255;
	const lin = c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4);
	SRGB_TO_LINEAR_LUT[i] = Math.round(Math.min(1, Math.max(0, lin)) * 255);
	const srgb = c <= .0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - .055;
	LINEAR_TO_SRGB_LUT[i] = Math.round(Math.min(1, Math.max(0, srgb)) * 255);
}
/**
* Interactive Image / Texture Viewer component for plugins (e.g. texture-library).
* Supports DDS (BC1, BC2, BC3, BC4, BC5, BC7, RGBA) and standard web images (PNG, JPG, BMP, WebP).
* Features color space modes (sRGB, Linear, Raw), channel inspection (RGBA, RGB, R, G, B, A),
* checkerboard transparency, smooth pan/drag, zoom (wheel & buttons), and format metadata.
*/
var ImageViewer = class {
	container;
	el;
	currentBlobUrl = null;
	zoom = 1;
	panX = 0;
	panY = 0;
	isDragging = false;
	dragStartX = 0;
	dragStartY = 0;
	canvasWrapper;
	canvasEl;
	zoomLabel;
	rawRgba = null;
	imageWidth = 0;
	imageHeight = 0;
	sourceIsSRGB = true;
	colorSpaceMode = "sRGB";
	channelMode = "RGB";
	colorSpaceBtns = /* @__PURE__ */ new Map();
	channelBtns = /* @__PURE__ */ new Map();
	cleanups = [];
	constructor(container) {
		this.container = container;
		this.el = document.createElement("div");
		this.el.className = "image-viewer-container";
		this.container.appendChild(this.el);
	}
	show(info) {
		this.dispose();
		this.el.replaceChildren();
		this.zoom = 1;
		this.panX = 0;
		this.panY = 0;
		this.colorSpaceBtns.clear();
		this.channelBtns.clear();
		this.channelMode = "RGB";
		const isDds = /\.dds$/i.test(info.name);
		let format = isDds ? "DDS" : info.name.split(".").pop()?.toUpperCase() ?? "IMAGE";
		const sizeBytes = info.bytes.byteLength;
		const toolbar = document.createElement("div");
		toolbar.className = "image-viewer-toolbar";
		const fileInfo = document.createElement("div");
		fileInfo.className = "image-viewer-file-info";
		const iconSpan = document.createElement("span");
		iconSpan.className = "image-viewer-icon";
		iconSpan.textContent = isDds ? "DDS" : "IMG";
		const nameSpan = document.createElement("span");
		nameSpan.className = "image-viewer-filename";
		nameSpan.textContent = info.name;
		nameSpan.title = info.path || info.name;
		const formatBadge = document.createElement("span");
		formatBadge.className = "image-badge format-badge";
		formatBadge.textContent = format;
		const dimBadge = document.createElement("span");
		dimBadge.className = "image-badge dim-badge";
		dimBadge.textContent = "로딩 중...";
		const sizeBadge = document.createElement("span");
		sizeBadge.className = "image-badge size-badge";
		sizeBadge.textContent = this.formatSize(sizeBytes);
		fileInfo.append(iconSpan, nameSpan, formatBadge, dimBadge, sizeBadge);
		const toolbarControls = document.createElement("div");
		toolbarControls.className = "image-viewer-toolbar-controls";
		const csSection = document.createElement("div");
		csSection.className = "image-viewer-toolbar-section";
		const csLabel = document.createElement("span");
		csLabel.className = "image-viewer-group-label";
		csLabel.textContent = "색공간:";
		const csGroup = document.createElement("div");
		csGroup.className = "image-viewer-toolbar-group";
		for (const mode of [
			"sRGB",
			"Linear",
			"Raw"
		]) {
			const btn = document.createElement("button");
			btn.className = "img-tool-btn";
			btn.textContent = mode;
			btn.title = mode === "sRGB" ? "sRGB 감마 곡선 뷰" : mode === "Linear" ? "선형 공간(감마 미적용) 뷰" : "원시 바이트 원본 뷰";
			btn.addEventListener("click", () => {
				this.setColorSpaceMode(mode);
			});
			csGroup.appendChild(btn);
			this.colorSpaceBtns.set(mode, btn);
		}
		csSection.append(csLabel, csGroup);
		const chSection = document.createElement("div");
		chSection.className = "image-viewer-toolbar-section";
		const chLabel = document.createElement("span");
		chLabel.className = "image-viewer-group-label";
		chLabel.textContent = "채널:";
		const chGroup = document.createElement("div");
		chGroup.className = "image-viewer-toolbar-group";
		for (const ch of [
			"RGB",
			"RGBA",
			"R",
			"G",
			"B",
			"A"
		]) {
			const btn = document.createElement("button");
			btn.className = "img-tool-btn";
			btn.textContent = ch;
			btn.title = `${ch} 채널 보기`;
			btn.addEventListener("click", () => {
				this.setChannelMode(ch);
			});
			chGroup.appendChild(btn);
			this.channelBtns.set(ch, btn);
		}
		chSection.append(chLabel, chGroup);
		const zoomControls = document.createElement("div");
		zoomControls.className = "image-viewer-zoom-controls";
		const btnFit = document.createElement("button");
		btnFit.className = "img-tool-btn";
		btnFit.textContent = "화면맞춤";
		btnFit.title = "화면에 맞추기 (단축키: 더블클릭)";
		btnFit.addEventListener("click", () => this.fitToViewport(this.imageWidth, this.imageHeight));
		const btn100 = document.createElement("button");
		btn100.className = "img-tool-btn";
		btn100.textContent = "100%";
		btn100.title = "실제 크기 (1:1)";
		btn100.addEventListener("click", () => this.resetTo100());
		const btnZoomOut = document.createElement("button");
		btnZoomOut.className = "img-tool-btn";
		btnZoomOut.textContent = "−";
		btnZoomOut.title = "축소";
		btnZoomOut.addEventListener("click", () => this.zoomBy(1 / 1.25));
		this.zoomLabel = document.createElement("span");
		this.zoomLabel.className = "image-zoom-label";
		this.zoomLabel.textContent = "100%";
		const btnZoomIn = document.createElement("button");
		btnZoomIn.className = "img-tool-btn";
		btnZoomIn.textContent = "+";
		btnZoomIn.title = "확대";
		btnZoomIn.addEventListener("click", () => this.zoomBy(1.25));
		zoomControls.append(btnFit, btn100, btnZoomOut, this.zoomLabel, btnZoomIn);
		toolbarControls.append(csSection, chSection, zoomControls);
		toolbar.append(fileInfo, toolbarControls);
		this.el.append(toolbar);
		const viewport = document.createElement("div");
		viewport.className = "image-viewer-viewport";
		this.canvasWrapper = document.createElement("div");
		this.canvasWrapper.className = "image-canvas-wrapper checkerboard";
		this.canvasEl = document.createElement("canvas");
		this.canvasWrapper.append(this.canvasEl);
		viewport.append(this.canvasWrapper);
		this.el.append(viewport);
		this.bindViewportEvents(viewport);
		try {
			if (isDds) {
				const decoded = decodeDDS(info.bytes);
				this.imageWidth = decoded.width;
				this.imageHeight = decoded.height;
				this.rawRgba = new Uint8ClampedArray(decoded.rgba);
				this.sourceIsSRGB = decoded.isSRGB;
				if (decoded.format.startsWith("BC5") || decoded.format.startsWith("BC4")) this.colorSpaceMode = "Linear";
				else if (decoded.isSRGB) this.colorSpaceMode = "sRGB";
				else this.colorSpaceMode = decoded.format.includes("Linear") ? "Linear" : "sRGB";
				formatBadge.textContent = `DDS (${decoded.format})`;
				dimBadge.textContent = `${this.imageWidth} × ${this.imageHeight} px`;
				this.canvasEl.width = this.imageWidth;
				this.canvasEl.height = this.imageHeight;
				this.updateButtonsUI();
				this.renderFilteredImage();
				this.fitToViewport(this.imageWidth, this.imageHeight);
			} else {
				const ext = info.name.split(".").pop()?.toLowerCase() ?? "png";
				const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
				const blob = new Blob([info.bytes], { type: mime });
				this.currentBlobUrl = URL.createObjectURL(blob);
				const img = new Image();
				img.onload = () => {
					this.imageWidth = img.naturalWidth;
					this.imageHeight = img.naturalHeight;
					this.sourceIsSRGB = true;
					this.colorSpaceMode = "sRGB";
					formatBadge.textContent = ext.toUpperCase();
					dimBadge.textContent = `${this.imageWidth} × ${this.imageHeight} px`;
					this.canvasEl.width = this.imageWidth;
					this.canvasEl.height = this.imageHeight;
					const ctx = this.canvasEl.getContext("2d");
					if (ctx) {
						ctx.drawImage(img, 0, 0);
						const imgData = ctx.getImageData(0, 0, this.imageWidth, this.imageHeight);
						this.rawRgba = new Uint8ClampedArray(imgData.data);
					}
					this.updateButtonsUI();
					this.renderFilteredImage();
					this.fitToViewport(this.imageWidth, this.imageHeight);
				};
				img.onerror = (e) => {
					dimBadge.textContent = "이미지 로드 오류";
					console.error("[ImageViewer] Failed to load image:", e);
				};
				img.src = this.currentBlobUrl;
			}
		} catch (err) {
			dimBadge.textContent = "디코딩 실패";
			const errMsg = document.createElement("div");
			errMsg.className = "image-error-notice";
			errMsg.textContent = `텍스처 미리보기 오류: ${String(err)}`;
			viewport.append(errMsg);
		}
	}
	setColorSpaceMode(mode) {
		if (this.colorSpaceMode === mode) return;
		this.colorSpaceMode = mode;
		this.updateButtonsUI();
		this.renderFilteredImage();
	}
	setChannelMode(mode) {
		if (this.channelMode === mode) return;
		this.channelMode = mode;
		this.updateButtonsUI();
		this.renderFilteredImage();
	}
	updateButtonsUI() {
		for (const [mode, btn] of this.colorSpaceBtns.entries()) if (mode === this.colorSpaceMode) btn.classList.add("active");
		else btn.classList.remove("active");
		for (const [mode, btn] of this.channelBtns.entries()) if (mode === this.channelMode) btn.classList.add("active");
		else btn.classList.remove("active");
	}
	renderFilteredImage() {
		if (!this.rawRgba || !this.imageWidth || !this.imageHeight) return;
		const ctx = this.canvasEl.getContext("2d");
		if (!ctx) return;
		const imgData = ctx.createImageData(this.imageWidth, this.imageHeight);
		const dest = imgData.data;
		const src = this.rawRgba;
		const totalPixels = this.imageWidth * this.imageHeight;
		const isLinearTarget = this.colorSpaceMode === "Linear";
		const convertLinearToSRGB = this.colorSpaceMode === "sRGB" && !this.sourceIsSRGB;
		const convertSRGBToLinear = isLinearTarget && this.sourceIsSRGB;
		const ch = this.channelMode;
		for (let i = 0; i < totalPixels; i++) {
			const idx = i * 4;
			let r = src[idx];
			let g = src[idx + 1];
			let b = src[idx + 2];
			const a = src[idx + 3];
			if (convertLinearToSRGB) {
				r = LINEAR_TO_SRGB_LUT[r];
				g = LINEAR_TO_SRGB_LUT[g];
				b = LINEAR_TO_SRGB_LUT[b];
			} else if (convertSRGBToLinear) {
				r = SRGB_TO_LINEAR_LUT[r];
				g = SRGB_TO_LINEAR_LUT[g];
				b = SRGB_TO_LINEAR_LUT[b];
			}
			switch (ch) {
				case "RGBA":
					dest[idx] = r;
					dest[idx + 1] = g;
					dest[idx + 2] = b;
					dest[idx + 3] = a;
					break;
				case "RGB":
					dest[idx] = r;
					dest[idx + 1] = g;
					dest[idx + 2] = b;
					dest[idx + 3] = 255;
					break;
				case "R":
					dest[idx] = r;
					dest[idx + 1] = r;
					dest[idx + 2] = r;
					dest[idx + 3] = 255;
					break;
				case "G":
					dest[idx] = g;
					dest[idx + 1] = g;
					dest[idx + 2] = g;
					dest[idx + 3] = 255;
					break;
				case "B":
					dest[idx] = b;
					dest[idx + 1] = b;
					dest[idx + 2] = b;
					dest[idx + 3] = 255;
					break;
				case "A":
					dest[idx] = a;
					dest[idx + 1] = a;
					dest[idx + 2] = a;
					dest[idx + 3] = 255;
			}
		}
		ctx.putImageData(imgData, 0, 0);
	}
	getViewportRect() {
		const vp = this.el.querySelector(".image-viewer-viewport");
		return vp ? vp.getBoundingClientRect() : null;
	}
	fitToViewport(w = this.imageWidth, h = this.imageHeight) {
		if (!w || !h) return;
		const rect = this.getViewportRect();
		if (!rect || rect.width <= 0 || rect.height <= 0) {
			requestAnimationFrame(() => this.fitToViewport(w, h));
			return;
		}
		const pad = 40;
		const availW = Math.max(20, rect.width - pad);
		const availH = Math.max(20, rect.height - pad);
		const scaleX = availW / w;
		const scaleY = availH / h;
		let fitScale = Math.min(scaleX, scaleY);
		fitScale = Math.min(32, Math.max(.01, fitScale));
		this.zoom = fitScale;
		this.panX = Math.round((rect.width - w * this.zoom) / 2);
		this.panY = Math.round((rect.height - h * this.zoom) / 2);
		this.updateTransform();
	}
	resetTo100() {
		this.zoom = 1;
		const rect = this.getViewportRect();
		if (rect && rect.width > 0 && rect.height > 0) {
			this.panX = Math.round((rect.width - this.imageWidth) / 2);
			this.panY = Math.round((rect.height - this.imageHeight) / 2);
		} else {
			this.panX = 0;
			this.panY = 0;
		}
		this.updateTransform();
	}
	zoomBy(factor) {
		const rect = this.getViewportRect();
		const centerX = rect ? rect.width / 2 : 0;
		const centerY = rect ? rect.height / 2 : 0;
		const imgX = (centerX - this.panX) / this.zoom;
		const imgY = (centerY - this.panY) / this.zoom;
		const newZoom = Math.min(64, Math.max(.01, this.zoom * factor));
		this.panX = Math.round(centerX - imgX * newZoom);
		this.panY = Math.round(centerY - imgY * newZoom);
		this.zoom = newZoom;
		this.updateTransform();
	}
	updateTransform() {
		if (!this.canvasWrapper) return;
		this.canvasWrapper.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
		if (this.zoomLabel) this.zoomLabel.textContent = `${Math.round(this.zoom * 100)}%`;
	}
	bindViewportEvents(viewport) {
		viewport.addEventListener("wheel", (e) => {
			e.preventDefault();
			const rect = viewport.getBoundingClientRect();
			const mouseX = e.clientX - rect.left;
			const mouseY = e.clientY - rect.top;
			const imgX = (mouseX - this.panX) / this.zoom;
			const imgY = (mouseY - this.panY) / this.zoom;
			const zoomFactor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
			const newZoom = Math.min(64, Math.max(.01, this.zoom * zoomFactor));
			this.panX = Math.round(mouseX - imgX * newZoom);
			this.panY = Math.round(mouseY - imgY * newZoom);
			this.zoom = newZoom;
			this.updateTransform();
		}, { passive: false });
		viewport.addEventListener("mousedown", (e) => {
			if (e.button !== 0 && e.button !== 1) return;
			this.isDragging = true;
			this.dragStartX = e.clientX - this.panX;
			this.dragStartY = e.clientY - this.panY;
			viewport.style.cursor = "grabbing";
			e.preventDefault();
		});
		const onMouseMove = (e) => {
			if (!this.isDragging) return;
			this.panX = Math.round(e.clientX - this.dragStartX);
			this.panY = Math.round(e.clientY - this.dragStartY);
			this.updateTransform();
		};
		const onMouseUp = () => {
			if (this.isDragging) {
				this.isDragging = false;
				viewport.style.cursor = "grab";
			}
		};
		window.addEventListener("mousemove", onMouseMove);
		window.addEventListener("mouseup", onMouseUp);
		this.cleanups.push(() => {
			window.removeEventListener("mousemove", onMouseMove);
			window.removeEventListener("mouseup", onMouseUp);
		});
		viewport.addEventListener("dblclick", () => {
			this.fitToViewport(this.imageWidth, this.imageHeight);
		});
		if (typeof ResizeObserver !== "undefined") {
			const ro = new ResizeObserver(() => {
				if (this.imageWidth && this.imageHeight && !this.isDragging) this.fitToViewport(this.imageWidth, this.imageHeight);
			});
			ro.observe(viewport);
			this.cleanups.push(() => ro.disconnect());
		}
	}
	formatSize(bytes) {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / 1048576).toFixed(2)} MB`;
	}
	dispose() {
		this.cleanups.forEach((fn) => {
			try {
				fn();
			} catch {}
		});
		this.cleanups = [];
		if (this.currentBlobUrl) {
			URL.revokeObjectURL(this.currentBlobUrl);
			this.currentBlobUrl = null;
		}
		this.rawRgba = null;
		this.el.replaceChildren();
	}
};
//#endregion
export { ImageViewer };
