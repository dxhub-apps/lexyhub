"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, useSupabaseClient } from "@supabase/auth-helpers-react";

import { useTheme, type ThemeOption } from "@/components/theme/ThemeProvider";

const AVATAR_URL = "https://avatar.vercel.sh/lexyhub.svg?size=72&background=111827";

type UserMenuProps = {
  environmentLabel: string;
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

export function UserMenu({ environmentLabel }: UserMenuProps): JSX.Element {
  const router = useRouter();
  const session = useSession();
  const supabase = useSupabaseClient();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState(AVATAR_URL);
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

  const profileName = useMemo(() => {
    if (!user) {
      return "Signed out";
    }
    const fullName = (user.user_metadata?.full_name as string | undefined)?.trim();
    if (fullName) {
      return fullName;
    }
    const email = user?.email ?? "Account";
    return email.split("@")[0];
  }, [user]);

  const profileEmail = user?.email ?? "";
  const resolvedAvatarUrl = useMemo(() => {
    const rawUrl = (user?.user_metadata?.avatar_url as string | undefined) ?? "";
    const trimmedUrl = typeof rawUrl === "string" ? rawUrl.trim() : "";
    return trimmedUrl || AVATAR_URL;
  }, [user]);

  useEffect(() => {
    setAvatarSrc(resolvedAvatarUrl);
  }, [resolvedAvatarUrl]);

  const logout = async () => {
    await supabase.auth.signOut();
    setOpen(false);
    router.replace("/login");
    router.refresh();
  };

  const menuItems: MenuItem[] = [
    {
      label: "Theme",
      description: `Following ${theme === "system" ? "system" : theme} preference`,
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
    user
      ? {
          label: "Profile",
          description: "Manage account",
          href: "/profile",
          icon: <UserIcon />,
        }
      : null,
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
          onError={() => setAvatarSrc(AVATAR_URL)}
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
          <div className="user-menu-section" aria-label="Theme controls">
            <span className="user-menu-section-label">Theme</span>
            <div className="user-menu-theme-options">
              {menuItems[0].subMenu?.options.map((option) => {
                const isActive = theme === option.value || (theme === "system" && option.value === "system");
                const highlight = option.value === "system" ? isActive : option.value === resolvedTheme;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`theme-choice ${highlight ? "theme-choice-active" : ""}`}
                    onClick={() => setTheme(option.value)}
                  >
                    {option.icon}
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="user-menu-section" role="none">
            {menuItems.slice(1).map((item) => {
              const content = (
                <div className="user-menu-item-inner">
                  {item.icon}
                  <div>
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
                    onClick={() => setOpen(false)}
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
