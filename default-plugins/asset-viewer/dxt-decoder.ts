/**
 * dxt-decoder.ts
 * BC1(DXT1), BC2(DXT3), BC3(DXT5), BC4, BC5 및 비압축(RGBA/BGRA/BGR) 텍스처 디코더
 */

export function unpackRGB565Table(c0: number, c1: number, isDxt1: boolean): [number, number, number, number][] {
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

export function unpackAlphaTable(a0: number, a1: number): number[] {
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

// ---------------------------------------------------------------------------
// BC1 (DXT1) Decoder
// ---------------------------------------------------------------------------
export function decodeDXT1(
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
export function decodeDXT3(
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
export function decodeDXT5(
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
export function decodeBC4(
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
export function decodeBC5(
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
// Uncompressed decoders
// ---------------------------------------------------------------------------
export function decodeRGBA32(
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

export function decodeBGRA32(
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

export function decodeBGR24(
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
