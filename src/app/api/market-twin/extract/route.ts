import { NextRequest, NextResponse } from "next/server";

/**
 * Extract product data from marketplace URLs
 * This endpoint is currently not implemented - product extraction requires
 * additional marketplace API integrations or scraping infrastructure.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return NextResponse.json(
    {
      error: "Product extraction is not yet implemented. Please enter product details manually.",
      feature: "market-twin-extract",
      status: "not_implemented"
    },
    { status: 501 }
  );
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
