import { decodeDDS } from './dds-decoder.ts';

export interface ImageOpenInfo {
  name: string;
  path?: string;
  bytes: Uint8Array;
}

/**
 * Interactive Image / Texture Viewer component for plugins (e.g. asset-viewer).
 * Supports DDS (DXT1, DXT3, DXT5, RGBA) and standard web images (PNG, JPG, BMP, WebP).
 * Features checkerboard transparency, pan/drag, zoom (wheel & buttons), and format metadata.
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

    const isDds = /\.dds$/i.test(info.name);
    let format = isDds ? 'DDS' : info.name.split('.').pop()?.toUpperCase() ?? 'IMAGE';
    let width = 0;
    let height = 0;
    const sizeBytes = info.bytes.byteLength;

    // Header Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'image-viewer-toolbar';

    const fileInfo = document.createElement('div');
    fileInfo.className = 'image-viewer-file-info';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'image-viewer-icon';
    iconSpan.textContent = '🖼️';

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

    // Zoom Controls
    const zoomControls = document.createElement('div');
    zoomControls.className = 'image-viewer-zoom-controls';

    const btnFit = document.createElement('button');
    btnFit.className = 'img-tool-btn';
    btnFit.textContent = '화면맞춤';
    btnFit.title = '화면에 맞추기';
    btnFit.addEventListener('click', () => this.fitToViewport(width, height));

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
    toolbar.append(fileInfo, zoomControls);
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
        width = decoded.width;
        height = decoded.height;
        formatBadge.textContent = `DDS (${decoded.format})`;
        dimBadge.textContent = `${width} × ${height} px`;

        this.canvasEl.width = width;
        this.canvasEl.height = height;
        const ctx = this.canvasEl.getContext('2d');
        if (ctx) {
          const imgData = ctx.createImageData(width, height);
          imgData.data.set(decoded.rgba);
          ctx.putImageData(imgData, 0, 0);
        }
        this.fitToViewport(width, height);
      } else {
        // Standard Web Image
        const ext = info.name.split('.').pop()?.toLowerCase() ?? 'png';
        const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
        const blob = new Blob([info.bytes as unknown as BlobPart], { type: mime });
        this.currentBlobUrl = URL.createObjectURL(blob);

        const img = new Image();
        img.onload = () => {
          width = img.naturalWidth;
          height = img.naturalHeight;
          formatBadge.textContent = ext.toUpperCase();
          dimBadge.textContent = `${width} × ${height} px`;

          this.canvasEl.width = width;
          this.canvasEl.height = height;
          const ctx = this.canvasEl.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
          }
          this.fitToViewport(width, height);
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
    viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const newZoom = Math.min(20, Math.max(0.05, this.zoom * zoomFactor));

      this.zoom = newZoom;
      this.updateTransform();
    }, { passive: false });

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
    this.el.replaceChildren();
  }
}
