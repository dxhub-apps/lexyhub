# Logo and Favicon Setup Guide

This guide provides instructions for uploading your logo and favicon files to the LexyHub application.

## 📁 File Upload Locations

### 1. Main Web Application Logos

Upload the following files to the **`public/logos/`** directory:

```
public/logos/
├── Lexyhub_logo_dark.svg    ← Dark logo for LIGHT theme (expanded sidebar)
├── Lexyhub_logo_white.svg   ← White logo for DARK theme (expanded sidebar)
└── lexyhub_icon.svg         ← Icon-only version (collapsed sidebar, both themes)
```

**Usage:**
- `Lexyhub_logo_dark.svg` - Displayed on the expanded sidebar when using **light theme**
- `Lexyhub_logo_white.svg` - Displayed on the expanded sidebar when using **dark theme**
- `lexyhub_icon.svg` - Displayed when the sidebar is collapsed (works on both themes)

**Implementation:** See `src/components/layout/Sidebar.tsx:72-92`

---

### 2. Web Application Favicons

Upload the favicon file to the **`public/`** directory:

```
public/
└── favicon.png              ← Main favicon (recommended: 32x32 or 48x48)
```

**Optional:** For better browser support, you can also provide these additional sizes:

```
public/
├── favicon.png              ← Main favicon (32x32 or 48x48)
├── favicon-16x16.png        ← 16x16 size variant
├── favicon-32x32.png        ← 32x32 size variant
└── apple-touch-icon.png     ← 180x180 for iOS devices
```

**Implementation:** See `src/app/layout.tsx:10-19`

---

### 3. Chrome Extension Icons

Replace the placeholder icons in the **`extension/icons/`** directory:

```
extension/icons/
├── icon16.png               ← 16x16 (browser toolbar icon)
├── icon48.png               ← 48x48 (extension management page)
└── icon128.png              ← 128x128 (Chrome Web Store listing)
```

**Note:** You can generate these from your `favicon.png` file. The extension expects PNG format.

**To generate extension icons from favicon:**
```bash
# If you have ImageMagick installed:
convert favicon.png -resize 16x16 extension/icons/icon16.png
convert favicon.png -resize 48x48 extension/icons/icon48.png
convert favicon.png -resize 128x128 extension/icons/icon128.png
```

**Implementation:** See `extension/manifest.json:6-9` and `extension/manifest.json:91-95`

---

## 🎨 Design Specifications

Based on the project's design guidelines (`extension/GRAPHICS_GUIDE.md`):

**Color Palette:**
- Primary Purple: `#6366f1`
- Secondary Purple: `#8b5cf6`
- Accent Green: `#10b981`

**Logo Requirements:**
- SVG format for web logos (scalable, crisp at any size)
- PNG format for favicons and extension icons
- Transparent backgrounds recommended
- Ensure sufficient contrast for both light and dark themes

**Recommended Sizes:**
- Expanded sidebar logo: ~140px width, 32px height
- Collapsed sidebar icon: 32x32px
- Favicons: 16x16, 32x32, 48x48, 180x180 (apple)
- Extension icons: 16x16, 48x48, 128x128 (required)

---

## ✅ Quick Upload Checklist

- [ ] Upload `Lexyhub_logo_dark.svg` to `public/logos/`
- [ ] Upload `Lexyhub_logo_white.svg` to `public/logos/`
- [ ] Upload `lexyhub_icon.svg` to `public/logos/`
- [ ] Upload `favicon.png` to `public/`
- [ ] (Optional) Generate and upload additional favicon sizes to `public/`
- [ ] Generate PNG icons from favicon
- [ ] Replace `extension/icons/icon16.png`
- [ ] Replace `extension/icons/icon48.png`
- [ ] Replace `extension/icons/icon128.png`

---

## 🔄 After Uploading Files

### For Web Application:
1. Restart the Next.js development server (if running):
   ```bash
   npm run dev
   ```
2. Clear browser cache or do a hard refresh (Ctrl+Shift+R / Cmd+Shift+R)
3. Navigate to `/dashboard` to see the logo in the sidebar
4. Toggle the theme (light/dark) to verify both logo variants
5. Toggle the sidebar collapse to verify the icon-only version

### For Chrome Extension:
1. Rebuild the extension:
   ```bash
   npm run extension:build
   ```
2. In Chrome, navigate to `chrome://extensions/`
3. Click the reload button on the LexyHub Extension card
4. Check the toolbar icon and popup to verify the new icons

---

## 📝 File Structure Summary

```
/home/user/lexyhub/
├── public/                          ← Created and ready
│   ├── favicon.png                  ← UPLOAD HERE
│   ├── favicon-16x16.png            ← UPLOAD HERE (optional)
│   ├── favicon-32x32.png            ← UPLOAD HERE (optional)
│   ├── apple-touch-icon.png         ← UPLOAD HERE (optional)
│   └── logos/                       ← Created and ready
│       ├── Lexyhub_logo_dark.svg    ← UPLOAD HERE (for light theme)
│       ├── Lexyhub_logo_white.svg   ← UPLOAD HERE (for dark theme)
│       └── lexyhub_icon.svg         ← UPLOAD HERE (collapsed sidebar)
├── extension/
│   └── icons/                       ← Existing directory
│       ├── icon16.png               ← REPLACE THIS
│       ├── icon48.png               ← REPLACE THIS
│       └── icon128.png              ← REPLACE THIS
└── src/
    ├── app/
    │   └── layout.tsx               ← Updated ✓
    └── components/
        └── layout/
            └── Sidebar.tsx          ← Updated ✓
```

---

## 🚀 Code Changes Summary

The following files have been updated to support your logo and favicon:

1. **`src/components/layout/Sidebar.tsx`**
   - Added `Image` component from Next.js
   - Added `useTheme` hook for theme detection
   - Implemented dynamic logo switching based on theme
   - Uses `Lexyhub_logo_white.svg` for dark theme
   - Uses `Lexyhub_logo_dark.svg` for light theme
   - Uses `lexyhub_icon.svg` when sidebar is collapsed

2. **`src/app/layout.tsx`**
   - Added favicon metadata configuration
   - Supports multiple favicon sizes for better browser compatibility
   - Includes apple-touch-icon for iOS devices

3. **Directory Structure**
   - Created `public/` directory (required by Next.js)
   - Created `public/logos/` subdirectory for logo assets
   - Both directories are ready to receive your files

---

## 💡 Tips

- **SVG files** are preferred for logos as they scale perfectly at any size
- **PNG files** are required for favicons and extension icons
- Test both **light and dark themes** to ensure proper contrast
- Verify the **collapsed sidebar** shows the icon-only version correctly
- Check the **browser tab** to confirm the favicon displays properly
- For the extension, ensure icons are **square** and **centered**

---

## ❓ Need Help?

- Design guidelines: See `extension/GRAPHICS_GUIDE.md`
- Sidebar implementation: `src/components/layout/Sidebar.tsx`
- Favicon configuration: `src/app/layout.tsx`
- Extension manifest: `extension/manifest.json`

---

**Ready to upload!** Simply place your files in the locations specified above. 🎉
