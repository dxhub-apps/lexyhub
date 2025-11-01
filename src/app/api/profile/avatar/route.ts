import { randomUUID } from "crypto";

import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

import { requireUserId } from "../helpers";

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let userId: string;
  try {
    userId = requireUserId(request);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "userId is required" },
      { status: 400 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A file upload is required" }, { status: 400 });
  }

  const baseName = sanitizeFilename(file.name || "avatar");
  const typeExtension = file.type ? file.type.split("/").pop() : undefined;
  const extension = baseName.includes(".") ? "" : typeExtension && typeExtension.length > 0 ? typeExtension : "bin";
  const finalName = extension ? `${baseName}.${extension}` : baseName;
  const arrayBuffer = await file.arrayBuffer();

  try {
    const blob = await put(`avatars/${userId}/${randomUUID()}-${finalName}`, Buffer.from(arrayBuffer), {
      access: "public",
      contentType: file.type || "application/octet-stream",
    });

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Avatar upload failed" },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
