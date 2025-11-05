#!/usr/bin/env node
// extension/scripts/generate-icons.js
/**
 * Generate placeholder icons for the extension
 * Creates simple colored PNG files using canvas
 */

const fs = require('fs');
const path = require('path');

// Simple function to create a PNG data URL for a colored square
function createIconDataURL(size, color) {
  // Create a simple PNG as base64
  // This is a minimal PNG file structure (colored square)

  // For now, we'll create SVG and convert to PNG-like format
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#grad)" rx="${size * 0.2}"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
            font-family="Arial, sans-serif" font-size="${size * 0.4}" font-weight="bold" fill="white">L</text>
    </svg>
  `;

  return svg;
}

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, '..', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Icon sizes needed
const sizes = [16, 48, 128];

console.log('Generating placeholder icons...');

sizes.forEach(size => {
  const svg = createIconDataURL(size, '#6366f1');
  const filename = path.join(iconsDir, `icon${size}.png.svg`);

  fs.writeFileSync(filename, svg);
  console.log(`  ✓ Created icon${size}.png.svg`);
});

console.log('\n⚠️  NOTE: These are SVG placeholders.');
console.log('For production, create proper PNG icons using:');
console.log('  - Figma, Canva, or Photoshop');
console.log('  - Online tools like favicon.io');
console.log('  - Icon generators\n');
console.log('See GRAPHICS_GUIDE.md for detailed instructions.');
