# Multi-Platform Keyword Pipeline - TODO List & Next Steps

**Created**: 2025-11-06
**Status**: Implementation Complete, Ready for Deployment
**Branch**: `claude/populate-keyword-data-011CUrAMvLjhbGWTMcj4bqg4`

---

## ✅ Completed (Implementation Phase)

### Database Layer
- [x] Create `social_platform_trends` table for detailed platform tracking
- [x] Create `user_keyword_watchlists` table for user monitoring
- [x] Create `api_usage_tracking` table for rate limit management
- [x] Add social metrics columns to `keyword_metrics_daily`
- [x] Create helper functions (`is_feature_enabled`, `get_feature_config`, `track_api_usage`)
- [x] Add RLS policies for watchlists
- [x] Seed feature flags for all platforms

### Platform Collectors
- [x] **Reddit Collector** - Enhanced with sentiment analysis
  - [x] Expand to 19 subreddits
  - [x] Enable comments by default
  - [x] Add sentiment analysis (no external API)
  - [x] Track subreddit diversity
  - [x] Store social metrics in new tables

- [x] **Twitter Collector** - Free tier implementation
  - [x] Hashtag tracking
  - [x] Smart rate limiting (1,500/month)
  - [x] Sentiment analysis
  - [x] API usage tracking

- [x] **Pinterest Collector** - Free tier with high intent signals
  - [x] Category rotation
  - [x] Seasonal detection
  - [x] Board diversity tracking
  - [x] Save count weighting (3x)

- [x] **Google Trends Collector** - Free unlimited
  - [x] Interest over time
  - [x] Related queries
  - [x] Momentum calculation

- [x] **TikTok Collector** - Ready but disabled
  - [x] Web scraping implementation
  - [x] Official API support (when key available)
  - [x] Feature flag control

### Aggregation & Analysis Jobs
- [x] **Social Metrics Aggregator** - Hourly combination of all platforms
  - [x] Weighted scoring by platform
  - [x] Multi-platform validation
  - [x] Sentiment averaging
  - [x] Dominant platform detection

- [x] **Hourly Keyword Refresh** - Prioritized updates
  - [x] 50% budget for watched keywords
  - [x] 50% budget for active keywords
  - [x] Up to 500 keywords/hour

- [x] **Watchlist Momentum Monitor** - Notification system
  - [x] Surge alerts (momentum > 15%)
  - [x] Cooling alerts (momentum < -10%)
  - [x] 24-hour deduplication
  - [x] Business hours frequency (15 min)

### Workflows & Configuration
- [x] Create 7 GitHub workflows
  - [x] twitter-trends-collector.yml
  - [x] pinterest-trends-collector.yml
  - [x] google-trends-collector.yml
  - [x] social-metrics-aggregator.yml
  - [x] hourly-keyword-refresh.yml
  - [x] watchlist-momentum-monitor.yml
  - [x] tiktok-trends-collector.yml (disabled)

- [x] Create master configuration (`config/social-platforms.yml`)
- [x] Expand Reddit configuration (`config/reddit.yml`)
- [x] Update package.json with new scripts
- [x] Fix feature_flags column naming compatibility

### Documentation
- [x] Comprehensive pipeline documentation
- [x] Database schema documentation
- [x] Platform collector details
- [x] Workflow scheduling guide
- [x] Setup & deployment guide
- [x] Troubleshooting guide
- [x] This TODO list

---

## 🚀 Immediate Next Steps (Week 1)

### Setup & Configuration

- [ ] **Add GitHub Secrets** (5 min)
  ```bash
  gh secret set SUPABASE_URL
  gh secret set SUPABASE_SERVICE_ROLE_KEY
  gh secret set TWITTER_BEARER_TOKEN
  gh secret set PINTEREST_ACCESS_TOKEN
  gh secret set REDDIT_ACCESS_TOKEN  # Optional
  ```

  How to get tokens:
  - Twitter: https://developer.twitter.com/en/portal/dashboard → Create App → Get Bearer Token
  - Pinterest: https://developers.pinterest.com/ → Create App → Get Access Token
  - Reddit: https://www.reddit.com/prefs/apps → Create App → Get Token

- [ ] **Run Database Migration** (2 min)
  ```bash
  supabase db push
  # Or: psql $DATABASE_URL -f supabase/migrations/0031_social_metrics_and_watchlist.sql
  ```

- [ ] **Verify Migration** (1 min)
  ```sql
  -- Check tables exist
  SELECT tablename FROM pg_tables
  WHERE schemaname = 'public'
  AND tablename IN ('social_platform_trends', 'user_keyword_watchlists', 'api_usage_tracking');

  -- Check feature flags
  SELECT key, is_enabled FROM feature_flags WHERE key LIKE '%_collection';
  ```

### Testing & Validation

- [ ] **Test Individual Collectors Locally** (30 min)
  ```bash
  # Set environment variables
  export SUPABASE_URL="..."
  export SUPABASE_SERVICE_ROLE_KEY="..."
  export TWITTER_BEARER_TOKEN="..."
  export PINTEREST_ACCESS_TOKEN="..."

  # Test each collector
  npm run social:reddit
  npm run social:twitter
  npm run social:pinterest
  npm run social:google-trends
  ```

  **Success Criteria:**
  - No errors in console
  - Data appears in `social_platform_trends` table
  - Keywords upserted in `keywords` table

- [ ] **Manually Trigger Workflows** (10 min)
  ```bash
  gh workflow run twitter-trends-collector.yml
  gh workflow run pinterest-trends-collector.yml
  gh workflow run google-trends-collector.yml
  gh workflow run reddit-discovery.yml
  ```

  **Success Criteria:**
  - Workflows complete successfully
  - Check logs in GitHub Actions
  - Verify data in database

- [ ] **Test Aggregation** (5 min)
  ```bash
  gh workflow run social-metrics-aggregator.yml
  ```

  Then check:
  ```sql
  SELECT * FROM keyword_metrics_daily
  WHERE source = 'social_aggregate'
  ORDER BY collected_on DESC
  LIMIT 10;
  ```

### Monitoring Setup

- [ ] **Create Monitoring Dashboard** (30 min)
  - Platform collection status
  - API usage charts
  - Top trending keywords
  - Data quality metrics

- [ ] **Set Up Alerts** (20 min)
  - Collection failures
  - API quota warnings (> 90%)
  - Job failures
  - Data gaps

- [ ] **Schedule First Review** (1 min)
  - Check after 24 hours of running
  - Review data quality
  - Adjust frequencies if needed

---

## 📋 Short-term Improvements (Weeks 2-4)

### Frontend Integration

- [ ] **Keyword Detail View Enhancements** (2-3 days)
  - [ ] Display social metrics section
    - Mentions by platform
    - Platform breakdown chart
    - Sentiment badge with color coding
  - [ ] Add "Appears on X platforms" indicator
  - [ ] Show trending direction (↑↓→)
  - [ ] Link to top posts/tweets/pins

- [ ] **Watchlist Management UI** (3-4 days)
  - [ ] Create watchlist page (`/dashboard/watchlists`)
  - [ ] Add keyword to watchlist button
  - [ ] Configure alert thresholds per keyword
  - [ ] Bulk operations (add/remove multiple)
  - [ ] Export watchlist to CSV

- [ ] **Notifications Center** (2-3 days)
  - [ ] Notification bell icon in header
  - [ ] Unread count badge
  - [ ] Notification list with filtering
  - [ ] Mark as read/unread
  - [ ] Notification preferences page

- [ ] **Social Trends Page** (3-4 days)
  - [ ] Multi-platform trending keywords
  - [ ] Filter by platform
  - [ ] Filter by sentiment
  - [ ] Filter by platform count (2+, 3+, 4+)
  - [ ] Real-time updates

### Backend Enhancements

- [ ] **API Endpoints** (2-3 days)
  - [ ] `GET /api/keywords/:id/social-trends` - Social data for keyword
  - [ ] `GET /api/trends/multi-platform` - Keywords on multiple platforms
  - [ ] `POST /api/watchlist` - Add to watchlist
  - [ ] `DELETE /api/watchlist/:id` - Remove from watchlist
  - [ ] `GET /api/notifications` - Get user notifications
  - [ ] `PATCH /api/notifications/:id/read` - Mark notification read

- [ ] **Caching Layer** (1-2 days)
  - [ ] Cache social metrics (5 min TTL)
  - [ ] Cache trending keywords (10 min TTL)
  - [ ] Cache user watchlists (1 min TTL)

- [ ] **Rate Limiting Improvements** (1 day)
  - [ ] Add warning emails at 80% quota
  - [ ] Automatic frequency reduction at 90% quota
  - [ ] Dashboard for quota monitoring

### Data Quality

- [ ] **Validation Rules** (1-2 days)
  - [ ] Reject keywords with < 2 platform appearances after 7 days
  - [ ] Flag keywords with inconsistent sentiment across platforms
  - [ ] Require minimum engagement threshold

- [ ] **Deduplication** (1 day)
  - [ ] Merge similar keywords (e.g., "handmade gift" vs "handmade gifts")
  - [ ] Detect and merge plurals
  - [ ] Handle typos and variations

- [ ] **Quality Scoring** (2 days)
  - [ ] Calculate data quality score per keyword
  - [ ] Weight by platform count, recency, engagement
  - [ ] Display quality badge in UI

---

## 🎯 Medium-term Features (Months 2-3)

### Advanced Analytics

- [ ] **Historical Analysis** (1 week)
  - [ ] Create `historical-backfill.yml` workflow
  - [ ] Backfill 90 days of Google Trends data
  - [ ] Generate historical momentum charts
  - [ ] Seasonal pattern analysis dashboard

- [ ] **Comparative Analysis** (1 week)
  - [ ] Compare keyword performance across platforms
  - [ ] Benchmark against similar keywords
  - [ ] Identify platform-specific opportunities

- [ ] **Predictive Models** (2 weeks)
  - [ ] Train momentum prediction model
  - [ ] Forecast keyword trends 7-30 days ahead
  - [ ] Confidence intervals
  - [ ] Model performance dashboard

### AI-Powered Features

- [ ] **Weekly Trend Summary** (3-4 days)
  - [ ] GPT-4 generated summary of top trends
  - [ ] Email digest every Monday
  - [ ] Personalized based on user's interests

- [ ] **Keyword Recommendations** (1 week)
  - [ ] AI suggests related keywords
  - [ ] Opportunity scoring
  - [ ] Competitive gap analysis

- [ ] **Content Ideas** (3-4 days)
  - [ ] Generate content ideas from trending keywords
  - [ ] SEO optimization suggestions
  - [ ] Title and description templates

### Competitive Intelligence

- [ ] **Competitor Tracking** (1 week)
  - [ ] Add competitor keywords to track
  - [ ] Alert on competitor keyword surges
  - [ ] Competitive dashboard
  - [ ] Share of voice analysis

- [ ] **Gap Analysis** (3-4 days)
  - [ ] Find keywords competitors rank for but you don't
  - [ ] Find underserved niches
  - [ ] Opportunity scoring

---

## 🚢 Long-term Vision (Months 4-6)

### Paid Platform Integration

- [ ] **Amazon Product Advertising API** (When revenue justifies)
  - **Prerequisites:**
    - App generating revenue to cover ~$50-100/month
    - Amazon Associates account approved
  - **Implementation:**
    - [ ] Create `amazon-pa-collector.mjs`
    - [ ] Add workflow `amazon-pa-collector.yml`
    - [ ] Update feature flag to enabled
    - [ ] Add `AMAZON_PA_API_KEY` secret
  - **Data to collect:**
    - Search volume
    - Conversion rates
    - ASIN recommendations
    - Price trends

- [ ] **TikTok Official API** (When approved)
  - **Prerequisites:**
    - Apply for TikTok API access
    - Wait for approval (can take 2-4 weeks)
  - **Activation:**
    - [ ] Add `TIKTOK_CLIENT_KEY` secret
    - [ ] Update feature flag: `UPDATE feature_flags SET is_enabled = true WHERE key = 'tiktok_collection'`
    - [ ] Remove `if: false` from workflow
  - **Data to collect:**
    - Official trending hashtags
    - Video engagement metrics
    - Creator insights

### Machine Learning Pipeline

- [ ] **Keyword Classification** (2 weeks)
  - [ ] Train classifier for keyword categories
  - [ ] Auto-tag keywords by niche
  - [ ] Confidence scoring

- [ ] **Seasonal Forecasting** (2 weeks)
  - [ ] Build seasonal pattern database
  - [ ] Predict seasonal peaks 90 days ahead
  - [ ] Alert users of upcoming seasonal opportunities

- [ ] **Sentiment Deep Dive** (1 week)
  - [ ] Advanced sentiment analysis (BERT/GPT)
  - [ ] Aspect-based sentiment (price, quality, shipping)
  - [ ] Sentiment trend prediction

### Platform Expansion

- [ ] **Instagram** (When API available)
  - Hashtag trends
  - Caption keyword analysis
  - Engagement metrics

- [ ] **YouTube** (Free tier)
  - Video title/description keywords
  - Comment analysis
  - Trending topics

- [ ] **Facebook Marketplace** (If API available)
  - Listing keywords
  - Category trends
  - Regional insights

### Export & Integration

- [ ] **Data Export** (1 week)
  - [ ] CSV export with custom date ranges
  - [ ] PDF reports with charts
  - [ ] Scheduled email reports

- [ ] **Third-party Integrations** (2 weeks)
  - [ ] Google Sheets sync
  - [ ] Zapier integration
  - [ ] Make.com integration
  - [ ] REST API for custom integrations

- [ ] **Webhooks** (3-4 days)
  - [ ] Real-time keyword surge webhooks
  - [ ] Custom webhook endpoints
  - [ ] Webhook payload customization

---

## 🔧 Technical Debt & Infrastructure

### Testing

- [ ] **Unit Tests** (1 week)
  - [ ] Test all collector functions
  - [ ] Test sentiment analysis
  - [ ] Test n-gram extraction
  - [ ] Test aggregation logic
  - [ ] Target: 80% code coverage

- [ ] **Integration Tests** (1 week)
  - [ ] Test end-to-end data flow
  - [ ] Test database operations
  - [ ] Test API endpoints
  - [ ] Mock external APIs

- [ ] **E2E Tests** (1 week)
  - [ ] Test full workflows
  - [ ] Test notification delivery
  - [ ] Test watchlist operations

### Performance Optimization

- [ ] **Query Optimization** (3-4 days)
  - [ ] Add missing indexes
  - [ ] Optimize JOIN queries
  - [ ] Implement query result caching

- [ ] **Materialized Views** (2-3 days)
  - [ ] Create for trending keywords
  - [ ] Create for multi-platform keywords
  - [ ] Auto-refresh strategy

- [ ] **Batch Processing** (2-3 days)
  - [ ] Batch database inserts
  - [ ] Parallelize collector operations
  - [ ] Queue-based job processing

### Reliability & Monitoring

- [ ] **Error Handling** (1 week)
  - [ ] Retry logic with exponential backoff
  - [ ] Circuit breakers for external APIs
  - [ ] Dead letter queues for failed jobs
  - [ ] Graceful degradation

- [ ] **Observability** (1 week)
  - [ ] Set up Sentry for error tracking
  - [ ] Add structured logging
  - [ ] Create Grafana dashboards
  - [ ] APM monitoring

- [ ] **Health Checks** (2-3 days)
  - [ ] Endpoint health checks
  - [ ] Database connection monitoring
  - [ ] API credential validation
  - [ ] Automated alerting

### Security

- [ ] **API Security** (3-4 days)
  - [ ] Implement rate limiting per user
  - [ ] Add API key authentication
  - [ ] CORS configuration
  - [ ] Input validation & sanitization

- [ ] **Data Privacy** (2-3 days)
  - [ ] GDPR compliance review
  - [ ] User data export
  - [ ] User data deletion
  - [ ] Privacy policy updates

### Infrastructure

- [ ] **Self-hosted Runners** (If private repo)
  - [ ] Set up GitHub Actions runners
  - [ ] Reduces workflow costs to $0
  - [ ] Better control over environment

- [ ] **Database Optimization** (1 week)
  - [ ] Partition large tables by date
  - [ ] Archive old data to separate storage
  - [ ] Implement data retention policies

- [ ] **Backup Strategy** (2-3 days)
  - [ ] Automated daily backups
  - [ ] Point-in-time recovery
  - [ ] Disaster recovery plan

---

## 📚 Documentation

### User Documentation

- [ ] **Getting Started Guide** (2-3 days)
  - [ ] How to use keyword search
  - [ ] Understanding social metrics
  - [ ] Creating watchlists
  - [ ] Setting up notifications

- [ ] **Feature Guides** (1 week)
  - [ ] Sentiment analysis explained
  - [ ] Multi-platform validation
  - [ ] Seasonal trends guide
  - [ ] Best practices for keyword research

- [ ] **Video Tutorials** (1 week)
  - [ ] Platform overview (5 min)
  - [ ] Using watchlists (3 min)
  - [ ] Reading social trends (5 min)
  - [ ] Advanced filtering (4 min)

### Developer Documentation

- [ ] **API Documentation** (3-4 days)
  - [ ] OpenAPI/Swagger spec
  - [ ] Authentication guide
  - [ ] Code examples in multiple languages
  - [ ] Rate limiting documentation

- [ ] **Architecture Documentation** (2-3 days)
  - [ ] System architecture diagrams
  - [ ] Data flow diagrams
  - [ ] Database ERD
  - [ ] Sequence diagrams

- [ ] **Deployment Guide** (1-2 days)
  - [ ] Production deployment checklist
  - [ ] Environment configuration
  - [ ] Scaling strategies
  - [ ] Rollback procedures

---

## 💡 Ideas for Future Exploration

### Community Features
- Shared watchlists between team members
- Public trend dashboards for inspiration
- User-submitted keyword suggestions
- Commenting on keyword trends

### Gamification
- Keyword discovery achievements
- Trend prediction competitions
- Leaderboards for trend spotters

### White Label
- Rebrand for agencies
- Client-specific dashboards
- Custom branding

### Mobile App
- iOS/Android apps
- Push notifications
- Quick keyword lookup
- Offline access to saved keywords

---

## 🎯 Success Metrics

### Week 1 Goals
- ✅ All workflows running successfully
- ✅ At least 100 keywords collected per platform per day
- ✅ No API quota overages
- ✅ Zero critical errors

### Month 1 Goals
- 1,000+ unique keywords with social data
- 500+ keywords appearing on multiple platforms
- 50+ users with active watchlists
- 100+ notifications sent

### Month 3 Goals
- 10,000+ keywords with social data
- 80% of keywords on 2+ platforms
- 500+ active watchlist users
- < 1 second average API response time

### Month 6 Goals
- 50,000+ keywords with social data
- Predictive model accuracy > 70%
- 2,000+ active users
- Revenue covering all API costs

---

## 📊 KPIs to Track

### Data Collection
- Keywords collected per day per platform
- Multi-platform keywords percentage
- API quota usage percentage
- Collection success rate

### Data Quality
- Average sentiment confidence
- Average engagement per keyword
- Platform coverage (% on 2+, 3+, 4+ platforms)
- Data freshness (hours since last update)

### User Engagement
- Active watchlist users
- Notifications sent per user
- Notification click-through rate
- Average keywords per watchlist

### System Health
- Workflow success rate
- Average workflow runtime
- Error rate per collector
- Database query performance

---

## 🚨 Known Limitations & Constraints

### Current Limitations

1. **GitHub Actions Cost** (If private repo)
   - Current usage: ~34,000 minutes/month
   - Free tier: 2,000 minutes/month
   - Estimated cost: ~$255/month
   - **Mitigation:** Consider public repo or self-hosted runners

2. **API Rate Limits**
   - Twitter: 1,500 posts/month
   - Pinterest: 200 requests/day
   - **Mitigation:** Smart scheduling, prioritize high-value keywords

3. **No Real-time Updates**
   - Minimum frequency: 30 minutes (Twitter)
   - **Mitigation:** Event-driven updates for watched keywords

4. **Sentiment Analysis Accuracy**
   - Using simple word lists (not ML model)
   - Estimated accuracy: 60-70%
   - **Mitigation:** Upgrade to BERT/GPT model in future

5. **TikTok Data Limited**
   - Web scraping only (no API)
   - Limited data points
   - **Mitigation:** Apply for official API

### Planned Improvements

1. Implement queue-based job processing
2. Add Redis caching layer
3. Upgrade to ML-based sentiment analysis
4. Add real-time WebSocket updates
5. Implement intelligent rate limit distribution

---

## 🤝 Contributing

### How to Add a New Platform

1. **Create Collector Script**
   - Copy `scripts/twitter-keyword-collector.mjs` as template
   - Implement platform-specific API calls
   - Add rate limiting logic
   - Add to package.json scripts

2. **Create Workflow**
   - Copy `.github/workflows/twitter-trends-collector.yml`
   - Update frequency and parameters
   - Add required secrets

3. **Add Feature Flag**
   ```sql
   INSERT INTO feature_flags (key, description, is_enabled, rollout)
   VALUES ('new_platform_collection', 'Enable New Platform', true, '{}');
   ```

4. **Update Configuration**
   - Add to `config/social-platforms.yml`
   - Document in main docs

5. **Test & Deploy**
   - Test locally
   - Manual workflow trigger
   - Monitor for 24 hours
   - Enable auto-scheduling

---

## 📞 Support & Questions

### Internal Team
- Check `docs/SOCIAL_KEYWORD_PIPELINE.md` for detailed documentation
- Review workflow logs in GitHub Actions
- Check database with provided SQL queries

### External Support
- GitHub Issues for bugs
- Discussions for feature requests
- Email for urgent production issues

---

**Document Version**: 1.0
**Last Updated**: 2025-11-06
**Maintained By**: LexHub Development Team

