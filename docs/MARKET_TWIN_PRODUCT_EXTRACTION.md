# Market Twin Product Extraction Feature

## Overview

The Market Twin feature is now fully operational with comprehensive product extraction capabilities. Users can paste product links from major marketplaces (Etsy, Amazon, Shopify, eBay, and more), and the system automatically extracts relevant product information, stores it in the database, and enriches the application with actionable market intelligence.

## Features

### 1. **Multi-Marketplace Support**

The product extraction system supports the following marketplaces:

- **Etsy** ✅ Full support with advanced scraping
- **Amazon** ✅ Full support (US and international domains)
- **Shopify** ✅ Full support (any Shopify-powered store)
- **eBay** ✅ Full support (US and international domains)
- **Generic** ✅ Fallback extractor for other sites using meta tags and JSON-LD

### 2. **Extracted Data**

For each product URL, the system extracts:

- **Basic Info**: Title, description, marketplace
- **Pricing**: Price amount and currency
- **Media**: Product images
- **Tags**: Keywords and product tags
- **Category**: Product category/hierarchy
- **Shop Info**: Seller name, URL, location
- **Extras**: Reviews, ratings, shipping info (marketplace-specific)

### 3. **Database Storage**

All extracted products are automatically stored in the database:

- **`listings` table**: Core product information
- **`listing_tags` table**: Product tags/keywords
- **Automatic linking**: Products are linked to the user who extracted them

### 4. **AI Market Analysis**

After extraction, users can:

1. Tweak product attributes (title, tags, price, description)
2. Set optimization goals
3. Run AI-powered market simulations
4. Get visibility predictions, confidence scores, and recommendations

## Architecture

### File Structure

```
src/lib/product-extraction/
├── index.ts                          # Public API exports
├── types.ts                          # Type definitions
├── service.ts                        # Main extraction service
└── extractors/
    ├── etsy.ts                       # Etsy extractor
    ├── amazon.ts                     # Amazon extractor
    ├── shopify.ts                    # Shopify extractor
    ├── ebay.ts                       # eBay extractor
    └── generic.ts                    # Generic fallback extractor

src/app/api/market-twin/
├── route.ts                          # Main simulation endpoint
└── extract/
    └── route.ts                      # Product extraction endpoint

src/app/(app)/market-twin/
└── page.tsx                          # Market Twin UI
```

### Key Components

#### 1. **Product Extraction Service** (`service.ts`)

The main orchestrator that:
- Detects marketplace from URL
- Routes to appropriate extractor
- Validates extracted data
- Falls back to generic extractor if needed

```typescript
import { productExtractionService } from "@/lib/product-extraction";

const product = await productExtractionService.extract(url);
```

#### 2. **Marketplace Extractors**

Each extractor implements the `MarketplaceExtractor` interface:

```typescript
interface MarketplaceExtractor {
  readonly name: string;
  canHandle(url: string): boolean;
  extract(url: string): Promise<NormalizedProduct>;
}
```

**Extraction Methods:**
- **Etsy**: Advanced HTML scraping with JSON-LD parsing, CAPTCHA bypass
- **Amazon**: HTML scraping with meta tag extraction
- **Shopify**: JSON API endpoint + HTML fallback
- **eBay**: JSON-LD + meta tag extraction
- **Generic**: Meta tags + JSON-LD for any site

#### 3. **API Endpoint** (`/api/market-twin/extract`)

POST endpoint that:
- Accepts `{ userId, url }`
- Extracts product data
- Stores in database
- Returns normalized product

```typescript
const response = await fetch("/api/market-twin/extract", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ userId, url: productUrl }),
});
```

#### 4. **UI Component** (`market-twin/page.tsx`)

User interface with:
- Product URL input field
- "Load Product" button
- Auto-populated product form
- Scenario tweaking controls
- AI simulation trigger
- Results history

## Usage

### For Users

1. **Navigate** to the Market Twin page
2. **Paste** a product URL from any supported marketplace
3. **Click** "Load Product" to extract data
4. **Review** auto-populated product details
5. **Tweak** title, tags, price, or description
6. **Set** optimization goals
7. **Run** Market Twin analysis
8. **Review** AI predictions and recommendations

### For Developers

#### Extract a Product

```typescript
import { productExtractionService } from "@/lib/product-extraction";

try {
  const product = await productExtractionService.extract(
    "https://www.etsy.com/listing/123456789/..."
  );

  console.log(product.title);
  console.log(product.price.amount);
  console.log(product.tags);
} catch (error) {
  if (error instanceof ProductExtractionError) {
    console.error(error.code, error.message);
  }
}
```

#### Check if URL is Supported

```typescript
const isSupported = productExtractionService.isSupported(url);
const marketplace = productExtractionService.detectMarketplace(url);
```

#### Add a New Marketplace Extractor

1. Create a new extractor in `src/lib/product-extraction/extractors/`:

```typescript
import type { MarketplaceExtractor, NormalizedProduct } from "../types";

export class MyMarketplaceExtractor implements MarketplaceExtractor {
  readonly name = "mymarketplace";

  canHandle(url: string): boolean {
    // Return true if URL belongs to your marketplace
  }

  async extract(url: string): Promise<NormalizedProduct> {
    // Extract and return normalized product data
  }
}
```

2. Register in `service.ts`:

```typescript
import { MyMarketplaceExtractor } from "./extractors/mymarketplace";

this.extractors = [
  new EtsyExtractor(),
  new AmazonExtractor(),
  new ShopifyExtractor(),
  new EbayExtractor(),
  new MyMarketplaceExtractor(), // Add here
];
```

## Data Flow

```
User Input (URL)
    ↓
Product Extraction Service
    ↓
Marketplace Detection
    ↓
Appropriate Extractor
    ↓
HTML/JSON Parsing
    ↓
Normalized Product Data
    ↓
Database Storage (listings + listing_tags)
    ↓
UI Auto-Population
    ↓
User Tweaks Scenario
    ↓
AI Market Twin Simulation
    ↓
Results + Recommendations
```

## Error Handling

The system gracefully handles various error scenarios:

### Extraction Errors

- **Invalid URL**: Returns 400 with validation error
- **Unsupported Marketplace**: Tries generic extractor, then returns 422
- **CAPTCHA/Rate Limiting**: Returns retryable error
- **Network Errors**: Returns 500 with details
- **Insufficient Data**: Returns error if extraction yields no useful data

### Database Errors

- Extraction continues even if database storage fails
- Errors are logged but don't block the extraction result
- Users still receive extracted data for manual use

## Performance Considerations

### Rate Limiting

- **Etsy**: Built-in throttling (1.5s between requests)
- **Amazon**: May encounter CAPTCHAs (returns retryable error)
- **Shopify**: No rate limiting (uses public JSON endpoints)
- **eBay**: No specific rate limiting
- **Generic**: No rate limiting

### Caching

Consider implementing:
- Redis cache for recently extracted products
- Database cache lookup before external requests
- TTL-based cache invalidation

### Optimization Tips

1. **Batch Operations**: Extract multiple products in parallel for bulk import
2. **Background Jobs**: Move extraction to background workers for large operations
3. **Caching**: Cache extracted data for 24-48 hours
4. **Fallback**: Use generic extractor as last resort

## Database Schema

### `listings` Table

```sql
CREATE TABLE listings (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  marketplace_account_id UUID REFERENCES marketplace_accounts(id),
  external_id TEXT,
  title TEXT,
  description TEXT,
  price_cents INTEGER,
  currency TEXT,
  status TEXT,
  url TEXT,
  extras JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### `listing_tags` Table

```sql
CREATE TABLE listing_tags (
  listing_id UUID REFERENCES listings(id),
  tag_name TEXT,
  PRIMARY KEY (listing_id, tag_name)
);
```

## Testing

### Manual Testing

Test with real product URLs:

```
# Etsy
https://www.etsy.com/listing/1234567890/product-name

# Amazon
https://www.amazon.com/dp/B08N5WRWNW

# Shopify
https://example.myshopify.com/products/product-handle

# eBay
https://www.ebay.com/itm/123456789012
```

### Integration Testing

```typescript
import { productExtractionService } from "@/lib/product-extraction";

describe("Product Extraction", () => {
  it("should extract Etsy product", async () => {
    const url = "https://www.etsy.com/listing/...";
    const product = await productExtractionService.extract(url);

    expect(product.marketplace).toBe("etsy");
    expect(product.title).toBeTruthy();
    expect(product.price.amount).toBeGreaterThan(0);
  });
});
```

## Security Considerations

1. **URL Validation**: All URLs are validated before fetching
2. **Rate Limiting**: Built-in throttling prevents abuse
3. **Error Messages**: Generic errors prevent information leakage
4. **User Isolation**: Products are linked to authenticated users only
5. **Input Sanitization**: All extracted data is sanitized before storage

## Future Enhancements

### Planned Features

- [ ] **Batch Import**: Extract multiple products from CSV/spreadsheet
- [ ] **Auto-Refresh**: Periodically update product data
- [ ] **Price Tracking**: Monitor price changes over time
- [ ] **Competitor Tracking**: Track competitor products automatically
- [ ] **Image Analysis**: Extract insights from product images
- [ ] **Review Sentiment**: Analyze product reviews
- [ ] **Performance Metrics**: Track extraction success rates
- [ ] **API Rate Limit Monitoring**: Smart backoff and retry logic

### Marketplace Expansion

- [ ] Walmart
- [ ] AliExpress
- [ ] Facebook Marketplace
- [ ] Mercari
- [ ] Poshmark
- [ ] Depop

## Troubleshooting

### "Product extraction is not yet implemented"

This error means the API endpoint wasn't updated. Ensure `/api/market-twin/extract/route.ts` has the new implementation.

### "Unsupported marketplace"

- Check if the URL is valid
- Verify the marketplace is in the supported list
- Try using a direct product URL (not category or search pages)

### "Could not extract meaningful product data"

- The page may have non-standard structure
- Check if the product page is publicly accessible
- Try the URL in a browser to verify it loads

### CAPTCHA Errors

- Etsy: The system has Playwright fallback for CAPTCHAs
- Amazon: May require human verification (implement proxy rotation)
- Other sites: Consider using official APIs instead

### Database Errors

Check:
- Supabase connection is configured
- User has permissions to create listings
- Database schema matches expected structure

## Support

For issues or questions:
- Review this documentation
- Check the codebase comments
- Open an issue in the repository
- Contact the development team

## Changelog

### v1.0.0 (2025-11-05)
- ✅ Initial release with full marketplace support
- ✅ Etsy, Amazon, Shopify, eBay, and generic extractors
- ✅ Database storage with automatic tag management
- ✅ UI integration with auto-population
- ✅ AI Market Twin simulation integration
- ✅ Comprehensive error handling
- ✅ Documentation and usage examples
