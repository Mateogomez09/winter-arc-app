import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const svgBuffer = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <!-- Solid Dark Luxury Background -->
  <rect width="512" height="512" fill="#0A0A0E" />
  
  <!-- Subtle Ambient Glow -->
  <radialGradient id="frostGlow" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="#7A8DFF" stop-opacity="0.25" />
    <stop offset="100%" stop-color="#7A8DFF" stop-opacity="0" />
  </radialGradient>
  <circle cx="256" cy="256" r="210" fill="url(#frostGlow)" />

  <!-- Outer Hexagonal Shield / Monolith Arc -->
  <path
    d="M 256 68 L 420 165 L 420 347 L 256 444 L 92 347 L 92 165 Z"
    stroke="#FFFFFF"
    stroke-width="18"
    stroke-linejoin="round"
    fill="#121218"
  />

  <!-- Top Diamond Star / Frost Apex -->
  <path
    d="M 256 125 L 273 160 L 256 195 L 239 160 Z"
    fill="#7A8DFF"
  />

  <!-- Inner Geometric Winter Arc "W" -->
  <path
    d="M 154 195 L 222 342 L 256 257 L 290 342 L 358 195"
    stroke="#FFFFFF"
    stroke-width="26"
    stroke-linecap="round"
    stroke-linejoin="round"
  />

  <!-- Subtle Arc Base Bar -->
  <path
    d="M 205 376 L 307 376"
    stroke="#7A8DFF"
    stroke-width="14"
    stroke-linecap="round"
  />
</svg>
`);

async function generate() {
  const publicDir = path.resolve('public');
  
  // 1. apple-touch-icon.png (180x180)
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('Created apple-touch-icon.png (180x180)');

  // 2. icon-192.png (192x192)
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'icon-192.png'));
  console.log('Created icon-192.png (192x192)');

  // 3. icon-512.png (512x512)
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'icon-512.png'));
  console.log('Created icon-512.png (512x512)');

  // 4. favicon.png (32x32)
  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile(path.join(publicDir, 'favicon.png'));
  console.log('Created favicon.png (32x32)');
}

generate().catch(console.error);
