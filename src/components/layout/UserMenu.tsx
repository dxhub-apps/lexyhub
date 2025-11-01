"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, useSupabaseClient } from "@supabase/auth-helpers-react";

import { useTheme, type ThemeOption } from "@/components/theme/ThemeProvider";

const AVATAR_URL = "https://avatar.vercel.sh/lexyhub.svg?size=72&background=111827";

function normalizeAvatarUrl(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return AVATAR_URL;
  }

  if (trimmed.startsWith("data:")) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
  } catch {
    // Ignore invalid URLs and fall through to the default avatar.
  }

  return AVATAR_URL;
}

type UserMenuProps = {
  environmentLabel: string;
};

type ProfileData = {
  fullName: string;
  email: string;
  avatarUrl: string;
};

type MenuItem = {
  label: string;
  description?: string;
  href?: string;
  action?: () => void;
  icon: JSX.Element;
  subMenu?: {
    label: string;
    options: Array<{ value: ThemeOption; label: string; icon: JSX.Element }>;
  };
};

function formatThemeLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width={18} height={18} className="menu-icon">
      <path
        fill="currentColor"
        d="M12 7a5 5 0 1 1 0 10a5 5 0 0 1 0-10m0-5a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1m0 18a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0v-2a1 1 0 0 1 1-1M3 11h2a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2m16 0h2a1 1 0 1 1 0 2h-2a1 1 0 1 1 0-2M5.64 5.64a1 1 0 0 1 1.41 0L8.4 7a1 1 0 1 1-1.41 1.41L5.64 7.05a1 1 0 0 1 0-1.41m10.96 10.96a1 1 0 0 1 1.41 0l1.35 1.35a1 1 0 0 1-1.41 1.41l-1.35-1.35a1 1 0 0 1 0-1.41m0-10.96l1.35-1.35a1 1 0 0 1 1.41 1.41l-1.35 1.35A1 1 0 1 1 16.6 7m-10.96 10.96l1.35 1.35a1 1 0 0 1-1.41 1.41l-1.35-1.35a1 1 0 1 1 1.41-1.41"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width={18} height={18} className="menu-icon">
      <path
        fill="currentColor"
        d="M12.01 2a1 1 0 0 1 .95.68a8 8 0 0 0 8.36 5.3a1 1 0 0 1 .96 1.45A9.98 9.98 0 1 1 11.3 1.06a1 1 0 0 1 .71.94ZM12 4.27a7.98 7.98 0 0 0 7.57 6.83A7.98 7.98 0 1 1 12 4.27Z"
      />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width={18} height={18} className="menu-icon">
      <path
        fill="currentColor"
        d="M4 5a3 3 0 0 0-3 3v7a3 3 0 0 0 3 3h5v1H7a1 1 0 1 0 0 2h10a1 1 0 1 0 0-2h-2v-1h5a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3H4Zm-1 3a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8Z"
      />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width={18} height={18} className="menu-icon">
      <path
        fill="currentColor"
        d="M12 2a5 5 0 1 0 0 10a5 5 0 0 0 0-10m0 12c-5.33 0-8 3.16-8 6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1c0-2.84-2.67-6-8-6"
      />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width={18} height={18} className="menu-icon">
      <path
        fill="currentColor"
        d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2m.01 5a3.5 3.5 0 0 1 3.45 3.99l-.05.25a2.8 2.8 0 0 1-1.23 1.81l-.77.54a1 1 0 0 0-.41.81V14a1 1 0 0 1-2 0v-.75a2.8 2.8 0 0 1 1.23-2.31l.77-.54a.8.8 0 0 0 .34-.51l.05-.25A1.5 1.5 0 0 0 12 9a1 1 0 1 1 0-2m0 10.5a1.25 1.25 0 1 1-1.25 1.25A1.25 1.25 0 0 1 12 15.5"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width={18} height={18} className="menu-icon">
      <path
        fill="currentColor"
        d="M10 5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0V6h-6v12h6v-2a1 1 0 1 1 2 0v3a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1zm-1.7 4.3a1 1 0 0 0-1.4 1.4L8.6 12l-1.7 1.7a1 1 0 1 0 1.4 1.4L11 13.4a1 1 0 0 0 0-1.4z"
      />
    </svg>
  );
}

function ThemeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width={18} height={18} className="menu-icon">
      <path
        fill="currentColor"
        d="M12 2a10 10 0 0 0 0 20a10 10 0 0 0 0-20m0 2a8 8 0 0 1 0 16Z"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width={18} height={18} className="menu-icon">
      <path
        fill="currentColor"
        d="M12 15.5a3.5 3.5 0 1 1 0-7a3.5 3.5 0 0 1 0 7m7.5-2v-3l-1.8-.4a6 6 0 0 0-.9-1.6l.4-1.8l-2.1-2.1l-1.8.4a6 6 0 0 0-1.6-.9L11.5 2h-3l-.4 1.8a6 6 0 0 0-1.6.9l-1.8-.4L2.6 6.4l.4 1.8a6 6 0 0 0-.9 1.6L0 10.5v3l1.8.4a6 6 0 0 0 .9 1.6l-.4 1.8l2.1 2.1l1.8-.4a6 6 0 0 0 1.6.9l.4 1.8h3l.4-1.8a6 6 0 0 0 1.6-.9l1.8.4l2.1-2.1l-.4-1.8a6 6 0 0 0 .9-1.6z"
      />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      width={18}
      height={18}
      className={`menu-icon user-menu-chevron${open ? " user-menu-chevron-open" : ""}`}
    >
      <path fill="currentColor" d="m8.5 10.5 3.5 3l3.5-3" />
    </svg>
  );
}

export function UserMenu({ environmentLabel }: UserMenuProps): JSX.Element {
  const router = useRouter();
  const session = useSession();
  const supabase = useSupabaseClient();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [activeSubMenu, setActiveSubMenu] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current) {
        return;
      }
      if (!menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const user = session?.user ?? null;

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
        if (controller.signal.aborted) {
          return;
        }
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

    if (!user) {
      return "Signed out";
    }
    const fullName = (user.user_metadata?.full_name as string | undefined)?.trim();
    if (fullName) {
      return fullName;
    }
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
    setOpen(false);
    router.replace("/login");
    router.refresh();
  };

  useEffect(() => {
    if (!open) {
      setActiveSubMenu(null);
    }
  }, [open]);

  const themeDescription = useMemo(() => {
    if (theme === "system") {
      return `Following system preference (${formatThemeLabel(resolvedTheme)})`;
    }
    return `${formatThemeLabel(theme)} theme active`;
  }, [resolvedTheme, theme]);

  const menuItems: MenuItem[] = [
    user
      ? {
          label: "Profile",
          description: "Manage account",
          href: "/profile",
          icon: <UserIcon />,
        }
      : null,
    user
      ? {
          label: "Settings",
          description: "Plan & team",
          href: "/settings",
          icon: <SettingsIcon />,
        }
      : null,
    {
      label: "Theme",
      description: themeDescription,
      icon: <ThemeIcon />,
      subMenu: {
        label: "Choose theme",
        options: [
          { value: "light", label: "Light", icon: <SunIcon /> },
          { value: "dark", label: "Dark", icon: <MoonIcon /> },
          { value: "system", label: "System", icon: <MonitorIcon /> },
        ],
      },
    },
    {
      label: "Help Center",
      description: "Guides & how-tos",
      href: "/docs",
      icon: <HelpIcon />,
    },
    user
      ? {
          label: "Logout",
          description: "End session",
          action: logout,
          icon: <LogoutIcon />,
        }
      : null,
  ].filter(Boolean) as MenuItem[];

  const toggleLabel = open ? "Close user menu" : "Open user menu";

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        type="button"
        className="user-menu-trigger"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={toggleLabel}
        onClick={() => setOpen((value) => !value)}
      >
        <Image
          src={avatarSrc}
          alt="User avatar"
          className="user-menu-avatar"
          width={36}
          height={36}
          unoptimized={avatarSrc.startsWith("data:")}
          onError={handleAvatarError}
        />
        <span className="sr-only">{toggleLabel}</span>
      </button>
      {open ? (
        <div className="user-menu-dropdown" role="menu">
          <div className="user-menu-header">
            <strong>{profileName}</strong>
            {profileEmail ? <span>{profileEmail}</span> : null}
            <span>{environmentLabel}</span>
          </div>
          <div className="user-menu-list" role="none">
            {menuItems.map((item) => {
              if (item.subMenu) {
                const isSubMenuOpen = activeSubMenu === item.label;
                return (
                  <div key={item.label} className="user-menu-group" role="none">
                    <button
                      type="button"
                      className={`user-menu-item${isSubMenuOpen ? " user-menu-item-active" : ""}`}
                      role="menuitem"
                      aria-haspopup="true"
                      aria-expanded={isSubMenuOpen}
                      onClick={() =>
                        setActiveSubMenu((current) => (current === item.label ? null : item.label))
                      }
                    >
                      <div className="user-menu-item-inner">
                        {item.icon}
                        <div className="user-menu-item-text">
                          <span>{item.label}</span>
                          {item.description ? <small>{item.description}</small> : null}
                        </div>
                        <ChevronIcon open={isSubMenuOpen} />
                      </div>
                    </button>
                    {isSubMenuOpen ? (
                      <div className="user-menu-submenu" role="group" aria-label={item.subMenu.label}>
                        {item.subMenu.options.map((option) => {
                          const isChecked =
                            option.value === "system" ? theme === "system" : resolvedTheme === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              className={`user-menu-submenu-item${
                                isChecked ? " user-menu-submenu-item-active" : ""
                              }`}
                              role="menuitemradio"
                              aria-checked={isChecked}
                              onClick={() => {
                                setTheme(option.value);
                              }}
                            >
                              {option.icon}
                              <span>{option.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              }

              const content = (
                <div className="user-menu-item-inner">
                  {item.icon}
                  <div className="user-menu-item-text">
                    <span>{item.label}</span>
                    {item.description ? <small>{item.description}</small> : null}
                  </div>
                </div>
              );

              if (item.href) {
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="user-menu-item"
                    role="menuitem"
                    onClick={() => {
                      setActiveSubMenu(null);
                      setOpen(false);
                    }}
                  >
                    {content}
                  </Link>
                );
              }

              return (
                <button
                  key={item.label}
                  type="button"
                  className="user-menu-item"
                  role="menuitem"
                  onClick={() => {
                    setActiveSubMenu(null);
                    item.action?.();
                    setOpen(false);
                  }}
                >
                  {content}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
