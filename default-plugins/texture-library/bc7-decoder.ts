/**
 * bc7-decoder.ts
 * BC7 (DirectX 11 Block Compression 7) 텍스처 디코더 - Modes 0 to 7
 */

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

class BitReader {
  private buf!: Uint8Array;
  private baseOffset: number = 0;
  bitPos: number = 0;

  init(buf: Uint8Array, baseOffset: number) {
    this.buf = buf;
    this.baseOffset = baseOffset;
    this.bitPos = 0;
  }

  read(count: number): number {
    let bits = 0;
    let totalBits = 0;
    while (totalBits < count) {
      const bitInByte = this.bitPos & 7;
      const bitsToRead = Math.min(count - totalBits, 8 - bitInByte);
      const byteVal = this.buf[this.baseOffset + (this.bitPos >> 3)] >> bitInByte;
      const mask = (1 << bitsToRead) - 1;
      bits |= (byteVal & mask) << totalBits;
      totalBits += bitsToRead;
      this.bitPos += bitsToRead;
    }
    return bits >>> 0;
  }
}

const blockReader = new BitReader();

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


export function decodeBC7(
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

  blockReader.init(src, offset);
  blockReader.read(mode + 1); // skip mode bits

  switch (mode) {
    case 0:
    case 2:
      unpackBC7Mode0_2(mode, blockReader, outPixels);
      break;
    case 1:
    case 3:
    case 7:
      unpackBC7Mode1_3_7(mode, blockReader, outPixels);
      break;
    case 4:
    case 5:
      unpackBC7Mode4_5(mode, blockReader, outPixels);
      break;
    case 6:
      unpackBC7Mode6(blockReader, outPixels);
      break;
    default:
      outPixels.fill(0);
      break;
  }
}

function unpackBC7Mode0_2(mode: number, reader: BitReader, outPixels: Uint8Array) {
  const ENDPOINTS = 6;
  const COMPS = 3;
  const WEIGHT_BITS = mode === 0 ? 3 : 2;
  const ENDPOINT_BITS = mode === 0 ? 4 : 5;
  const PBITS = mode === 0 ? 6 : 0;
  const WEIGHT_VALS = 1 << WEIGHT_BITS;

  const part = reader.read(mode === 0 ? 4 : 6);

  const endpoints: number[][] = Array.from({ length: ENDPOINTS }, () => [0, 0, 0, 255]);
  for (let c = 0; c < COMPS; c++) {
    for (let e = 0; e < ENDPOINTS; e++) {
      endpoints[e][c] = reader.read(ENDPOINT_BITS);
    }
  }

  const pbits = [0, 0, 0, 0, 0, 0];
  for (let p = 0; p < PBITS; p++) {
    pbits[p] = reader.read(1);
  }

  const weights = new Array<number>(16);
  const a1 = BC7_ANCHOR3_1[part];
  const a2 = BC7_ANCHOR3_2[part];
  for (let i = 0; i < 16; i++) {
    const isAnchor = !i || i === a1 || i === a2;
    weights[i] = reader.read(isAnchor ? WEIGHT_BITS - 1 : WEIGHT_BITS);
  }

  for (let e = 0; e < ENDPOINTS; e++) {
    for (let c = 0; c < 3; c++) {
      endpoints[e][c] = PBITS
        ? bc7DequantWithPBit(endpoints[e][c], pbits[e], ENDPOINT_BITS)
        : bc7DequantNoPBit(endpoints[e][c], ENDPOINT_BITS);
    }
    endpoints[e][3] = 255;
  }

  const weightsTable = WEIGHT_BITS === 2 ? BC7_WEIGHTS2 : BC7_WEIGHTS3;
  const blockColors: number[][][] = Array.from({ length: 3 }, () =>
    Array.from({ length: WEIGHT_VALS }, () => [0, 0, 0, 255]),
  );

  for (let s = 0; s < 3; s++) {
    for (let i = 0; i < WEIGHT_VALS; i++) {
      for (let c = 0; c < 3; c++) {
        blockColors[s][i][c] = bc7Interp(endpoints[s * 2][c], endpoints[s * 2 + 1][c], i, weightsTable);
      }
      blockColors[s][i][3] = 255;
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

function unpackBC7Mode1_3_7(mode: number, reader: BitReader, outPixels: Uint8Array) {
  const ENDPOINTS = 4;
  const COMPS = mode === 7 ? 4 : 3;
  const WEIGHT_BITS = mode === 1 ? 3 : 2;
  const ENDPOINT_BITS = mode === 7 ? 5 : mode === 1 ? 6 : 7;
  const PBITS = mode === 1 ? 2 : 4;
  const SHARED_PBITS = mode === 1;
  const WEIGHT_VALS = 1 << WEIGHT_BITS;

  const part = reader.read(6);

  const endpoints: number[][] = Array.from({ length: ENDPOINTS }, () => [0, 0, 0, 255]);
  for (let c = 0; c < COMPS; c++) {
    for (let e = 0; e < ENDPOINTS; e++) {
      endpoints[e][c] = reader.read(ENDPOINT_BITS);
    }
  }

  const pbits = [0, 0, 0, 0];
  for (let p = 0; p < PBITS; p++) {
    pbits[p] = reader.read(1);
  }

  const weights = new Array<number>(16);
  const a1 = BC7_ANCHOR2[part];
  for (let i = 0; i < 16; i++) {
    const isAnchor = !i || i === a1;
    weights[i] = reader.read(isAnchor ? WEIGHT_BITS - 1 : WEIGHT_BITS);
  }

  for (let e = 0; e < ENDPOINTS; e++) {
    const pbit = pbits[SHARED_PBITS ? (e >> 1) : e];
    for (let c = 0; c < 4; c++) {
      if (c === (mode === 7 ? 4 : 3)) {
        endpoints[e][c] = 255;
      } else {
        endpoints[e][c] = bc7DequantWithPBit(endpoints[e][c], pbit, ENDPOINT_BITS);
      }
    }
  }

  const weightsTable = WEIGHT_BITS === 2 ? BC7_WEIGHTS2 : BC7_WEIGHTS3;
  const blockColors: number[][][] = Array.from({ length: 2 }, () =>
    Array.from({ length: WEIGHT_VALS }, () => [0, 0, 0, 255]),
  );

  for (let s = 0; s < 2; s++) {
    for (let i = 0; i < WEIGHT_VALS; i++) {
      for (let c = 0; c < COMPS; c++) {
        blockColors[s][i][c] = bc7Interp(endpoints[s * 2][c], endpoints[s * 2 + 1][c], i, weightsTable);
      }
      blockColors[s][i][3] = COMPS === 3 ? 255 : blockColors[s][i][3];
    }
  }

  for (let i = 0; i < 16; i++) {
    const subset = BC7_PARTITION2[part * 16 + i];
    const color = blockColors[subset][weights[i]];
    const dIdx = i * 4;
    outPixels[dIdx] = color[0];
    outPixels[dIdx + 1] = color[1];
    outPixels[dIdx + 2] = color[2];
    outPixels[dIdx + 3] = COMPS === 4 ? color[3] : 255;
  }
}

function unpackBC7Mode4_5(mode: number, reader: BitReader, outPixels: Uint8Array) {
  const ENDPOINTS = 2;
  const COMPS = 4;
  const WEIGHT_BITS = 2;
  const A_WEIGHT_BITS = mode === 4 ? 3 : 2;
  const ENDPOINT_BITS = mode === 4 ? 5 : 7;
  const A_ENDPOINT_BITS = mode === 4 ? 6 : 8;

  const compRot = reader.read(2);
  const indexMode = mode === 4 ? reader.read(1) : 0;

  const endpoints: number[][] = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  for (let c = 0; c < COMPS; c++) {
    const nBits = c === 3 ? A_ENDPOINT_BITS : ENDPOINT_BITS;
    for (let e = 0; e < ENDPOINTS; e++) {
      endpoints[e][c] = reader.read(nBits);
    }
  }

  const weightBits = [
    indexMode ? A_WEIGHT_BITS : WEIGHT_BITS,
    indexMode ? WEIGHT_BITS : A_WEIGHT_BITS,
  ];

  const weights = new Array<number>(16);
  const aWeights = new Array<number>(16);

  const firstWeights = indexMode ? aWeights : weights;
  for (let i = 0; i < 16; i++) {
    firstWeights[i] = reader.read(weightBits[indexMode] - (!i ? 1 : 0));
  }

  const secondWeights = indexMode ? weights : aWeights;
  for (let i = 0; i < 16; i++) {
    secondWeights[i] = reader.read(weightBits[1 - indexMode] - (!i ? 1 : 0));
  }

  for (let e = 0; e < ENDPOINTS; e++) {
    for (let c = 0; c < 3; c++) {
      endpoints[e][c] = bc7DequantNoPBit(endpoints[e][c], ENDPOINT_BITS);
    }
    endpoints[e][3] = bc7DequantNoPBit(endpoints[e][3], A_ENDPOINT_BITS);
  }

  const rgbTable = weightBits[0] === 3 ? BC7_WEIGHTS3 : BC7_WEIGHTS2;
  const aTable = weightBits[1] === 3 ? BC7_WEIGHTS3 : BC7_WEIGHTS2;

  const numRgb = 1 << weightBits[0];
  const numA = 1 << weightBits[1];

  const blockColorsRgb: number[][] = Array.from({ length: numRgb }, () => [0, 0, 0]);
  for (let i = 0; i < numRgb; i++) {
    for (let c = 0; c < 3; c++) {
      blockColorsRgb[i][c] = bc7Interp(endpoints[0][c], endpoints[1][c], i, rgbTable);
    }
  }

  const blockColorsA = new Array<number>(numA);
  for (let i = 0; i < numA; i++) {
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

function unpackBC7Mode6(reader: BitReader, outPixels: Uint8Array) {
  const r0 = reader.read(7);
  const r1 = reader.read(7);
  const g0 = reader.read(7);
  const g1 = reader.read(7);
  const b0 = reader.read(7);
  const b1 = reader.read(7);
  const a0 = reader.read(7);
  const a1 = reader.read(7);
  const p0 = reader.read(1);
  const p1 = reader.read(1);

  const ep0_r = (r0 << 1) | p0;
  const ep0_g = (g0 << 1) | p0;
  const ep0_b = (b0 << 1) | p0;
  const ep0_a = (a0 << 1) | p0;

  const ep1_r = (r1 << 1) | p1;
  const ep1_g = (g1 << 1) | p1;
  const ep1_b = (b1 << 1) | p1;
  const ep1_a = (a1 << 1) | p1;

  const tableColors: number[][] = Array.from({ length: 16 }, () => [0, 0, 0, 0]);
  for (let i = 0; i < 16; i++) {
    const w = BC7_WEIGHTS4[i];
    const iw = 64 - w;
    tableColors[i][0] = (ep0_r * iw + ep1_r * w + 32) >> 6;
    tableColors[i][1] = (ep0_g * iw + ep1_g * w + 32) >> 6;
    tableColors[i][2] = (ep0_b * iw + ep1_b * w + 32) >> 6;
    tableColors[i][3] = (ep0_a * iw + ep1_a * w + 32) >> 6;
  }

  for (let i = 0; i < 16; i++) {
    const wIdx = reader.read(i === 0 ? 3 : 4);
    const c = tableColors[wIdx];
    const dIdx = i * 4;
    outPixels[dIdx] = c[0];
    outPixels[dIdx + 1] = c[1];
    outPixels[dIdx + 2] = c[2];
    outPixels[dIdx + 3] = c[3];
  }
}
