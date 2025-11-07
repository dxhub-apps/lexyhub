# LexyBrain Business Documentation

## What is LexyBrain?

LexyBrain is LexyHub's AI-powered market intelligence system designed specifically for Etsy and marketplace sellers. It transforms raw keyword data and market trends into actionable insights, helping sellers identify opportunities, avoid risks, and optimize their strategies.

Think of LexyBrain as your personal market analyst—always on, always learning, and powered by the same data that successful sellers use to stay ahead.

## Key Features

### 1. Market Brief 📊

**What it does**: Provides a comprehensive analysis of a specific niche or market segment.

**Includes**:
- High-level market summary
- Top 5 keyword opportunities with explanations
- Risk assessment (up to 3 key risks)
- 5 actionable recommendations
- Confidence score (0-100%)

**Use case**: "I'm thinking of selling vintage jewelry on Etsy. What should I know?"

**Example output**:
```
Niche: Vintage Jewelry
Summary: Strong market with steady demand and moderate competition.
Growing interest in sustainable and unique pieces.

Top Opportunities:
✓ "art deco rings" - High demand, low competition, premium pricing
✓ "vintage cameo brooches" - Niche collector market, high margins
✓ "antique locket necklaces" - Emotional appeal, gift potential

Risks:
⚠ "vintage jewelry" (generic) - Oversaturated, price competition
⚠ Authentication challenges - Buyers concerned about authenticity
⚠ Sourcing consistency - Supply chain can be unpredictable

Actions:
1. Focus on specific eras (Art Deco, Victorian) for better positioning
2. Include authentication certificates or detailed provenance
3. Build relationships with estate sale suppliers
4. Emphasize sustainability and one-of-a-kind nature
5. Create collection stories to differentiate from mass market

Confidence: 87%
```

### 2. Opportunity Radar 🎯

**What it does**: Scores keywords across 5 critical dimensions to identify the best opportunities.

**Scoring dimensions**:
1. **Demand** (0-100) - How much buyer interest exists
2. **Momentum** (0-100) - Is the trend growing or declining
3. **Competition** (0-100) - Market saturation (lower is better)
4. **Novelty** (0-100) - How fresh/unique is this opportunity
5. **Profit** (0-100) - Estimated profit potential

**Use case**: "What keywords should I target for my handmade candle shop?"

**Example output**:
```
Top Opportunities for "handmade candles":

1. "soy candles with essential oils"
   Demand: 91  Momentum: 85  Competition: 35  Novelty: 72  Profit: 88
   → Strong demand with low competition. Essential oil angle is trending.

2. "minimalist concrete candle holders"
   Demand: 76  Momentum: 92  Competition: 28  Novelty: 89  Profit: 81
   → Rapidly growing niche. Combine candles with holders for upsell.

3. "personalized wedding candles"
   Demand: 88  Momentum: 65  Competition: 48  Novelty: 45  Profit: 93
   → Stable high-margin market. Focus on customization.
```

### 3. Ad Insight 💰

**What it does**: Recommends how to allocate your advertising budget across keywords for maximum ROI.

**Includes**:
- Budget split by keyword
- Expected cost-per-click (CPC)
- Estimated daily clicks
- Strategic notes

**Use case**: "I have $20/day to spend on Etsy ads. How should I allocate it?"

**Example output**:
```
Budget: $20.00/day

Recommended Split:

1. "soy candles with essential oils" - $8.00/day
   Expected CPC: $0.45  |  Expected Clicks: 18

2. "minimalist concrete candle holders" - $6.50/day
   Expected CPC: $0.38  |  Expected Clicks: 17

3. "personalized wedding candles" - $5.50/day
   Expected CPC: $0.52  |  Expected Clicks: 11

Notes:
- Allocate more budget to essential oil keywords due to strong conversion signals
- Test concrete holders in the afternoon (peak browsing for home decor)
- Wedding candles have seasonal peaks (spring/summer), adjust budget accordingly
- Monitor CPC trends weekly and shift budget to better performers
```

### 4. Risk Sentinel 🛡️

**What it does**: Identifies potential risks and challenges in your chosen market.

**Risk levels**:
- 🟢 **Low** - Monitor but not urgent
- 🟡 **Medium** - Requires attention
- 🔴 **High** - Immediate action needed

**Use case**: "What could go wrong with my product strategy?"

**Example output**:
```
Risk Alerts for "handmade candles":

🔴 HIGH: "scented candles" (generic term)
Issue: Market saturation with race-to-bottom pricing
Evidence: Competition score 0.94, declining trend momentum (-0.15)
Action: Differentiate with unique scents, packaging, or story. Avoid competing on generic terms.

🟡 MEDIUM: Seasonal demand fluctuation
Issue: 60% of sales concentrated in Q4 (holidays)
Evidence: Historical trend data shows sharp drop-off in January-March
Action: Develop spring/summer product lines (beach-themed, citrus scents) to smooth revenue.

🟢 LOW: Supply chain for soy wax
Issue: Single-source suppliers can cause disruptions
Evidence: Recent reports of soy wax shortages
Action: Establish relationships with 2-3 suppliers and maintain safety stock.
```

### 5. Neural Map (Keyword Graph) 🧠

**What it does**: Visualizes keyword relationships using AI-powered similarity analysis.

**Features**:
- Interactive graph showing related keywords
- Node size reflects opportunity score
- Edge thickness shows similarity strength
- Click nodes to explore neighbors

**Use case**: "What other keywords are related to my main product?"

**Example**: Starting from "handmade soap", the graph reveals:
- "natural soap bars" (high similarity)
- "organic skincare" (medium similarity)
- "vegan bath products" (medium similarity)
- "artisan soap gift sets" (medium similarity)

This helps discover adjacent niches and expansion opportunities.

## Plan-Based Access

LexyBrain features are tiered to match your business growth:

### Free Tier
- **20 AI operations/month** (Radar, Risk, Ad Insights combined)
- **2 Market Briefs/month**
- **2 Simulations/month** (future feature)
- **Extension Boost**: 2x limit with Chrome extension installed

**Best for**: Testing the waters, occasional research

### Basic ($6.99/month)
- **200 AI operations/month**
- **20 Market Briefs/month**
- **20 Simulations/month**
- Full access to Neural Map
- Priority support

**Best for**: Active sellers researching 1-2 niches

### Pro ($12.99/month)
- **2,000 AI operations/month**
- **100 Market Briefs/month**
- **200 Simulations/month**
- Advanced analytics
- Weekly digest emails
- Priority support

**Best for**: Power sellers managing multiple product lines

### Growth ($24.99/month)
- **Unlimited AI operations**
- **Unlimited Market Briefs**
- **Unlimited Simulations**
- All Pro features
- Dedicated account manager
- Custom integrations

**Best for**: Agencies and high-volume sellers

## How LexyBrain Works

### Data Sources

LexyBrain draws from:
1. **LexyHub Keyword Database** - Millions of keywords with demand, competition, and trend data
2. **Market Trends** - Real-time trend tracking from multiple sources
3. **Historical Performance** - Aggregated seller performance data (anonymized)
4. **Social Signals** - Pinterest, Reddit, and social media trends

### AI Model

- **Model**: Llama-3-8B fine-tuned for marketplace intelligence
- **Hosting**: RunPod serverless infrastructure
- **Response Time**: 3-10 seconds (typical)
- **Format**: Strict JSON output for consistent, structured insights

### Caching & Speed

LexyBrain caches insights to balance freshness with speed:
- **Market Briefs**: 24 hours
- **Opportunity Radar**: 24 hours
- **Risk Alerts**: 12 hours (more volatile)
- **Ad Insights**: 6 hours (ad costs change frequently)

If you request the same analysis within the cache window, you'll get instant results without consuming quota.

## Using LexyBrain Effectively

### Best Practices

1. **Start with Market Brief**
   - Get the big picture before diving into specifics
   - Use it to validate niche ideas before investing

2. **Use Opportunity Radar for Product Research**
   - Compare multiple keywords side-by-side
   - Look for high demand + low competition + high momentum

3. **Run Risk Sentinel Before Launching**
   - Identify challenges early
   - Plan mitigation strategies

4. **Optimize Ads with Ad Insight**
   - Test the recommended split for 1-2 weeks
   - Track performance and iterate

5. **Explore with Neural Map**
   - Discover adjacent niches
   - Find less competitive alternatives to your main keywords

### Common Workflows

**Workflow 1: New Niche Research**
```
1. Market Brief → Understand the landscape
2. Opportunity Radar → Find best keywords
3. Risk Sentinel → Identify challenges
4. Neural Map → Discover related opportunities
5. Ad Insight → Plan initial ad budget
```

**Workflow 2: Optimize Existing Shop**
```
1. Add your current keywords to Watchlist
2. Run Opportunity Radar on your niche
3. Compare your keywords to top opportunities
4. Use Ad Insight to reallocate budget
5. Set up Risk Sentinel alerts
```

**Workflow 3: Seasonal Planning**
```
1. Market Brief for upcoming season (e.g., "holiday gifts")
2. Opportunity Radar filtered by trend momentum
3. Ad Insight to plan seasonal budget
4. Schedule weekly Risk Sentinel checks
```

## Integration with LexyHub

### Watchlists

Add keywords to your Watchlist and click **"Analyze with LexyBrain"** to:
- Generate instant insights
- Track opportunity scores over time
- Get alerts when risks emerge

### Insights Dashboard

View all your generated insights in one place:
- Recent briefs, radars, and alerts
- Saved analyses
- Performance tracking

### Weekly Digest

Pro and Growth users receive weekly emails with:
- Top new opportunities in your niches
- Risk alerts requiring attention
- Performance trends
- Recommended actions

## FAQ

### How accurate is LexyBrain?

LexyBrain provides data-driven insights with **confidence scores**. A confidence score of 85%+ indicates high reliability. However, AI insights should inform—not replace—your judgment. Always validate with your own market knowledge and testing.

### Can I trust the budget recommendations?

Ad Insight recommendations are based on historical data and current competition levels. Use them as a starting point and adjust based on your actual performance. CPC estimates can vary based on seasonality, ad quality, and market changes.

### What if LexyBrain gets it wrong?

LexyBrain is a tool, not a guarantee. If an insight doesn't match your experience:
1. Check the confidence score
2. Verify with manual research
3. Report feedback to help improve the system

### How often should I use LexyBrain?

**Minimum**:
- Market Brief: Once per niche/month
- Opportunity Radar: Weekly
- Risk Sentinel: Weekly
- Ad Insight: Monthly (or when budget changes)

**Optimal** (Pro/Growth):
- Daily check of your watchlisted keywords
- Weekly market brief updates
- Real-time risk monitoring

### Does LexyBrain replace keyword research?

No—it enhances it. LexyBrain automates analysis that would take hours manually, but you should still:
- Browse actual listings
- Check competitor strategies
- Test products in small batches
- Monitor your own performance data

### Can I export LexyBrain insights?

Yes. All insights can be:
- Downloaded as JSON
- Copied to clipboard
- Exported to PDF (Pro+)
- Sent to integrations via API (Growth)

## Roadmap

### Coming Soon

1. **Seasonal Forecasting** - Predict demand spikes 3-6 months ahead
2. **Competitor Tracking** - Monitor what top sellers in your niche are doing
3. **Listing Optimizer** - AI-powered title/tag suggestions
4. **Market Simulator** - "What if" scenarios for strategy testing
5. **Trend Alerts** - Real-time notifications when opportunities emerge

### Under Consideration

- Multi-platform support (Amazon Handmade, eBay, etc.)
- Supplier recommendations
- Pricing strategy advisor
- Social media content suggestions
- Collaborative team features

## Support

### Getting Help

- **Documentation**: [docs.lexyhub.com/lexybrain](https://docs.lexyhub.com/lexybrain)
- **Video Tutorials**: [youtube.com/lexyhub](https://youtube.com/lexyhub)
- **Community Forum**: Share strategies and ask questions
- **Email Support**: support@lexyhub.com (24-48 hour response)
- **Priority Support**: Pro and Growth users get <12 hour response

### Feedback

We're constantly improving LexyBrain. Share your feedback:
- In-app feedback button
- Email: feedback@lexyhub.com
- Feature requests: [github.com/lexyhub/roadmap](https://github.com/lexyhub/roadmap)

## Success Stories

> "LexyBrain helped me identify a niche I never would have considered. Now it's 40% of my revenue."
> — Sarah K., Pro user

> "The Risk Sentinel caught a potential issue with my main keyword before I invested in inventory. Saved me thousands."
> — Mike T., Growth user

> "I use the Opportunity Radar every Monday to plan my week. It's like having a research assistant."
> — Jennifer L., Pro user

## Legal & Privacy

- All AI insights are generated on-demand for your account
- Your prompts and results are private and not shared with other users
- LexyHub does not sell your data or insights to third parties
- See full [Privacy Policy](https://lexyhub.com/privacy) and [Terms of Service](https://lexyhub.com/terms)

---

**Ready to get started?** Enable LexyBrain in your [dashboard settings](https://lexyhub.com/settings) or [upgrade your plan](https://lexyhub.com/billing) for more insights.

For technical details, see the [LexyBrain Technical Documentation](./technical.md).
