/**
 * Offline ISO-18004 Byte-Mode QR Code Generator (Zero external APIs or dependencies)
 * Supports URLs & strings up to ~150 UTF-8 bytes cleanly with Error Correction Level M/L.
 */

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(ecLen: number): Uint8Array {
  let poly: number[] = [1];
  for (let i = 0; i < ecLen; i++) {
    const next: number[] = new Array(poly.length + 1).fill(0);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return new Uint8Array(poly);
}

function rsRemainder(data: Uint8Array, ecLen: number): Uint8Array {
  const gen = rsGeneratorPoly(ecLen);
  const res = new Uint8Array(data.length + ecLen);
  res.set(data);
  for (let i = 0; i < data.length; i++) {
    const coef = res[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        res[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return res.slice(data.length);
}

interface QrVersionSpec {
  version: number;
  dataCodewords: number;
  ecPerBlock: number;
  blocks: number;
  align: number[];
}

// Level L single/multi-block versions 1-8 covering up to 192 UTF-8 bytes
const VERSIONS_L: QrVersionSpec[] = [
  { version: 1, dataCodewords: 19, ecPerBlock: 7, blocks: 1, align: [] },
  { version: 2, dataCodewords: 34, ecPerBlock: 10, blocks: 1, align: [6, 18] },
  { version: 3, dataCodewords: 55, ecPerBlock: 15, blocks: 1, align: [6, 22] },
  { version: 4, dataCodewords: 80, ecPerBlock: 20, blocks: 1, align: [6, 26] },
  { version: 5, dataCodewords: 108, ecPerBlock: 26, blocks: 1, align: [6, 30] },
  { version: 6, dataCodewords: 136, ecPerBlock: 18, blocks: 2, align: [6, 34] },
  { version: 7, dataCodewords: 156, ecPerBlock: 20, blocks: 2, align: [6, 22, 38] },
  { version: 8, dataCodewords: 194, ecPerBlock: 24, blocks: 2, align: [6, 24, 42] }
];

function encodeByteCodewords(bytes: Uint8Array, spec: QrVersionSpec): Uint8Array {
  const totalBits = spec.dataCodewords * 8;
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };

  pushBits(0b0100, 4); // Byte mode
  pushBits(bytes.length, 8);
  for (let i = 0; i < bytes.length; i++) pushBits(bytes[i], 8);

  const term = Math.min(4, totalBits - bits.length);
  for (let i = 0; i < term; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    codewords.push(b);
  }
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (codewords.length < spec.dataCodewords) {
    codewords.push(padBytes[padIdx % 2]);
    padIdx++;
  }

  // Split into RS blocks and interleave
  const blockSize = Math.floor(spec.dataCodewords / spec.blocks);
  const longBlocks = spec.dataCodewords % spec.blocks;
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];

  let cursor = 0;
  for (let b = 0; b < spec.blocks; b++) {
    const len = blockSize + (b >= spec.blocks - longBlocks ? 1 : 0);
    const slice = new Uint8Array(codewords.slice(cursor, cursor + len));
    cursor += len;
    dataBlocks.push(slice);
    ecBlocks.push(rsRemainder(slice, spec.ecPerBlock));
  }

  const interleaved: number[] = [];
  const maxDataLen = blockSize + (longBlocks > 0 ? 1 : 0);
  for (let i = 0; i < maxDataLen; i++) {
    for (let b = 0; b < spec.blocks; b++) {
      if (i < dataBlocks[b].length) interleaved.push(dataBlocks[b][i]);
    }
  }
  for (let i = 0; i < spec.ecPerBlock; i++) {
    for (let b = 0; b < spec.blocks; b++) {
      interleaved.push(ecBlocks[b][i]);
    }
  }
  return new Uint8Array(interleaved);
}

function getFormatBits(mask: number): number {
  // Error Correction L = 01
  const data = (0b01 << 3) | mask;
  let rem = data << 10;
  const gen = 0b10100110111;
  for (let i = 14; i >= 10; i--) {
    if ((rem >>> i) & 1) rem ^= gen << (i - 10);
  }
  return ((data << 10) | rem) ^ 0b101010000010010;
}

function getVersionBits(version: number): number {
  let rem = version << 12;
  const gen = 0b1111100100101;
  for (let i = 17; i >= 12; i--) {
    if ((rem >>> i) & 1) rem ^= gen << (i - 12);
  }
  return (version << 12) | rem;
}

export function generateQrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  const spec = VERSIONS_L.find(v => bytes.length + 2 <= v.dataCodewords) || VERSIONS_L[VERSIONS_L.length - 1];
  const finalBytes = bytes.length + 2 <= spec.dataCodewords ? bytes : bytes.slice(0, spec.dataCodewords - 2);
  const codewords = encodeByteCodewords(finalBytes, spec);

  const size = spec.version * 4 + 17;
  const modules: Array<Array<boolean | null>> = Array.from({ length: size }, () => Array(size).fill(null));
  const reserved: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const setFixed = (r: number, c: number, val: boolean) => {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      modules[r][c] = val;
      reserved[r][c] = true;
    }
  };

  const drawFinder = (r0: number, c0: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = r0 + r;
        const cc = c0 + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        const inBorder = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const isDark =
          inBorder &&
          (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
        setFixed(rr, cc, isDark);
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Alignment patterns
  for (const r of spec.align) {
    for (const c of spec.align) {
      if (reserved[r]?.[c]) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const isDark = Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
          setFixed(r + dr, c + dc, isDark);
        }
      }
    }
  }

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (!reserved[6][i]) setFixed(6, i, i % 2 === 0);
    if (!reserved[i][6]) setFixed(i, 6, i % 2 === 0);
  }

  // Dark module
  setFixed(size - 8, 8, true);

  // Reserve format info spots
  for (let i = 0; i < 9; i++) {
    if (!reserved[8][i]) reserved[8][i] = true;
    if (!reserved[i][8]) reserved[i][8] = true;
  }
  for (let i = 0; i < 8; i++) {
    if (!reserved[8][size - 1 - i]) reserved[8][size - 1 - i] = true;
    if (!reserved[size - 1 - i][8]) reserved[size - 1 - i][8] = true;
  }

  // Version info (version >= 7)
  if (spec.version >= 7) {
    const vBits = getVersionBits(spec.version);
    for (let i = 0; i < 18; i++) {
      const bit = ((vBits >>> i) & 1) === 1;
      const r = Math.floor(i / 3);
      const c = size - 11 + (i % 3);
      setFixed(r, c, bit);
      setFixed(c, r, bit);
    }
  }

  // Place data bits in zig-zag order + apply mask 0 ((r + c) % 2 === 0)
  const mask = 0;
  let bitIdx = 0;
  const totalDataBits = codewords.length * 8;
  let upward = true;

  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let step = 0; step < size; step++) {
      const r = upward ? size - 1 - step : step;
      for (const colOffset of [0, 1]) {
        const c = right - colOffset;
        if (!reserved[r][c]) {
          let bit = false;
          if (bitIdx < totalDataBits) {
            const cw = codewords[bitIdx >>> 3];
            bit = ((cw >>> (7 - (bitIdx & 7))) & 1) === 1;
            bitIdx++;
          }
          if ((r + c) % 2 === 0) bit = !bit;
          modules[r][c] = bit;
        }
      }
    }
    upward = !upward;
  }

  // Write format info
  const fmt = getFormatBits(mask);
  for (let i = 0; i < 15; i++) {
    const bit = ((fmt >>> i) & 1) === 1;
    if (i < 6) modules[i][8] = bit;
    else if (i < 8) modules[i + 1][8] = bit;
    else modules[size - 15 + i][8] = bit;

    if (i < 8) modules[8][size - 1 - i] = bit;
    else if (i < 9) modules[8][7] = bit;
    else modules[8][14 - i] = bit;
  }

  return modules.map(row => row.map(cell => Boolean(cell)));
}

export function renderQrToCanvas(canvas: HTMLCanvasElement, text: string, pxSize = 220): void {
  const matrix = generateQrMatrix(text);
  const count = matrix.length;
  const quiet = 3;
  const totalMods = count + quiet * 2;
  const scale = Math.max(2, Math.floor(pxSize / totalMods));
  const actualSize = totalMods * scale;

  canvas.width = actualSize;
  canvas.height = actualSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, actualSize, actualSize);
  ctx.fillStyle = '#111312';

  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (matrix[r][c]) {
        ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
      }
    }
  }
}

export function downloadQrPng(text: string, filename: string): void {
  const canvas = document.createElement('canvas');
  renderQrToCanvas(canvas, text, 480);
  const url = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Generates and downloads an eye-catching dark-gold Sonic Bingo VIP Promo Ad Poster PNG
 * embedding the affiliate's referral QR code and partner invite code.
 */
export async function downloadPromoPosterPng(
  text: string,
  affiliateCode: string,
  filename: string
): Promise<void> {
  const width = 900;
  const height = 1180;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Deep luxury background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#071710');
  bgGrad.addColorStop(0.5, '#0b2219');
  bgGrad.addColorStop(1, '#090d16');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle radial gold/emerald glow accents
  const goldGlow = ctx.createRadialGradient(width * 0.5, 220, 20, width * 0.5, 220, 420);
  goldGlow.addColorStop(0, 'rgba(250, 204, 21, 0.22)');
  goldGlow.addColorStop(1, 'rgba(250, 204, 21, 0)');
  ctx.fillStyle = goldGlow;
  ctx.fillRect(0, 0, width, 620);

  // Try loading hero artwork banner cleanly
  const heroImg = await new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = '/assets/images/sonic-hero-75-vip.jpg';
  });

  if (heroImg) {
    ctx.save();
    drawRoundedRect(ctx, 48, 42, width - 96, 260, 28);
    ctx.clip();
    const scale = Math.max((width - 96) / heroImg.width, 260 / heroImg.height);
    const drawW = heroImg.width * scale;
    const drawH = heroImg.height * scale;
    ctx.drawImage(heroImg, (width - drawW) / 2, 42 + (260 - drawH) / 2, drawW, drawH);
    const overlay = ctx.createLinearGradient(0, 42, 0, 302);
    overlay.addColorStop(0, 'rgba(7, 23, 16, 0.2)');
    overlay.addColorStop(1, 'rgba(7, 23, 16, 0.88)');
    ctx.fillStyle = overlay;
    ctx.fillRect(48, 42, width - 96, 260);
    ctx.restore();

    ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, 48, 42, width - 96, 260, 28);
    ctx.stroke();
  }

  // Top VIP badge
  ctx.fillStyle = '#facc15';
  drawRoundedRect(ctx, width / 2 - 155, 274, 310, 44, 22);
  ctx.fill();
  ctx.fillStyle = '#090d16';
  ctx.font = '800 18px Urbanist, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('OFFICIAL SONIC PARTNER', width / 2, 302);

  // Headline & subheadline
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 56px Urbanist, system-ui, sans-serif';
  ctx.fillText('SONIC BINGO VIP', width / 2, 386);

  ctx.fillStyle = '#a7f3d0';
  ctx.font = '700 25px Urbanist, system-ui, sans-serif';
  ctx.fillText('Play Live 75-Ball & Win Real ETB Instantly!', width / 2, 430);

  // Feature chips row
  const chips = ['10-100 ETB Rooms', 'Instant Telebirr', '24/7 Live Draws'];
  const chipW = 240;
  const chipGap = 24;
  const startX = (width - (chips.length * chipW + (chips.length - 1) * chipGap)) / 2;
  chips.forEach((label, idx) => {
    const cx = startX + idx * (chipW + chipGap);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    drawRoundedRect(ctx, cx, 464, chipW, 48, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(167, 243, 208, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 18px Urbanist, system-ui, sans-serif';
    ctx.fillText(label, cx + chipW / 2, 494);
  });

  // White QR container card
  const qrBoxSize = 470;
  const qrBoxX = (width - qrBoxSize) / 2;
  const qrBoxY = 550;
  ctx.fillStyle = '#ffffff';
  drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 32);
  ctx.fill();

  const qrCanvas = document.createElement('canvas');
  renderQrToCanvas(qrCanvas, text, 420);
  ctx.drawImage(qrCanvas, (width - qrCanvas.width) / 2, qrBoxY + (qrBoxSize - qrCanvas.height) / 2);

  // Partner invite code pill & CTA footer
  ctx.fillStyle = 'rgba(250, 204, 21, 0.14)';
  drawRoundedRect(ctx, width / 2 - 200, 1054, 400, 54, 27);
  ctx.fill();
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#fde047';
  ctx.font = '800 22px monospace';
  ctx.fillText(`PARTNER CODE: ${affiliateCode}`, width / 2, 1088);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 19px Urbanist, system-ui, sans-serif';
  ctx.fillText('Scan QR Code with your camera or Telegram to join Sonic Bingo', width / 2, 1144);

  const pngUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = pngUrl;
  link.download = filename;
  link.click();
}
