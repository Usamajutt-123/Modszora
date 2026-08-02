import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';

const svg = readFileSync('public/favicon.svg');

// PWA + apple icons from the master SVG
for (const [file, size] of [['public/icon-192.png',192],['public/icon-512.png',512],['public/apple-icon.png',180]]) {
  await sharp(svg, { density: 400 }).resize(size, size).png({ quality: 92 }).toFile(file);
  console.log('✓', file, size);
}

// Maskable icon needs generous safe-area padding (icon at ~60% of canvas)
const inner = await sharp(svg, { density: 400 }).resize(310, 310).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#0e1120' } })
  .composite([{ input: inner, gravity: 'center' }]).png().toFile('public/icon-maskable.png');
console.log('✓ public/icon-maskable.png (maskable, safe-area padded)');

// Default OG image 1200x630
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#070912"/><stop offset="55%" stop-color="#141829"/><stop offset="100%" stop-color="#0d1022"/>
  </linearGradient>
  <linearGradient id="txt" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="#8a6cff"/><stop offset="100%" stop-color="#ff3da8"/>
  </linearGradient>
  <radialGradient id="glow1" cx="0.5" cy="0.5"><stop offset="0%" stop-color="#5b3df5" stop-opacity=".55"/><stop offset="100%" stop-color="#5b3df5" stop-opacity="0"/></radialGradient>
  <radialGradient id="glow2" cx="0.5" cy="0.5"><stop offset="0%" stop-color="#ff3da8" stop-opacity=".42"/><stop offset="100%" stop-color="#ff3da8" stop-opacity="0"/></radialGradient>
</defs>
<rect width="1200" height="630" fill="url(#bg)"/>
<circle cx="180" cy="120" r="330" fill="url(#glow1)"/>
<circle cx="1050" cy="540" r="300" fill="url(#glow2)"/>
<g stroke="#2c334f" stroke-opacity=".5" stroke-width="1">
${Array.from({length:13},(_,i)=>`<line x1="${i*100}" y1="0" x2="${i*100}" y2="630"/>`).join('')}
${Array.from({length:7},(_,i)=>`<line x1="0" y1="${i*100}" x2="1200" y2="${i*100}"/>`).join('')}
</g>
<rect x="88" y="86" width="104" height="104" rx="26" fill="url(#txt)"/>
<path d="M118 132h44a18 18 0 0 1 17.8 15.1l1.6 9.7a6.4 6.4 0 0 1-11.9 4.1l-3.6-5.9h-37l-3.6 5.9a6.4 6.4 0 0 1-11.9-4.1l1.6-9.7A18 18 0 0 1 118 132Z" fill="#ffffff" fill-opacity=".96" transform="translate(-6,-8) scale(1.02)"/>
<text x="88" y="290" font-family="Segoe UI,Helvetica,Arial,sans-serif" font-size="96" font-weight="800" fill="#f0f3fc">MOD<tspan fill="url(#txt)">Verse</tspan></text>
<text x="88" y="360" font-family="Segoe UI,Helvetica,Arial,sans-serif" font-size="38" font-weight="600" fill="#9ea8c4">Premium MOD APK Games for Android</text>
<g font-family="Segoe UI,Helvetica,Arial,sans-serif" font-size="26" font-weight="700">
  <rect x="88" y="418" width="290" height="62" rx="31" fill="#8a6cff" fill-opacity=".16" stroke="#8a6cff" stroke-opacity=".5"/>
  <text x="118" y="457" fill="#b9a7ff">Unlimited Money</text>
  <rect x="398" y="418" width="250" height="62" rx="31" fill="#ff3da8" fill-opacity=".14" stroke="#ff3da8" stroke-opacity=".45"/>
  <text x="428" y="457" fill="#ff8fd0">Mod Menus</text>
  <rect x="668" y="418" width="272" height="62" rx="31" fill="#22d3ee" fill-opacity=".13" stroke="#22d3ee" stroke-opacity=".4"/>
  <text x="698" y="457" fill="#7fe6f6">Virus Scanned</text>
</g>
<text x="88" y="556" font-family="Segoe UI,Helvetica,Arial,sans-serif" font-size="24" fill="#6e7998">modverse.app</text>
</svg>`;
writeFileSync('/tmp/og.svg', og);
await sharp(Buffer.from(og)).png({ quality: 92 }).toFile('public/og-default.png');
console.log('✓ public/og-default.png');
