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
export { decodeBC4, decodeBC5, decodeBGR24, decodeBGRA32, decodeDXT1, decodeDXT3, decodeDXT5, decodeRGBA32, unpackAlphaTable, unpackRGB565Table };
