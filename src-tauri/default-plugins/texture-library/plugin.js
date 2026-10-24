//#region default-plugins/texture-library/dxt-decoder.ts
/**
* dxt-decoder.ts
* BC1(DXT1), BC2(DXT3), BC3(DXT5), BC4, BC5 및 비압축(RGBA/BGRA/BGR) 텍스처 디코더
*/
function unpackRGB565Table(c0, c1, isDxt1) {
	const r0 = Math.round((c0 >> 11 & 31) * 255 / 31);
	const g0 = Math.round((c0 >> 5 & 63) * 255 / 63);
	const b0 = Math.round((c0 & 31) * 255 / 31);
	const r1 = Math.round((c1 >> 11 & 31) * 255 / 31);
	const g1 = Math.round((c1 >> 5 & 63) * 255 / 63);
	const b1 = Math.round((c1 & 31) * 255 / 31);
	const table = [
		[
			r0,
			g0,
			b0,
			255
		],
		[
			r1,
			g1,
			b1,
			255
		],
		[
			0,
			0,
			0,
			255
		],
		[
			0,
			0,
			0,
			255
		]
	];
	if (!isDxt1 || c0 > c1) {
		table[2] = [
			Math.round((2 * r0 + r1) / 3),
			Math.round((2 * g0 + g1) / 3),
			Math.round((2 * b0 + b1) / 3),
			255
		];
		table[3] = [
			Math.round((r0 + 2 * r1) / 3),
			Math.round((g0 + 2 * g1) / 3),
			Math.round((b0 + 2 * b1) / 3),
			255
		];
	} else {
		table[2] = [
			Math.round((r0 + r1) / 2),
			Math.round((g0 + g1) / 2),
			Math.round((b0 + b1) / 2),
			255
		];
		table[3] = [
			0,
			0,
			0,
			0
		];
	}
	return table;
}
function unpackAlphaTable(a0, a1) {
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
function decodeDXT1(src, offset, width, height, dest) {
	const numBlocksWide = Math.ceil(width / 4);
	const numBlocksHigh = Math.ceil(height / 4);
	let srcPos = offset;
	for (let by = 0; by < numBlocksHigh; by++) for (let bx = 0; bx < numBlocksWide; bx++) {
		if (srcPos + 8 > src.length) return;
		const c0 = src[srcPos] | src[srcPos + 1] << 8;
		const c1 = src[srcPos + 2] | src[srcPos + 3] << 8;
		const code = src[srcPos + 4] | src[srcPos + 5] << 8 | src[srcPos + 6] << 16 | src[srcPos + 7] << 24;
		srcPos += 8;
		const colors = unpackRGB565Table(c0, c1, true);
		for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
			const px = bx * 4 + x;
			const py = by * 4 + y;
			if (px < width && py < height) {
				const colorIdx = code >> (y * 4 + x) * 2 & 3;
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
function decodeDXT3(src, offset, width, height, dest) {
	const numBlocksWide = Math.ceil(width / 4);
	const numBlocksHigh = Math.ceil(height / 4);
	let srcPos = offset;
	for (let by = 0; by < numBlocksHigh; by++) for (let bx = 0; bx < numBlocksWide; bx++) {
		if (srcPos + 16 > src.length) return;
		const alphaTable = src.subarray(srcPos, srcPos + 8);
		srcPos += 8;
		const c0 = src[srcPos] | src[srcPos + 1] << 8;
		const c1 = src[srcPos + 2] | src[srcPos + 3] << 8;
		const code = src[srcPos + 4] | src[srcPos + 5] << 8 | src[srcPos + 6] << 16 | src[srcPos + 7] << 24;
		srcPos += 8;
		const colors = unpackRGB565Table(c0, c1, false);
		for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
			const px = bx * 4 + x;
			const py = by * 4 + y;
			if (px < width && py < height) {
				const aIdx = y * 2 + Math.floor(x / 2);
				const aShift = x % 2 * 4;
				const alpha = (alphaTable[aIdx] >> aShift & 15) * 17;
				const colorIdx = code >> (y * 4 + x) * 2 & 3;
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
function decodeDXT5(src, offset, width, height, dest) {
	const numBlocksWide = Math.ceil(width / 4);
	const numBlocksHigh = Math.ceil(height / 4);
	let srcPos = offset;
	for (let by = 0; by < numBlocksHigh; by++) for (let bx = 0; bx < numBlocksWide; bx++) {
		if (srcPos + 16 > src.length) return;
		const a0 = src[srcPos];
		const a1 = src[srcPos + 1];
		const aBits = BigInt(src[srcPos + 2]) | BigInt(src[srcPos + 3]) << 8n | BigInt(src[srcPos + 4]) << 16n | BigInt(src[srcPos + 5]) << 24n | BigInt(src[srcPos + 6]) << 32n | BigInt(src[srcPos + 7]) << 40n;
		srcPos += 8;
		const c0 = src[srcPos] | src[srcPos + 1] << 8;
		const c1 = src[srcPos + 2] | src[srcPos + 3] << 8;
		const code = src[srcPos + 4] | src[srcPos + 5] << 8 | src[srcPos + 6] << 16 | src[srcPos + 7] << 24;
		srcPos += 8;
		const alphaTable = unpackAlphaTable(a0, a1);
		const colors = unpackRGB565Table(c0, c1, false);
		for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
			const px = bx * 4 + x;
			const py = by * 4 + y;
			if (px < width && py < height) {
				const bitOffset = BigInt((y * 4 + x) * 3);
				const alpha = alphaTable[Number(aBits >> bitOffset & 7n)];
				const colorIdx = code >> (y * 4 + x) * 2 & 3;
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
function decodeBC4(src, offset, width, height, dest) {
	const numBlocksWide = Math.ceil(width / 4);
	const numBlocksHigh = Math.ceil(height / 4);
	let srcPos = offset;
	for (let by = 0; by < numBlocksHigh; by++) for (let bx = 0; bx < numBlocksWide; bx++) {
		if (srcPos + 8 > src.length) return;
		const r0 = src[srcPos];
		const r1 = src[srcPos + 1];
		const rBits = BigInt(src[srcPos + 2]) | BigInt(src[srcPos + 3]) << 8n | BigInt(src[srcPos + 4]) << 16n | BigInt(src[srcPos + 5]) << 24n | BigInt(src[srcPos + 6]) << 32n | BigInt(src[srcPos + 7]) << 40n;
		srcPos += 8;
		const rTable = unpackAlphaTable(r0, r1);
		for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
			const px = bx * 4 + x;
			const py = by * 4 + y;
			if (px < width && py < height) {
				const bitOffset = BigInt((y * 4 + x) * 3);
				const val = rTable[Number(rBits >> bitOffset & 7n)];
				const dIdx = (py * width + px) * 4;
				dest[dIdx] = val;
				dest[dIdx + 1] = val;
				dest[dIdx + 2] = val;
				dest[dIdx + 3] = 255;
			}
		}
	}
}
function decodeBC5(src, offset, width, height, dest) {
	const numBlocksWide = Math.ceil(width / 4);
	const numBlocksHigh = Math.ceil(height / 4);
	let srcPos = offset;
	for (let by = 0; by < numBlocksHigh; by++) for (let bx = 0; bx < numBlocksWide; bx++) {
		if (srcPos + 16 > src.length) return;
		const r0 = src[srcPos];
		const r1 = src[srcPos + 1];
		const rBits = BigInt(src[srcPos + 2]) | BigInt(src[srcPos + 3]) << 8n | BigInt(src[srcPos + 4]) << 16n | BigInt(src[srcPos + 5]) << 24n | BigInt(src[srcPos + 6]) << 32n | BigInt(src[srcPos + 7]) << 40n;
		srcPos += 8;
		const g0 = src[srcPos];
		const g1 = src[srcPos + 1];
		const gBits = BigInt(src[srcPos + 2]) | BigInt(src[srcPos + 3]) << 8n | BigInt(src[srcPos + 4]) << 16n | BigInt(src[srcPos + 5]) << 24n | BigInt(src[srcPos + 6]) << 32n | BigInt(src[srcPos + 7]) << 40n;
		srcPos += 8;
		const rTable = unpackAlphaTable(r0, r1);
		const gTable = unpackAlphaTable(g0, g1);
		for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
			const px = bx * 4 + x;
			const py = by * 4 + y;
			if (px < width && py < height) {
				const bitOffset = BigInt((y * 4 + x) * 3);
				const rVal = rTable[Number(rBits >> bitOffset & 7n)];
				const gVal = gTable[Number(gBits >> bitOffset & 7n)];
				const nx = rVal / 255 * 2 - 1;
				const ny = gVal / 255 * 2 - 1;
				const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
				const bVal = Math.round((nz + 1) / 2 * 255);
				const dIdx = (py * width + px) * 4;
				dest[dIdx] = rVal;
				dest[dIdx + 1] = gVal;
				dest[dIdx + 2] = bVal;
				dest[dIdx + 3] = 255;
			}
		}
	}
}
function decodeRGBA32(src, offset, width, height, dest) {
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
function decodeBGRA32(src, offset, width, height, dest) {
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
function decodeBGR24(src, offset, width, height, dest) {
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
//#endregion
//#region default-plugins/texture-library/bc7-decoder.ts
/**
* bc7-decoder.ts
* BC7 (DirectX 11 Block Compression 7) 텍스처 디코더 - Modes 0 to 7
*/
var BC7_WEIGHTS2 = [
	0,
	21,
	43,
	64
];
var BC7_WEIGHTS3 = [
	0,
	9,
	18,
	27,
	37,
	46,
	55,
	64
];
var BC7_WEIGHTS4 = [
	0,
	4,
	9,
	13,
	17,
	21,
	26,
	30,
	34,
	38,
	43,
	47,
	51,
	55,
	60,
	64
];
var BC7_PARTITION2 = new Uint8Array([
	0,
	0,
	1,
	1,
	0,
	0,
	1,
	1,
	0,
	0,
	1,
	1,
	0,
	0,
	1,
	1,
	0,
	0,
	0,
	1,
	0,
	0,
	0,
	1,
	0,
	0,
	0,
	1,
	0,
	0,
	0,
	1,
	0,
	1,
	1,
	1,
	0,
	1,
	1,
	1,
	0,
	1,
	1,
	1,
	0,
	1,
	1,
	1,
	0,
	0,
	0,
	1,
	0,
	0,
	1,
	1,
	0,
	0,
	1,
	1,
	0,
	1,
	1,
	1,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	1,
	0,
	0,
	0,
	1,
	0,
	0,
	1,
	1,
	0,
	0,
	1,
	1,
	0,
	1,
	1,
	1,
	0,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	0,
	0,
	0,
	1,
	0,
	0,
	1,
	1,
	0,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	1,
	0,
	0,
	1,
	1,
	0,
	1,
	1,
	1,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	1,
	0,
	0,
	1,
	1,
	0,
	0,
	1,
	1,
	0,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	1,
	0,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	1,
	0,
	1,
	1,
	1,
	0,
	0,
	0,
	1,
	0,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	0,
	0,
	0,
	0,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	1,
	1,
	1,
	1,
	0,
	0,
	0,
	0,
	1,
	0,
	0,
	0,
	1,
	1,
	1,
	0,
	1,
	1,
	1,
	1,
	0,
	1,
	1,
	1,
	0,
	0,
	0,
	1,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	1,
	0,
	0,
	0,
	1,
	1,
	1,
	0,
	0,
	1,
	1,
	1,
	0,
	0,
	1,
	1,
	0,
	0,
	0,
	1,
	0,
	0,
	0,
	0,
	0,
	0,
	1,
	1,
	0,
	0,
	0,
	1,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	1,
	0,
	0,
	0,
	1,
	1,
	0,
	0,
	1,
	1,
	1,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	1,
	0,
	0,
	0,
	1,
	1,
	0,
	0,
	0,
	1,
	1,
	1,
	0,
	0,
	1,
	1,
	0,
	0,
	1,
	1,
	0,
	0,
	0,
	1,
	0,
	0,
	1,
	1,
	0,
	0,
	0,
	1,
	0,
	0,
	0,
	1,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	1,
	0,
	0,
	0,
	1,
	0,
	0,
	0,
	1,
	1,
	0,
	0,
	0,
	1,
	1,
	0,
	0,
	1,
	1,
	0,
	0,
	1,
	1,
	0,
	0,
	1,
	1,
	0,
	0,
	0,
	1,
	1,
	0,
	1,
	1,
	0,
	0,
	1,
	1,
	0,
	1,
	1,
	0,
	0,
	0,
	0,
	0,
	1,
	0,
	1,
	1,
	1,
	1,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	0,
	0,
	0,
	0,
	0,
	1,
	1,
	1,
	0,
	0,
	0,
	1,
	1,
	0,
	0,
	0,
	1,
	1,
	1,
	0,
	0,
	0,
	1,
	1,
	1,
	0,
	0,
	1,
	1,
	0,
	0,
	1,
	1,
	1,
	0,
	0,
	0,
	1,
	0,
	1,
	0,
	1,
	0,
	1,
	0,
	1,
	0,
	1,
	0,
	1,
	0,
	1,
	0,
	0,
	0,
	0,
	1,
	1,
	1,
	1,
	0,
	0,
	0,
	0,
	1,
	1,
	1,
	1,
	0,
	1,
	0,
	1,
	1,
	0,
	1,
	0,
	0,
	1,
	0,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	1,
	1,
	0,
	0,
	1,
	1,
	1,
	1,
	0,
	0,
	1,
	1,
	0,
	0,
	0,
	0,
	1,
	1,
	1,
	1,
	0,
	0,
	0,
	0,
	1,
	1,
	1,
	1,
	0,
	0,
	0,
	1,
	0,
	1,
	0,
	1,
	0,
	1,
	1,
	0,
	1,
	0,
	1,
	0,
	1,
	0,
	0,
	1,
	1,
	0,
	1,
	0,
	0,
	1,
	0,
	1,
	1,
	0,
	1,
	0,
	0,
	1,
	0,
	1,
	0,
	1,
	1,
	0,
	1,
	0,
	1,
	0,
	1,
	0,
	0,
	1,
	0,
	1,
	0,
	1,
	1,
	1,
	0,
	0,
	1,
	1,
	1,
	1,
	0,
	0,
	1,
	1,
	1,
	0,
	0,
	0,
	0,
	1,
	0,
	0,
	1,
	1,
	1,
	1,
	0,
	0,
	1,
	0,
	0,
	0,
	0,
	0,
	1,
	1,
	0,
	0,
	1,
	0,
	0,
	1,
	0,
	0,
	1,
	1,
	0,
	0,
	0,
	0,
	1,
	1,
	1,
	0,
	1,
	1,
	1,
	1,
	0,
	1,
	1,
	1,
	0,
	0,
	0,
	1,
	1,
	0,
	1,
	0,
	0,
	1,
	1,
	0,
	0,
	1,
	0,
	1,
	1,
	0,
	0,
	0,
	1,
	1,
	1,
	1,
	0,
	0,
	1,
	1,
	0,
	0,
	0,
	0,
	1,
	1,
	0,
	1,
	1,
	0,
	0,
	1,
	1,
	0,
	1,
	0,
	0,
	1,
	1,
	0,
	0,
	1,
	0,
	0,
	0,
	0,
	0,
	1,
	1,
	0,
	0,
	1,
	1,
	0,
	0,
	0,
	0,
	0,
	0,
	1,
	0,
	0,
	1,
	1,
	1,
	0,
	0,
	1,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	1,
	0,
	0,
	1,
	1,
	1,
	0,
	0,
	1,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	1,
	0,
	0,
	1,
	1,
	1,
	0,
	0,
	1,
	0,
	0,
	0,
	0,
	0,
	0,
	1,
	0,
	0,
	1,
	1,
	1,
	0,
	0,
	1,
	0,
	0,
	0,
	1,
	1,
	0,
	1,
	1,
	0,
	0,
	1,
	0,
	0,
	1,
	0,
	0,
	1,
	1,
	0,
	0,
	1,
	1,
	0,
	1,
	1,
	0,
	1,
	1,
	0,
	0,
	1,
	0,
	0,
	1,
	0,
	1,
	1,
	0,
	0,
	0,
	1,
	1,
	1,
	0,
	0,
	1,
	1,
	1,
	0,
	0,
	0,
	0,
	1,
	1,
	1,
	0,
	0,
	1,
	1,
	1,
	0,
	0,
	0,
	1,
	1,
	0,
	0,
	1,
	1,
	0,
	1,
	1,
	0,
	0,
	1,
	1,
	0,
	0,
	1,
	0,
	0,
	1,
	0,
	1,
	1,
	0,
	0,
	0,
	1,
	1,
	0,
	0,
	1,
	1,
	1,
	0,
	0,
	1,
	0,
	1,
	1,
	1,
	1,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	0,
	0,
	0,
	1,
	0,
	0,
	0,
	1,
	1,
	0,
	0,
	0,
	1,
	1,
	1,
	0,
	0,
	1,
	1,
	1,
	0,
	0,
	0,
	0,
	1,
	1,
	1,
	1,
	0,
	0,
	1,
	1,
	0,
	0,
	1,
	1,
	0,
	0,
	1,
	1,
	0,
	0,
	1,
	1,
	1,
	1,
	1,
	1,
	0,
	0,
	0,
	0,
	0,
	0,
	1,
	0,
	0,
	0,
	1,
	0,
	1,
	1,
	1,
	0,
	1,
	1,
	1,
	0,
	0,
	1,
	0,
	0,
	0,
	1,
	0,
	0,
	0,
	1,
	1,
	1,
	0,
	1,
	1,
	1
]);
var BC7_PARTITION3 = new Uint8Array([
	0,
	0,
	1,
	1,
	0,
	0,
	1,
	1,
	0,
	2,
	2,
	1,
	2,
	2,
	2,
	2,
	0,
	0,
	0,
	1,
	0,
	0,
	1,
	1,
	2,
	2,
	1,
	1,
	2,
	2,
	2,
	1,
	0,
	0,
	0,
	0,
	2,
	0,
	0,
	1,
	2,
	2,
	1,
	1,
	2,
	2,
	1,
	1,
	0,
	2,
	2,
	2,
	0,
	0,
	2,
	2,
	0,
	0,
	1,
	1,
	0,
	1,
	1,
	1,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	1,
	1,
	2,
	2,
	1,
	1,
	2,
	2,
	0,
	0,
	1,
	1,
	0,
	0,
	1,
	1,
	0,
	0,
	2,
	2,
	0,
	0,
	2,
	2,
	0,
	0,
	2,
	2,
	0,
	0,
	2,
	2,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	0,
	0,
	1,
	1,
	0,
	0,
	1,
	1,
	2,
	2,
	1,
	1,
	2,
	2,
	1,
	1,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	1,
	1,
	1,
	1,
	2,
	2,
	2,
	2,
	0,
	0,
	0,
	0,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	2,
	2,
	2,
	2,
	0,
	0,
	0,
	0,
	1,
	1,
	1,
	1,
	2,
	2,
	2,
	2,
	2,
	2,
	2,
	2,
	0,
	0,
	1,
	2,
	0,
	0,
	1,
	2,
	0,
	0,
	1,
	2,
	0,
	0,
	1,
	2,
	0,
	1,
	1,
	2,
	0,
	1,
	1,
	2,
	0,
	1,
	1,
	2,
	0,
	1,
	1,
	2,
	0,
	1,
	2,
	2,
	0,
	1,
	2,
	2,
	0,
	1,
	2,
	2,
	0,
	1,
	2,
	2,
	0,
	0,
	1,
	1,
	0,
	1,
	1,
	2,
	1,
	1,
	2,
	2,
	1,
	2,
	2,
	2,
	0,
	0,
	1,
	1,
	2,
	0,
	0,
	1,
	2,
	2,
	0,
	0,
	2,
	2,
	2,
	0,
	0,
	0,
	0,
	1,
	0,
	0,
	1,
	1,
	0,
	1,
	1,
	2,
	1,
	1,
	2,
	2,
	0,
	1,
	1,
	1,
	0,
	0,
	1,
	1,
	2,
	0,
	0,
	1,
	2,
	2,
	0,
	0,
	0,
	0,
	0,
	0,
	1,
	1,
	2,
	2,
	1,
	1,
	2,
	2,
	1,
	1,
	2,
	2,
	0,
	0,
	2,
	2,
	0,
	0,
	2,
	2,
	0,
	0,
	2,
	2,
	1,
	1,
	1,
	1,
	0,
	1,
	1,
	1,
	0,
	1,
	1,
	1,
	0,
	2,
	2,
	2,
	0,
	2,
	2,
	2,
	0,
	0,
	0,
	1,
	0,
	0,
	0,
	1,
	2,
	2,
	2,
	1,
	2,
	2,
	2,
	1,
	0,
	0,
	0,
	0,
	0,
	0,
	1,
	1,
	0,
	1,
	2,
	2,
	0,
	1,
	2,
	2,
	0,
	0,
	0,
	0,
	1,
	1,
	0,
	0,
	2,
	2,
	1,
	0,
	2,
	2,
	1,
	0,
	0,
	1,
	2,
	2,
	0,
	1,
	2,
	2,
	0,
	0,
	1,
	1,
	0,
	0,
	0,
	0,
	0,
	0,
	1,
	2,
	0,
	0,
	1,
	2,
	1,
	1,
	2,
	2,
	2,
	2,
	2,
	2,
	0,
	1,
	1,
	0,
	1,
	2,
	2,
	1,
	1,
	2,
	2,
	1,
	0,
	1,
	1,
	0,
	0,
	0,
	0,
	0,
	0,
	1,
	1,
	0,
	1,
	2,
	2,
	1,
	1,
	2,
	2,
	1,
	0,
	0,
	2,
	2,
	1,
	1,
	0,
	2,
	1,
	1,
	0,
	2,
	0,
	0,
	2,
	2,
	0,
	1,
	1,
	0,
	0,
	1,
	1,
	0,
	2,
	0,
	0,
	2,
	2,
	2,
	2,
	2,
	0,
	0,
	1,
	1,
	0,
	1,
	2,
	2,
	0,
	1,
	2,
	2,
	0,
	0,
	1,
	1,
	0,
	0,
	0,
	0,
	2,
	0,
	0,
	0,
	2,
	2,
	1,
	1,
	2,
	2,
	2,
	1,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	2,
	1,
	1,
	2,
	2,
	1,
	2,
	2,
	2,
	0,
	2,
	2,
	2,
	0,
	0,
	2,
	2,
	0,
	0,
	1,
	2,
	0,
	0,
	1,
	1,
	0,
	0,
	1,
	1,
	0,
	0,
	1,
	2,
	0,
	0,
	2,
	2,
	0,
	2,
	2,
	2,
	0,
	1,
	2,
	0,
	0,
	1,
	2,
	0,
	0,
	1,
	2,
	0,
	0,
	1,
	2,
	0,
	0,
	0,
	0,
	0,
	1,
	1,
	1,
	1,
	2,
	2,
	2,
	2,
	0,
	0,
	0,
	0,
	0,
	1,
	2,
	0,
	1,
	2,
	0,
	1,
	2,
	0,
	1,
	2,
	0,
	1,
	2,
	0,
	0,
	1,
	2,
	0,
	2,
	0,
	1,
	2,
	1,
	2,
	0,
	1,
	0,
	1,
	2,
	0,
	0,
	0,
	1,
	1,
	2,
	2,
	0,
	0,
	1,
	1,
	2,
	2,
	0,
	0,
	1,
	1,
	0,
	0,
	1,
	1,
	1,
	1,
	2,
	2,
	2,
	2,
	0,
	0,
	0,
	0,
	1,
	1,
	0,
	1,
	0,
	1,
	0,
	1,
	0,
	1,
	2,
	2,
	2,
	2,
	2,
	2,
	2,
	2,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	2,
	1,
	2,
	1,
	2,
	1,
	2,
	1,
	0,
	0,
	2,
	2,
	1,
	1,
	2,
	2,
	0,
	0,
	2,
	2,
	1,
	1,
	2,
	2,
	0,
	0,
	2,
	2,
	0,
	0,
	1,
	1,
	0,
	0,
	2,
	2,
	0,
	0,
	1,
	1,
	0,
	2,
	2,
	0,
	1,
	2,
	2,
	1,
	0,
	2,
	2,
	0,
	1,
	2,
	2,
	1,
	0,
	1,
	0,
	1,
	2,
	2,
	2,
	2,
	2,
	2,
	2,
	2,
	0,
	1,
	0,
	1,
	0,
	0,
	0,
	0,
	2,
	1,
	2,
	1,
	2,
	1,
	2,
	1,
	2,
	1,
	2,
	1,
	0,
	1,
	0,
	1,
	0,
	1,
	0,
	1,
	0,
	1,
	0,
	1,
	2,
	2,
	2,
	2,
	0,
	2,
	2,
	2,
	0,
	1,
	1,
	1,
	0,
	2,
	2,
	2,
	0,
	1,
	1,
	1,
	0,
	0,
	0,
	2,
	1,
	1,
	1,
	2,
	0,
	0,
	0,
	2,
	1,
	1,
	1,
	2,
	0,
	0,
	0,
	0,
	2,
	1,
	1,
	2,
	2,
	1,
	1,
	2,
	2,
	1,
	1,
	2,
	0,
	2,
	2,
	2,
	0,
	1,
	1,
	1,
	0,
	1,
	1,
	1,
	0,
	2,
	2,
	2,
	0,
	0,
	0,
	2,
	1,
	1,
	1,
	2,
	1,
	1,
	1,
	2,
	0,
	0,
	0,
	2,
	0,
	1,
	1,
	0,
	0,
	1,
	1,
	0,
	0,
	1,
	1,
	0,
	2,
	2,
	2,
	2,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	2,
	1,
	1,
	2,
	2,
	1,
	1,
	2,
	0,
	1,
	1,
	0,
	0,
	1,
	1,
	0,
	2,
	2,
	2,
	2,
	2,
	2,
	2,
	2,
	0,
	0,
	2,
	2,
	0,
	0,
	1,
	1,
	0,
	0,
	1,
	1,
	0,
	0,
	2,
	2,
	0,
	0,
	2,
	2,
	1,
	1,
	2,
	2,
	1,
	1,
	2,
	2,
	0,
	0,
	2,
	2,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	2,
	1,
	1,
	2,
	0,
	0,
	0,
	2,
	0,
	0,
	0,
	1,
	0,
	0,
	0,
	2,
	0,
	0,
	0,
	1,
	0,
	2,
	2,
	2,
	1,
	2,
	2,
	2,
	0,
	2,
	2,
	2,
	1,
	2,
	2,
	2,
	0,
	1,
	0,
	1,
	2,
	2,
	2,
	2,
	2,
	2,
	2,
	2,
	2,
	2,
	2,
	2,
	0,
	1,
	1,
	1,
	2,
	0,
	1,
	1,
	2,
	2,
	0,
	1,
	2,
	2,
	2,
	0
]);
var BC7_ANCHOR2 = new Uint8Array([
	15,
	15,
	15,
	15,
	15,
	15,
	15,
	15,
	15,
	15,
	15,
	15,
	15,
	15,
	15,
	15,
	15,
	2,
	8,
	2,
	2,
	8,
	8,
	15,
	2,
	8,
	2,
	2,
	8,
	8,
	2,
	2,
	15,
	15,
	6,
	8,
	2,
	8,
	15,
	15,
	2,
	8,
	2,
	2,
	2,
	15,
	15,
	6,
	6,
	2,
	6,
	8,
	15,
	15,
	2,
	2,
	15,
	15,
	15,
	15,
	15,
	2,
	2,
	15
]);
var BC7_ANCHOR3_1 = new Uint8Array([
	3,
	3,
	15,
	15,
	8,
	3,
	15,
	15,
	8,
	8,
	6,
	6,
	6,
	5,
	3,
	3,
	3,
	3,
	8,
	15,
	3,
	3,
	6,
	10,
	5,
	8,
	8,
	6,
	8,
	5,
	15,
	15,
	8,
	15,
	3,
	5,
	6,
	10,
	8,
	15,
	15,
	3,
	15,
	5,
	15,
	15,
	15,
	15,
	3,
	15,
	5,
	5,
	5,
	8,
	5,
	10,
	5,
	10,
	8,
	13,
	15,
	12,
	3,
	3
]);
var BC7_ANCHOR3_2 = new Uint8Array([
	15,
	8,
	8,
	3,
	15,
	15,
	3,
	8,
	15,
	15,
	15,
	15,
	15,
	15,
	15,
	8,
	15,
	8,
	15,
	3,
	15,
	8,
	15,
	8,
	3,
	15,
	6,
	10,
	15,
	15,
	10,
	8,
	15,
	3,
	15,
	10,
	10,
	8,
	9,
	10,
	6,
	15,
	8,
	15,
	3,
	6,
	6,
	8,
	15,
	3,
	15,
	15,
	15,
	15,
	15,
	15,
	15,
	15,
	15,
	15,
	3,
	15,
	15,
	8
]);
function getBC7Mode(firstByte) {
	if (firstByte === 0) return 8;
	for (let m = 0; m < 8; m++) if ((firstByte & 1 << m) !== 0) return m;
	return 8;
}
function insertWeightZero(indexBits, bitsPerIndex, offset) {
	const lowBitMask = (1n << BigInt(bitsPerIndex * (offset + 1) - 1)) - 1n;
	return (indexBits & ~lowBitMask) << 1n | indexBits & lowBitMask;
}
function bc7DequantWithPBit(val, pbit, valBits) {
	const totalBits = valBits + 1;
	let v = (val << 1 | pbit) & 255;
	v = v << 8 - totalBits & 255;
	v |= v >> totalBits;
	return v & 255;
}
function bc7DequantNoPBit(val, valBits) {
	if (valBits >= 8) return val & 255;
	let v = val << 8 - valBits & 255;
	v |= v >> valBits;
	return v & 255;
}
function bc7Interp(l, h, w, weights) {
	const weight = weights[w];
	return l * (64 - weight) + h * weight + 32 >> 6;
}
function readUint64LE(bytes, offset) {
	const b0 = BigInt(bytes[offset] | bytes[offset + 1] << 8 | bytes[offset + 2] << 16 | bytes[offset + 3] << 24 >>> 0);
	return BigInt(bytes[offset + 4] | bytes[offset + 5] << 8 | bytes[offset + 6] << 16 | bytes[offset + 7] << 24 >>> 0) << 32n | b0 & 4294967295n;
}
function decodeBC7(src, offset, width, height, dest) {
	const numBlocksWide = Math.ceil(width / 4);
	const numBlocksHigh = Math.ceil(height / 4);
	let srcPos = offset;
	const blockPixels = /* @__PURE__ */ new Uint8Array(64);
	for (let by = 0; by < numBlocksHigh; by++) for (let bx = 0; bx < numBlocksWide; bx++) {
		if (srcPos + 16 > src.length) return;
		decodeBC7Block(src, srcPos, blockPixels);
		srcPos += 16;
		for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
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
function decodeBC7Block(src, offset, outPixels) {
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
		default: outPixels.fill(0);
	}
}
function unpackBC7Mode0_2(mode, lowChunk, highChunk, outPixels) {
	const weightBits = mode === 0 ? 3 : 2;
	const weightMask = (1 << weightBits) - 1;
	const endpointBits = mode === 0 ? 4 : 5;
	const endpointMask = (1 << endpointBits) - 1;
	const pBits = mode === 0 ? 6 : 0;
	const partMask = (1 << (mode === 0 ? 4 : 6)) - 1;
	const part = Number(lowChunk >> BigInt(mode + 1) & BigInt(partMask));
	const channelReadChunks = [
		0n,
		0n,
		0n
	];
	if (mode === 0) {
		channelReadChunks[0] = lowChunk >> 5n;
		channelReadChunks[1] = lowChunk >> 29n;
		channelReadChunks[2] = lowChunk >> 53n | highChunk << 11n;
	} else {
		channelReadChunks[0] = lowChunk >> 9n;
		channelReadChunks[1] = lowChunk >> 39n | highChunk << 25n;
		channelReadChunks[2] = highChunk >> 5n;
	}
	const endpoints = Array.from({ length: 6 }, () => [
		0,
		0,
		0,
		255
	]);
	for (let c = 0; c < 3; c++) {
		let chunk = channelReadChunks[c];
		for (let e = 0; e < 6; e++) {
			endpoints[e][c] = Number(chunk & BigInt(endpointMask));
			chunk >>= BigInt(endpointBits);
		}
	}
	const pbits = [
		0,
		0,
		0,
		0,
		0,
		0
	];
	if (mode === 0) {
		const pBitsChunk = Number(highChunk >> 13n & 63n);
		for (let p = 0; p < pBits; p++) pbits[p] = pBitsChunk >> p & 1;
	}
	let weightsReadChunk = highChunk >> BigInt(67 - 16 * weightBits);
	const anchor1 = Math.min(BC7_ANCHOR3_1[part], BC7_ANCHOR3_2[part]);
	const anchor2 = Math.max(BC7_ANCHOR3_1[part], BC7_ANCHOR3_2[part]);
	weightsReadChunk = insertWeightZero(weightsReadChunk, weightBits, 0);
	weightsReadChunk = insertWeightZero(weightsReadChunk, weightBits, anchor1);
	weightsReadChunk = insertWeightZero(weightsReadChunk, weightBits, anchor2);
	const weights = new Array(16);
	for (let i = 0; i < 16; i++) {
		weights[i] = Number(weightsReadChunk & BigInt(weightMask));
		weightsReadChunk >>= BigInt(weightBits);
	}
	for (let e = 0; e < 6; e++) for (let c = 0; c < 3; c++) endpoints[e][c] = pBits ? bc7DequantWithPBit(endpoints[e][c], pbits[e], endpointBits) : bc7DequantNoPBit(endpoints[e][c], endpointBits);
	const weightsTable = weightBits === 2 ? BC7_WEIGHTS2 : BC7_WEIGHTS3;
	const numWeights = 1 << weightBits;
	const blockColors = Array.from({ length: 3 }, () => Array.from({ length: numWeights }, () => [
		0,
		0,
		0,
		255
	]));
	for (let s = 0; s < 3; s++) for (let i = 0; i < numWeights; i++) for (let c = 0; c < 3; c++) blockColors[s][i][c] = bc7Interp(endpoints[s * 2][c], endpoints[s * 2 + 1][c], i, weightsTable);
	for (let i = 0; i < 16; i++) {
		const color = blockColors[BC7_PARTITION3[part * 16 + i]][weights[i]];
		const dIdx = i * 4;
		outPixels[dIdx] = color[0];
		outPixels[dIdx + 1] = color[1];
		outPixels[dIdx + 2] = color[2];
		outPixels[dIdx + 3] = 255;
	}
}
function unpackBC7Mode1_3_7(mode, lowChunk, highChunk, outPixels) {
	const comps = mode === 7 ? 4 : 3;
	const weightBits = mode === 1 ? 3 : 2;
	const weightMask = (1 << weightBits) - 1;
	const endpointBits = mode === 7 ? 5 : mode === 1 ? 6 : 7;
	const endpointMask = (1 << endpointBits) - 1;
	const pBits = mode === 1 ? 2 : 4;
	const sharedPBits = mode === 1;
	const part = Number(lowChunk >> BigInt(mode + 1) & 63n);
	const endpoints = Array.from({ length: 4 }, () => [
		0,
		0,
		0,
		255
	]);
	const channelReadChunks = [
		0n,
		0n,
		0n,
		0n
	];
	channelReadChunks[0] = lowChunk >> BigInt(mode + 7);
	let pReadChunk = 0n;
	let weightReadChunk = 0n;
	if (mode === 1) {
		channelReadChunks[1] = lowChunk >> 32n;
		channelReadChunks[2] = lowChunk >> 56n | highChunk << 8n;
		pReadChunk = highChunk >> 16n;
		weightReadChunk = highChunk >> 18n;
	} else if (mode === 3) {
		channelReadChunks[1] = lowChunk >> 38n | highChunk << 26n;
		channelReadChunks[2] = highChunk >> 2n;
		pReadChunk = highChunk >> 30n;
		weightReadChunk = highChunk >> 34n;
	} else {
		channelReadChunks[1] = lowChunk >> 34n;
		channelReadChunks[2] = lowChunk >> 54n | highChunk << 10n;
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
	const pbits = [
		0,
		0,
		0,
		0
	];
	for (let p = 0; p < pBits; p++) pbits[p] = Number(pReadChunk >> BigInt(p) & 1n);
	weightReadChunk = insertWeightZero(weightReadChunk, weightBits, 0);
	weightReadChunk = insertWeightZero(weightReadChunk, weightBits, BC7_ANCHOR2[part]);
	const weights = new Array(16);
	for (let i = 0; i < 16; i++) {
		weights[i] = Number(weightReadChunk & BigInt(weightMask));
		weightReadChunk >>= BigInt(weightBits);
	}
	for (let e = 0; e < 4; e++) {
		const pbit = pbits[sharedPBits ? e >> 1 : e];
		for (let c = 0; c < comps; c++) endpoints[e][c] = bc7DequantWithPBit(endpoints[e][c], pbit, endpointBits);
	}
	const weightsTable = weightBits === 2 ? BC7_WEIGHTS2 : BC7_WEIGHTS3;
	const numWeights = 1 << weightBits;
	const blockColors = Array.from({ length: 2 }, () => Array.from({ length: numWeights }, () => [
		0,
		0,
		0,
		255
	]));
	for (let s = 0; s < 2; s++) for (let i = 0; i < numWeights; i++) for (let c = 0; c < comps; c++) blockColors[s][i][c] = bc7Interp(endpoints[s * 2][c], endpoints[s * 2 + 1][c], i, weightsTable);
	for (let i = 0; i < 16; i++) {
		const color = blockColors[BC7_PARTITION2[part * 16 + i]][weights[i]];
		const dIdx = i * 4;
		outPixels[dIdx] = color[0];
		outPixels[dIdx + 1] = color[1];
		outPixels[dIdx + 2] = color[2];
		outPixels[dIdx + 3] = comps === 4 ? color[3] : 255;
	}
}
function unpackBC7Mode4_5(mode, lowChunk, highChunk, outPixels) {
	const weightBits = 2;
	const weightMask = 3;
	const aWeightBits = mode === 4 ? 3 : 2;
	const aWeightMask = (1 << aWeightBits) - 1;
	const endpointBits = mode === 4 ? 5 : 7;
	const endpointMask = (1 << endpointBits) - 1;
	const aEndpointBits = mode === 4 ? 6 : 8;
	const aEndpointMask = (1 << aEndpointBits) - 1;
	const compRot = Number(lowChunk >> BigInt(mode + 1) & 3n);
	const indexMode = mode === 4 ? Number(lowChunk >> 7n & 1n) : 0;
	let colorReadBits = lowChunk >> 8n;
	const endpoints = [[
		0,
		0,
		0,
		0
	], [
		0,
		0,
		0,
		0
	]];
	for (let c = 0; c < 3; c++) for (let e = 0; e < 2; e++) {
		endpoints[e][c] = Number(colorReadBits & BigInt(endpointMask));
		colorReadBits >>= BigInt(endpointBits);
	}
	let rgbWeightsChunk = 0n;
	let aWeightsChunk = 0n;
	if (mode === 4) {
		endpoints[0][3] = Number(colorReadBits & BigInt(aEndpointMask));
		endpoints[1][3] = Number(colorReadBits >> BigInt(aEndpointBits) & BigInt(aEndpointMask));
		rgbWeightsChunk = lowChunk >> 50n | highChunk << 14n;
		aWeightsChunk = highChunk >> 17n;
	} else {
		endpoints[0][3] = Number(colorReadBits & BigInt(aEndpointMask));
		endpoints[1][3] = Number((lowChunk >> 58n | highChunk << 6n) & BigInt(aEndpointMask));
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
	const weights = new Array(16);
	const aWeights = new Array(16);
	for (let i = 0; i < 16; i++) {
		weights[i] = Number(rgbWeightsChunk & BigInt(effWeightMask[0]));
		rgbWeightsChunk >>= BigInt(effWeightBits[0]);
	}
	for (let i = 0; i < 16; i++) {
		aWeights[i] = Number(aWeightsChunk & BigInt(effWeightMask[1]));
		aWeightsChunk >>= BigInt(effWeightBits[1]);
	}
	for (let e = 0; e < 2; e++) {
		for (let c = 0; c < 3; c++) endpoints[e][c] = bc7DequantNoPBit(endpoints[e][c], endpointBits);
		endpoints[e][3] = bc7DequantNoPBit(endpoints[e][3], aEndpointBits);
	}
	const rgbTable = effWeightBits[0] === 3 ? BC7_WEIGHTS3 : BC7_WEIGHTS2;
	const aTable = effWeightBits[1] === 3 ? BC7_WEIGHTS3 : BC7_WEIGHTS2;
	const numRgbWeights = 1 << effWeightBits[0];
	const numAWeights = 1 << effWeightBits[1];
	const blockColorsRgb = Array.from({ length: numRgbWeights }, () => [
		0,
		0,
		0
	]);
	for (let i = 0; i < numRgbWeights; i++) for (let c = 0; c < 3; c++) blockColorsRgb[i][c] = bc7Interp(endpoints[0][c], endpoints[1][c], i, rgbTable);
	const blockColorsA = new Array(numAWeights);
	for (let i = 0; i < numAWeights; i++) blockColorsA[i] = bc7Interp(endpoints[0][3], endpoints[1][3], i, aTable);
	for (let i = 0; i < 16; i++) {
		const rgb = blockColorsRgb[weights[i]];
		let r = rgb[0];
		let g = rgb[1];
		let b = rgb[2];
		let a = blockColorsA[aWeights[i]];
		if (compRot === 1) {
			const tmp = a;
			a = r;
			r = tmp;
		} else if (compRot === 2) {
			const tmp = a;
			a = g;
			g = tmp;
		} else if (compRot === 3) {
			const tmp = a;
			a = b;
			b = tmp;
		}
		const dIdx = i * 4;
		outPixels[dIdx] = r;
		outPixels[dIdx + 1] = g;
		outPixels[dIdx + 2] = b;
		outPixels[dIdx + 3] = a;
	}
}
function unpackBC7Mode6(lowChunk, highChunk, outPixels) {
	const r0 = Number(lowChunk >> 7n & 127n);
	const r1 = Number(lowChunk >> 14n & 127n);
	const g0 = Number(lowChunk >> 21n & 127n);
	const g1 = Number(lowChunk >> 28n & 127n);
	const b0 = Number(lowChunk >> 35n & 127n);
	const b1 = Number(lowChunk >> 42n & 127n);
	const a0 = Number(lowChunk >> 49n & 127n);
	const a1 = Number(lowChunk >> 56n & 127n);
	const p0 = Number(lowChunk >> 63n & 1n);
	const p1 = Number(highChunk & 1n);
	const ep0 = [
		r0 << 1 | p0,
		g0 << 1 | p0,
		b0 << 1 | p0,
		a0 << 1 | p0
	];
	const ep1 = [
		r1 << 1 | p1,
		g1 << 1 | p1,
		b1 << 1 | p1,
		a1 << 1 | p1
	];
	const tableColors = Array.from({ length: 16 }, () => [
		0,
		0,
		0,
		0
	]);
	for (let i = 0; i < 16; i++) {
		const w = BC7_WEIGHTS4[i];
		const iw = 64 - w;
		tableColors[i][0] = ep0[0] * iw + ep1[0] * w + 32 >> 6;
		tableColors[i][1] = ep0[1] * iw + ep1[1] * w + 32 >> 6;
		tableColors[i][2] = ep0[2] * iw + ep1[2] * w + 32 >> 6;
		tableColors[i][3] = ep0[3] * iw + ep1[3] * w + 32 >> 6;
	}
	const c0 = tableColors[Number(highChunk >> 1n & 7n)];
	outPixels[0] = c0[0];
	outPixels[1] = c0[1];
	outPixels[2] = c0[2];
	outPixels[3] = c0[3];
	for (let i = 1; i < 16; i++) {
		const shift = BigInt(4 + (i - 1) * 4);
		const ci = tableColors[Number(highChunk >> shift & 15n)];
		const dIdx = i * 4;
		outPixels[dIdx] = ci[0];
		outPixels[dIdx + 1] = ci[1];
		outPixels[dIdx + 2] = ci[2];
		outPixels[dIdx + 3] = ci[3];
	}
}
//#endregion
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
function decodeDDS(buffer) {
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
	channelMode = "RGBA";
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
			"RGBA",
			"RGB",
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
//#region default-plugins/texture-library/index.ts
/**
* DDS 및 이미지 에셋 뷰어 플러그인
* 탐색기에서 지원되는 이미지 확장자 클릭 시 에디터 탭 내에서 인터랙티브 캔버스 뷰어로 엽니다.
*/
var plugin = {
	activate(context) {
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
	},
	deactivate() {}
};
//#endregion
export { plugin as default };
