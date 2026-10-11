/**
 * Zero-dependency pure TypeScript DDS (DirectDraw Surface) texture decoder.
 * Supports DXT1 (BC1), DXT3 (BC2), DXT5 (BC3), and uncompressed RGBA textures.
 */

export interface DecodedDDS {
  width: number;
  height: number;
  format: string;
  rgba: Uint8ClampedArray;
}

const FOURCC_DXT1 = 0x31545844; // 'DXT1'
const FOURCC_DXT3 = 0x33545844; // 'DXT3'
const FOURCC_DXT5 = 0x35545844; // 'DXT5'
const FOURCC_DX10 = 0x30315844; // 'DX10'

export function decodeDDS(buffer: Uint8Array | ArrayBuffer): DecodedDDS {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const header = new DataView(bytes.buffer, bytes.byteOffset, Math.min(bytes.byteLength, 148));

  const magic = header.getUint32(0, true);
  if (magic !== 0x20534444) {
    throw new Error('유효한 DDS 파일이 아닙니다 (Magic 불일치).');
  }

  const height = header.getUint32(12, true);
  const width = header.getUint32(16, true);
  const fourCC = header.getUint32(84, true);
  const rgbBitCount = header.getUint32(88, true);

  let dataOffset = 128;
  if (fourCC === FOURCC_DX10 && bytes.byteLength >= 148) {
    dataOffset = 148; // Skip DX10 header
  }

  const rgba = new Uint8ClampedArray(width * height * 4);

  let formatName = 'RGBA';
  if (fourCC === FOURCC_DXT1) {
    formatName = 'DXT1 (BC1)';
    decodeDXT1(bytes, dataOffset, width, height, rgba);
  } else if (fourCC === FOURCC_DXT3) {
    formatName = 'DXT3 (BC2)';
    decodeDXT3(bytes, dataOffset, width, height, rgba);
  } else if (fourCC === FOURCC_DXT5) {
    formatName = 'DXT5 (BC3)';
    decodeDXT5(bytes, dataOffset, width, height, rgba);
  } else if (rgbBitCount === 32) {
    formatName = 'BGRA32';
    decodeBGRA32(bytes, dataOffset, width, height, rgba);
  } else {
    formatName = `FourCC 0x${fourCC.toString(16)}`;
    decodeDXT1(bytes, dataOffset, width, height, rgba); // Attempt fallback
  }

  return { width, height, format: formatName, rgba };
}

function decodeDXT1(
  src: Uint8Array,
  offset: number,
  width: number,
  height: number,
  dest: Uint8ClampedArray,
) {
  const numBlocksWide = Math.ceil(width / 4);
  const numBlocksHigh = Math.ceil(height / 4);
  let srcPos = offset;

  for (let by = 0; by < numBlocksHigh; by++) {
    for (let bx = 0; bx < numBlocksWide; bx++) {
      if (srcPos + 8 > src.length) return;
      const c0 = src[srcPos] | (src[srcPos + 1] << 8);
      const c1 = src[srcPos + 2] | (src[srcPos + 3] << 8);
      const code =
        src[srcPos + 4] |
        (src[srcPos + 5] << 8) |
        (src[srcPos + 6] << 16) |
        (src[srcPos + 7] << 24);
      srcPos += 8;

      const colors = unpackRGB565Table(c0, c1, true);

      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          const px = bx * 4 + x;
          const py = by * 4 + y;
          if (px < width && py < height) {
            const shift = (y * 4 + x) * 2;
            const colorIdx = (code >> shift) & 0x03;
            const dIdx = (py * width + px) * 4;
            const c = colors[colorIdx];
            dest[dIdx] = c[0];
            dest[dIdx + 1] = c[1];
            dest[dIdx + 2] = c[2];
            dest[dIdx + 3] = c[3];
          }
        }
      }
    }
  }
}

function decodeDXT3(
  src: Uint8Array,
  offset: number,
  width: number,
  height: number,
  dest: Uint8ClampedArray,
) {
  const numBlocksWide = Math.ceil(width / 4);
  const numBlocksHigh = Math.ceil(height / 4);
  let srcPos = offset;

  for (let by = 0; by < numBlocksHigh; by++) {
    for (let bx = 0; bx < numBlocksWide; bx++) {
      if (srcPos + 16 > src.length) return;
      const alphaTable = src.subarray(srcPos, srcPos + 8);
      srcPos += 8;

      const c0 = src[srcPos] | (src[srcPos + 1] << 8);
      const c1 = src[srcPos + 2] | (src[srcPos + 3] << 8);
      const code =
        src[srcPos + 4] |
        (src[srcPos + 5] << 8) |
        (src[srcPos + 6] << 16) |
        (src[srcPos + 7] << 24);
      srcPos += 8;

      const colors = unpackRGB565Table(c0, c1, false);

      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          const px = bx * 4 + x;
          const py = by * 4 + y;
          if (px < width && py < height) {
            const aIdx = y * 2 + Math.floor(x / 2);
            const aShift = (x % 2) * 4;
            const alpha = ((alphaTable[aIdx] >> aShift) & 0x0f) * 17;

            const shift = (y * 4 + x) * 2;
            const colorIdx = (code >> shift) & 0x03;
            const dIdx = (py * width + px) * 4;
            const c = colors[colorIdx];
            dest[dIdx] = c[0];
            dest[dIdx + 1] = c[1];
            dest[dIdx + 2] = c[2];
            dest[dIdx + 3] = alpha;
          }
        }
      }
    }
  }
}

function decodeDXT5(
  src: Uint8Array,
  offset: number,
  width: number,
  height: number,
  dest: Uint8ClampedArray,
) {
  const numBlocksWide = Math.ceil(width / 4);
  const numBlocksHigh = Math.ceil(height / 4);
  let srcPos = offset;

  for (let by = 0; by < numBlocksHigh; by++) {
    for (let bx = 0; bx < numBlocksWide; bx++) {
      if (srcPos + 16 > src.length) return;
      const a0 = src[srcPos];
      const a1 = src[srcPos + 1];
      const aBits =
        BigInt(src[srcPos + 2]) |
        (BigInt(src[srcPos + 3]) << 8n) |
        (BigInt(src[srcPos + 4]) << 16n) |
        (BigInt(src[srcPos + 5]) << 24n) |
        (BigInt(src[srcPos + 6]) << 32n) |
        (BigInt(src[srcPos + 7]) << 40n);
      srcPos += 8;

      const c0 = src[srcPos] | (src[srcPos + 1] << 8);
      const c1 = src[srcPos + 2] | (src[srcPos + 3] << 8);
      const code =
        src[srcPos + 4] |
        (src[srcPos + 5] << 8) |
        (src[srcPos + 6] << 16) |
        (src[srcPos + 7] << 24);
      srcPos += 8;

      const alphaTable = unpackAlphaTable(a0, a1);
      const colors = unpackRGB565Table(c0, c1, false);

      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          const px = bx * 4 + x;
          const py = by * 4 + y;
          if (px < width && py < height) {
            const bitOffset = BigInt((y * 4 + x) * 3);
            const aIdx = Number((aBits >> bitOffset) & 0x07n);
            const alpha = alphaTable[aIdx];

            const shift = (y * 4 + x) * 2;
            const colorIdx = (code >> shift) & 0x03;
            const dIdx = (py * width + px) * 4;
            const c = colors[colorIdx];
            dest[dIdx] = c[0];
            dest[dIdx + 1] = c[1];
            dest[dIdx + 2] = c[2];
            dest[dIdx + 3] = alpha;
          }
        }
      }
    }
  }
}

function decodeBGRA32(
  src: Uint8Array,
  offset: number,
  width: number,
  height: number,
  dest: Uint8ClampedArray,
) {
  let s = offset;
  let d = 0;
  const total = width * height;
  for (let i = 0; i < total && s + 4 <= src.length; i++) {
    const b = src[s++];
    const g = src[s++];
    const r = src[s++];
    const a = src[s++];
    dest[d++] = r;
    dest[d++] = g;
    dest[d++] = b;
    dest[d++] = a;
  }
}

function unpackRGB565Table(c0: number, c1: number, isDxt1: boolean): [number, number, number, number][] {
  const r0 = ((c0 >> 11) & 0x1f) * 255 / 31;
  const g0 = ((c0 >> 5) & 0x3f) * 255 / 63;
  const b0 = (c0 & 0x1f) * 255 / 31;

  const r1 = ((c1 >> 11) & 0x1f) * 255 / 31;
  const g1 = ((c1 >> 5) & 0x3f) * 255 / 63;
  const b1 = (c1 & 0x1f) * 255 / 31;

  const table: [number, number, number, number][] = [
    [r0, g0, b0, 255],
    [r1, g1, b1, 255],
    [0, 0, 0, 255],
    [0, 0, 0, 255],
  ];

  if (!isDxt1 || c0 > c1) {
    table[2] = [(2 * r0 + r1) / 3, (2 * g0 + g1) / 3, (2 * b0 + b1) / 3, 255];
    table[3] = [(r0 + 2 * r1) / 3, (g0 + 2 * g1) / 3, (b0 + 2 * b1) / 3, 255];
  } else {
    table[2] = [(r0 + r1) / 2, (g0 + g1) / 2, (b0 + b1) / 2, 255];
    table[3] = [0, 0, 0, 0];
  }

  return table;
}

function unpackAlphaTable(a0: number, a1: number): number[] {
  const table = new Array(8);
  table[0] = a0;
  table[1] = a1;
  if (a0 > a1) {
    table[2] = (6 * a0 + 1 * a1) / 7;
    table[3] = (5 * a0 + 2 * a1) / 7;
    table[4] = (4 * a0 + 3 * a1) / 7;
    table[5] = (3 * a0 + 4 * a1) / 7;
    table[6] = (2 * a0 + 5 * a1) / 7;
    table[7] = (1 * a0 + 6 * a1) / 7;
  } else {
    table[2] = (4 * a0 + 1 * a1) / 5;
    table[3] = (3 * a0 + 2 * a1) / 5;
    table[4] = (2 * a0 + 3 * a1) / 5;
    table[5] = (1 * a0 + 4 * a1) / 5;
    table[6] = 0;
    table[7] = 255;
  }
  return table;
}
