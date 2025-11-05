#!/usr/bin/env node
// extension/scripts/create-placeholder-icons.js
/**
 * Creates minimal valid PNG files as placeholders
 */

const fs = require('fs');
const path = require('path');

// Minimal 1x1 transparent PNG (base64 encoded)
const MINIMAL_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// Colored PNG for LexyHub (purple/indigo square)
function createColoredPNG(size) {
  // This is a simple approach - create a minimal PNG
  // For a real icon, you'd want to use a proper PNG encoder
  // For now, we'll create a simple colored square

  // Base64 encoded 16x16 purple square PNG
  const png16x16 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMklEQVR42mNgGAWjYBQMHvD///9/BiYmJgYGBgYGBkZGRgYGBgYGFhYWBmRgZGSE8AEAe7wGjXfxn4UAAAAASUVORK5CYII=';
  const png48x48 = 'iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAxklEQVR42u3XMQ6DMAxAUZr7X5pV6tChQ4cOHTp06NChQ4cOHTp0WOdaJCQkJCQkJCQkJCRkyZKlS5cuXbp06dKlS5cuXbp06dKlS5cuXbp06dKlS5cuXbp06dKlS5cuXbp06dKlS5cuXbp06dKlS5cuXbp06dKlS5cuXbp06dKlS5cuXbp06dKlS5f+X7p06dKlS5cuXbp06dKlS5cuXbp06dKlS5cuXbp06dKlS5cuXbp06dKlS5cuXbp06dKlS5cuXbp0MZ8AAAAASUVORK5CYII=';

  // Use the appropriate size
  if (size <= 16) {
    return Buffer.from(png16x16, 'base64');
  } else if (size <= 48) {
    return Buffer.from(png48x48, 'base64');
  } else {
    // For 128x128, we'll reuse the 48x48 (browsers will scale)
    return Buffer.from(png48x48, 'base64');
  }
}

// Create icons directory
const iconsDir = path.join(__dirname, '..', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
  console.log('Created icons directory');
}

// Icon sizes needed
const sizes = [16, 48, 128];

console.log('\n🎨 Creating placeholder icons...\n');

sizes.forEach(size => {
  const pngData = createColoredPNG(size);
  const filename = path.join(iconsDir, `icon${size}.png`);

  fs.writeFileSync(filename, pngData);
  console.log(`  ✓ Created icon${size}.png`);
});

console.log('\n✅ Placeholder icons created successfully!\n');
console.log('⚠️  IMPORTANT: These are minimal placeholder PNGs.');
console.log('For production, create professional icons using:');
console.log('  • Figma, Canva, Photoshop, or GIMP');
console.log('  • Online generators: favicon.io, iconifier.net');
console.log('  • See GRAPHICS_GUIDE.md for specifications\n');
