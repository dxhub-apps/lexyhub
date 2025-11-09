"use client";

export const dynamic = 'force-dynamic';

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { upload } from "@vercel/blob/client";
import { useSession } from "@supabase/auth-helpers-react";
import { User, Upload } from "lucide-react";

import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type ProfileDetails = {
  fullName: string;
  email: string;
  company: string;
  bio: string;
  timezone: string;
  notifications: boolean;
  avatarUrl: string;
};

const EMPTY_PROFILE: ProfileDetails = {
  fullName: "",
  email: "",
  company: "",
  bio: "",
  timezone: "",
  notifications: false,
  avatarUrl: "",
};

const AVATAR_FALLBACK = "https://avatar.vercel.sh/lexyhub.svg?size=120&background=111827";

export default function ProfilePage(): JSX.Element {
  const { toast } = useToast();
  const session = useSession();
  const userId = session?.user?.id ?? null;
  const [profile, setProfile] = useState<ProfileDetails>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const loadData = useCallback(async () => {
    if (!userId) {
      setProfile(EMPTY_PROFILE);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const profileResponse = await fetch(`/api/profile?userId=${encodeURIComponent(userId)}`);
      if (!profileResponse.ok) {
        const payload = await profileResponse.json().catch(() => ({}));
        throw new Error(payload.error ?? `Failed to load profile (${profileResponse.status})`);
      }
      const profileJson = (await profileResponse.json()) as {
        profile?: Partial<ProfileDetails>;
      };
      if (profileJson.profile) {
        setProfile({ ...EMPTY_PROFILE, ...profileJson.profile });
      }
    } catch (error) {
      toast({
        title: "Profile unavailable",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, userId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId) {
      toast({
        title: "Profile unavailable",
        description: "You must be signed in to update your profile.",
        variant: "destructive",
      });
      return;
    }
    try {
      const response = await fetch(`/api/profile?userId=${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json.error ?? "Failed to update profile");
      }
      toast({
        title: "Profile updated",
        description: "Your changes have been saved successfully.",
        variant: "success",
      });
      await loadData();
    } catch (error) {
      toast({
        title: "Profile update failed",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    }
  };

  const handleAvatarSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!userId) {
      toast({
        title: "Avatar unavailable",
        description: "You must be signed in to update your profile photo.",
        variant: "destructive",
      });
      return;
    }

    const resetInput = () => {
      if (avatarInputRef.current) {
        avatarInputRef.current.value = "";
      }
    };

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Unsupported file",
        description: "Please choose a PNG, JPG, or WebP image.",
        variant: "destructive",
      });
      resetInput();
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Image too large",
        description: "Avatars must be smaller than 5MB.",
        variant: "destructive",
      });
      resetInput();
      return;
    }

    setAvatarUploading(true);

    try {
      const sanitizedName = file.name
        .toLowerCase()
        .replace(/[^a-z0-9_.-]+/g, "-")
        .replace(/-{2,}/g, "-")
        .replace(/^-+|-+$/g, "");
      const pathname = `users/${userId}/avatar-${Date.now()}-${sanitizedName || "upload"}`;

      const uploaded = await upload(pathname, file, {
        access: "public",
        contentType: file.type,
        handleUploadUrl: "/api/profile/avatar",
        clientPayload: JSON.stringify({ userId }),
      });

      const response = await fetch(`/api/profile?userId=${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: uploaded.url }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json.error ?? "Failed to update avatar");
      }

      setProfile((state) => ({ ...state, avatarUrl: uploaded.url }));
      toast({
        title: "Avatar updated",
        description: "Your profile photo is refreshed.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Avatar upload failed",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setAvatarUploading(false);
      resetInput();
    }
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <User className="h-6 w-6 text-muted-foreground" />
            <div className="space-y-1">
              <CardTitle className="text-3xl font-bold">Profile Settings</CardTitle>
              <CardDescription className="text-base">
                Manage your account details and notification preferences.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update the information that appears in your workspace and notifications.</CardDescription>
            </div>
          </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileSubmit} className="space-y-6">
                <div className="flex items-start gap-6">
                  <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={profile.avatarUrl || AVATAR_FALLBACK}
                      alt={profile.fullName ? `${profile.fullName}'s avatar` : "Profile avatar"}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-2">
                    <input
                      ref={avatarInputRef}
                      id="profile-avatar-input"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      onChange={handleAvatarSelect}
                      disabled={avatarUploading || loading}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={avatarUploading || loading}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      {avatarUploading ? "Uploading…" : "Change avatar"}
                    </Button>
                    <p className="text-xs text-muted-foreground">Use a clear square image under 5MB (PNG, JPG, or WebP).</p>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="full-name">Full name</Label>
                    <Input
                      id="full-name"
                      value={profile.fullName}
                      onChange={(event) => setProfile((state) => ({ ...state, fullName: event.target.value }))}
                      disabled={loading}
                      placeholder="Your name"
                      autoComplete="name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profile.email}
                      onChange={(event) => setProfile((state) => ({ ...state, email: event.target.value }))}
                      disabled={loading}
                      placeholder="you@company.com"
                      autoComplete="email"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="company">Company</Label>
                    <Input
                      id="company"
                      value={profile.company}
                      onChange={(event) => setProfile((state) => ({ ...state, company: event.target.value }))}
                      disabled={loading}
                      placeholder="LexyHub"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Input
                      id="timezone"
                      value={profile.timezone}
                      onChange={(event) => setProfile((state) => ({ ...state, timezone: event.target.value }))}
                      disabled={loading}
                      placeholder="America/Chicago"
                      autoComplete="timezone"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    rows={3}
                    value={profile.bio}
                    onChange={(event) => setProfile((state) => ({ ...state, bio: event.target.value }))}
                    disabled={loading}
                    placeholder="Share a short intro for teammates."
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    id="notifications"
                    type="checkbox"
                    checked={profile.notifications}
                    onChange={(event) => setProfile((state) => ({ ...state, notifications: event.target.checked }))}
                    disabled={loading}
                    className="h-4 w-4 rounded border-input"
                  />
                  <Label htmlFor="notifications" className="cursor-pointer font-normal">Send product notifications</Label>
                </div>

                <Button type="submit" disabled={loading}>Save profile</Button>
              </form>
            </CardContent>
          </Card>
      </div>
    </div>
  );
}
