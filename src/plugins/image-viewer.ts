import { decodeDDS } from './dds-decoder.ts';

export interface ImageOpenInfo {
  name: string;
  path?: string;
  bytes: Uint8Array;
}

export type ColorSpaceMode = 'sRGB' | 'Linear' | 'Raw';
export type ChannelMode = 'RGBA' | 'RGB' | 'R' | 'G' | 'B' | 'A';

// Precomputed 8-bit sRGB <-> Linear LUT tables for fast real-time preview
const SRGB_TO_LINEAR_LUT = new Uint8Array(256);
const LINEAR_TO_SRGB_LUT = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  const lin = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  SRGB_TO_LINEAR_LUT[i] = Math.round(Math.min(1, Math.max(0, lin)) * 255);

  const srgb = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  LINEAR_TO_SRGB_LUT[i] = Math.round(Math.min(1, Math.max(0, srgb)) * 255);
}

/**
 * Interactive Image / Texture Viewer component for plugins (e.g. asset-viewer).
 * Supports DDS (BC1, BC2, BC3, BC4, BC5, BC7, RGBA) and standard web images (PNG, JPG, BMP, WebP).
 * Features color space modes (sRGB, Linear, Raw), channel inspection (RGBA, RGB, R, G, B, A),
 * checkerboard transparency, smooth pan/drag, zoom (wheel & buttons), and format metadata.
 */
export class ImageViewer {
  private container: HTMLElement;
  private el: HTMLElement;
  private currentBlobUrl: string | null = null;
  private zoom = 1.0;
  private panX = 0;
  private panY = 0;
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;

  private canvasWrapper!: HTMLElement;
  private canvasEl!: HTMLCanvasElement;
  private zoomLabel!: HTMLElement;

  private rawRgba: Uint8ClampedArray | null = null;
  private imageWidth = 0;
  private imageHeight = 0;
  private sourceIsSRGB = true;
  private colorSpaceMode: ColorSpaceMode = 'sRGB';
  private channelMode: ChannelMode = 'RGBA';

  private colorSpaceBtns: Map<ColorSpaceMode, HTMLButtonElement> = new Map();
  private channelBtns: Map<ChannelMode, HTMLButtonElement> = new Map();

  constructor(container: HTMLElement) {
    this.container = container;
    this.el = document.createElement('div');
    this.el.className = 'image-viewer-container';
    this.container.appendChild(this.el);
  }

  show(info: ImageOpenInfo) {
    this.dispose();
    this.el.replaceChildren();
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.colorSpaceBtns.clear();
    this.channelBtns.clear();

    const isDds = /\.dds$/i.test(info.name);
    let format = isDds ? 'DDS' : (info.name.split('.').pop()?.toUpperCase() ?? 'IMAGE');
    const sizeBytes = info.bytes.byteLength;

    // Header Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'image-viewer-toolbar';

    const fileInfo = document.createElement('div');
    fileInfo.className = 'image-viewer-file-info';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'image-viewer-icon';
    iconSpan.textContent = isDds ? 'DDS' : 'IMG';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'image-viewer-filename';
    nameSpan.textContent = info.name;
    nameSpan.title = info.path || info.name;

    const formatBadge = document.createElement('span');
    formatBadge.className = 'image-badge format-badge';
    formatBadge.textContent = format;

    const dimBadge = document.createElement('span');
    dimBadge.className = 'image-badge dim-badge';
    dimBadge.textContent = '로딩 중...';

    const sizeBadge = document.createElement('span');
    sizeBadge.className = 'image-badge size-badge';
    sizeBadge.textContent = this.formatSize(sizeBytes);

    fileInfo.append(iconSpan, nameSpan, formatBadge, dimBadge, sizeBadge);

    // Controls wrapper (Color Space + Channels + Zoom)
    const toolbarControls = document.createElement('div');
    toolbarControls.className = 'image-viewer-toolbar-controls';

    // 1. Color Space Controls
    const csSection = document.createElement('div');
    csSection.className = 'image-viewer-toolbar-section';
    const csLabel = document.createElement('span');
    csLabel.className = 'image-viewer-group-label';
    csLabel.textContent = '색공간:';

    const csGroup = document.createElement('div');
    csGroup.className = 'image-viewer-toolbar-group';

    const csModes: ColorSpaceMode[] = ['sRGB', 'Linear', 'Raw'];
    for (const mode of csModes) {
      const btn = document.createElement('button');
      btn.className = 'img-tool-btn';
      btn.textContent = mode;
      btn.title = mode === 'sRGB' ? 'sRGB 감마 곡선 뷰' : mode === 'Linear' ? '선형 공간(감마 미적용) 뷰' : '원시 바이트 원본 뷰';
      btn.addEventListener('click', () => {
        this.setColorSpaceMode(mode);
      });
      csGroup.appendChild(btn);
      this.colorSpaceBtns.set(mode, btn);
    }
    csSection.append(csLabel, csGroup);

    // 2. Channel Controls
    const chSection = document.createElement('div');
    chSection.className = 'image-viewer-toolbar-section';
    const chLabel = document.createElement('span');
    chLabel.className = 'image-viewer-group-label';
    chLabel.textContent = '채널:';

    const chGroup = document.createElement('div');
    chGroup.className = 'image-viewer-toolbar-group';

    const chModes: ChannelMode[] = ['RGBA', 'RGB', 'R', 'G', 'B', 'A'];
    for (const ch of chModes) {
      const btn = document.createElement('button');
      btn.className = 'img-tool-btn';
      btn.textContent = ch;
      btn.title = `${ch} 채널 보기`;
      btn.addEventListener('click', () => {
        this.setChannelMode(ch);
      });
      chGroup.appendChild(btn);
      this.channelBtns.set(ch, btn);
    }
    chSection.append(chLabel, chGroup);

    // 3. Zoom Controls
    const zoomControls = document.createElement('div');
    zoomControls.className = 'image-viewer-zoom-controls';

    const btnFit = document.createElement('button');
    btnFit.className = 'img-tool-btn';
    btnFit.textContent = '화면맞춤';
    btnFit.title = '화면에 맞추기';
    btnFit.addEventListener('click', () => this.fitToViewport(this.imageWidth, this.imageHeight));

    const btn100 = document.createElement('button');
    btn100.className = 'img-tool-btn';
    btn100.textContent = '100%';
    btn100.title = '실제 크기 (1:1)';
    btn100.addEventListener('click', () => {
      this.zoom = 1.0;
      this.panX = 0;
      this.panY = 0;
      this.updateTransform();
    });

    const btnZoomOut = document.createElement('button');
    btnZoomOut.className = 'img-tool-btn';
    btnZoomOut.textContent = '−';
    btnZoomOut.title = '축소';
    btnZoomOut.addEventListener('click', () => {
      this.zoom = Math.max(0.1, this.zoom / 1.25);
      this.updateTransform();
    });

    this.zoomLabel = document.createElement('span');
    this.zoomLabel.className = 'image-zoom-label';
    this.zoomLabel.textContent = '100%';

    const btnZoomIn = document.createElement('button');
    btnZoomIn.className = 'img-tool-btn';
    btnZoomIn.textContent = '+';
    btnZoomIn.title = '확대';
    btnZoomIn.addEventListener('click', () => {
      this.zoom = Math.min(20, this.zoom * 1.25);
      this.updateTransform();
    });

    zoomControls.append(btnFit, btn100, btnZoomOut, this.zoomLabel, btnZoomIn);
    toolbarControls.append(csSection, chSection, zoomControls);
    toolbar.append(fileInfo, toolbarControls);
    this.el.append(toolbar);

    // Viewport & Canvas
    const viewport = document.createElement('div');
    viewport.className = 'image-viewer-viewport';

    this.canvasWrapper = document.createElement('div');
    this.canvasWrapper.className = 'image-canvas-wrapper checkerboard';

    this.canvasEl = document.createElement('canvas');
    this.canvasWrapper.append(this.canvasEl);
    viewport.append(this.canvasWrapper);
    this.el.append(viewport);

    // Bind Pan & Zoom events
    this.bindViewportEvents(viewport);

    // Decode & Render
    try {
      if (isDds) {
        const decoded = decodeDDS(info.bytes);
        this.imageWidth = decoded.width;
        this.imageHeight = decoded.height;
        this.rawRgba = new Uint8ClampedArray(decoded.rgba);
        this.sourceIsSRGB = decoded.isSRGB;

        // Auto default color space:
        // BC4/BC5 are typically normal maps or masks -> Linear
        // Otherwise if header says sRGB -> sRGB, if header says Linear -> Linear
        if (decoded.format.startsWith('BC5') || decoded.format.startsWith('BC4')) {
          this.colorSpaceMode = 'Linear';
        } else if (decoded.isSRGB) {
          this.colorSpaceMode = 'sRGB';
        } else {
          // If UNORM (Linear), default to sRGB view for pleasant viewing or Linear
          this.colorSpaceMode = decoded.format.includes('Linear') ? 'Linear' : 'sRGB';
        }

        formatBadge.textContent = `DDS (${decoded.format})`;
        dimBadge.textContent = `${this.imageWidth} × ${this.imageHeight} px`;

        this.canvasEl.width = this.imageWidth;
        this.canvasEl.height = this.imageHeight;

        this.updateButtonsUI();
        this.renderFilteredImage();
        this.fitToViewport(this.imageWidth, this.imageHeight);
      } else {
        // Standard Web Image
        const ext = info.name.split('.').pop()?.toLowerCase() ?? 'png';
        const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
        const blob = new Blob([info.bytes as unknown as BlobPart], { type: mime });
        this.currentBlobUrl = URL.createObjectURL(blob);

        const img = new Image();
        img.onload = () => {
          this.imageWidth = img.naturalWidth;
          this.imageHeight = img.naturalHeight;
          this.sourceIsSRGB = true;
          this.colorSpaceMode = 'sRGB';

          formatBadge.textContent = ext.toUpperCase();
          dimBadge.textContent = `${this.imageWidth} × ${this.imageHeight} px`;

          this.canvasEl.width = this.imageWidth;
          this.canvasEl.height = this.imageHeight;
          const ctx = this.canvasEl.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const imgData = ctx.getImageData(0, 0, this.imageWidth, this.imageHeight);
            this.rawRgba = new Uint8ClampedArray(imgData.data);
          }

          this.updateButtonsUI();
          this.fitToViewport(this.imageWidth, this.imageHeight);
        };
        img.onerror = (e) => {
          dimBadge.textContent = '이미지 로드 오류';
          console.error('[ImageViewer] Failed to load image:', e);
        };
        img.src = this.currentBlobUrl;
      }
    } catch (err) {
      dimBadge.textContent = '디코딩 실패';
      const errMsg = document.createElement('div');
      errMsg.className = 'image-error-notice';
      errMsg.textContent = `텍스처 미리보기 오류: ${String(err)}`;
      viewport.append(errMsg);
    }
  }

  private setColorSpaceMode(mode: ColorSpaceMode) {
    if (this.colorSpaceMode === mode) return;
    this.colorSpaceMode = mode;
    this.updateButtonsUI();
    this.renderFilteredImage();
  }

  private setChannelMode(mode: ChannelMode) {
    if (this.channelMode === mode) return;
    this.channelMode = mode;
    this.updateButtonsUI();
    this.renderFilteredImage();
  }

  private updateButtonsUI() {
    for (const [mode, btn] of this.colorSpaceBtns.entries()) {
      if (mode === this.colorSpaceMode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }

    for (const [mode, btn] of this.channelBtns.entries()) {
      if (mode === this.channelMode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  }

  private renderFilteredImage() {
    if (!this.rawRgba || !this.imageWidth || !this.imageHeight) return;
    const ctx = this.canvasEl.getContext('2d');
    if (!ctx) return;

    const imgData = ctx.createImageData(this.imageWidth, this.imageHeight);
    const dest = imgData.data;
    const src = this.rawRgba;
    const totalPixels = this.imageWidth * this.imageHeight;

    const isLinearTarget = this.colorSpaceMode === 'Linear';
    const isSRGBTarget = this.colorSpaceMode === 'sRGB';
    const convertLinearToSRGB = isSRGBTarget && !this.sourceIsSRGB;
    const convertSRGBToLinear = isLinearTarget && this.sourceIsSRGB;

    const ch = this.channelMode;

    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      let r = src[idx];
      let g = src[idx + 1];
      let b = src[idx + 2];
      const a = src[idx + 3];

      // Apply Color Space Conversion
      if (convertLinearToSRGB) {
        r = LINEAR_TO_SRGB_LUT[r];
        g = LINEAR_TO_SRGB_LUT[g];
        b = LINEAR_TO_SRGB_LUT[b];
      } else if (convertSRGBToLinear) {
        r = SRGB_TO_LINEAR_LUT[r];
        g = SRGB_TO_LINEAR_LUT[g];
        b = SRGB_TO_LINEAR_LUT[b];
      }

      // Apply Channel Isolation Filter
      switch (ch) {
        case 'RGBA':
          dest[idx] = r;
          dest[idx + 1] = g;
          dest[idx + 2] = b;
          dest[idx + 3] = a;
          break;
        case 'RGB':
          dest[idx] = r;
          dest[idx + 1] = g;
          dest[idx + 2] = b;
          dest[idx + 3] = 255;
          break;
        case 'R':
          dest[idx] = r;
          dest[idx + 1] = r;
          dest[idx + 2] = r;
          dest[idx + 3] = 255;
          break;
        case 'G':
          dest[idx] = g;
          dest[idx + 1] = g;
          dest[idx + 2] = g;
          dest[idx + 3] = 255;
          break;
        case 'B':
          dest[idx] = b;
          dest[idx + 1] = b;
          dest[idx + 2] = b;
          dest[idx + 3] = 255;
          break;
        case 'A':
          dest[idx] = a;
          dest[idx + 1] = a;
          dest[idx + 2] = a;
          dest[idx + 3] = 255;
          break;
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }

  private fitToViewport(w: number, h: number) {
    if (!w || !h) return;
    const rect = this.el.querySelector('.image-viewer-viewport')?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      this.zoom = 1.0;
      this.panX = 0;
      this.panY = 0;
      this.updateTransform();
      return;
    }

    const pad = 40;
    const availW = Math.max(100, rect.width - pad);
    const availH = Math.max(100, rect.height - pad);
    const scaleX = availW / w;
    const scaleY = availH / h;
    const fitScale = Math.min(scaleX, scaleY, 1.0);

    this.zoom = Math.round(fitScale * 100) / 100;
    this.panX = 0;
    this.panY = 0;
    this.updateTransform();
  }

  private updateTransform() {
    if (!this.canvasWrapper) return;
    this.canvasWrapper.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
    if (this.zoomLabel) {
      this.zoomLabel.textContent = `${Math.round(this.zoom * 100)}%`;
    }
  }

  private bindViewportEvents(viewport: HTMLElement) {
    viewport.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        const newZoom = Math.min(20, Math.max(0.05, this.zoom * zoomFactor));

        this.zoom = newZoom;
        this.updateTransform();
      },
      { passive: false },
    );

    viewport.addEventListener('mousedown', (e) => {
      if (e.button !== 0 && e.button !== 1) return;
      this.isDragging = true;
      this.dragStartX = e.clientX - this.panX;
      this.dragStartY = e.clientY - this.panY;
      viewport.style.cursor = 'grabbing';
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      this.panX = e.clientX - this.dragStartX;
      this.panY = e.clientY - this.dragStartY;
      this.updateTransform();
    });

    window.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        viewport.style.cursor = 'grab';
      }
    });

    viewport.addEventListener('dblclick', () => {
      if (this.canvasEl && this.canvasEl.width && this.canvasEl.height) {
        this.fitToViewport(this.canvasEl.width, this.canvasEl.height);
      }
    });
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  dispose() {
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }
    this.rawRgba = null;
    this.el.replaceChildren();
  }
}

