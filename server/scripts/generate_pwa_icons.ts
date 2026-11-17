import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const outputDir = path.resolve(process.cwd(), 'public/icons');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 1. Master High-Resolution SVG Definition (512x512)
const createSvg = (isMaskable = false) => {
  // If maskable, scale content slightly to guarantee 80% safe zone
  const scale = isMaskable ? 0.78 : 0.92;
  const translate = isMaskable ? 56 : 20;

  return `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background Gradient -->
    <radialGradient id="bgGrad" cx="50%" cy="40%" r="65%">
      <stop offset="0%" stop-color="#1e293b" />
      <stop offset="60%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#020617" />
    </radialGradient>

    <!-- Metallic Gold Gradient -->
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fef08a" />
      <stop offset="35%" stop-color="#f59e0b" />
      <stop offset="70%" stop-color="#d97706" />
      <stop offset="100%" stop-color="#78350f" />
    </linearGradient>

    <!-- Electric Cyan Gradient -->
    <linearGradient id="cyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#e0f2fe" />
      <stop offset="50%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#0284c7" />
    </linearGradient>

    <!-- Crimson Glow -->
    <radialGradient id="redGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ef4444" stop-opacity="0.35" />
      <stop offset="100%" stop-color="#ef4444" stop-opacity="0" />
    </radialGradient>

    <!-- Gold Glow -->
    <radialGradient id="goldGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.3" />
      <stop offset="100%" stop-color="#f59e0b" stop-opacity="0" />
    </radialGradient>

    <!-- Drop Shadow Filter -->
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.65" />
    </filter>

    <filter id="glowFilter" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Base Canvas -->
  <rect width="512" height="512" rx="${isMaskable ? '0' : '96'}" fill="url(#bgGrad)" />

  <!-- Outer Luxury Gold Bezel -->
  <rect x="12" y="12" width="488" height="488" rx="${isMaskable ? '0' : '88'}" fill="none" stroke="url(#goldGrad)" stroke-width="4" stroke-opacity="0.4" />

  <g transform="translate(${translate}, ${translate}) scale(${scale})">
    <!-- Center Glow -->
    <circle cx="256" cy="220" r="160" fill="url(#goldGlow)" />
    <circle cx="256" cy="220" r="120" fill="url(#redGlow)" />

    <!-- Brand Header: SONIC -->
    <text x="256" y="90"
      font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      font-size="34"
      font-weight="900"
      letter-spacing="12"
      fill="url(#cyanGrad)"
      text-anchor="middle"
      filter="url(#shadow)">SONIC</text>

    <!-- Royal Crown Badge Container -->
    <g transform="translate(256, 215) scale(1.35)" filter="url(#shadow)">
      <!-- Outer Crown Coin Ring -->
      <circle cx="0" cy="0" r="68" fill="url(#goldGrad)" stroke="#fef08a" stroke-width="3" />
      <circle cx="0" cy="0" r="60" fill="#0f172a" />
      <circle cx="0" cy="0" r="54" fill="url(#goldGrad)" opacity="0.15" />

      <!-- Golden Crown Silhouette -->
      <path d="M -36,18 L -38,-14 L -18,-2 L 0,-24 L 18,-2 L 38,-14 L 36,18 Z"
        fill="url(#goldGrad)"
        stroke="#fef08a"
        stroke-width="2.5"
        stroke-linejoin="round" />

      <!-- Crown Base Band -->
      <path d="M -36,16 Q 0,22 36,16 L 36,22 Q 0,28 -36,22 Z" fill="#b45309" stroke="#fef08a" stroke-width="1.5" />

      <!-- Crown Jewels -->
      <circle cx="-38" cy="-15" r="4.5" fill="#fef08a" stroke="#d97706" stroke-width="1.2" />
      <circle cx="-18" cy="-3" r="3.5" fill="#ef4444" stroke="#fef08a" stroke-width="1" />
      <circle cx="0" cy="-25" r="5.5" fill="#fef08a" stroke="#d97706" stroke-width="1.5" />
      <circle cx="18" cy="-3" r="3.5" fill="#3b82f6" stroke="#fef08a" stroke-width="1" />
      <circle cx="38" cy="-15" r="4.5" fill="#fef08a" stroke="#d97706" stroke-width="1.2" />

      <!-- Center Ruby on Crown Band -->
      <circle cx="0" cy="19" r="3" fill="#ef4444" />
      <circle cx="-18" cy="18" r="2.5" fill="#3b82f6" />
      <circle cx="18" cy="18" r="2.5" fill="#10b981" />
    </g>

    <!-- Brand Footer: AGENT -->
    <text x="256" y="380"
      font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      font-size="44"
      font-weight="900"
      letter-spacing="14"
      fill="url(#goldGrad)"
      text-anchor="middle"
      filter="url(#shadow)">AGENT</text>

    <!-- Subtitle: TERMINAL -->
    <g transform="translate(256, 420)">
      <rect x="-85" y="-16" width="170" height="30" rx="15" fill="#1e293b" stroke="url(#goldGrad)" stroke-width="1.5" stroke-opacity="0.6" />
      <text x="0" y="5"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        font-size="13"
        font-weight="800"
        letter-spacing="5"
        fill="#f8fafc"
        text-anchor="middle">TERMINAL</text>
    </g>
  </g>
</svg>
  `.trim();
};

async function generateIcons() {
  console.log('🚀 Generating Sonic Agent PWA Icons...');

  const standardSvg = Buffer.from(createSvg(false));
  const maskableSvg = Buffer.from(createSvg(true));

  // 1. icon-512.png
  await sharp(standardSvg)
    .resize(512, 512)
    .png({ compressionLevel: 9, quality: 100 })
    .toFile(path.join(outputDir, 'icon-512.png'));
  console.log('✅ Generated public/icons/icon-512.png (512x512)');

  // 2. icon-512-maskable.png
  await sharp(maskableSvg)
    .resize(512, 512)
    .png({ compressionLevel: 9, quality: 100 })
    .toFile(path.join(outputDir, 'icon-512-maskable.png'));
  console.log('✅ Generated public/icons/icon-512-maskable.png (512x512 maskable)');

  // 3. icon-192.png
  await sharp(standardSvg)
    .resize(192, 192)
    .png({ compressionLevel: 9, quality: 100 })
    .toFile(path.join(outputDir, 'icon-192.png'));
  console.log('✅ Generated public/icons/icon-192.png (192x192)');

  // 4. apple-touch-icon.png (180x180 standard for iOS)
  await sharp(standardSvg)
    .resize(180, 180)
    .png({ compressionLevel: 9, quality: 100 })
    .toFile(path.join(outputDir, 'apple-touch-icon.png'));
  console.log('✅ Generated public/icons/apple-touch-icon.png (180x180 Apple)');

  // 5. apple-touch-icon-180.png
  await sharp(standardSvg)
    .resize(180, 180)
    .png({ compressionLevel: 9, quality: 100 })
    .toFile(path.join(outputDir, 'apple-touch-icon-180.png'));
  console.log('✅ Generated public/icons/apple-touch-icon-180.png (180x180 Apple)');

  console.log('🎉 All PWA icons generated successfully in public/icons/');
}

generateIcons().catch(err => {
  console.error('❌ Failed to generate icons:', err);
  process.exit(1);
});

