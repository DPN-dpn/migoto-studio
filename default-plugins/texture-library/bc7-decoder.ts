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
