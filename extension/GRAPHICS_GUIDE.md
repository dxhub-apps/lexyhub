# LexyHub Extension - Graphics & Assets Guide

## Required Graphics for Store Submission

### Icon Files (Required for all stores)

#### Store Icon - 128x128px
- **Format**: PNG with transparency
- **Purpose**: Display in extension store
- **Design**: Full-color LexyHub logo with background
- **File**: `icons/icon128.png`

#### Extension Icons (All sizes required)
- **16x16px**: Toolbar icon (small)
- **48x48px**: Extension management
- **128x128px**: Chrome Web Store listing
- **Format**: PNG with transparency
- **Design**: Simple, recognizable at small sizes
- **Files**: `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png`

### Screenshots (Required - 3 to 5 recommended)

#### Chrome Web Store Requirements
- **Size**: 1280x800px or 640x400px
- **Format**: PNG or JPEG
- **Max file size**: 2MB each
- **Quantity**: Minimum 1, recommended 5

#### Firefox Add-ons Requirements
- **Size**: Minimum 640x400px
- **Format**: PNG or JPEG
- **Max file size**: 5MB each
- **Aspect ratio**: Any, but 16:10 or 16:9 recommended

#### Edge Add-ons Requirements
- **Size**: 1280x800px recommended
- **Format**: PNG or JPEG
- **Quantity**: Minimum 1, maximum 10

### Promotional Graphics

#### Promotional Tile (Chrome Web Store - Optional but recommended)
- **Size**: 440x280px
- **Format**: PNG or JPEG
- **Purpose**: Featured placement in store
- **Design**: Showcase key feature with text overlay

#### Marquee Promo Tile (Chrome Web Store - Optional)
- **Size**: 1400x560px
- **Format**: PNG or JPEG
- **Purpose**: Large promotional banner

## Screenshot Content Suggestions

### Screenshot 1: Keyword Highlighting on Etsy
**Purpose**: Show the core functionality

**What to capture**:
- Etsy search results page
- Multiple keywords highlighted in different colors
- Clean, professional looking page
- 2-3 highlighted keywords visible

**Annotations to add**:
- Arrow pointing to highlighted keyword: "Watchlist keywords auto-highlight"
- Badge: "Works on Etsy, Amazon, Shopify"

### Screenshot 2: Metrics Tooltip
**Purpose**: Showcase the information density

**What to capture**:
- Mouse hovering over highlighted keyword
- Tooltip fully visible with all metrics
- Clean background

**Annotations to add**:
- Labels for each metric: "Demand", "Competition", "AI Score", "Trend"
- Caption: "Live metrics on hover"

### Screenshot 3: Extension Popup
**Purpose**: Show the extension interface

**What to capture**:
- Extension popup fully opened
- "Extension Boost" badge visible
- At least one tab active (Discover or Settings)

**Annotations to add**:
- Highlight "Extension Boost" badge
- Caption: "Quick access to all features"

### Screenshot 4: Watchlist Management
**Purpose**: Demonstrate watchlist functionality

**What to capture**:
- A page with "Add to Watchlist" action visible
- Or: Settings page showing domain toggles

**Annotations to add**:
- Arrow to "Add to Watchlist" button
- Caption: "Build your keyword library"

### Screenshot 5: Multi-Platform Support
**Purpose**: Show versatility across marketplaces

**What to capture**:
- Split screen or collage showing Etsy + Amazon + Shopify
- Each with highlighted keywords

**Annotations to add**:
- Platform logos
- Caption: "Works everywhere you research"

## Design Guidelines

### Color Palette

**Primary Colors** (from LexyHub brand):
- **Primary Purple**: `#6366f1` (indigo-500)
- **Secondary Purple**: `#8b5cf6` (violet-500)
- **Accent**: `#10b981` (emerald-500)

**UI Colors**:
- **Background**: `#f9fafb` (gray-50)
- **Text Dark**: `#1f2937` (gray-800)
- **Text Light**: `#6b7280` (gray-500)
- **Border**: `#e5e7eb` (gray-200)

### Typography

**Font Family**: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif

**Font Sizes**:
- **Headline**: 24-32px, bold
- **Subheading**: 16-20px, semibold
- **Body**: 14-16px, regular
- **Caption**: 12-13px, regular

### Icon Design

**Style**: Modern, minimal, flat design
**Stroke**: 2px consistent stroke width
**Corners**: Rounded (4-6px radius)
**Elements**:
- Magnifying glass (search/research)
- Tag/label (keywords)
- Star (highlights)
- Chart (metrics)

## Tools & Resources

### Design Tools

**Free Options**:
- **Figma** (figma.com) - Recommended, browser-based
- **Canva** (canva.com) - Easy templates
- **GIMP** (gimp.org) - Open-source Photoshop alternative
- **Inkscape** (inkscape.org) - Vector graphics

**Paid Options**:
- **Adobe Photoshop** - Industry standard
- **Sketch** (Mac only) - Popular for UI design
- **Affinity Designer** - One-time purchase

### Screenshot Tools

**Mac**:
- `Cmd + Shift + 4` - Built-in screenshot
- **CleanShot X** - Advanced screenshot tool

**Windows**:
- `Windows + Shift + S` - Built-in Snip & Sketch
- **ShareX** - Free, powerful screenshot tool

**Chrome**:
- **Full Page Screen Capture** extension
- Chrome DevTools: `Cmd/Ctrl + Shift + P` → "Capture screenshot"

### Image Optimization

**Tools**:
- **TinyPNG** (tinypng.com) - Compress PNGs
- **Squoosh** (squoosh.app) - Google's image optimizer
- **ImageOptim** (Mac) - Batch optimization

**Guidelines**:
- Compress images to reduce file size
- Maintain quality (aim for <200KB per screenshot)
- Use PNG for graphics with text
- Use JPEG for photographic screenshots

## Annotation Tools

### Adding Text & Arrows to Screenshots

**Free Tools**:
- **Skitch** (Mac) - Simple annotation
- **Flameshot** (Linux/Windows) - Screenshot + annotation
- **Paint.NET** (Windows) - Free Photoshop alternative

**Tips**:
- Use consistent arrow style
- Keep text readable (minimum 14px)
- Add subtle drop shadow for text clarity
- Use contrasting colors (white text on dark overlay)

## Asset Checklist

Before submission, ensure you have:

### Icons
- [ ] icon16.png (16x16px, PNG, transparent)
- [ ] icon48.png (48x48px, PNG, transparent)
- [ ] icon128.png (128x128px, PNG, transparent)
- [ ] store-icon.png (128x128px, PNG, branded)

### Screenshots
- [ ] Screenshot 1: Keyword highlighting (1280x800px)
- [ ] Screenshot 2: Metrics tooltip (1280x800px)
- [ ] Screenshot 3: Extension popup (1280x800px)
- [ ] Screenshot 4: Watchlist management (1280x800px)
- [ ] Screenshot 5: Multi-platform (1280x800px)

### Promotional (Optional)
- [ ] Promotional tile: 440x280px (Chrome)
- [ ] Marquee tile: 1400x560px (Chrome)

### Files Organized
- [ ] All files in `extension/assets/` directory
- [ ] Files named consistently
- [ ] Optimized for web (<200KB each)
- [ ] Correct formats (PNG/JPEG)

## Quick Start Template (Figma)

```
1. Go to Figma.com
2. Create new design file
3. Set canvas size: 1280x800px
4. Import LexyHub logo
5. Take browser screenshot of extension in use
6. Paste screenshot onto canvas
7. Add text annotations:
   - Font: Inter or Roboto
   - Size: 18px for labels
   - Color: White text with dark semi-transparent background
8. Export as PNG at 2x resolution
```

## Example Screenshot Layout

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  [Browser Window Mock]                                  │
│  ┌───────────────────────────────────────────────────┐  │
│  │ ← → ⟳  https://www.etsy.com/search?q=boho     🔍 │  │
│  ├───────────────────────────────────────────────────┤  │
│  │                                                   │  │
│  │   Search Results for "boho earrings"            │  │
│  │                                                   │  │
│  │   [Product 1]  [Product 2]  [Product 3]        │  │
│  │   Boho hoop    Vintage     Rustic bronze        │  │
│  │   ~~~~~~~~     style       ~~~~~~~~~~~~         │  │
│  │   earrings     earrings    hoops               │  │
│  │   ~~~~~~~~     ~~~~~~~~    ~~~~~               │  │
│  │                                                   │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  [Annotation]: "Watchlist keywords automatically     │
│                 highlighted on any marketplace"       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Branding Assets

### Logo Usage

If you need LexyHub logo assets:
1. Request from design team or
2. Export from website at https://lexyhub.com
3. Maintain aspect ratio
4. Minimum size: 32px height
5. Use PNG with transparency for overlays

### Brand Colors

Always use official brand colors for consistency:
- Primary: `#6366f1`
- Accent: `#10b981`
- Background: `#f9fafb`

### Voice & Tone

**In screenshots text**:
- Friendly and helpful
- Clear and concise
- Benefit-focused
- Professional but approachable

**Examples**:
✅ "See live metrics on hover"
✅ "Works on Etsy, Amazon, Shopify"
✅ "Build your keyword library"

❌ "Hover functionality enabled"
❌ "Multi-platform compatibility"
❌ "Keyword aggregation system"

## Final Checklist

Before uploading to stores:

- [ ] All images are correct dimensions
- [ ] Images are optimized (<200KB)
- [ ] Text is readable on all screenshots
- [ ] Brand colors are consistent
- [ ] No personal/sensitive information visible
- [ ] Screenshots show latest extension version
- [ ] All annotations are spelled correctly
- [ ] Images represent actual functionality
- [ ] Files are named clearly
- [ ] Backup copies saved

---

**Questions?** Contact the design team or refer to official store guidelines:
- Chrome: https://developer.chrome.com/docs/webstore/images/
- Firefox: https://extensionworkshop.com/documentation/develop/create-an-appealing-listing/
- Edge: https://docs.microsoft.com/en-us/microsoft-edge/extensions-chromium/publish/create-dev-account
