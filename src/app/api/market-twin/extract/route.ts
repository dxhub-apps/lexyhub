import { NextRequest, NextResponse } from "next/server";

import { productExtractionService, ProductExtractionError } from "@/lib/product-extraction";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Extract product data from marketplace URLs
 * Supports: Etsy, Amazon, Shopify, and more
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase client unavailable" }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { url, userId } = body;

    // Validate input
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "url is required and must be a string" }, { status: 400 });
    }

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // Detect marketplace
    const marketplace = productExtractionService.detectMarketplace(url);

    // Extract product data
    const product = await productExtractionService.extract(url);

    // Store extracted product in database
    const { data: listing, error: insertError } = await supabase
      .from("listings")
      .insert({
        user_id: userId,
        marketplace_account_id: null, // Not linked to a specific account
        external_id: product.id,
        title: product.title,
        description: product.description,
        price_cents: product.price.amount ? Math.round(product.price.amount * 100) : null,
        currency: product.price.currency || "USD",
        status: "active",
        url: product.url,
        extras: {
          marketplace: product.marketplace,
          images: product.images,
          category: product.category,
          shop: product.shop,
          extractedAt: product.fetchedAt,
          ...product.extras,
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to store extracted listing:", insertError);
      // Continue even if storage fails - return the extracted data
    }

    // Store tags if we have a listing ID
    if (listing && product.tags.length > 0) {
      const tagInserts = product.tags.map((tag) => ({
        listing_id: listing.id,
        tag_name: tag,
      }));

      const { error: tagsError } = await supabase.from("listing_tags").insert(tagInserts);

      if (tagsError) {
        console.error("Failed to store listing tags:", tagsError);
      }
    }

    return NextResponse.json({
      success: true,
      product,
      listing: listing || null,
      marketplace: product.marketplace,
      message: `Successfully extracted product from ${product.marketplace}`,
    });
  } catch (error) {
    console.error("Product extraction error:", error);

    if (error instanceof ProductExtractionError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          details: error.details,
        },
        { status: error.code === "INVALID_URL" ? 400 : error.code === "UNSUPPORTED_MARKETPLACE" ? 422 : 500 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to extract product data",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
