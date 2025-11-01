import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import { getSupabaseServerClient } from "@/lib/supabase-server";

const ALLOWED_AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5 MB

type UploadPayload = {
  userId?: string;
};

function parsePayload(raw: string | null | undefined): UploadPayload {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as UploadPayload;
    return parsed ?? {};
  } catch {
    return {};
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();

  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (_pathname, clientPayload, multipart) => {
        if (multipart) {
          throw new Error("Avatar uploads must be under 5MB");
        }

        const { userId } = parsePayload(clientPayload);
        if (!userId) {
          throw new Error("userId missing from upload payload");
        }

        return {
          allowedContentTypes: ALLOWED_AVATAR_TYPES,
          maximumSizeInBytes: MAX_AVATAR_SIZE,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId }),
        };
      },
      onUploadCompleted:
        supabase == null
          ? undefined
          : async ({ blob, tokenPayload }) => {
              const { userId } = parsePayload(tokenPayload);
              if (!userId) {
                return;
              }

              const { data: existing, error: fetchError } = await supabase
                .from("user_profiles")
                .select("plan, momentum, settings")
                .eq("user_id", userId)
                .maybeSingle();

              if (fetchError && fetchError.code !== "PGRST116") {
                console.error("Failed to load profile while saving avatar", fetchError.message);
                return;
              }

              const settings = { ...(existing?.settings ?? {}) } as Record<string, unknown>;
              const profileSettings = {
                ...(settings.profile as Record<string, unknown> | undefined),
                avatarUrl: blob.url,
              };
              settings.profile = profileSettings;

              const { error: upsertError } = await supabase
                .from("user_profiles")
                .upsert(
                  {
                    user_id: userId,
                    plan: existing?.plan ?? "free",
                    momentum: existing?.momentum ?? "new",
                    settings,
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: "user_id" },
                );

              if (upsertError) {
                console.error("Failed to persist avatar URL", upsertError.message);
              }
            },
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload error" },
      { status: 400 },
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
