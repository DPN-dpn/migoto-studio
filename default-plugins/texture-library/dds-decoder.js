import { decodeBC4, decodeBC5, decodeBGR24, decodeBGRA32, decodeDXT1, decodeDXT3, decodeDXT5, decodeRGBA32 } from "./dxt-decoder.js";
import { decodeBC7 } from "./bc7-decoder.js";
//#region default-plugins/texture-library/dds-decoder.ts
/**
* dds-decoder.ts
* Zero-dependency pure TypeScript DDS (DirectDraw Surface) texture decoder.
* Supports BC1 (DXT1), BC2 (DXT3), BC3 (DXT5), BC4, BC5, BC7 (Modes 0-7),
* DX10 extended headers, sRGB / Linear metadata detection, and uncompressed RGBA/BGRA textures.
*/
var DDS_MAGIC = 542327876;
var FOURCC_DXT1 = 827611204;
var FOURCC_DXT2 = 844388420;
var FOURCC_DXT3 = 861165636;
var FOURCC_DXT4 = 877942852;
var FOURCC_DXT5 = 894720068;
var FOURCC_ATI1 = 826889281;
var FOURCC_BC4U = 1429488450;
var FOURCC_BC4S = 1395934018;
var FOURCC_ATI2 = 843666497;
var FOURCC_BC5U = 1429553986;
var FOURCC_BC5S = 1395999554;
var FOURCC_DX10 = 808540228;
var FOURCC_BC7 = 540492610;
var FOURCC_BC7_ALT = 3621698;
function decodeDDS(buffer, options) {
	const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
	if (bytes.byteLength < 4) throw new Error("유효한 DDS 파일이 아닙니다 (데이터 크기 부족).");
	const header = new DataView(bytes.buffer, bytes.byteOffset, Math.min(bytes.byteLength, 148));
	if (header.getUint32(0, true) !== DDS_MAGIC) throw new Error("유효한 DDS 파일이 아닙니다 (Magic 불일치).");
	if (bytes.byteLength < 128) throw new Error("유효한 DDS 파일이 아닙니다 (헤더 크기 128바이트 미만).");
	const height = header.getUint32(12, true);
	const width = header.getUint32(16, true);
	const pfFlags = header.getUint32(80, true);
	const fourCC = header.getUint32(84, true);
	const rgbBitCount = header.getUint32(88, true);
	const rMask = header.getUint32(92, true);
	header.getUint32(96, true);
	const bMask = header.getUint32(100, true);
	header.getUint32(104, true);
	let dataOffset = 128;
	let dxgiFormat;
	let isSRGB = false;
	let formatName = "RGBA";
	if (fourCC === FOURCC_DX10 && bytes.byteLength >= 148) {
		dataOffset = 148;
		dxgiFormat = header.getUint32(128, true);
	}
	const rgba = new Uint8ClampedArray(width * height * 4);
	if (dxgiFormat !== void 0) switch (dxgiFormat) {
		case 98:
			formatName = "BC7 (Linear)";
			isSRGB = false;
			decodeBC7(bytes, dataOffset, width, height, rgba);
			break;
		case 99:
		case 97:
			formatName = "BC7 (sRGB)";
			isSRGB = true;
			decodeBC7(bytes, dataOffset, width, height, rgba);
			break;
		case 71:
		case 70:
			formatName = "BC1 (Linear)";
			isSRGB = false;
			decodeDXT1(bytes, dataOffset, width, height, rgba);
			break;
		case 72:
			formatName = "BC1 (sRGB)";
			isSRGB = true;
			decodeDXT1(bytes, dataOffset, width, height, rgba);
			break;
		case 74:
		case 73:
			formatName = "BC2 (Linear)";
			isSRGB = false;
			decodeDXT3(bytes, dataOffset, width, height, rgba);
			break;
		case 75:
			formatName = "BC2 (sRGB)";
			isSRGB = true;
			decodeDXT3(bytes, dataOffset, width, height, rgba);
			break;
		case 77:
		case 76:
			formatName = "BC3 (Linear)";
			isSRGB = false;
			decodeDXT5(bytes, dataOffset, width, height, rgba);
			break;
		case 78:
			formatName = "BC3 (sRGB)";
			isSRGB = true;
			decodeDXT5(bytes, dataOffset, width, height, rgba);
			break;
		case 80:
		case 81:
		case 79:
			formatName = "BC4 (Linear)";
			isSRGB = false;
			decodeBC4(bytes, dataOffset, width, height, rgba);
			break;
		case 83:
		case 84:
		case 82:
			formatName = "BC5 (Linear)";
			isSRGB = false;
			decodeBC5(bytes, dataOffset, width, height, rgba);
			break;
		case 28:
			formatName = "RGBA32 (Linear)";
			isSRGB = false;
			decodeRGBA32(bytes, dataOffset, width, height, rgba);
			break;
		case 29:
			formatName = "RGBA32 (sRGB)";
			isSRGB = true;
			decodeRGBA32(bytes, dataOffset, width, height, rgba);
			break;
		case 87:
		case 88:
			formatName = "BGRA32 (Linear)";
			isSRGB = false;
			decodeBGRA32(bytes, dataOffset, width, height, rgba);
			break;
		case 91:
		case 93:
			formatName = "BGRA32 (sRGB)";
			isSRGB = true;
			decodeBGRA32(bytes, dataOffset, width, height, rgba);
			break;
		default:
			formatName = `DXGI Format ${dxgiFormat}`;
			decodeBC7(bytes, dataOffset, width, height, rgba);
	}
	else if (fourCC === FOURCC_DXT1) {
		formatName = "DXT1 (BC1)";
		isSRGB = false;
		decodeDXT1(bytes, dataOffset, width, height, rgba);
	} else if (fourCC === FOURCC_DXT2 || fourCC === FOURCC_DXT3) {
		formatName = "DXT3 (BC2)";
		isSRGB = false;
		decodeDXT3(bytes, dataOffset, width, height, rgba);
	} else if (fourCC === FOURCC_DXT4 || fourCC === FOURCC_DXT5) {
		formatName = "DXT5 (BC3)";
		isSRGB = false;
		decodeDXT5(bytes, dataOffset, width, height, rgba);
	} else if (fourCC === FOURCC_BC7 || fourCC === FOURCC_BC7_ALT) {
		formatName = "BC7";
		isSRGB = false;
		decodeBC7(bytes, dataOffset, width, height, rgba);
	} else if (fourCC === FOURCC_ATI1 || fourCC === FOURCC_BC4U || fourCC === FOURCC_BC4S) {
		formatName = "BC4";
		isSRGB = false;
		decodeBC4(bytes, dataOffset, width, height, rgba);
	} else if (fourCC === FOURCC_ATI2 || fourCC === FOURCC_BC5U || fourCC === FOURCC_BC5S) {
		formatName = "BC5";
		isSRGB = false;
		decodeBC5(bytes, dataOffset, width, height, rgba);
	} else if ((pfFlags & 64) !== 0 || rgbBitCount === 32 || rgbBitCount === 24) {
		if (rgbBitCount === 32) {
			if (rMask === 255 && bMask === 16711680) {
				formatName = "RGBA32";
				decodeRGBA32(bytes, dataOffset, width, height, rgba);
			} else {
				formatName = "BGRA32";
				decodeBGRA32(bytes, dataOffset, width, height, rgba);
			}
		} else if (rgbBitCount === 24) {
			formatName = "BGR24";
			decodeBGR24(bytes, dataOffset, width, height, rgba);
		} else {
			formatName = `RGB ${rgbBitCount}bpp`;
			decodeBGRA32(bytes, dataOffset, width, height, rgba);
		}
	} else {
		formatName = `FourCC 0x${fourCC.toString(16)}`;
		decodeDXT1(bytes, dataOffset, width, height, rgba);
	}
	if (options?.ignoreAlpha) for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255;
	return {
		width,
		height,
		format: formatName,
		rgba,
		isSRGB,
		dxgiFormat
	};
}
//#endregion
export { decodeDDS };
