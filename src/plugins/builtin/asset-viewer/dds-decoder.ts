/**
 * Zero-dependency pure TypeScript DDS (DirectDraw Surface) texture decoder.
 * Supports BC1 (DXT1), BC2 (DXT3), BC3 (DXT5), BC4, BC5, BC7 (Modes 0-7),
 * DX10 extended headers, sRGB / Linear metadata detection, and uncompressed RGBA/BGRA textures.
 */

export interface DecodedDDS {
  width: number;
  height: number;
  format: string;
  rgba: Uint8ClampedArray;
  isSRGB: boolean;
  dxgiFormat?: number;
}

// DDS Magic & FourCC constants
const DDS_MAGIC = 0x20534444; // 'DDS '
const FOURCC_DXT1 = 0x31545844; // 'DXT1'
const FOURCC_DXT2 = 0x32545844; // 'DXT2'
const FOURCC_DXT3 = 0x33545844; // 'DXT3'
const FOURCC_DXT4 = 0x34545844; // 'DXT4'
const FOURCC_DXT5 = 0x35545844; // 'DXT5'
const FOURCC_ATI1 = 0x31495441; // 'ATI1'
const FOURCC_BC4U = 0x55344342; // 'BC4U'
const FOURCC_BC4S = 0x53344342; // 'BC4S'
const FOURCC_ATI2 = 0x32495441; // 'ATI2'
const FOURCC_BC5U = 0x55354342; // 'BC5U'
const FOURCC_BC5S = 0x53354342; // 'BC5S'
const FOURCC_DX10 = 0x30315844; // 'DX10'
const FOURCC_BC7  = 0x20374342; // 'BC7 '
const FOURCC_BC7_ALT = 0x00374342; // 'BC7\0'

// DXGI Format constants
export const DXGI_FORMAT_R8G8B8A8_UNORM = 28;
export const DXGI_FORMAT_R8G8B8A8_UNORM_SRGB = 29;
export const DXGI_FORMAT_BC1_TYPELESS = 70;
export const DXGI_FORMAT_BC1_UNORM = 71;
export const DXGI_FORMAT_BC1_UNORM_SRGB = 72;
export const DXGI_FORMAT_BC2_TYPELESS = 73;
export const DXGI_FORMAT_BC2_UNORM = 74;
export const DXGI_FORMAT_BC2_UNORM_SRGB = 75;
export const DXGI_FORMAT_BC3_TYPELESS = 76;
export const DXGI_FORMAT_BC3_UNORM = 77;
export const DXGI_FORMAT_BC3_UNORM_SRGB = 78;
export const DXGI_FORMAT_BC4_TYPELESS = 79;
export const DXGI_FORMAT_BC4_UNORM = 80;
export const DXGI_FORMAT_BC4_SNORM = 81;
export const DXGI_FORMAT_BC5_TYPELESS = 82;
export const DXGI_FORMAT_BC5_UNORM = 83;
export const DXGI_FORMAT_BC5_SNORM = 84;
export const DXGI_FORMAT_B8G8R8A8_UNORM = 87;
export const DXGI_FORMAT_B8G8R8X8_UNORM = 88;
export const DXGI_FORMAT_B8G8R8A8_UNORM_SRGB = 91;
export const DXGI_FORMAT_B8G8R8X8_UNORM_SRGB = 93;
export const DXGI_FORMAT_BC7_TYPELESS = 97;
export const DXGI_FORMAT_BC7_UNORM = 98;
export const DXGI_FORMAT_BC7_UNORM_SRGB = 99;

export function decodeDDS(buffer: Uint8Array | ArrayBuffer): DecodedDDS {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.byteLength < 4) {
    throw new Error('유효한 DDS 파일이 아닙니다 (데이터 크기 부족).');
  }

  const header = new DataView(bytes.buffer, bytes.byteOffset, Math.min(bytes.byteLength, 148));
  const magic = header.getUint32(0, true);
  if (magic !== DDS_MAGIC) {
    throw new Error('유효한 DDS 파일이 아닙니다 (Magic 불일치).');
  }

  if (bytes.byteLength < 128) {
    throw new Error('유효한 DDS 파일이 아닙니다 (헤더 크기 128바이트 미만).');
  }

  const height = header.getUint32(12, true);
  const width = header.getUint32(16, true);
  const pfFlags = header.getUint32(80, true);
  const fourCC = header.getUint32(84, true);
  const rgbBitCount = header.getUint32(88, true);
  const rMask = header.getUint32(92, true);
  const gMask = header.getUint32(96, true);
  const bMask = header.getUint32(100, true);
  const aMask = header.getUint32(104, true);

  let dataOffset = 128;
  let dxgiFormat: number | undefined;
  let isSRGB = false;
  let formatName = 'RGBA';

  if (fourCC === FOURCC_DX10 && bytes.byteLength >= 148) {
    dataOffset = 148;
    dxgiFormat = header.getUint32(128, true);
  }

  const rgba = new Uint8ClampedArray(width * height * 4);

  if (dxgiFormat !== undefined) {
    // DX10 Header path
    switch (dxgiFormat) {
      case DXGI_FORMAT_BC7_UNORM:
        formatName = 'BC7 (Linear)';
        isSRGB = false;
        decodeBC7(bytes, dataOffset, width, height, rgba);
        break;
      case DXGI_FORMAT_BC7_UNORM_SRGB:
      case DXGI_FORMAT_BC7_TYPELESS:
        formatName = 'BC7 (sRGB)';
        isSRGB = true;
        decodeBC7(bytes, dataOffset, width, height, rgba);
        break;

      case DXGI_FORMAT_BC1_UNORM:
      case DXGI_FORMAT_BC1_TYPELESS:
        formatName = 'BC1 (Linear)';
        isSRGB = false;
        decodeDXT1(bytes, dataOffset, width, height, rgba);
        break;
      case DXGI_FORMAT_BC1_UNORM_SRGB:
        formatName = 'BC1 (sRGB)';
        isSRGB = true;
        decodeDXT1(bytes, dataOffset, width, height, rgba);
        break;

      case DXGI_FORMAT_BC2_UNORM:
      case DXGI_FORMAT_BC2_TYPELESS:
        formatName = 'BC2 (Linear)';
        isSRGB = false;
        decodeDXT3(bytes, dataOffset, width, height, rgba);
        break;
      case DXGI_FORMAT_BC2_UNORM_SRGB:
        formatName = 'BC2 (sRGB)';
        isSRGB = true;
        decodeDXT3(bytes, dataOffset, width, height, rgba);
        break;

      case DXGI_FORMAT_BC3_UNORM:
      case DXGI_FORMAT_BC3_TYPELESS:
        formatName = 'BC3 (Linear)';
        isSRGB = false;
        decodeDXT5(bytes, dataOffset, width, height, rgba);
        break;
      case DXGI_FORMAT_BC3_UNORM_SRGB:
        formatName = 'BC3 (sRGB)';
        isSRGB = true;
        decodeDXT5(bytes, dataOffset, width, height, rgba);
        break;

      case DXGI_FORMAT_BC4_UNORM:
      case DXGI_FORMAT_BC4_SNORM:
      case DXGI_FORMAT_BC4_TYPELESS:
        formatName = 'BC4 (Linear)';
        isSRGB = false;
        decodeBC4(bytes, dataOffset, width, height, rgba);
        break;

      case DXGI_FORMAT_BC5_UNORM:
      case DXGI_FORMAT_BC5_SNORM:
      case DXGI_FORMAT_BC5_TYPELESS:
        formatName = 'BC5 (Linear)';
        isSRGB = false;
        decodeBC5(bytes, dataOffset, width, height, rgba);
        break;

      case DXGI_FORMAT_R8G8B8A8_UNORM:
        formatName = 'RGBA32 (Linear)';
        isSRGB = false;
        decodeRGBA32(bytes, dataOffset, width, height, rgba);
        break;
      case DXGI_FORMAT_R8G8B8A8_UNORM_SRGB:
        formatName = 'RGBA32 (sRGB)';
        isSRGB = true;
        decodeRGBA32(bytes, dataOffset, width, height, rgba);
        break;

      case DXGI_FORMAT_B8G8R8A8_UNORM:
      case DXGI_FORMAT_B8G8R8X8_UNORM:
        formatName = 'BGRA32 (Linear)';
        isSRGB = false;
        decodeBGRA32(bytes, dataOffset, width, height, rgba);
        break;
      case DXGI_FORMAT_B8G8R8A8_UNORM_SRGB:
      case DXGI_FORMAT_B8G8R8X8_UNORM_SRGB:
        formatName = 'BGRA32 (sRGB)';
        isSRGB = true;
        decodeBGRA32(bytes, dataOffset, width, height, rgba);
        break;

      default:
        formatName = `DXGI Format ${dxgiFormat}`;
        decodeBC7(bytes, dataOffset, width, height, rgba);
        break;
    }
  } else {
    // Legacy FourCC / DDPF path
    if (fourCC === FOURCC_DXT1) {
      formatName = 'DXT1 (BC1)';
      isSRGB = false;
      decodeDXT1(bytes, dataOffset, width, height, rgba);
    } else if (fourCC === FOURCC_DXT2 || fourCC === FOURCC_DXT3) {
      formatName = 'DXT3 (BC2)';
      isSRGB = false;
      decodeDXT3(bytes, dataOffset, width, height, rgba);
    } else if (fourCC === FOURCC_DXT4 || fourCC === FOURCC_DXT5) {
      formatName = 'DXT5 (BC3)';
      isSRGB = false;
      decodeDXT5(bytes, dataOffset, width, height, rgba);
    } else if (fourCC === FOURCC_BC7 || fourCC === FOURCC_BC7_ALT) {
      formatName = 'BC7';
      isSRGB = false;
      decodeBC7(bytes, dataOffset, width, height, rgba);
    } else if (fourCC === FOURCC_ATI1 || fourCC === FOURCC_BC4U || fourCC === FOURCC_BC4S) {
      formatName = 'BC4';
      isSRGB = false;
      decodeBC4(bytes, dataOffset, width, height, rgba);
    } else if (fourCC === FOURCC_ATI2 || fourCC === FOURCC_BC5U || fourCC === FOURCC_BC5S) {
      formatName = 'BC5';
      isSRGB = false;
      decodeBC5(bytes, dataOffset, width, height, rgba);
    } else if ((pfFlags & 0x40) !== 0 || rgbBitCount === 32 || rgbBitCount === 24) {
      // Uncompressed RGB / RGBA
      if (rgbBitCount === 32) {
        if (rMask === 0x000000ff && bMask === 0x00ff0000) {
          formatName = 'RGBA32';
          decodeRGBA32(bytes, dataOffset, width, height, rgba);
        } else {
          formatName = 'BGRA32';
          decodeBGRA32(bytes, dataOffset, width, height, rgba);
        }
      } else if (rgbBitCount === 24) {
        formatName = 'BGR24';
        decodeBGR24(bytes, dataOffset, width, height, rgba);
      } else {
        formatName = `RGB ${rgbBitCount}bpp`;
        decodeBGRA32(bytes, dataOffset, width, height, rgba);
      }
    } else {
      formatName = `FourCC 0x${fourCC.toString(16)}`;
      decodeDXT1(bytes, dataOffset, width, height, rgba); // Fallback attempt
    }
  }

  return { width, height, format: formatName, rgba, isSRGB, dxgiFormat };
}

// ---------------------------------------------------------------------------
// BC1 (DXT1) Decoder
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// BC2 (DXT3) Decoder
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// BC3 (DXT5) Decoder
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// BC4 Decoder (Single-channel 8-level interpolated block, 8 bytes per 4x4)
// ---------------------------------------------------------------------------
function decodeBC4(
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
      const r0 = src[srcPos];
      const r1 = src[srcPos + 1];
      const rBits =
        BigInt(src[srcPos + 2]) |
        (BigInt(src[srcPos + 3]) << 8n) |
        (BigInt(src[srcPos + 4]) << 16n) |
        (BigInt(src[srcPos + 5]) << 24n) |
        (BigInt(src[srcPos + 6]) << 32n) |
        (BigInt(src[srcPos + 7]) << 40n);
      srcPos += 8;

      const rTable = unpackAlphaTable(r0, r1);

      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          const px = bx * 4 + x;
          const py = by * 4 + y;
          if (px < width && py < height) {
            const bitOffset = BigInt((y * 4 + x) * 3);
            const rIdx = Number((rBits >> bitOffset) & 0x07n);
            const val = rTable[rIdx];
            const dIdx = (py * width + px) * 4;
            dest[dIdx] = val;
            dest[dIdx + 1] = val;
            dest[dIdx + 2] = val;
            dest[dIdx + 3] = 255;
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// BC5 Decoder (Two-channel 8-level interpolated block, 16 bytes per 4x4)
// ---------------------------------------------------------------------------
function decodeBC5(
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
      // Red block
      const r0 = src[srcPos];
      const r1 = src[srcPos + 1];
      const rBits =
        BigInt(src[srcPos + 2]) |
        (BigInt(src[srcPos + 3]) << 8n) |
        (BigInt(src[srcPos + 4]) << 16n) |
        (BigInt(src[srcPos + 5]) << 24n) |
        (BigInt(src[srcPos + 6]) << 32n) |
        (BigInt(src[srcPos + 7]) << 40n);
      srcPos += 8;

      // Green block
      const g0 = src[srcPos];
      const g1 = src[srcPos + 1];
      const gBits =
        BigInt(src[srcPos + 2]) |
        (BigInt(src[srcPos + 3]) << 8n) |
        (BigInt(src[srcPos + 4]) << 16n) |
        (BigInt(src[srcPos + 5]) << 24n) |
        (BigInt(src[srcPos + 6]) << 32n) |
        (BigInt(src[srcPos + 7]) << 40n);
      srcPos += 8;

      const rTable = unpackAlphaTable(r0, r1);
      const gTable = unpackAlphaTable(g0, g1);

      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          const px = bx * 4 + x;
          const py = by * 4 + y;
          if (px < width && py < height) {
            const bitOffset = BigInt((y * 4 + x) * 3);
            const rVal = rTable[Number((rBits >> bitOffset) & 0x07n)];
            const gVal = gTable[Number((gBits >> bitOffset) & 0x07n)];

            // Normal map z-reconstruction: z = sqrt(max(0, 1 - x^2 - y^2))
            const nx = (rVal / 255) * 2 - 1;
            const ny = (gVal / 255) * 2 - 1;
            const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
            const bVal = Math.round(((nz + 1) / 2) * 255);

            const dIdx = (py * width + px) * 4;
            dest[dIdx] = rVal;
            dest[dIdx + 1] = gVal;
            dest[dIdx + 2] = bVal;
            dest[dIdx + 3] = 255;
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// BC7 (DirectX 11 Block Compression 7) Decoder - Modes 0 to 7
// ---------------------------------------------------------------------------

const BC7_WEIGHTS2 = [0, 21, 43, 64];
const BC7_WEIGHTS3 = [0, 9, 18, 27, 37, 46, 55, 64];
const BC7_WEIGHTS4 = [0, 4, 9, 13, 17, 21, 26, 30, 34, 38, 43, 47, 51, 55, 60, 64];

// 64 shapes of 2 subsets (16 pixels each)
// prettier-ignore
const BC7_PARTITION2 = new Uint8Array([
  0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,  0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,
  0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,1,  0,0,0,1,0,0,1,1,0,0,1,1,0,1,1,1,
  0,0,0,0,0,0,0,1,0,0,0,1,0,0,1,1,  0,0,1,1,0,1,1,1,0,1,1,1,1,1,1,1,
  0,0,0,1,0,0,1,1,0,1,1,1,1,1,1,1,  0,0,0,0,0,0,0,1,0,0,1,1,0,1,1,1,
  0,0,0,0,0,0,0,0,0,0,0,1,0,0,1,1,  0,0,1,1,0,1,1,1,1,1,1,1,1,1,1,1,
  0,0,0,0,0,0,0,1,0,1,1,1,1,1,1,1,  0,0,0,0,0,0,0,0,0,0,0,1,0,1,1,1,
  0,0,0,1,0,1,1,1,1,1,1,1,1,1,1,1,  0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,
  0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,  0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,
  0,0,0,0,1,0,0,0,1,1,1,0,1,1,1,1,  0,1,1,1,0,0,0,1,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,1,0,0,0,1,1,1,0,  0,1,1,1,0,0,1,1,0,0,0,1,0,0,0,0,
  0,0,1,1,0,0,0,1,0,0,0,0,0,0,0,0,  0,0,0,0,1,0,0,0,1,1,0,0,1,1,1,0,
  0,0,0,0,0,0,0,0,1,0,0,0,1,1,0,0,  0,1,1,1,0,0,1,1,0,0,1,1,0,0,0,1,
  0,0,1,1,0,0,0,1,0,0,0,1,0,0,0,0,  0,0,0,0,1,0,0,0,1,0,0,0,1,1,0,0,
  0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,  0,0,1,1,0,1,1,0,0,1,1,0,1,1,0,0,
  0,0,0,1,0,1,1,1,1,1,1,0,1,0,0,0,  0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,
  0,1,1,1,0,0,0,1,1,0,0,0,1,1,1,0,  0,0,1,1,1,0,0,1,1,0,0,1,1,1,0,0,
  0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,  0,0,0,0,1,1,1,1,0,0,0,0,1,1,1,1,
  0,1,0,1,1,0,1,0,0,1,0,1,1,0,1,0,  0,0,1,1,0,0,1,1,1,1,0,0,1,1,0,0,
  0,0,1,1,1,1,0,0,0,0,1,1,1,1,0,0,  0,1,0,1,0,1,0,1,1,0,1,0,1,0,1,0,
  0,1,1,0,1,0,0,1,0,1,1,0,1,0,0,1,  0,1,0,1,1,0,1,0,1,0,1,0,0,1,0,1,
  0,1,1,1,0,0,1,1,1,1,0,0,1,1,1,0,  0,0,0,1,0,0,1,1,1,1,0,0,1,0,0,0,
  0,0,1,1,0,0,1,0,0,1,0,0,1,1,0,0,  0,0,1,1,1,0,1,1,1,1,0,1,1,1,0,0,
  0,1,1,0,1,0,0,1,1,0,0,1,0,1,1,0,  0,0,1,1,1,1,0,0,1,1,0,0,0,0,1,1,
  0,1,1,0,0,1,1,0,1,0,0,1,1,0,0,1,  0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0,
  0,1,0,0,1,1,1,0,0,1,0,0,0,0,0,0,  0,0,1,0,0,1,1,1,0,0,1,0,0,0,0,0,
  0,0,0,0,0,0,1,0,0,1,1,1,0,0,1,0,  0,0,0,0,0,1,0,0,1,1,1,0,0,1,0,0,
  0,1,1,0,1,1,0,0,1,0,0,1,0,0,1,1,  0,0,1,1,0,1,1,0,1,1,0,0,1,0,0,1,
  0,1,1,0,0,0,1,1,1,0,0,1,1,1,0,0,  0,0,1,1,1,0,0,1,1,1,0,0,0,1,1,0,
  0,1,1,0,1,1,0,0,1,1,0,0,1,0,0,1,  0,1,1,0,0,0,1,1,0,0,1,1,1,0,0,1,
  0,1,1,1,1,1,1,0,1,0,0,0,0,0,0,1,  0,0,0,1,1,0,0,0,1,1,1,0,0,1,1,1,
  0,0,0,0,1,1,1,1,0,0,1,1,0,0,1,1,  0,0,1,1,0,0,1,1,1,1,1,1,0,0,0,0,
  0,0,1,0,0,0,1,0,1,1,1,0,1,1,1,0,  0,1,0,0,0,1,0,0,0,1,1,1,0,1,1,1,
]);

// 64 shapes of 3 subsets (16 pixels each)
// prettier-ignore
const BC7_PARTITION3 = new Uint8Array([
  0,0,1,1,0,0,1,1,0,2,2,1,2,2,2,2,  0,0,0,1,0,0,1,1,2,2,1,1,2,2,2,1,
  0,0,0,0,2,0,0,1,2,2,1,1,2,2,1,1,  0,2,2,2,0,0,2,2,0,0,1,1,0,1,1,1,
  0,0,0,0,0,0,0,0,1,1,2,2,1,1,2,2,  0,0,1,1,0,0,1,1,0,0,2,2,0,0,2,2,
  0,0,2,2,0,0,2,2,1,1,1,1,1,1,1,1,  0,0,1,1,0,0,1,1,2,2,1,1,2,2,1,1,
  0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,  0,0,0,0,1,1,1,1,1,1,1,1,2,2,2,2,
  0,0,0,0,1,1,1,1,2,2,2,2,2,2,2,2,  0,0,1,2,0,0,1,2,0,0,1,2,0,0,1,2,
  0,1,1,2,0,1,1,2,0,1,1,2,0,1,1,2,  0,1,2,2,0,1,2,2,0,1,2,2,0,1,2,2,
  0,0,1,1,0,1,1,2,1,1,2,2,1,2,2,2,  0,0,1,1,2,0,0,1,2,2,0,0,2,2,2,0,
  0,0,0,1,0,0,1,1,0,1,1,2,1,1,2,2,  0,1,1,1,0,0,1,1,2,0,0,1,2,2,0,0,
  0,0,0,0,1,1,2,2,1,1,2,2,1,1,2,2,  0,0,2,2,0,0,2,2,0,0,2,2,1,1,1,1,
  0,1,1,1,0,1,1,1,0,2,2,2,0,2,2,2,  0,0,0,1,0,0,0,1,2,2,2,1,2,2,2,1,
  0,0,0,0,0,0,1,1,0,1,2,2,0,1,2,2,  0,0,0,0,1,1,0,0,2,2,1,0,2,2,1,0,
  0,1,2,2,0,1,2,2,0,0,1,1,0,0,0,0,  0,0,1,2,0,0,1,2,1,1,2,2,2,2,2,2,
  0,1,1,0,1,2,2,1,1,2,2,1,0,1,1,0,  0,0,0,0,0,1,1,0,1,2,2,1,1,2,2,1,
  0,0,2,2,1,1,0,2,1,1,0,2,0,0,2,2,  0,1,1,0,0,1,1,0,2,0,0,2,2,2,2,2,
  0,0,1,1,0,1,2,2,0,1,2,2,0,0,1,1,  0,0,0,0,2,0,0,0,2,2,1,1,2,2,2,1,
  0,0,0,0,0,0,0,2,1,1,2,2,1,2,2,2,  0,2,2,2,0,0,2,2,0,0,1,2,0,0,1,1,
  0,0,1,1,0,0,1,2,0,0,2,2,0,2,2,2,  0,1,2,0,0,1,2,0,0,1,2,0,0,1,2,0,
  0,0,0,0,1,1,1,1,2,2,2,2,0,0,0,0,  0,1,2,0,1,2,0,1,2,0,1,2,0,1,2,0,
  0,1,2,0,2,0,1,2,1,2,0,1,0,1,2,0,  0,0,1,1,2,2,0,0,1,1,2,2,0,0,1,1,
  0,0,1,1,1,1,2,2,2,2,0,0,0,0,1,1,  0,1,0,1,0,1,0,1,2,2,2,2,2,2,2,2,
  0,0,0,0,0,0,0,0,2,1,2,1,2,1,2,1,  0,0,2,2,1,1,2,2,0,0,2,2,1,1,2,2,
  0,0,2,2,0,0,1,1,0,0,2,2,0,0,1,1,  0,2,2,0,1,2,2,1,0,2,2,0,1,2,2,1,
  0,1,0,1,2,2,2,2,2,2,2,2,0,1,0,1,  0,0,0,0,2,1,2,1,2,1,2,1,2,1,2,1,
  0,1,0,1,0,1,0,1,0,1,0,1,2,2,2,2,  0,2,2,2,0,1,1,1,0,2,2,2,0,1,1,1,
  0,0,0,2,1,1,1,2,0,0,0,2,1,1,1,2,  0,0,0,0,2,1,1,2,2,1,1,2,2,1,1,2,
  0,2,2,2,0,1,1,1,0,1,1,1,0,2,2,2,  0,0,0,2,1,1,1,2,1,1,1,2,0,0,0,2,
  0,1,1,0,0,1,1,0,0,1,1,0,2,2,2,2,  0,0,0,0,0,0,0,0,2,1,1,2,2,1,1,2,
  0,1,1,0,0,1,1,0,2,2,2,2,2,2,2,2,  0,0,2,2,0,0,1,1,0,0,1,1,0,0,2,2,
  0,0,2,2,1,1,2,2,1,1,2,2,0,0,2,2,  0,0,0,0,0,0,0,0,0,0,0,0,2,1,1,2,
  0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,1,  0,2,2,2,1,2,2,2,0,2,2,2,1,2,2,2,
  0,1,0,1,2,2,2,2,2,2,2,2,2,2,2,2,  0,1,1,1,2,0,1,1,2,2,0,1,2,2,2,0,
]);

// 2 subsets anchor index table (for subset 1)
// prettier-ignore
const BC7_ANCHOR2 = new Uint8Array([
  15,15,15,15,15,15,15,15, 15,15,15,15,15,15,15,15,
  15, 2, 8, 2, 2, 8, 8,15,  2, 8, 2, 2, 8, 8, 2, 2,
  15,15, 6, 8, 2, 8,15,15,  2, 8, 2, 2, 2,15,15, 6,
   6, 2, 6, 8,15,15, 2, 2, 15,15,15,15,15, 2, 2,15
]);

// 3 subsets anchor index tables (for subset 1 and subset 2)
// prettier-ignore
const BC7_ANCHOR3_1 = new Uint8Array([
   3, 3,15,15, 8, 3,15,15,  8, 8, 6, 6, 6, 5, 3, 3,
   3, 3, 8,15, 3, 3, 6,10,  5, 8, 8, 6, 8, 5,15,15,
   8,15, 3, 5, 6,10, 8,15, 15, 3,15, 5,15,15,15,15,
   3,15, 5, 5, 5, 8, 5,10,  5,10, 8,13,15,12, 3, 3
]);

// prettier-ignore
const BC7_ANCHOR3_2 = new Uint8Array([
  15, 8, 8, 3,15,15, 3, 8, 15,15,15,15,15,15,15, 8,
  15, 8,15, 3,15, 8,15, 8,  3,15, 6,10,15,15,10, 8,
  15, 3,15,10,10, 8, 9,10,  6,15, 8,15, 3, 6, 6, 8,
  15, 3,15,15,15,15,15,15, 15,15,15,15, 3,15,15, 8
]);

function getBC7Mode(firstByte: number): number {
  if (firstByte === 0) return 8;
  for (let m = 0; m < 8; m++) {
    if ((firstByte & (1 << m)) !== 0) return m;
  }
  return 8;
}

function insertWeightZero(indexBits: bigint, bitsPerIndex: number, offset: number): bigint {
  const shift = BigInt(bitsPerIndex * (offset + 1) - 1);
  const lowBitMask = (1n << shift) - 1n;
  const highBitMask = ~lowBitMask;
  return ((indexBits & highBitMask) << 1n) | (indexBits & lowBitMask);
}

function bc7DequantWithPBit(val: number, pbit: number, valBits: number): number {
  const totalBits = valBits + 1;
  let v = ((val << 1) | pbit) & 0xff;
  v = (v << (8 - totalBits)) & 0xff;
  v |= v >> totalBits;
  return v & 0xff;
}

function bc7DequantNoPBit(val: number, valBits: number): number {
  if (valBits >= 8) return val & 0xff;
  let v = (val << (8 - valBits)) & 0xff;
  v |= v >> valBits;
  return v & 0xff;
}

function bc7Interp(l: number, h: number, w: number, weights: number[]): number {
  const weight = weights[w];
  return (l * (64 - weight) + h * weight + 32) >> 6;
}

function readUint64LE(bytes: Uint8Array, offset: number): bigint {
  const b0 = BigInt(bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | ((bytes[offset + 3] << 24) >>> 0));
  const b1 = BigInt(bytes[offset + 4] | (bytes[offset + 5] << 8) | (bytes[offset + 6] << 16) | ((bytes[offset + 7] << 24) >>> 0));
  return (b1 << 32n) | (b0 & 0xffffffffn);
}

function decodeBC7(
  src: Uint8Array,
  offset: number,
  width: number,
  height: number,
  dest: Uint8ClampedArray,
) {
  const numBlocksWide = Math.ceil(width / 4);
  const numBlocksHigh = Math.ceil(height / 4);
  let srcPos = offset;
  const blockPixels = new Uint8Array(16 * 4);

  for (let by = 0; by < numBlocksHigh; by++) {
    for (let bx = 0; bx < numBlocksWide; bx++) {
      if (srcPos + 16 > src.length) return;

      decodeBC7Block(src, srcPos, blockPixels);
      srcPos += 16;

      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          const px = bx * 4 + x;
          const py = by * 4 + y;
          if (px < width && py < height) {
            const sIdx = (y * 4 + x) * 4;
            const dIdx = (py * width + px) * 4;
            dest[dIdx] = blockPixels[sIdx];
            dest[dIdx + 1] = blockPixels[sIdx + 1];
            dest[dIdx + 2] = blockPixels[sIdx + 2];
            dest[dIdx + 3] = blockPixels[sIdx + 3];
          }
        }
      }
    }
  }
}

function decodeBC7Block(src: Uint8Array, offset: number, outPixels: Uint8Array) {
  const mode = getBC7Mode(src[offset]);
  if (mode > 7) {
    outPixels.fill(0);
    return;
  }

  const lowChunk = readUint64LE(src, offset);
  const highChunk = readUint64LE(src, offset + 8);

  switch (mode) {
    case 0:
    case 2:
      unpackBC7Mode0_2(mode, lowChunk, highChunk, outPixels);
      break;
    case 1:
    case 3:
    case 7:
      unpackBC7Mode1_3_7(mode, lowChunk, highChunk, outPixels);
      break;
    case 4:
    case 5:
      unpackBC7Mode4_5(mode, lowChunk, highChunk, outPixels);
      break;
    case 6:
      unpackBC7Mode6(lowChunk, highChunk, outPixels);
      break;
    default:
      outPixels.fill(0);
      break;
  }
}

function unpackBC7Mode0_2(mode: number, lowChunk: bigint, highChunk: bigint, outPixels: Uint8Array) {
  const weightBits = mode === 0 ? 3 : 2;
  const weightMask = (1 << weightBits) - 1;
  const endpointBits = mode === 0 ? 4 : 5;
  const endpointMask = (1 << endpointBits) - 1;
  const pBits = mode === 0 ? 6 : 0;
  const partBits = mode === 0 ? 4 : 6;
  const partMask = (1 << partBits) - 1;

  const part = Number((lowChunk >> BigInt(mode + 1)) & BigInt(partMask));

  const channelReadChunks: bigint[] = [0n, 0n, 0n];
  if (mode === 0) {
    channelReadChunks[0] = lowChunk >> 5n;
    channelReadChunks[1] = lowChunk >> 29n;
    channelReadChunks[2] = (lowChunk >> 53n) | (highChunk << 11n);
  } else {
    channelReadChunks[0] = lowChunk >> 9n;
    channelReadChunks[1] = (lowChunk >> 39n) | (highChunk << 25n);
    channelReadChunks[2] = highChunk >> 5n;
  }

  const endpoints: number[][] = Array.from({ length: 6 }, () => [0, 0, 0, 255]);
  for (let c = 0; c < 3; c++) {
    let chunk = channelReadChunks[c];
    for (let e = 0; e < 6; e++) {
      endpoints[e][c] = Number(chunk & BigInt(endpointMask));
      chunk >>= BigInt(endpointBits);
    }
  }

  const pbits = [0, 0, 0, 0, 0, 0];
  if (mode === 0) {
    const pBitsChunk = Number((highChunk >> 13n) & 0x3fn);
    for (let p = 0; p < pBits; p++) {
      pbits[p] = (pBitsChunk >> p) & 1;
    }
  }

  let weightsReadChunk = highChunk >> BigInt(67 - 16 * weightBits);
  const anchor1 = Math.min(BC7_ANCHOR3_1[part], BC7_ANCHOR3_2[part]);
  const anchor2 = Math.max(BC7_ANCHOR3_1[part], BC7_ANCHOR3_2[part]);
  weightsReadChunk = insertWeightZero(weightsReadChunk, weightBits, 0);
  weightsReadChunk = insertWeightZero(weightsReadChunk, weightBits, anchor1);
  weightsReadChunk = insertWeightZero(weightsReadChunk, weightBits, anchor2);

  const weights: number[] = new Array(16);
  for (let i = 0; i < 16; i++) {
    weights[i] = Number(weightsReadChunk & BigInt(weightMask));
    weightsReadChunk >>= BigInt(weightBits);
  }

  for (let e = 0; e < 6; e++) {
    for (let c = 0; c < 3; c++) {
      endpoints[e][c] = pBits
        ? bc7DequantWithPBit(endpoints[e][c], pbits[e], endpointBits)
        : bc7DequantNoPBit(endpoints[e][c], endpointBits);
    }
  }

  const weightsTable = weightBits === 2 ? BC7_WEIGHTS2 : BC7_WEIGHTS3;
  const numWeights = 1 << weightBits;
  const blockColors: number[][][] = Array.from({ length: 3 }, () =>
    Array.from({ length: numWeights }, () => [0, 0, 0, 255]),
  );

  for (let s = 0; s < 3; s++) {
    for (let i = 0; i < numWeights; i++) {
      for (let c = 0; c < 3; c++) {
        blockColors[s][i][c] = bc7Interp(endpoints[s * 2][c], endpoints[s * 2 + 1][c], i, weightsTable);
      }
    }
  }

  for (let i = 0; i < 16; i++) {
    const subset = BC7_PARTITION3[part * 16 + i];
    const color = blockColors[subset][weights[i]];
    const dIdx = i * 4;
    outPixels[dIdx] = color[0];
    outPixels[dIdx + 1] = color[1];
    outPixels[dIdx + 2] = color[2];
    outPixels[dIdx + 3] = 255;
  }
}

function unpackBC7Mode1_3_7(mode: number, lowChunk: bigint, highChunk: bigint, outPixels: Uint8Array) {
  const comps = mode === 7 ? 4 : 3;
  const weightBits = mode === 1 ? 3 : 2;
  const weightMask = (1 << weightBits) - 1;
  const endpointBits = mode === 7 ? 5 : mode === 1 ? 6 : 7;
  const endpointMask = (1 << endpointBits) - 1;
  const pBits = mode === 1 ? 2 : 4;
  const sharedPBits = mode === 1;

  const part = Number((lowChunk >> BigInt(mode + 1)) & 0x3fn);
  const endpoints: number[][] = Array.from({ length: 4 }, () => [0, 0, 0, 255]);

  const channelReadChunks: bigint[] = [0n, 0n, 0n, 0n];
  channelReadChunks[0] = lowChunk >> BigInt(mode + 7);
  let pReadChunk = 0n;
  let weightReadChunk = 0n;

  if (mode === 1) {
    channelReadChunks[1] = lowChunk >> 32n;
    channelReadChunks[2] = (lowChunk >> 56n) | (highChunk << 8n);
    pReadChunk = highChunk >> 16n;
    weightReadChunk = highChunk >> 18n;
  } else if (mode === 3) {
    channelReadChunks[1] = (lowChunk >> 38n) | (highChunk << 26n);
    channelReadChunks[2] = highChunk >> 2n;
    pReadChunk = highChunk >> 30n;
    weightReadChunk = highChunk >> 34n;
  } else {
    // Mode 7
    channelReadChunks[1] = lowChunk >> 34n;
    channelReadChunks[2] = (lowChunk >> 54n) | (highChunk << 10n);
    channelReadChunks[3] = highChunk >> 10n;
    pReadChunk = highChunk >> 30n;
    weightReadChunk = highChunk >> 34n;
  }

  for (let c = 0; c < comps; c++) {
    let chunk = channelReadChunks[c];
    for (let e = 0; e < 4; e++) {
      endpoints[e][c] = Number(chunk & BigInt(endpointMask));
      chunk >>= BigInt(endpointBits);
    }
  }

  const pbits = [0, 0, 0, 0];
  for (let p = 0; p < pBits; p++) {
    pbits[p] = Number((pReadChunk >> BigInt(p)) & 1n);
  }

  weightReadChunk = insertWeightZero(weightReadChunk, weightBits, 0);
  weightReadChunk = insertWeightZero(weightReadChunk, weightBits, BC7_ANCHOR2[part]);

  const weights: number[] = new Array(16);
  for (let i = 0; i < 16; i++) {
    weights[i] = Number(weightReadChunk & BigInt(weightMask));
    weightReadChunk >>= BigInt(weightBits);
  }

  for (let e = 0; e < 4; e++) {
    const pbit = pbits[sharedPBits ? e >> 1 : e];
    for (let c = 0; c < comps; c++) {
      endpoints[e][c] = bc7DequantWithPBit(endpoints[e][c], pbit, endpointBits);
    }
  }

  const weightsTable = weightBits === 2 ? BC7_WEIGHTS2 : BC7_WEIGHTS3;
  const numWeights = 1 << weightBits;
  const blockColors: number[][][] = Array.from({ length: 2 }, () =>
    Array.from({ length: numWeights }, () => [0, 0, 0, 255]),
  );

  for (let s = 0; s < 2; s++) {
    for (let i = 0; i < numWeights; i++) {
      for (let c = 0; c < comps; c++) {
        blockColors[s][i][c] = bc7Interp(endpoints[s * 2][c], endpoints[s * 2 + 1][c], i, weightsTable);
      }
    }
  }

  for (let i = 0; i < 16; i++) {
    const subset = BC7_PARTITION2[part * 16 + i];
    const color = blockColors[subset][weights[i]];
    const dIdx = i * 4;
    outPixels[dIdx] = color[0];
    outPixels[dIdx + 1] = color[1];
    outPixels[dIdx + 2] = color[2];
    outPixels[dIdx + 3] = comps === 4 ? color[3] : 255;
  }
}

function unpackBC7Mode4_5(mode: number, lowChunk: bigint, highChunk: bigint, outPixels: Uint8Array) {
  const weightBits = 2;
  const weightMask = (1 << weightBits) - 1;
  const aWeightBits = mode === 4 ? 3 : 2;
  const aWeightMask = (1 << aWeightBits) - 1;
  const endpointBits = mode === 4 ? 5 : 7;
  const endpointMask = (1 << endpointBits) - 1;
  const aEndpointBits = mode === 4 ? 6 : 8;
  const aEndpointMask = (1 << aEndpointBits) - 1;

  const compRot = Number((lowChunk >> BigInt(mode + 1)) & 3n);
  const indexMode = mode === 4 ? Number((lowChunk >> 7n) & 1n) : 0;

  let colorReadBits = lowChunk >> 8n;
  const endpoints: number[][] = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];

  for (let c = 0; c < 3; c++) {
    for (let e = 0; e < 2; e++) {
      endpoints[e][c] = Number(colorReadBits & BigInt(endpointMask));
      colorReadBits >>= BigInt(endpointBits);
    }
  }

  let rgbWeightsChunk = 0n;
  let aWeightsChunk = 0n;

  if (mode === 4) {
    endpoints[0][3] = Number(colorReadBits & BigInt(aEndpointMask));
    endpoints[1][3] = Number((colorReadBits >> BigInt(aEndpointBits)) & BigInt(aEndpointMask));
    rgbWeightsChunk = (lowChunk >> 50n) | (highChunk << 14n);
    aWeightsChunk = highChunk >> 17n;
  } else {
    // Mode 5
    endpoints[0][3] = Number(colorReadBits & BigInt(aEndpointMask));
    endpoints[1][3] = Number(((lowChunk >> 58n) | (highChunk << 6n)) & BigInt(aEndpointMask));
    rgbWeightsChunk = highChunk >> 2n;
    aWeightsChunk = highChunk >> 33n;
  }

  rgbWeightsChunk = insertWeightZero(rgbWeightsChunk, weightBits, 0);
  aWeightsChunk = insertWeightZero(aWeightsChunk, aWeightBits, 0);

  const effWeightBits = [indexMode ? aWeightBits : weightBits, indexMode ? weightBits : aWeightBits];
  const effWeightMask = [indexMode ? aWeightMask : weightMask, indexMode ? weightMask : aWeightMask];

  if (indexMode) {
    const tmp = rgbWeightsChunk;
    rgbWeightsChunk = aWeightsChunk;
    aWeightsChunk = tmp;
  }

  const weights: number[] = new Array(16);
  const aWeights: number[] = new Array(16);
  for (let i = 0; i < 16; i++) {
    weights[i] = Number(rgbWeightsChunk & BigInt(effWeightMask[0]));
    rgbWeightsChunk >>= BigInt(effWeightBits[0]);
  }
  for (let i = 0; i < 16; i++) {
    aWeights[i] = Number(aWeightsChunk & BigInt(effWeightMask[1]));
    aWeightsChunk >>= BigInt(effWeightBits[1]);
  }

  for (let e = 0; e < 2; e++) {
    for (let c = 0; c < 3; c++) {
      endpoints[e][c] = bc7DequantNoPBit(endpoints[e][c], endpointBits);
    }
    endpoints[e][3] = bc7DequantNoPBit(endpoints[e][3], aEndpointBits);
  }

  const rgbTable = effWeightBits[0] === 3 ? BC7_WEIGHTS3 : BC7_WEIGHTS2;
  const aTable = effWeightBits[1] === 3 ? BC7_WEIGHTS3 : BC7_WEIGHTS2;

  const numRgbWeights = 1 << effWeightBits[0];
  const numAWeights = 1 << effWeightBits[1];

  const blockColorsRgb: number[][] = Array.from({ length: numRgbWeights }, () => [0, 0, 0]);
  for (let i = 0; i < numRgbWeights; i++) {
    for (let c = 0; c < 3; c++) {
      blockColorsRgb[i][c] = bc7Interp(endpoints[0][c], endpoints[1][c], i, rgbTable);
    }
  }

  const blockColorsA: number[] = new Array(numAWeights);
  for (let i = 0; i < numAWeights; i++) {
    blockColorsA[i] = bc7Interp(endpoints[0][3], endpoints[1][3], i, aTable);
  }

  for (let i = 0; i < 16; i++) {
    const rgb = blockColorsRgb[weights[i]];
    let r = rgb[0];
    let g = rgb[1];
    let b = rgb[2];
    let a = blockColorsA[aWeights[i]];

    if (compRot === 1) {
      const tmp = a; a = r; r = tmp;
    } else if (compRot === 2) {
      const tmp = a; a = g; g = tmp;
    } else if (compRot === 3) {
      const tmp = a; a = b; b = tmp;
    }

    const dIdx = i * 4;
    outPixels[dIdx] = r;
    outPixels[dIdx + 1] = g;
    outPixels[dIdx + 2] = b;
    outPixels[dIdx + 3] = a;
  }
}

function unpackBC7Mode6(lowChunk: bigint, highChunk: bigint, outPixels: Uint8Array) {
  const r0 = Number((lowChunk >> 7n) & 0x7fn);
  const r1 = Number((lowChunk >> 14n) & 0x7fn);
  const g0 = Number((lowChunk >> 21n) & 0x7fn);
  const g1 = Number((lowChunk >> 28n) & 0x7fn);
  const b0 = Number((lowChunk >> 35n) & 0x7fn);
  const b1 = Number((lowChunk >> 42n) & 0x7fn);
  const a0 = Number((lowChunk >> 49n) & 0x7fn);
  const a1 = Number((lowChunk >> 56n) & 0x7fn);
  const p0 = Number((lowChunk >> 63n) & 1n);
  const p1 = Number(highChunk & 1n);

  const ep0 = [
    (r0 << 1) | p0,
    (g0 << 1) | p0,
    (b0 << 1) | p0,
    (a0 << 1) | p0,
  ];
  const ep1 = [
    (r1 << 1) | p1,
    (g1 << 1) | p1,
    (b1 << 1) | p1,
    (a1 << 1) | p1,
  ];

  // Precompute 16 interpolated colors
  const tableColors: number[][] = Array.from({ length: 16 }, () => [0, 0, 0, 0]);
  for (let i = 0; i < 16; i++) {
    const w = BC7_WEIGHTS4[i];
    const iw = 64 - w;
    tableColors[i][0] = (ep0[0] * iw + ep1[0] * w + 32) >> 6;
    tableColors[i][1] = (ep0[1] * iw + ep1[1] * w + 32) >> 6;
    tableColors[i][2] = (ep0[2] * iw + ep1[2] * w + 32) >> 6;
    tableColors[i][3] = (ep0[3] * iw + ep1[3] * w + 32) >> 6;
  }

  // Pixel 0 uses 3 bits (anchor fixup, MSB is 0)
  const w0 = Number((highChunk >> 1n) & 0x07n);
  const c0 = tableColors[w0];
  outPixels[0] = c0[0];
  outPixels[1] = c0[1];
  outPixels[2] = c0[2];
  outPixels[3] = c0[3];

  // Pixels 1-15 use 4 bits each
  for (let i = 1; i < 16; i++) {
    const shift = BigInt(4 + (i - 1) * 4);
    const wi = Number((highChunk >> shift) & 0x0fn);
    const ci = tableColors[wi];
    const dIdx = i * 4;
    outPixels[dIdx] = ci[0];
    outPixels[dIdx + 1] = ci[1];
    outPixels[dIdx + 2] = ci[2];
    outPixels[dIdx + 3] = ci[3];
  }
}

// ---------------------------------------------------------------------------
// Uncompressed decoders
// ---------------------------------------------------------------------------
function decodeRGBA32(
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
    dest[d++] = src[s++];
    dest[d++] = src[s++];
    dest[d++] = src[s++];
    dest[d++] = src[s++];
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

function decodeBGR24(
  src: Uint8Array,
  offset: number,
  width: number,
  height: number,
  dest: Uint8ClampedArray,
) {
  let s = offset;
  let d = 0;
  const total = width * height;
  for (let i = 0; i < total && s + 3 <= src.length; i++) {
    const b = src[s++];
    const g = src[s++];
    const r = src[s++];
    dest[d++] = r;
    dest[d++] = g;
    dest[d++] = b;
    dest[d++] = 255;
  }
}

function unpackRGB565Table(c0: number, c1: number, isDxt1: boolean): [number, number, number, number][] {
  const r0 = Math.round(((c0 >> 11) & 0x1f) * 255 / 31);
  const g0 = Math.round(((c0 >> 5) & 0x3f) * 255 / 63);
  const b0 = Math.round((c0 & 0x1f) * 255 / 31);

  const r1 = Math.round(((c1 >> 11) & 0x1f) * 255 / 31);
  const g1 = Math.round(((c1 >> 5) & 0x3f) * 255 / 63);
  const b1 = Math.round((c1 & 0x1f) * 255 / 31);

  const table: [number, number, number, number][] = [
    [r0, g0, b0, 255],
    [r1, g1, b1, 255],
    [0, 0, 0, 255],
    [0, 0, 0, 255],
  ];

  if (!isDxt1 || c0 > c1) {
    table[2] = [Math.round((2 * r0 + r1) / 3), Math.round((2 * g0 + g1) / 3), Math.round((2 * b0 + b1) / 3), 255];
    table[3] = [Math.round((r0 + 2 * r1) / 3), Math.round((g0 + 2 * g1) / 3), Math.round((b0 + 2 * b1) / 3), 255];
  } else {
    table[2] = [Math.round((r0 + r1) / 2), Math.round((g0 + g1) / 2), Math.round((b0 + b1) / 2), 255];
    table[3] = [0, 0, 0, 0];
  }

  return table;
}

function unpackAlphaTable(a0: number, a1: number): number[] {
  const table = new Array(8);
  table[0] = a0;
  table[1] = a1;
  if (a0 > a1) {
    table[2] = Math.round((6 * a0 + 1 * a1) / 7);
    table[3] = Math.round((5 * a0 + 2 * a1) / 7);
    table[4] = Math.round((4 * a0 + 3 * a1) / 7);
    table[5] = Math.round((3 * a0 + 4 * a1) / 7);
    table[6] = Math.round((2 * a0 + 5 * a1) / 7);
    table[7] = Math.round((1 * a0 + 6 * a1) / 7);
  } else {
    table[2] = Math.round((4 * a0 + 1 * a1) / 5);
    table[3] = Math.round((3 * a0 + 2 * a1) / 5);
    table[4] = Math.round((2 * a0 + 3 * a1) / 5);
    table[5] = Math.round((1 * a0 + 4 * a1) / 5);
    table[6] = 0;
    table[7] = 255;
  }
  return table;
}

