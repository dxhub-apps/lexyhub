#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const ETSY_API_KEY = process.env.ETSY_API_KEY;

if (!ETSY_API_KEY) {
  console.error('Missing ETSY_API_KEY environment variable.');
  process.exit(1);
}

const query = process.env.ETSY_QUERY || process.argv[2] || 'handmade gifts';
const requestedLimit = Number.parseInt(process.env.ETSY_LIMIT || process.argv[3] || '25', 10);
const limit = Number.isNaN(requestedLimit) ? 25 : Math.min(Math.max(requestedLimit, 1), 100);
const sortOn = process.env.ETSY_SORT_ON || 'score';
const sortOrder = process.env.ETSY_SORT_ORDER || 'down';
const outputDir = process.env.ETSY_OUTPUT_DIR || path.join('data', 'etsy');
const includeDescription = (process.env.ETSY_INCLUDE_DESCRIPTION || 'false').toLowerCase() === 'true';

if (!Number.isNaN(requestedLimit) && requestedLimit !== limit) {
  console.warn(`Requested limit ${requestedLimit} adjusted to Etsy bounds -> ${limit}.`);
}

const apiUrl = new URL('https://openapi.etsy.com/v3/application/listings/active');
const fields = [
  'listing_id',
  'title',
  'price',
  'currency_code',
  'url',
  'shop_id',
  'shop_title',
  'tags',
  'original_creation_timestamp',
  'ending_timestamp',
  'quantity',
  'views'
];

if (includeDescription) {
  fields.push('description');
}

apiUrl.searchParams.set('keywords', query);
apiUrl.searchParams.set('limit', String(limit));
apiUrl.searchParams.set('sort_on', sortOn);
apiUrl.searchParams.set('sort_order', sortOrder);
apiUrl.searchParams.set('expand', 'shop,images');
apiUrl.searchParams.set('fields', fields.join(','));

async function run() {
  console.log(`Fetching Etsy listings for "${query}" (limit=${limit})...`);
  const response = await fetch(apiUrl, {
    headers: {
      'x-api-key': ETSY_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch listings: ${response.status} ${response.statusText}\n${errorText}`);
  }

  const payload = await response.json();
  const results = Array.isArray(payload?.results) ? payload.results : [];

  if (results.length === 0) {
    console.warn('No listings returned. Check your query or API permissions.');
  }

  const normalized = results.map((listing) => ({
    id: listing.listing_id ?? listing.listingId,
    title: listing.title,
    price: listing.price?.amount ?? listing.price,
    currency: listing.currency_code ?? listing.price?.currency_code,
    url: listing.url,
    shop: {
      id: listing.shop_id ?? listing.shop?.shop_id,
      title: listing.shop_title ?? listing.shop?.shop_name
    },
    tags: listing.tags,
    quantity: listing.quantity,
    views: listing.views,
    createdAt: listing.original_creation_timestamp ?? listing.original_creation_tsz,
    endingAt: listing.ending_timestamp ?? listing.ending_tsz,
    ...(includeDescription && listing.description ? { description: listing.description } : {}),
    images: Array.isArray(listing.images)
      ? listing.images.map((image) => ({
          url_fullxfull: image.url_fullxfull,
          url_75x75: image.url_75x75
        }))
      : undefined
  }));

  await fs.mkdir(outputDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = path.join(outputDir, `etsy-${timestamp}.json`);
  await fs.writeFile(
    filename,
    JSON.stringify(
      {
        query,
        limit,
        sortOn,
        sortOrder,
        fetchedAt: new Date().toISOString(),
        count: normalized.length,
        listings: normalized
      },
      null,
      2
    ),
    'utf8'
  );

  console.log(`Saved ${normalized.length} listings to ${filename}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
