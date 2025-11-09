"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, useSupabaseClient } from "@supabase/auth-helpers-react";
import { User, CreditCard, Users, HelpCircle, LogOut, Sun, Moon, Monitor, Palette } from "lucide-react";

import { useTheme, type ThemeOption } from "@/components/theme/ThemeProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const AVATAR_URL = "https://avatar.vercel.sh/lexyhub.svg?size=72&background=111827";

function normalizeAvatarUrl(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return AVATAR_URL;
  if (trimmed.startsWith("data:")) return trimmed;

  try {
    const url = new URL(trimmed);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
  } catch {
    // Invalid URL, fall through to default
  }

  return AVATAR_URL;
}

type ProfileData = {
  fullName: string;
  email: string;
  avatarUrl: string;
};

export function UserMenu(): JSX.Element {
  const router = useRouter();
  const session = useSession();
  const supabase = useSupabaseClient();
  const { theme, setTheme } = useTheme();
  const [profile, setProfile] = useState<ProfileData | null>(null);

  const user = session?.user ?? null;

  // Fetch profile data
  useEffect(() => {
    if (!user?.id) {
      setProfile(null);
      return;
    }

    let active = true;
    const controller = new AbortController();

    const loadProfile = async () => {
      try {
        const response = await fetch(`/api/profile?userId=${user.id}`, {
          signal: controller.signal,
        });
        const json = (await response.json().catch(() => ({}))) as {
          profile?: ProfileData;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(json.error ?? "Failed to load profile");
        }

        if (active) {
          setProfile(json.profile ?? null);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Failed to load user profile", error);
        if (active) {
          setProfile(null);
        }
      }
    };

    loadProfile();

    return () => {
      active = false;
      controller.abort();
    };
  }, [user?.id]);

  const profileName = useMemo(() => {
    if (profile?.fullName?.trim()) {
      return profile.fullName.trim();
    }

    if (!user) return "Signed out";

    const fullName = (user.user_metadata?.full_name as string | undefined)?.trim();
    if (fullName) return fullName;

    const email = user?.email ?? "Account";
    return email.split("@")[0];
  }, [profile?.fullName, user]);

  const profileEmail = useMemo(() => {
    if (profile?.email?.trim()) {
      return profile.email.trim();
    }
    return user?.email ?? "";
  }, [profile?.email, user?.email]);

  const avatarUrl =
    (profile?.avatarUrl?.trim() || (user?.user_metadata?.avatar_url as string | undefined)) ??
    AVATAR_URL;

  const normalizedAvatar = useMemo(() => normalizeAvatarUrl(avatarUrl), [avatarUrl]);
  const [avatarSrc, setAvatarSrc] = useState(() => normalizedAvatar);

  useEffect(() => {
    setAvatarSrc(normalizedAvatar);
  }, [normalizedAvatar]);

  const handleAvatarError = useCallback(() => {
    setAvatarSrc((current) => (current === AVATAR_URL ? current : AVATAR_URL));
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  const themeIcon = {
    light: <Sun className="h-4 w-4" />,
    dark: <Moon className="h-4 w-4" />,
    system: <Monitor className="h-4 w-4" />,
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 sm:h-11 sm:w-11 rounded-full p-0 overflow-hidden">
          <Image
            src={avatarSrc}
            alt="User avatar"
            className="rounded-full object-cover aspect-square"
            width={44}
            height={44}
            unoptimized={avatarSrc.startsWith("data:")}
            onError={handleAvatarError}
            priority={false}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{profileName}</p>
            {profileEmail && (
              <p className="text-xs leading-none text-muted-foreground">
                {profileEmail}
              </p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {user && (
          <>
            <DropdownMenuItem>
              <Link href="/profile" className="flex w-full items-center">
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Link href="/billing" className="flex w-full items-center">
                <CreditCard className="mr-2 h-4 w-4" />
                <span>Billing</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Link href="/referrals" className="flex w-full items-center">
                <Users className="mr-2 h-4 w-4" />
                <span>Referrals</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Link href="/help" className="flex w-full items-center">
                <HelpCircle className="mr-2 h-4 w-4" />
                <span>Help</span>
              </Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Palette className="mr-2 h-4 w-4" />
            <span>Theme</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as ThemeOption)}>
              <DropdownMenuRadioItem value="light">
                <Sun className="mr-2 h-4 w-4" />
                Light
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">
                <Moon className="mr-2 h-4 w-4" />
                Dark
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">
                <Monitor className="mr-2 h-4 w-4" />
                System
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {user && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Logout</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
