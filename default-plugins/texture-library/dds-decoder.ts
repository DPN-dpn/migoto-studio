/**
 * dds-decoder.ts
 * Zero-dependency pure TypeScript DDS (DirectDraw Surface) texture decoder.
 * Supports BC1 (DXT1), BC2 (DXT3), BC3 (DXT5), BC4, BC5, BC7 (Modes 0-7),
 * DX10 extended headers, sRGB / Linear metadata detection, and uncompressed RGBA/BGRA textures.
 */

import {
  decodeDXT1,
  decodeDXT3,
  decodeDXT5,
  decodeBC4,
  decodeBC5,
  decodeRGBA32,
  decodeBGRA32,
  decodeBGR24,
} from './dxt-decoder.ts';
import { decodeBC7 } from './bc7-decoder.ts';

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
