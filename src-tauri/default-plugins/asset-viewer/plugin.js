//#region src/plugins/api.ts
function e(e) {
	return e;
}
function t(e) {
	let t = e instanceof Uint8Array ? e : new Uint8Array(e);
	if (t.byteLength < 4) throw Error("유효한 DDS 파일이 아닙니다 (데이터 크기 부족).");
	let s = new DataView(t.buffer, t.byteOffset, Math.min(t.byteLength, 148));
	if (s.getUint32(0, !0) !== 542327876) throw Error("유효한 DDS 파일이 아닙니다 (Magic 불일치).");
	if (t.byteLength < 128) throw Error("유효한 DDS 파일이 아닙니다 (헤더 크기 128바이트 미만).");
	let c = s.getUint32(12, !0), l = s.getUint32(16, !0), u = s.getUint32(80, !0), d = s.getUint32(84, !0), f = s.getUint32(88, !0), p = s.getUint32(92, !0);
	s.getUint32(96, !0);
	let m = s.getUint32(100, !0);
	s.getUint32(104, !0);
	let h = 128, g, _ = !1, v = "RGBA";
	d === 808540228 && t.byteLength >= 148 && (h = 148, g = s.getUint32(128, !0));
	let y = new Uint8ClampedArray(l * c * 4);
	if (g !== void 0) switch (g) {
		case 98:
			v = "BC7 (Linear)", _ = !1, x(t, h, l, c, y);
			break;
		case 99:
		case 97:
			v = "BC7 (sRGB)", _ = !0, x(t, h, l, c, y);
			break;
		case 71:
		case 70:
			v = "BC1 (Linear)", _ = !1, n(t, h, l, c, y);
			break;
		case 72:
			v = "BC1 (sRGB)", _ = !0, n(t, h, l, c, y);
			break;
		case 74:
		case 73:
			v = "BC2 (Linear)", _ = !1, r(t, h, l, c, y);
			break;
		case 75:
			v = "BC2 (sRGB)", _ = !0, r(t, h, l, c, y);
			break;
		case 77:
		case 76:
			v = "BC3 (Linear)", _ = !1, i(t, h, l, c, y);
			break;
		case 78:
			v = "BC3 (sRGB)", _ = !0, i(t, h, l, c, y);
			break;
		case 80:
		case 81:
		case 79:
			v = "BC4 (Linear)", _ = !1, a(t, h, l, c, y);
			break;
		case 83:
		case 84:
		case 82:
			v = "BC5 (Linear)", _ = !1, o(t, h, l, c, y);
			break;
		case 28:
			v = "RGBA32 (Linear)", _ = !1, D(t, h, l, c, y);
			break;
		case 29:
			v = "RGBA32 (sRGB)", _ = !0, D(t, h, l, c, y);
			break;
		case 87:
		case 88:
			v = "BGRA32 (Linear)", _ = !1, O(t, h, l, c, y);
			break;
		case 91:
		case 93:
			v = "BGRA32 (sRGB)", _ = !0, O(t, h, l, c, y);
			break;
		default: v = `DXGI Format ${g}`, x(t, h, l, c, y);
	}
	else d === 827611204 ? (v = "DXT1 (BC1)", _ = !1, n(t, h, l, c, y)) : d === 844388420 || d === 861165636 ? (v = "DXT3 (BC2)", _ = !1, r(t, h, l, c, y)) : d === 877942852 || d === 894720068 ? (v = "DXT5 (BC3)", _ = !1, i(t, h, l, c, y)) : d === 540492610 || d === 3621698 ? (v = "BC7", _ = !1, x(t, h, l, c, y)) : d === 826889281 || d === 1429488450 || d === 1395934018 ? (v = "BC4", _ = !1, a(t, h, l, c, y)) : d === 843666497 || d === 1429553986 || d === 1395999554 ? (v = "BC5", _ = !1, o(t, h, l, c, y)) : u & 64 || f === 32 || f === 24 ? f === 32 ? p === 255 && m === 16711680 ? (v = "RGBA32", D(t, h, l, c, y)) : (v = "BGRA32", O(t, h, l, c, y)) : f === 24 ? (v = "BGR24", k(t, h, l, c, y)) : (v = `RGB ${f}bpp`, O(t, h, l, c, y)) : (v = `FourCC 0x${d.toString(16)}`, n(t, h, l, c, y));
	return {
		width: l,
		height: c,
		format: v,
		rgba: y,
		isSRGB: _,
		dxgiFormat: g
	};
}
function n(e, t, n, r, i) {
	let a = Math.ceil(n / 4), o = Math.ceil(r / 4), s = t;
	for (let t = 0; t < o; t++) for (let o = 0; o < a; o++) {
		if (s + 8 > e.length) return;
		let a = e[s] | e[s + 1] << 8, c = e[s + 2] | e[s + 3] << 8, l = e[s + 4] | e[s + 5] << 8 | e[s + 6] << 16 | e[s + 7] << 24;
		s += 8;
		let u = A(a, c, !0);
		for (let e = 0; e < 4; e++) for (let a = 0; a < 4; a++) {
			let s = o * 4 + a, c = t * 4 + e;
			if (s < n && c < r) {
				let t = l >> (e * 4 + a) * 2 & 3, r = (c * n + s) * 4, o = u[t];
				i[r] = o[0], i[r + 1] = o[1], i[r + 2] = o[2], i[r + 3] = o[3];
			}
		}
	}
}
function r(e, t, n, r, i) {
	let a = Math.ceil(n / 4), o = Math.ceil(r / 4), s = t;
	for (let t = 0; t < o; t++) for (let o = 0; o < a; o++) {
		if (s + 16 > e.length) return;
		let a = e.subarray(s, s + 8);
		s += 8;
		let c = e[s] | e[s + 1] << 8, l = e[s + 2] | e[s + 3] << 8, u = e[s + 4] | e[s + 5] << 8 | e[s + 6] << 16 | e[s + 7] << 24;
		s += 8;
		let d = A(c, l, !1);
		for (let e = 0; e < 4; e++) for (let s = 0; s < 4; s++) {
			let c = o * 4 + s, l = t * 4 + e;
			if (c < n && l < r) {
				let t = e * 2 + Math.floor(s / 2), r = s % 2 * 4, o = (a[t] >> r & 15) * 17, f = u >> (e * 4 + s) * 2 & 3, p = (l * n + c) * 4, m = d[f];
				i[p] = m[0], i[p + 1] = m[1], i[p + 2] = m[2], i[p + 3] = o;
			}
		}
	}
}
function i(e, t, n, r, i) {
	let a = Math.ceil(n / 4), o = Math.ceil(r / 4), s = t;
	for (let t = 0; t < o; t++) for (let o = 0; o < a; o++) {
		if (s + 16 > e.length) return;
		let a = e[s], c = e[s + 1], l = BigInt(e[s + 2]) | BigInt(e[s + 3]) << 8n | BigInt(e[s + 4]) << 16n | BigInt(e[s + 5]) << 24n | BigInt(e[s + 6]) << 32n | BigInt(e[s + 7]) << 40n;
		s += 8;
		let u = e[s] | e[s + 1] << 8, d = e[s + 2] | e[s + 3] << 8, f = e[s + 4] | e[s + 5] << 8 | e[s + 6] << 16 | e[s + 7] << 24;
		s += 8;
		let p = j(a, c), m = A(u, d, !1);
		for (let e = 0; e < 4; e++) for (let a = 0; a < 4; a++) {
			let s = o * 4 + a, c = t * 4 + e;
			if (s < n && c < r) {
				let t = BigInt((e * 4 + a) * 3), r = p[Number(l >> t & 7n)], o = f >> (e * 4 + a) * 2 & 3, u = (c * n + s) * 4, d = m[o];
				i[u] = d[0], i[u + 1] = d[1], i[u + 2] = d[2], i[u + 3] = r;
			}
		}
	}
}
function a(e, t, n, r, i) {
	let a = Math.ceil(n / 4), o = Math.ceil(r / 4), s = t;
	for (let t = 0; t < o; t++) for (let o = 0; o < a; o++) {
		if (s + 8 > e.length) return;
		let a = e[s], c = e[s + 1], l = BigInt(e[s + 2]) | BigInt(e[s + 3]) << 8n | BigInt(e[s + 4]) << 16n | BigInt(e[s + 5]) << 24n | BigInt(e[s + 6]) << 32n | BigInt(e[s + 7]) << 40n;
		s += 8;
		let u = j(a, c);
		for (let e = 0; e < 4; e++) for (let a = 0; a < 4; a++) {
			let s = o * 4 + a, c = t * 4 + e;
			if (s < n && c < r) {
				let t = BigInt((e * 4 + a) * 3), r = u[Number(l >> t & 7n)], o = (c * n + s) * 4;
				i[o] = r, i[o + 1] = r, i[o + 2] = r, i[o + 3] = 255;
			}
		}
	}
}
function o(e, t, n, r, i) {
	let a = Math.ceil(n / 4), o = Math.ceil(r / 4), s = t;
	for (let t = 0; t < o; t++) for (let o = 0; o < a; o++) {
		if (s + 16 > e.length) return;
		let a = e[s], c = e[s + 1], l = BigInt(e[s + 2]) | BigInt(e[s + 3]) << 8n | BigInt(e[s + 4]) << 16n | BigInt(e[s + 5]) << 24n | BigInt(e[s + 6]) << 32n | BigInt(e[s + 7]) << 40n;
		s += 8;
		let u = e[s], d = e[s + 1], f = BigInt(e[s + 2]) | BigInt(e[s + 3]) << 8n | BigInt(e[s + 4]) << 16n | BigInt(e[s + 5]) << 24n | BigInt(e[s + 6]) << 32n | BigInt(e[s + 7]) << 40n;
		s += 8;
		let p = j(a, c), m = j(u, d);
		for (let e = 0; e < 4; e++) for (let a = 0; a < 4; a++) {
			let s = o * 4 + a, c = t * 4 + e;
			if (s < n && c < r) {
				let t = BigInt((e * 4 + a) * 3), r = p[Number(l >> t & 7n)], o = m[Number(f >> t & 7n)], u = r / 255 * 2 - 1, d = o / 255 * 2 - 1, h = Math.sqrt(Math.max(0, 1 - u * u - d * d)), g = Math.round((h + 1) / 2 * 255), _ = (c * n + s) * 4;
				i[_] = r, i[_ + 1] = o, i[_ + 2] = g, i[_ + 3] = 255;
			}
		}
	}
}
var s = [
	0,
	21,
	43,
	64
], c = [
	0,
	9,
	18,
	27,
	37,
	46,
	55,
	64
], l = [
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
], u = new Uint8Array([
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
]), d = new Uint8Array([
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
]), f = new Uint8Array([
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
]), p = new Uint8Array([
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
]), m = new Uint8Array([
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
function h(e) {
	if (e === 0) return 8;
	for (let t = 0; t < 8; t++) if (e & 1 << t) return t;
	return 8;
}
function g(e, t, n) {
	let r = (1n << BigInt(t * (n + 1) - 1)) - 1n;
	return (e & ~r) << 1n | e & r;
}
function _(e, t, n) {
	let r = n + 1, i = (e << 1 | t) & 255;
	return i = i << 8 - r & 255, i |= i >> r, i & 255;
}
function v(e, t) {
	if (t >= 8) return e & 255;
	let n = e << 8 - t & 255;
	return n |= n >> t, n & 255;
}
function y(e, t, n, r) {
	let i = r[n];
	return e * (64 - i) + t * i + 32 >> 6;
}
function b(e, t) {
	let n = BigInt(e[t] | e[t + 1] << 8 | e[t + 2] << 16 | e[t + 3] << 24 >>> 0);
	return BigInt(e[t + 4] | e[t + 5] << 8 | e[t + 6] << 16 | e[t + 7] << 24 >>> 0) << 32n | n & 4294967295n;
}
function x(e, t, n, r, i) {
	let a = Math.ceil(n / 4), o = Math.ceil(r / 4), s = t, c = /* @__PURE__ */ new Uint8Array(64);
	for (let t = 0; t < o; t++) for (let o = 0; o < a; o++) {
		if (s + 16 > e.length) return;
		S(e, s, c), s += 16;
		for (let e = 0; e < 4; e++) for (let a = 0; a < 4; a++) {
			let s = o * 4 + a, l = t * 4 + e;
			if (s < n && l < r) {
				let t = (e * 4 + a) * 4, r = (l * n + s) * 4;
				i[r] = c[t], i[r + 1] = c[t + 1], i[r + 2] = c[t + 2], i[r + 3] = c[t + 3];
			}
		}
	}
}
function S(e, t, n) {
	let r = h(e[t]);
	if (r > 7) {
		n.fill(0);
		return;
	}
	let i = b(e, t), a = b(e, t + 8);
	switch (r) {
		case 0:
		case 2:
			C(r, i, a, n);
			break;
		case 1:
		case 3:
		case 7:
			w(r, i, a, n);
			break;
		case 4:
		case 5:
			T(r, i, a, n);
			break;
		case 6:
			E(i, a, n);
			break;
		default: n.fill(0);
	}
}
function C(e, t, n, r) {
	let i = e === 0 ? 3 : 2, a = (1 << i) - 1, o = e === 0 ? 4 : 5, l = (1 << o) - 1, u = e === 0 ? 6 : 0, f = (1 << (e === 0 ? 4 : 6)) - 1, h = Number(t >> BigInt(e + 1) & BigInt(f)), b = [
		0n,
		0n,
		0n
	];
	e === 0 ? (b[0] = t >> 5n, b[1] = t >> 29n, b[2] = t >> 53n | n << 11n) : (b[0] = t >> 9n, b[1] = t >> 39n | n << 25n, b[2] = n >> 5n);
	let x = Array.from({ length: 6 }, () => [
		0,
		0,
		0,
		255
	]);
	for (let e = 0; e < 3; e++) {
		let t = b[e];
		for (let n = 0; n < 6; n++) x[n][e] = Number(t & BigInt(l)), t >>= BigInt(o);
	}
	let S = [
		0,
		0,
		0,
		0,
		0,
		0
	];
	if (e === 0) {
		let e = Number(n >> 13n & 63n);
		for (let t = 0; t < u; t++) S[t] = e >> t & 1;
	}
	let C = n >> BigInt(67 - 16 * i), w = Math.min(p[h], m[h]), T = Math.max(p[h], m[h]);
	C = g(C, i, 0), C = g(C, i, w), C = g(C, i, T);
	let E = Array(16);
	for (let e = 0; e < 16; e++) E[e] = Number(C & BigInt(a)), C >>= BigInt(i);
	for (let e = 0; e < 6; e++) for (let t = 0; t < 3; t++) x[e][t] = u ? _(x[e][t], S[e], o) : v(x[e][t], o);
	let D = i === 2 ? s : c, O = 1 << i, k = Array.from({ length: 3 }, () => Array.from({ length: O }, () => [
		0,
		0,
		0,
		255
	]));
	for (let e = 0; e < 3; e++) for (let t = 0; t < O; t++) for (let n = 0; n < 3; n++) k[e][t][n] = y(x[e * 2][n], x[e * 2 + 1][n], t, D);
	for (let e = 0; e < 16; e++) {
		let t = k[d[h * 16 + e]][E[e]], n = e * 4;
		r[n] = t[0], r[n + 1] = t[1], r[n + 2] = t[2], r[n + 3] = 255;
	}
}
function w(e, t, n, r) {
	let i = e === 7 ? 4 : 3, a = e === 1 ? 3 : 2, o = (1 << a) - 1, l = e === 7 ? 5 : e === 1 ? 6 : 7, d = (1 << l) - 1, p = e === 1 ? 2 : 4, m = e === 1, h = Number(t >> BigInt(e + 1) & 63n), v = Array.from({ length: 4 }, () => [
		0,
		0,
		0,
		255
	]), b = [
		0n,
		0n,
		0n,
		0n
	];
	b[0] = t >> BigInt(e + 7);
	let x = 0n, S = 0n;
	e === 1 ? (b[1] = t >> 32n, b[2] = t >> 56n | n << 8n, x = n >> 16n, S = n >> 18n) : e === 3 ? (b[1] = t >> 38n | n << 26n, b[2] = n >> 2n, x = n >> 30n, S = n >> 34n) : (b[1] = t >> 34n, b[2] = t >> 54n | n << 10n, b[3] = n >> 10n, x = n >> 30n, S = n >> 34n);
	for (let e = 0; e < i; e++) {
		let t = b[e];
		for (let n = 0; n < 4; n++) v[n][e] = Number(t & BigInt(d)), t >>= BigInt(l);
	}
	let C = [
		0,
		0,
		0,
		0
	];
	for (let e = 0; e < p; e++) C[e] = Number(x >> BigInt(e) & 1n);
	S = g(S, a, 0), S = g(S, a, f[h]);
	let w = Array(16);
	for (let e = 0; e < 16; e++) w[e] = Number(S & BigInt(o)), S >>= BigInt(a);
	for (let e = 0; e < 4; e++) {
		let t = C[m ? e >> 1 : e];
		for (let n = 0; n < i; n++) v[e][n] = _(v[e][n], t, l);
	}
	let T = a === 2 ? s : c, E = 1 << a, D = Array.from({ length: 2 }, () => Array.from({ length: E }, () => [
		0,
		0,
		0,
		255
	]));
	for (let e = 0; e < 2; e++) for (let t = 0; t < E; t++) for (let n = 0; n < i; n++) D[e][t][n] = y(v[e * 2][n], v[e * 2 + 1][n], t, T);
	for (let e = 0; e < 16; e++) {
		let t = D[u[h * 16 + e]][w[e]], n = e * 4;
		r[n] = t[0], r[n + 1] = t[1], r[n + 2] = t[2], r[n + 3] = i === 4 ? t[3] : 255;
	}
}
function T(e, t, n, r) {
	let i = e === 4 ? 3 : 2, a = (1 << i) - 1, o = e === 4 ? 5 : 7, l = (1 << o) - 1, u = e === 4 ? 6 : 8, d = (1 << u) - 1, f = Number(t >> BigInt(e + 1) & 3n), p = e === 4 ? Number(t >> 7n & 1n) : 0, m = t >> 8n, h = [[
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
	for (let e = 0; e < 3; e++) for (let t = 0; t < 2; t++) h[t][e] = Number(m & BigInt(l)), m >>= BigInt(o);
	let _ = 0n, b = 0n;
	e === 4 ? (h[0][3] = Number(m & BigInt(d)), h[1][3] = Number(m >> BigInt(u) & BigInt(d)), _ = t >> 50n | n << 14n, b = n >> 17n) : (h[0][3] = Number(m & BigInt(d)), h[1][3] = Number((t >> 58n | n << 6n) & BigInt(d)), _ = n >> 2n, b = n >> 33n), _ = g(_, 2, 0), b = g(b, i, 0);
	let x = [p ? i : 2, p ? 2 : i], S = [p ? a : 3, p ? 3 : a];
	if (p) {
		let e = _;
		_ = b, b = e;
	}
	let C = Array(16), w = Array(16);
	for (let e = 0; e < 16; e++) C[e] = Number(_ & BigInt(S[0])), _ >>= BigInt(x[0]);
	for (let e = 0; e < 16; e++) w[e] = Number(b & BigInt(S[1])), b >>= BigInt(x[1]);
	for (let e = 0; e < 2; e++) {
		for (let t = 0; t < 3; t++) h[e][t] = v(h[e][t], o);
		h[e][3] = v(h[e][3], u);
	}
	let T = x[0] === 3 ? c : s, E = x[1] === 3 ? c : s, D = 1 << x[0], O = 1 << x[1], k = Array.from({ length: D }, () => [
		0,
		0,
		0
	]);
	for (let e = 0; e < D; e++) for (let t = 0; t < 3; t++) k[e][t] = y(h[0][t], h[1][t], e, T);
	let A = Array(O);
	for (let e = 0; e < O; e++) A[e] = y(h[0][3], h[1][3], e, E);
	for (let e = 0; e < 16; e++) {
		let t = k[C[e]], n = t[0], i = t[1], a = t[2], o = A[w[e]];
		if (f === 1) {
			let e = o;
			o = n, n = e;
		} else if (f === 2) {
			let e = o;
			o = i, i = e;
		} else if (f === 3) {
			let e = o;
			o = a, a = e;
		}
		let s = e * 4;
		r[s] = n, r[s + 1] = i, r[s + 2] = a, r[s + 3] = o;
	}
}
function E(e, t, n) {
	let r = Number(e >> 7n & 127n), i = Number(e >> 14n & 127n), a = Number(e >> 21n & 127n), o = Number(e >> 28n & 127n), s = Number(e >> 35n & 127n), c = Number(e >> 42n & 127n), u = Number(e >> 49n & 127n), d = Number(e >> 56n & 127n), f = Number(e >> 63n & 1n), p = Number(t & 1n), m = [
		r << 1 | f,
		a << 1 | f,
		s << 1 | f,
		u << 1 | f
	], h = [
		i << 1 | p,
		o << 1 | p,
		c << 1 | p,
		d << 1 | p
	], g = Array.from({ length: 16 }, () => [
		0,
		0,
		0,
		0
	]);
	for (let e = 0; e < 16; e++) {
		let t = l[e], n = 64 - t;
		g[e][0] = m[0] * n + h[0] * t + 32 >> 6, g[e][1] = m[1] * n + h[1] * t + 32 >> 6, g[e][2] = m[2] * n + h[2] * t + 32 >> 6, g[e][3] = m[3] * n + h[3] * t + 32 >> 6;
	}
	let _ = g[Number(t >> 1n & 7n)];
	n[0] = _[0], n[1] = _[1], n[2] = _[2], n[3] = _[3];
	for (let e = 1; e < 16; e++) {
		let r = BigInt(4 + (e - 1) * 4), i = g[Number(t >> r & 15n)], a = e * 4;
		n[a] = i[0], n[a + 1] = i[1], n[a + 2] = i[2], n[a + 3] = i[3];
	}
}
function D(e, t, n, r, i) {
	let a = t, o = 0, s = n * r;
	for (let t = 0; t < s && a + 4 <= e.length; t++) i[o++] = e[a++], i[o++] = e[a++], i[o++] = e[a++], i[o++] = e[a++];
}
function O(e, t, n, r, i) {
	let a = t, o = 0, s = n * r;
	for (let t = 0; t < s && a + 4 <= e.length; t++) {
		let t = e[a++], n = e[a++], r = e[a++], s = e[a++];
		i[o++] = r, i[o++] = n, i[o++] = t, i[o++] = s;
	}
}
function k(e, t, n, r, i) {
	let a = t, o = 0, s = n * r;
	for (let t = 0; t < s && a + 3 <= e.length; t++) {
		let t = e[a++], n = e[a++], r = e[a++];
		i[o++] = r, i[o++] = n, i[o++] = t, i[o++] = 255;
	}
}
function A(e, t, n) {
	let r = Math.round((e >> 11 & 31) * 255 / 31), i = Math.round((e >> 5 & 63) * 255 / 63), a = Math.round((e & 31) * 255 / 31), o = Math.round((t >> 11 & 31) * 255 / 31), s = Math.round((t >> 5 & 63) * 255 / 63), c = Math.round((t & 31) * 255 / 31), l = [
		[
			r,
			i,
			a,
			255
		],
		[
			o,
			s,
			c,
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
	return !n || e > t ? (l[2] = [
		Math.round((2 * r + o) / 3),
		Math.round((2 * i + s) / 3),
		Math.round((2 * a + c) / 3),
		255
	], l[3] = [
		Math.round((r + 2 * o) / 3),
		Math.round((i + 2 * s) / 3),
		Math.round((a + 2 * c) / 3),
		255
	]) : (l[2] = [
		Math.round((r + o) / 2),
		Math.round((i + s) / 2),
		Math.round((a + c) / 2),
		255
	], l[3] = [
		0,
		0,
		0,
		0
	]), l;
}
function j(e, t) {
	let n = Array(8);
	return n[0] = e, n[1] = t, e > t ? (n[2] = Math.round((6 * e + 1 * t) / 7), n[3] = Math.round((5 * e + 2 * t) / 7), n[4] = Math.round((4 * e + 3 * t) / 7), n[5] = Math.round((3 * e + 4 * t) / 7), n[6] = Math.round((2 * e + 5 * t) / 7), n[7] = Math.round((1 * e + 6 * t) / 7)) : (n[2] = Math.round((4 * e + 1 * t) / 5), n[3] = Math.round((3 * e + 2 * t) / 5), n[4] = Math.round((2 * e + 3 * t) / 5), n[5] = Math.round((1 * e + 4 * t) / 5), n[6] = 0, n[7] = 255), n;
}
//#endregion
//#region default-plugins/asset-viewer/image-viewer.ts
var M = /* @__PURE__ */ new Uint8Array(256), N = /* @__PURE__ */ new Uint8Array(256);
for (let e = 0; e < 256; e++) {
	let t = e / 255, n = t <= .04045 ? t / 12.92 : ((t + .055) / 1.055) ** 2.4;
	M[e] = Math.round(Math.min(1, Math.max(0, n)) * 255);
	let r = t <= .0031308 ? t * 12.92 : 1.055 * t ** (1 / 2.4) - .055;
	N[e] = Math.round(Math.min(1, Math.max(0, r)) * 255);
}
var P = class {
	container;
	el;
	currentBlobUrl = null;
	zoom = 1;
	panX = 0;
	panY = 0;
	isDragging = !1;
	dragStartX = 0;
	dragStartY = 0;
	canvasWrapper;
	canvasEl;
	zoomLabel;
	rawRgba = null;
	imageWidth = 0;
	imageHeight = 0;
	sourceIsSRGB = !0;
	colorSpaceMode = "sRGB";
	channelMode = "RGBA";
	colorSpaceBtns = /* @__PURE__ */ new Map();
	channelBtns = /* @__PURE__ */ new Map();
	cleanups = [];
	constructor(e) {
		this.container = e, this.el = document.createElement("div"), this.el.className = "image-viewer-container", this.container.appendChild(this.el);
	}
	show(e) {
		this.dispose(), this.el.replaceChildren(), this.zoom = 1, this.panX = 0, this.panY = 0, this.colorSpaceBtns.clear(), this.channelBtns.clear();
		let n = /\.dds$/i.test(e.name), r = n ? "DDS" : e.name.split(".").pop()?.toUpperCase() ?? "IMAGE", i = e.bytes.byteLength, a = document.createElement("div");
		a.className = "image-viewer-toolbar";
		let o = document.createElement("div");
		o.className = "image-viewer-file-info";
		let s = document.createElement("span");
		s.className = "image-viewer-icon", s.textContent = n ? "DDS" : "IMG";
		let c = document.createElement("span");
		c.className = "image-viewer-filename", c.textContent = e.name, c.title = e.path || e.name;
		let l = document.createElement("span");
		l.className = "image-badge format-badge", l.textContent = r;
		let u = document.createElement("span");
		u.className = "image-badge dim-badge", u.textContent = "로딩 중...";
		let d = document.createElement("span");
		d.className = "image-badge size-badge", d.textContent = this.formatSize(i), o.append(s, c, l, u, d);
		let f = document.createElement("div");
		f.className = "image-viewer-toolbar-controls";
		let p = document.createElement("div");
		p.className = "image-viewer-toolbar-section";
		let m = document.createElement("span");
		m.className = "image-viewer-group-label", m.textContent = "색공간:";
		let h = document.createElement("div");
		h.className = "image-viewer-toolbar-group";
		for (let e of [
			"sRGB",
			"Linear",
			"Raw"
		]) {
			let t = document.createElement("button");
			t.className = "img-tool-btn", t.textContent = e, t.title = e === "sRGB" ? "sRGB 감마 곡선 뷰" : e === "Linear" ? "선형 공간(감마 미적용) 뷰" : "원시 바이트 원본 뷰", t.addEventListener("click", () => {
				this.setColorSpaceMode(e);
			}), h.appendChild(t), this.colorSpaceBtns.set(e, t);
		}
		p.append(m, h);
		let g = document.createElement("div");
		g.className = "image-viewer-toolbar-section";
		let _ = document.createElement("span");
		_.className = "image-viewer-group-label", _.textContent = "채널:";
		let v = document.createElement("div");
		v.className = "image-viewer-toolbar-group";
		for (let e of [
			"RGBA",
			"RGB",
			"R",
			"G",
			"B",
			"A"
		]) {
			let t = document.createElement("button");
			t.className = "img-tool-btn", t.textContent = e, t.title = `${e} 채널 보기`, t.addEventListener("click", () => {
				this.setChannelMode(e);
			}), v.appendChild(t), this.channelBtns.set(e, t);
		}
		g.append(_, v);
		let y = document.createElement("div");
		y.className = "image-viewer-zoom-controls";
		let b = document.createElement("button");
		b.className = "img-tool-btn", b.textContent = "화면맞춤", b.title = "화면에 맞추기 (단축키: 더블클릭)", b.addEventListener("click", () => this.fitToViewport(this.imageWidth, this.imageHeight));
		let x = document.createElement("button");
		x.className = "img-tool-btn", x.textContent = "100%", x.title = "실제 크기 (1:1)", x.addEventListener("click", () => this.resetTo100());
		let S = document.createElement("button");
		S.className = "img-tool-btn", S.textContent = "−", S.title = "축소", S.addEventListener("click", () => this.zoomBy(1 / 1.25)), this.zoomLabel = document.createElement("span"), this.zoomLabel.className = "image-zoom-label", this.zoomLabel.textContent = "100%";
		let C = document.createElement("button");
		C.className = "img-tool-btn", C.textContent = "+", C.title = "확대", C.addEventListener("click", () => this.zoomBy(1.25)), y.append(b, x, S, this.zoomLabel, C), f.append(p, g, y), a.append(o, f), this.el.append(a);
		let w = document.createElement("div");
		w.className = "image-viewer-viewport", this.canvasWrapper = document.createElement("div"), this.canvasWrapper.className = "image-canvas-wrapper checkerboard", this.canvasEl = document.createElement("canvas"), this.canvasWrapper.append(this.canvasEl), w.append(this.canvasWrapper), this.el.append(w), this.bindViewportEvents(w);
		try {
			if (n) {
				let n = t(e.bytes);
				this.imageWidth = n.width, this.imageHeight = n.height, this.rawRgba = new Uint8ClampedArray(n.rgba), this.sourceIsSRGB = n.isSRGB, this.colorSpaceMode = n.format.startsWith("BC5") || n.format.startsWith("BC4") ? "Linear" : n.isSRGB ? "sRGB" : n.format.includes("Linear") ? "Linear" : "sRGB", l.textContent = `DDS (${n.format})`, u.textContent = `${this.imageWidth} × ${this.imageHeight} px`, this.canvasEl.width = this.imageWidth, this.canvasEl.height = this.imageHeight, this.updateButtonsUI(), this.renderFilteredImage(), this.fitToViewport(this.imageWidth, this.imageHeight);
			} else {
				let t = e.name.split(".").pop()?.toLowerCase() ?? "png", n = t === "jpg" || t === "jpeg" ? "image/jpeg" : `image/${t}`, r = new Blob([e.bytes], { type: n });
				this.currentBlobUrl = URL.createObjectURL(r);
				let i = new Image();
				i.onload = () => {
					this.imageWidth = i.naturalWidth, this.imageHeight = i.naturalHeight, this.sourceIsSRGB = !0, this.colorSpaceMode = "sRGB", l.textContent = t.toUpperCase(), u.textContent = `${this.imageWidth} × ${this.imageHeight} px`, this.canvasEl.width = this.imageWidth, this.canvasEl.height = this.imageHeight;
					let e = this.canvasEl.getContext("2d");
					if (e) {
						e.drawImage(i, 0, 0);
						let t = e.getImageData(0, 0, this.imageWidth, this.imageHeight);
						this.rawRgba = new Uint8ClampedArray(t.data);
					}
					this.updateButtonsUI(), this.fitToViewport(this.imageWidth, this.imageHeight);
				}, i.onerror = (e) => {
					u.textContent = "이미지 로드 오류", console.error("[ImageViewer] Failed to load image:", e);
				}, i.src = this.currentBlobUrl;
			}
		} catch (e) {
			u.textContent = "디코딩 실패";
			let t = document.createElement("div");
			t.className = "image-error-notice", t.textContent = `텍스처 미리보기 오류: ${String(e)}`, w.append(t);
		}
	}
	setColorSpaceMode(e) {
		this.colorSpaceMode !== e && (this.colorSpaceMode = e, this.updateButtonsUI(), this.renderFilteredImage());
	}
	setChannelMode(e) {
		this.channelMode !== e && (this.channelMode = e, this.updateButtonsUI(), this.renderFilteredImage());
	}
	updateButtonsUI() {
		for (let [e, t] of this.colorSpaceBtns.entries()) e === this.colorSpaceMode ? t.classList.add("active") : t.classList.remove("active");
		for (let [e, t] of this.channelBtns.entries()) e === this.channelMode ? t.classList.add("active") : t.classList.remove("active");
	}
	renderFilteredImage() {
		if (!this.rawRgba || !this.imageWidth || !this.imageHeight) return;
		let e = this.canvasEl.getContext("2d");
		if (!e) return;
		let t = e.createImageData(this.imageWidth, this.imageHeight), n = t.data, r = this.rawRgba, i = this.imageWidth * this.imageHeight, a = this.colorSpaceMode === "Linear", o = this.colorSpaceMode === "sRGB" && !this.sourceIsSRGB, s = a && this.sourceIsSRGB, c = this.channelMode;
		for (let e = 0; e < i; e++) {
			let t = e * 4, i = r[t], a = r[t + 1], l = r[t + 2], u = r[t + 3];
			switch (o ? (i = N[i], a = N[a], l = N[l]) : s && (i = M[i], a = M[a], l = M[l]), c) {
				case "RGBA":
					n[t] = i, n[t + 1] = a, n[t + 2] = l, n[t + 3] = u;
					break;
				case "RGB":
					n[t] = i, n[t + 1] = a, n[t + 2] = l, n[t + 3] = 255;
					break;
				case "R":
					n[t] = i, n[t + 1] = i, n[t + 2] = i, n[t + 3] = 255;
					break;
				case "G":
					n[t] = a, n[t + 1] = a, n[t + 2] = a, n[t + 3] = 255;
					break;
				case "B":
					n[t] = l, n[t + 1] = l, n[t + 2] = l, n[t + 3] = 255;
					break;
				case "A": n[t] = u, n[t + 1] = u, n[t + 2] = u, n[t + 3] = 255;
			}
		}
		e.putImageData(t, 0, 0);
	}
	getViewportRect() {
		let e = this.el.querySelector(".image-viewer-viewport");
		return e ? e.getBoundingClientRect() : null;
	}
	fitToViewport(e = this.imageWidth, t = this.imageHeight) {
		if (!e || !t) return;
		let n = this.getViewportRect();
		if (!n || n.width <= 0 || n.height <= 0) {
			requestAnimationFrame(() => this.fitToViewport(e, t));
			return;
		}
		let r = Math.max(20, n.width - 40), i = Math.max(20, n.height - 40), a = r / e, o = i / t, s = Math.min(a, o);
		s = Math.min(32, Math.max(.01, s)), this.zoom = s, this.panX = Math.round((n.width - e * this.zoom) / 2), this.panY = Math.round((n.height - t * this.zoom) / 2), this.updateTransform();
	}
	resetTo100() {
		this.zoom = 1;
		let e = this.getViewportRect();
		e && e.width > 0 && e.height > 0 ? (this.panX = Math.round((e.width - this.imageWidth) / 2), this.panY = Math.round((e.height - this.imageHeight) / 2)) : (this.panX = 0, this.panY = 0), this.updateTransform();
	}
	zoomBy(e) {
		let t = this.getViewportRect(), n = t ? t.width / 2 : 0, r = t ? t.height / 2 : 0, i = (n - this.panX) / this.zoom, a = (r - this.panY) / this.zoom, o = Math.min(64, Math.max(.01, this.zoom * e));
		this.panX = Math.round(n - i * o), this.panY = Math.round(r - a * o), this.zoom = o, this.updateTransform();
	}
	updateTransform() {
		this.canvasWrapper && (this.canvasWrapper.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`, this.zoomLabel && (this.zoomLabel.textContent = `${Math.round(this.zoom * 100)}%`));
	}
	bindViewportEvents(e) {
		e.addEventListener("wheel", (t) => {
			t.preventDefault();
			let n = e.getBoundingClientRect(), r = t.clientX - n.left, i = t.clientY - n.top, a = (r - this.panX) / this.zoom, o = (i - this.panY) / this.zoom, s = t.deltaY < 0 ? 1.15 : 1 / 1.15, c = Math.min(64, Math.max(.01, this.zoom * s));
			this.panX = Math.round(r - a * c), this.panY = Math.round(i - o * c), this.zoom = c, this.updateTransform();
		}, { passive: !1 }), e.addEventListener("mousedown", (t) => {
			(t.button === 0 || t.button === 1) && (this.isDragging = !0, this.dragStartX = t.clientX - this.panX, this.dragStartY = t.clientY - this.panY, e.style.cursor = "grabbing", t.preventDefault());
		});
		let t = (e) => {
			this.isDragging && (this.panX = Math.round(e.clientX - this.dragStartX), this.panY = Math.round(e.clientY - this.dragStartY), this.updateTransform());
		}, n = () => {
			this.isDragging && (this.isDragging = !1, e.style.cursor = "grab");
		};
		if (window.addEventListener("mousemove", t), window.addEventListener("mouseup", n), this.cleanups.push(() => {
			window.removeEventListener("mousemove", t), window.removeEventListener("mouseup", n);
		}), e.addEventListener("dblclick", () => {
			this.fitToViewport(this.imageWidth, this.imageHeight);
		}), typeof ResizeObserver < "u") {
			let t = new ResizeObserver(() => {
				this.imageWidth && this.imageHeight && !this.isDragging && this.fitToViewport(this.imageWidth, this.imageHeight);
			});
			t.observe(e), this.cleanups.push(() => t.disconnect());
		}
	}
	formatSize(e) {
		return e < 1024 ? `${e} B` : e < 1048576 ? `${(e / 1024).toFixed(1)} KB` : `${(e / 1048576).toFixed(2)} MB`;
	}
	dispose() {
		this.cleanups.forEach((e) => {
			try {
				e();
			} catch {}
		}), this.cleanups = [], this.currentBlobUrl &&= (URL.revokeObjectURL(this.currentBlobUrl), null), this.rawRgba = null, this.el.replaceChildren();
	}
}, F = e({
	activate(e) {
		e.editor.registerCustomViewer({
			id: "asset-viewer",
			name: "DDS / 텍스처 뷰어",
			extensions: [
				"dds",
				"png",
				"jpg",
				"jpeg",
				"bmp",
				"webp",
				"gif"
			],
			render(e, t) {
				let n = new P(e);
				return n.show({
					name: t.name,
					path: t.path,
					bytes: t.bytes
				}), () => n.dispose();
			}
		});
	},
	deactivate() {}
});
//#endregion
export { F as default };
