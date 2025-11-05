#!/usr/bin/env node
// extension/scripts/build.js
/**
 * Build script for LexyHub extension
 * Supports multiple browsers: chrome, firefox, safari
 */

const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const target = process.argv[2] || 'chrome';
const distDir = path.join(__dirname, '..', 'dist', target);

console.log(`Building extension for ${target}...`);

// Clean dist directory
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true });
}
fs.mkdirSync(distDir, { recursive: true });

// Copy static files
const staticFiles = [
  'manifest.json',
  'popup/index.html',
  'popup/popup.js',
  'options/index.html',
  'options/options.js',
  'src/content/styles.css',
];

staticFiles.forEach(file => {
  const src = path.join(__dirname, '..', file);
  const dest = path.join(distDir, file);

  // Create directory if needed
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`  ✓ Copied ${file}`);
  } else {
    console.warn(`  ⚠ Missing ${file}`);
  }
});

// Create icons directory (placeholder for now)
const iconsDir = path.join(distDir, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Build TypeScript files with esbuild
const entryPoints = [
  { in: 'src/background/index.ts', out: 'background' },
  { in: 'src/content/etsy.ts', out: 'content/etsy' },
  { in: 'src/content/amazon.ts', out: 'content/amazon' },
  { in: 'src/content/shopify.ts', out: 'content/shopify' },
];

const buildPromises = entryPoints.map(entry => {
  return esbuild.build({
    entryPoints: [path.join(__dirname, '..', entry.in)],
    bundle: true,
    outfile: path.join(distDir, `${entry.out}.js`),
    format: 'iife',
    target: 'es2020',
    minify: true,
    sourcemap: false,
    logLevel: 'info',
  }).then(() => {
    console.log(`  ✓ Built ${entry.out}.js`);
  }).catch(err => {
    console.error(`  ✗ Failed to build ${entry.out}.js:`, err);
    process.exit(1);
  });
});

Promise.all(buildPromises).then(() => {
  console.log(`\n✓ Build completed for ${target}!`);
  console.log(`Output: ${distDir}`);
}).catch(err => {
  console.error('\n✗ Build failed:', err);
  process.exit(1);
});
