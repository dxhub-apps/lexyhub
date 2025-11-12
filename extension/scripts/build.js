#!/usr/bin/env node
// extension/scripts/build.js
/**
 * Build script for LexyHub extension
 * Supports multiple browsers: chrome, firefox, safari
 */

const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const { execSync } = require('child_process');

const target = process.argv[2] || 'chrome';
const distDir = path.join(__dirname, '..', 'dist', target);

console.log(`\n🔨 Building LexyHub Extension for ${target}...\n`);

// Clean dist directory
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true });
}
fs.mkdirSync(distDir, { recursive: true });

// Check if icons exist, if not generate them
const iconsSourceDir = path.join(__dirname, '..', 'icons');
const icon16 = path.join(iconsSourceDir, 'icon16.png');

if (!fs.existsSync(icon16)) {
  console.log('📦 Icons not found. Generating placeholder icons...\n');
  try {
    execSync('node scripts/create-placeholder-icons.js', {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    });
  } catch (err) {
    console.error('Failed to generate icons:', err.message);
    process.exit(1);
  }
}

// Copy static files
console.log('📋 Copying static files...\n');

const staticFiles = [
  'manifest.json',
  'popup/popup.html',
  'popup/popup.js',
  'popup/popup.css',
  'options/options.html',
  'options/options.js',
  'options/options.css',
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
    console.warn(`  ⚠  Missing ${file}`);
  }
});

// Copy content styles
const contentStylesSrc = path.join(__dirname, '..', 'src', 'content', 'styles.css');
const contentStylesDest = path.join(distDir, 'content', 'styles.css');
if (fs.existsSync(contentStylesSrc)) {
  const contentDir = path.join(distDir, 'content');
  if (!fs.existsSync(contentDir)) {
    fs.mkdirSync(contentDir, { recursive: true });
  }
  fs.copyFileSync(contentStylesSrc, contentStylesDest);
  console.log(`  ✓ Copied src/content/styles.css`);
} else {
  console.warn(`  ⚠  Missing src/content/styles.css`);
}

// Copy icons
console.log('\n🎨 Copying icons...\n');
const iconsDestDir = path.join(distDir, 'icons');
if (!fs.existsSync(iconsDestDir)) {
  fs.mkdirSync(iconsDestDir, { recursive: true });
}

const iconSizes = [16, 48, 128];
iconSizes.forEach(size => {
  const iconFile = `icon${size}.png`;
  const src = path.join(iconsSourceDir, iconFile);
  const dest = path.join(iconsDestDir, iconFile);

  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`  ✓ Copied icons/${iconFile}`);
  } else {
    console.error(`  ✗ Missing icons/${iconFile}`);
    process.exit(1);
  }
});

// Build TypeScript files with esbuild
console.log('\n⚙️  Building TypeScript files...\n');

const entryPoints = [
  { in: 'src/background/index.ts', out: 'background' },
  { in: 'src/content/etsy.ts', out: 'content/etsy' },
  { in: 'src/content/amazon.ts', out: 'content/amazon' },
  { in: 'src/content/shopify.ts', out: 'content/shopify' },
  { in: 'src/content/google.ts', out: 'content/google' },
  { in: 'src/content/bing.ts', out: 'content/bing' },
  { in: 'src/content/pinterest.ts', out: 'content/pinterest' },
  { in: 'src/content/reddit.ts', out: 'content/reddit' },
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
    logLevel: 'error', // Only show errors
  }).then(() => {
    console.log(`  ✓ Built ${entry.out}.js`);
  }).catch(err => {
    console.error(`  ✗ Failed to build ${entry.out}.js:`);
    console.error(err.message);
    process.exit(1);
  });
});

Promise.all(buildPromises).then(() => {
  console.log('\n✅ Build completed successfully!\n');
  console.log(`📁 Output directory: ${distDir}`);
  console.log('\n🚀 Next steps:');
  console.log(`   1. Open Chrome and go to: chrome://extensions/`);
  console.log(`   2. Enable "Developer mode" (top right)`);
  console.log(`   3. Click "Load unpacked"`);
  console.log(`   4. Select: ${distDir}\n`);
}).catch(err => {
  console.error('\n✗ Build failed:', err.message);
  process.exit(1);
});
