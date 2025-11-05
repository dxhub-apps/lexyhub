# LexyHub Extension - QA Checklist

## Pre-Release Testing

### Installation & Setup

- [ ] Extension installs successfully in Chrome
- [ ] Extension installs successfully in Firefox
- [ ] Extension installs successfully in Edge
- [ ] Welcome page opens on first install
- [ ] Extension icon appears in browser toolbar
- [ ] Popup opens when clicking extension icon

### Authentication

- [ ] Login flow redirects to LexyHub web app
- [ ] Auth token is stored after successful login
- [ ] Extension recognizes authenticated state
- [ ] Extension Boost badge appears for free users
- [ ] Logout clears authentication state

### Etsy Domain

- [ ] Content script loads on Etsy search results
- [ ] Content script loads on Etsy listing pages
- [ ] Watchlist keywords are highlighted
- [ ] Highlights use correct CSS styling (no layout shift)
- [ ] Hover tooltip appears over highlighted keywords
- [ ] Tooltip displays correct metrics (demand, competition, AI score, trend)
- [ ] Tooltip positions correctly near keyword
- [ ] Tooltip hides on scroll or mouse leave
- [ ] Add to Watchlist button works from tooltip
- [ ] Maximum 300 highlights per page respected

### Amazon Domain

- [ ] Content script loads on Amazon search results
- [ ] Content script loads on Amazon product pages
- [ ] Watchlist keywords are highlighted
- [ ] Tooltips work correctly
- [ ] No conflicts with Amazon's own UI elements

### Shopify Detection

- [ ] Content script detects Shopify stores correctly
- [ ] Does NOT activate on non-Shopify sites
- [ ] Highlights work on Shopify product pages
- [ ] Highlights work on Shopify collection pages
- [ ] Tooltips work correctly

### Watchlist Management

- [ ] Can add keyword to watchlist from extension
- [ ] Watchlist syncs across tabs
- [ ] Watchlist persists after browser restart
- [ ] Duplicate keywords are prevented
- [ ] Watchlist items show in popup
- [ ] Can remove keywords from watchlist

### Metrics & Tooltips

- [ ] Metrics fetch successfully from API
- [ ] Metrics are cached to reduce API calls
- [ ] Loading state shows while fetching
- [ ] Error states handled gracefully
- [ ] Metrics display in correct format
- [ ] Trend arrows show correct direction (↑↓→)
- [ ] Freshness timestamp is displayed

### Brief Generation

- [ ] Can select 2-5 keywords for brief
- [ ] Brief creation succeeds
- [ ] Brief URL is returned and valid
- [ ] Brief permalink opens in new tab

### Popup UI

- [ ] Discover tab shows detected keywords
- [ ] Session tab (placeholder)
- [ ] Briefs tab (placeholder)
- [ ] Settings tab shows domain toggles
- [ ] Settings save successfully
- [ ] Extension Boost badge displays when authenticated

### Options Page

- [ ] Options page opens from popup link
- [ ] Options page opens from browser settings
- [ ] Account status displays correctly
- [ ] Domain toggles work
- [ ] Feature toggles work
- [ ] Settings save and persist
- [ ] Clear data button works

### Background Worker

- [ ] Worker processes queue items successfully
- [ ] Worker upserts into keywords table
- [ ] Worker handles duplicates gracefully (unique constraint)
- [ ] Worker marks items as processed
- [ ] Worker logs errors appropriately
- [ ] Worker records job runs in database

### Extension Boost

- [ ] Free users with extension get boosted entitlements
- [ ] API calls include `X-Ext-Client: true` header
- [ ] Quota endpoint checks extension flag
- [ ] Boosted limits are enforced server-side

### Performance

- [ ] Page load time not significantly impacted
- [ ] No console errors or warnings
- [ ] Highlighting completes within 1 second
- [ ] Memory usage stays reasonable (<50MB)
- [ ] No memory leaks over extended use
- [ ] MutationObserver debounces correctly

### API Integration

- [ ] `/api/ext/watchlist/add` endpoint works
- [ ] `/api/ext/watchlist` endpoint returns terms
- [ ] `/api/ext/metrics/batch` endpoint returns metrics
- [ ] `/api/ext/brief` endpoint creates brief
- [ ] `/api/ext/capture` endpoint accepts events
- [ ] Rate limiting works (429 responses)
- [ ] Authentication errors handled (401 responses)

### Error Handling

- [ ] Network errors handled gracefully
- [ ] API errors show user-friendly messages
- [ ] Invalid responses don't crash extension
- [ ] CORS issues are resolved
- [ ] Timeout errors handled

### Remote Config

- [ ] Remote config fetches on startup
- [ ] Kill-switch can disable extension
- [ ] Domain-specific disabling works
- [ ] Feature flags respected
- [ ] Config caches for 15 minutes

### Security

- [ ] Extension only activates on allowed domains
- [ ] No PII is captured or sent
- [ ] API calls use Bearer token authentication
- [ ] Tokens stored securely in chrome.storage
- [ ] Rate limiting prevents abuse

### Privacy

- [ ] No page content sent to server (only terms)
- [ ] User can opt out of analytics
- [ ] Clear data removes all extension storage
- [ ] Privacy policy link present

### Cross-Browser Compatibility

- [ ] Chrome: All features work
- [ ] Firefox: All features work
- [ ] Edge: All features work
- [ ] Safari: All features work (if supported)

### Accessibility

- [ ] Keyboard navigation works
- [ ] Screen reader compatible
- [ ] Color contrast meets WCAG standards
- [ ] Focus indicators visible

### Edge Cases

- [ ] Works with ad blockers enabled
- [ ] Works with other extensions installed
- [ ] Handles empty watchlist gracefully
- [ ] Handles API unavailability
- [ ] Works in incognito/private mode (if permissions granted)

### Store Submission

- [ ] Screenshots prepared (1280x800 or 640x400)
- [ ] Store description written
- [ ] Privacy policy published
- [ ] Support URL set
- [ ] Icons exported (16x16, 48x48, 128x128)
- [ ] Promotional graphics created
- [ ] Store listing reviewed

## Post-Release Monitoring

- [ ] Error tracking configured
- [ ] Usage analytics dashboard set up
- [ ] User feedback channel established
- [ ] Update mechanism tested
- [ ] Rollback plan prepared

## Known Issues

_Document any known issues or limitations here_

---

**Test Date**: _____________
**Tester**: _____________
**Version**: _____________
**Browser**: _____________
**OS**: _____________
