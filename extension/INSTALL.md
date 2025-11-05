# LexyHub Extension - Installation Guide

## ✅ Build Status

The extension has been successfully built and is ready for testing!

## 🚀 Quick Install (Developer Mode)

### Chrome / Edge / Brave

1. **Open Extensions Page**
   ```
   Chrome: chrome://extensions/
   Edge:   edge://extensions/
   Brave:  brave://extensions/
   ```

2. **Enable Developer Mode**
   - Toggle "Developer mode" switch in the top-right corner

3. **Load Extension**
   - Click "Load unpacked"
   - Navigate to: `D:\Alex\lexyhub\extension\dist\chrome`
   - Click "Select Folder"

4. **Verify Installation**
   - Extension icon should appear in toolbar
   - Extension card shows "LexyHub Extension"
   - Status: "Loaded (unpacked)"

### Firefox

1. **Open Debugging Page**
   ```
   about:debugging#/runtime/this-firefox
   ```

2. **Load Temporary Add-on**
   - Click "Load Temporary Add-on..."
   - Navigate to: `D:\Alex\lexyhub\extension\dist\chrome`
   - Select `manifest.json`

3. **Verify Installation**
   - Extension appears in add-ons list
   - Icon visible in toolbar

**Note**: Firefox temporary add-ons are removed when browser closes. For persistent installation, sign the extension at addons.mozilla.org.

## 🧪 Testing the Extension

### 1. Check Extension Loads

After installation:
- ✅ No errors in extensions page
- ✅ Icon visible in browser toolbar
- ✅ No console errors

### 2. Open Popup

1. Click the LexyHub icon in toolbar
2. Should see popup with:
   - Header "LexyHub"
   - Tabs: Discover, Session, Briefs, Settings
   - "Sign In" button (if not authenticated)

### 3. Test on Marketplaces

**Etsy Test:**
1. Visit: https://www.etsy.com/search?q=boho+earrings
2. Open browser console (F12)
3. Check for LexyHub logs:
   ```
   [LexyHub Etsy] Content script initialized
   ```
4. If authenticated and watchlist has keywords, they should be highlighted

**Amazon Test:**
1. Visit: https://www.amazon.com/s?k=wireless+mouse
2. Check console for initialization logs
3. Verify no errors

**Shopify Test:**
1. Visit any Shopify store (e.g., https://shop.tesla.com)
2. Check console for:
   ```
   [LexyHub Shopify] Content script initialized
   [LexyHub Shopify] Shopify store detected
   ```

## 🔧 Troubleshooting

### Extension Won't Load

**Error: "Manifest file is invalid"**
- Rebuild extension: `npm run build:chrome`
- Check `manifest.json` syntax

**Error: "Could not load icon"**
- Icons should be auto-generated during build
- Verify `dist/chrome/icons/` contains:
  - icon16.png
  - icon48.png
  - icon128.png

**Error: "Cannot find module"**
- Run: `npm install`
- Rebuild: `npm run build:chrome`

### Content Scripts Not Working

**No console logs on marketplace pages:**

1. Check if domain is enabled:
   - Click extension icon
   - Go to Settings tab
   - Verify Etsy/Amazon/Shopify are checked

2. Refresh the page after enabling

3. Check manifest host_permissions:
   - Should include `https://www.etsy.com/*`
   - Should include `https://www.amazon.com/*`

### Authentication Issues

The extension requires a LexyHub account:

1. **Create Account** (if you don't have one):
   - Visit: https://app.lexyhub.com
   - Sign up for free account

2. **Sign In via Extension**:
   - Click extension icon
   - Click "Sign In"
   - You'll be redirected to web app
   - Sign in with your credentials
   - Return to extension

**Note**: For local development, the auth flow expects the web app to be running at `https://app.lexyhub.com`. If testing locally, you may need to:
- Update the API base URL in `src/lib/api-client.ts`
- Set up local authentication flow
- Or use production API for testing

## 📦 Rebuild After Changes

If you make changes to the code:

```bash
# From extension directory
npm run build:chrome    # For Chrome/Edge
npm run build:firefox   # For Firefox
```

Then reload the extension:
- **Chrome/Edge**: Go to `chrome://extensions/` and click reload icon ↻
- **Firefox**: Remove and re-add the temporary add-on

## 🐛 Known Issues

### Icons are Placeholders

The current icons are minimal PNG files. For production:
1. Create proper icons (see `GRAPHICS_GUIDE.md`)
2. Replace files in `extension/icons/`
3. Rebuild extension

### API Endpoints May Not Exist

The extension expects these API endpoints to be live:
- `/api/ext/watchlist/add`
- `/api/ext/watchlist`
- `/api/ext/metrics/batch`
- `/api/ext/brief`

If testing locally:
1. Ensure backend server is running
2. Database migrations are applied
3. API routes are accessible

To check backend:
```bash
# From project root
curl http://localhost:3000/api/ext/watchlist \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Watchlist Features Require Authentication

Highlights won't appear until:
1. User is signed in
2. User has keywords in watchlist
3. Visiting a supported marketplace

## 📊 Build Output Structure

```
dist/chrome/
├── manifest.json           # Extension manifest
├── background.js           # Background service worker (bundled)
├── icons/
│   ├── icon16.png         # 16x16 toolbar icon
│   ├── icon48.png         # 48x48 management icon
│   └── icon128.png        # 128x128 store icon
├── content/
│   ├── etsy.js           # Etsy content script (bundled)
│   ├── amazon.js         # Amazon content script (bundled)
│   ├── shopify.js        # Shopify content script (bundled)
│   └── styles.css        # Highlight & tooltip styles
├── popup/
│   ├── index.html        # Popup UI
│   └── popup.js          # Popup logic
└── options/
    ├── index.html        # Options page UI
    └── options.js        # Options page logic
```

## 🚨 Common Errors & Solutions

### "Failed to load extension"
→ Check all files are present in dist directory
→ Rebuild: `npm run build:chrome`

### "Service worker registration failed"
→ Check `background.js` exists
→ Verify manifest.json background.service_worker path

### Content scripts not injecting
→ Verify manifest.json content_scripts matches are correct
→ Check host_permissions includes the domain
→ Reload the target page after loading extension

### Popup doesn't open
→ Check popup/index.html and popup.js exist
→ Open browser console when clicking icon for errors
→ Verify manifest.json action.default_popup path

## ✅ Verification Checklist

Before considering the extension ready for testing:

- [ ] Extension loads without errors
- [ ] Popup opens and shows UI
- [ ] Settings page accessible
- [ ] Console shows content script logs on Etsy
- [ ] Console shows content script logs on Amazon
- [ ] No manifest errors
- [ ] Icons display correctly in toolbar
- [ ] Build process completes successfully

## 📝 Next Steps

1. **Fix Icon Placeholders**: Create professional icons
2. **Test Authentication**: Set up auth flow with backend
3. **Test Watchlist**: Add keywords and verify highlights
4. **Test Tooltips**: Hover over highlights for metrics
5. **Backend Integration**: Ensure all API endpoints work
6. **Apply Migration**: Run database migration for extension tables

## 📞 Support

If you encounter issues:

1. Check browser console (F12) for errors
2. Check extension's service worker console:
   - Chrome: `chrome://extensions/` → Extension details → "service worker"
3. Review build output for warnings
4. Verify all dependencies installed: `npm install`

For development questions, see:
- `README.md` - Architecture overview
- `USER_GUIDE.md` - User documentation
- `QA_CHECKLIST.md` - Testing procedures
- `GRAPHICS_GUIDE.md` - Icon specifications

---

**Extension Location**: `D:\Alex\lexyhub\extension\dist\chrome`

**Build Command**: `npm run build:chrome`

**Reload**: Click ↻ on extension card in `chrome://extensions/`
