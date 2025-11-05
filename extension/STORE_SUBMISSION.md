# LexyHub Extension - Store Submission Guide

## Overview

This guide covers the submission process for distributing the LexyHub extension through official browser stores.

## Store Accounts Setup

### Chrome Web Store
1. Visit: https://chrome.google.com/webstore/devcenter/register
2. Sign in with Google account
3. Pay one-time $5 developer registration fee
4. Agree to developer agreement

### Firefox Add-ons
1. Visit: https://addons.mozilla.org/developers/
2. Create Firefox account (free)
3. Agree to developer policies

### Microsoft Edge Add-ons
1. Visit: https://partner.microsoft.com/dashboard/microsoftedge/overview
2. Sign in with Microsoft account (free)
3. Complete registration

## Pre-Submission Checklist

### Required Assets

- [ ] Extension ZIP file (built and tested)
- [ ] Icon files: 16x16, 48x48, 128x128 PNG
- [ ] Store icon: 128x128 PNG (branded)
- [ ] Promotional images: 1280x800 or 640x400 (3-5 screenshots)
- [ ] Promotional tile: 440x280 PNG (Chrome only)
- [ ] Privacy policy URL: https://lexyhub.com/privacy
- [ ] Support URL: https://lexyhub.com/support
- [ ] Homepage URL: https://app.lexyhub.com

### Store Listing Content

**Short Description** (132 characters max):
```
Free keyword research extension for Etsy, Amazon & Shopify. Capture keywords, track watchlists, get live metrics on-page.
```

**Full Description** (see STORE_LISTING.md)

**Category**: Productivity / Shopping

**Language**: English (US)

**Age Rating**: Everyone

### Privacy & Permissions

**Privacy Policy**: Must be hosted at https://lexyhub.com/privacy

**Permissions Justification**:
- `storage`: Store user preferences and cached data
- `activeTab`: Highlight keywords on current page
- `scripting`: Inject content scripts for highlighting
- `cookies`: Maintain authentication state
- `host_permissions`: Access marketplace domains (Etsy, Amazon, Shopify)

## Build for Submission

### 1. Build Production Version

```bash
cd extension
npm install
npm run build:chrome    # For Chrome/Edge
npm run build:firefox   # For Firefox
```

### 2. Create ZIP Package

```bash
# Chrome/Edge
cd dist/chrome
zip -r ../../lexyhub-chrome-v1.0.0.zip .

# Firefox
cd dist/firefox
zip -r ../../lexyhub-firefox-v1.0.0.zip .
```

### 3. Verify Package

- Test the ZIP in browser before submission
- Ensure all files are included
- Check manifest.json is valid
- Test core functionality

## Chrome Web Store Submission

### Step-by-Step

1. **Login to Developer Dashboard**
   - Visit: https://chrome.google.com/webstore/devcenter/dashboard

2. **Create New Item**
   - Click "New Item"
   - Upload `lexyhub-chrome-v1.0.0.zip`
   - Click "Upload"

3. **Store Listing**
   - **Product Name**: LexyHub - Keyword Research Extension
   - **Summary**: [Use short description above]
   - **Description**: [Use full description from STORE_LISTING.md]
   - **Category**: Productivity
   - **Language**: English

4. **Privacy**
   - **Privacy Policy**: https://lexyhub.com/privacy
   - **Single Purpose**: Keyword research and tracking for e-commerce sellers
   - **Permission Justification**: [Provide detailed justification for each permission]
   - **Remote Code**: None
   - **Data Usage**: Only captures keyword terms (no PII)

5. **Graphics**
   - **Store Icon**: Upload 128x128 PNG
   - **Screenshots**: Upload 3-5 screenshots (1280x800)
   - **Promotional Tile**: Upload 440x280 PNG
   - **Video**: (Optional) YouTube demo

6. **Distribution**
   - **Visibility**: Public
   - **Regions**: All regions
   - **Pricing**: Free

7. **Submit for Review**
   - Click "Submit for Review"
   - Review typically takes 1-3 business days

## Firefox Add-ons Submission

### Step-by-Step

1. **Login to Add-on Developer Hub**
   - Visit: https://addons.mozilla.org/developers/addon/submit/distribution

2. **Upload Version**
   - Click "Upload a New Version"
   - Upload `lexyhub-firefox-v1.0.0.zip`

3. **Source Code** (if minified)
   - Firefox requires source code if extension is minified
   - Upload source ZIP with build instructions
   - Include README with build steps

4. **Add-on Details**
   - **Name**: LexyHub - Keyword Research Extension
   - **Summary**: [Use short description above]
   - **Description**: [Use full description]
   - **Categories**: Shopping, Productivity
   - **Support Email**: support@lexyhub.com
   - **Support Website**: https://lexyhub.com/support
   - **Homepage**: https://app.lexyhub.com
   - **Privacy Policy**: https://lexyhub.com/privacy

5. **Graphics**
   - **Icon**: Upload 128x128 PNG
   - **Screenshots**: Upload 3-5 screenshots (640x400 or larger)

6. **Technical Details**
   - **License**: MIT
   - **This add-on is experimental**: No
   - **Requires payment**: No

7. **Submit**
   - Click "Submit Version"
   - Automated validation runs first
   - Manual review takes 2-5 business days

## Edge Add-ons Submission

### Step-by-Step

1. **Login to Partner Center**
   - Visit: https://partner.microsoft.com/dashboard/microsoftedge/overview

2. **Submit New Extension**
   - Click "New Extension"
   - Upload `lexyhub-chrome-v1.0.0.zip` (same as Chrome)

3. **Properties**
   - **Display Name**: LexyHub - Keyword Research Extension
   - **Short Description**: [Use short description]
   - **Description**: [Use full description]
   - **Category**: Productivity
   - **Privacy Policy URL**: https://lexyhub.com/privacy
   - **Website**: https://app.lexyhub.com

4. **Store Listings**
   - **Icon**: Upload 128x128 PNG
   - **Screenshots**: Upload 3-5 screenshots (1280x800)

5. **Submission Options**
   - **Publishing Hold**: None
   - **Notes for Certification**: [Provide test account if needed]

6. **Submit**
   - Click "Publish"
   - Review takes 1-3 business days

## Post-Submission

### Monitoring

- Check email for review updates
- Monitor developer dashboard for status
- Respond to reviewer questions within 7 days

### Common Rejection Reasons

1. **Privacy Policy Missing**: Must be accessible and comprehensive
2. **Permissions Not Justified**: Explain why each permission is needed
3. **Functionality Issues**: Extension must work as described
4. **Misleading Description**: Must accurately describe features
5. **Trademark Issues**: Don't use copyrighted terms without permission

### If Rejected

1. Read rejection reason carefully
2. Fix the issues mentioned
3. Update version number (e.g., 1.0.0 → 1.0.1)
4. Re-submit with explanation of changes

## After Approval

### Installation Links

Once approved, users can install from:

- **Chrome**: `https://chrome.google.com/webstore/detail/[extension-id]`
- **Firefox**: `https://addons.mozilla.org/firefox/addon/lexyhub`
- **Edge**: `https://microsoftedge.microsoft.com/addons/detail/[extension-id]`

### Update Extension Website

Add "Install Extension" buttons to:
- https://lexyhub.com
- https://app.lexyhub.com
- Marketing materials

### Monitor Metrics

- **Installs**: Track daily/weekly/monthly installs
- **Active Users**: Monitor DAU/MAU
- **Ratings**: Respond to user reviews
- **Uninstalls**: Track uninstall rate and reasons

### Updates

When releasing updates:
1. Increment version in `manifest.json`
2. Build new package
3. Upload to stores
4. Include change log
5. Updates auto-deploy to users (usually within 24 hours)

## Alternative Distribution (Pre-Store Approval)

### Self-Hosted Installation (Beta Testing)

**Chrome/Edge:**
1. Host ZIP file: `https://lexyhub.com/downloads/lexyhub-extension.zip`
2. Users download and extract
3. Navigate to `chrome://extensions/`
4. Enable "Developer mode"
5. Click "Load unpacked"
6. Select extracted folder

**Firefox:**
1. Host XPI file: `https://lexyhub.com/downloads/lexyhub-extension.xpi`
2. Users download XPI
3. Firefox prompts to install
4. Note: Self-hosted Firefox extensions require signing at AMO

### Internal/Beta Distribution

**Chrome Web Store:**
- Can publish as "Unlisted" for testing
- Share direct link with beta testers
- Not searchable in store

**Firefox Add-ons:**
- Use "Unlisted" distribution channel
- Generate download link
- Share with beta testers

## Support Resources

### Documentation

- **User Guide**: https://docs.lexyhub.com/extension
- **FAQ**: https://lexyhub.com/faq
- **Troubleshooting**: https://docs.lexyhub.com/extension/troubleshooting

### Support Channels

- **Email**: support@lexyhub.com
- **GitHub Issues**: https://github.com/dxhub-apps/lexyhub/issues
- **Discord**: (if applicable)

## Legal Requirements

### Privacy Policy

Must include:
- What data is collected (keyword terms only)
- How data is used (research and analytics)
- Data retention policies
- User rights (GDPR compliance)
- Contact information

### Terms of Service

Must include:
- Acceptable use policy
- Service limitations
- Disclaimer of warranties
- Limitation of liability

## Timeline Estimates

| Stage | Chrome | Firefox | Edge |
|-------|--------|---------|------|
| Account Setup | 1 hour | 30 min | 1 hour |
| Prepare Assets | 4-8 hours | 4-8 hours | 4-8 hours |
| Upload & Submit | 1 hour | 1 hour | 1 hour |
| Review Process | 1-3 days | 2-5 days | 1-3 days |
| **Total** | **2-4 days** | **3-6 days** | **2-4 days** |

## Maintenance

### Regular Updates

- **Monthly**: Check for browser API changes
- **Quarterly**: Update dependencies, security patches
- **Annually**: Refresh screenshots and descriptions

### Compliance

- Monitor Chrome Web Store policies
- Update privacy policy as needed
- Maintain GDPR compliance
- Respond to DMCA/trademark claims

---

**Next Steps:**
1. Create store graphics (icons, screenshots)
2. Write privacy policy
3. Set up store accounts
4. Build production packages
5. Submit to all stores simultaneously
6. Monitor for approval
7. Announce launch!
