"use client";

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { upload } from "@vercel/blob/client";
import { useSession } from "@supabase/auth-helpers-react";

import { useToast } from "@/components/ui/ToastProvider";

const PLAN_SUMMARY: Record<string, string> = {
  spark: "Starter access with 100 keyword queries and Market Twin previews.",
  scale: "Full Etsy sync, Market Twin history, and quota multipliers.",
  apex: "Unlimited sources, dedicated analyst hours, and real-time refreshes.",
};

type InvoiceHistoryRow = {
  id: string;
  period: string;
  total: string;
  status: string;
};

function formatAmount(cents?: number | null): string {
  if (cents == null) {
    return "$0.00";
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

type ProfileDetails = {
  fullName: string;
  email: string;
  company: string;
  bio: string;
  timezone: string;
  notifications: boolean;
  avatarUrl: string;
};

type BillingPreferences = {
  plan: "spark" | "scale" | "apex";
  billingEmail: string;
  autoRenew: boolean;
  paymentMethod: string;
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
  const { push } = useToast();
  const session = useSession();
  const userId = session?.user?.id ?? null;
  const [profile, setProfile] = useState<ProfileDetails>(EMPTY_PROFILE);
  const [billing, setBilling] = useState<BillingPreferences>({
    plan: "spark",
    billingEmail: "",
    autoRenew: true,
    paymentMethod: "",
  });
  const [invoiceHistory, setInvoiceHistory] = useState<InvoiceHistoryRow[]>([]);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>("unknown");
  const [periodEnd, setPeriodEnd] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const activePlanSummary = useMemo(() => PLAN_SUMMARY[billing.plan], [billing.plan]);

  const loadData = useCallback(async () => {
    if (!userId) {
      setProfile(EMPTY_PROFILE);
      setBilling({ plan: "spark", billingEmail: "", autoRenew: true, paymentMethod: "" });
      setInvoiceHistory([]);
      setSubscriptionStatus("unknown");
      setPeriodEnd(null);
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
      push({
        title: "Profile unavailable",
        description: error instanceof Error ? error.message : String(error),
        tone: "error",
      });
    }

    try {
      const response = await fetch(`/api/billing/subscription?userId=${encodeURIComponent(userId)}`);
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? `Failed to load billing data (${response.status})`);
      }

      setBilling((state) => {
        const nextPlan = (json.profile?.plan ?? json.subscription?.plan ?? state.plan) as BillingPreferences["plan"];
        const normalizedPlan: BillingPreferences["plan"] =
          nextPlan === "spark" || nextPlan === "scale" || nextPlan === "apex" ? nextPlan : state.plan;

        const settings = (json.profile?.settings ?? {}) as { payment_method_label?: string };

        return {
          plan: normalizedPlan,
          billingEmail: json.subscription?.metadata?.billing_email ?? state.billingEmail ?? "",
          autoRenew: !(json.subscription?.cancel_at_period_end ?? false),
          paymentMethod: settings.payment_method_label ?? state.paymentMethod ?? "",
        };
      });

      setInvoiceHistory(
        (json.invoices ?? []).map(
          (invoice: {
            stripe_invoice_id: string;
            invoice_date: string;
            amount_paid_cents?: number;
            amount_due_cents?: number;
            status?: string;
          }) => ({
            id: invoice.stripe_invoice_id,
            period: invoice.invoice_date
              ? new Date(invoice.invoice_date).toLocaleDateString(undefined, { month: "short", year: "numeric" })
              : "—",
            total: formatAmount(invoice.amount_paid_cents ?? invoice.amount_due_cents ?? null),
            status: invoice.status ?? "open",
          }),
        ),
      );

      setSubscriptionStatus(json.subscription?.status ?? "unknown");
      setPeriodEnd(json.subscription?.current_period_end ?? null);
    } catch (error) {
      push({
        title: "Billing unavailable",
        description: error instanceof Error ? error.message : String(error),
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [push, userId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId) {
      push({
        title: "Profile unavailable",
        description: "You must be signed in to update your profile.",
        tone: "error",
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
      push({
        title: "Profile updated",
        description: "Your preferences are saved to Supabase.",
        tone: "success",
      });
      await loadData();
    } catch (error) {
      push({
        title: "Profile update failed",
        description: error instanceof Error ? error.message : String(error),
        tone: "error",
      });
    }
  };

  const handleAvatarSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!userId) {
      push({
        title: "Avatar unavailable",
        description: "You must be signed in to update your profile photo.",
        tone: "error",
      });
      return;
    }

    const resetInput = () => {
      if (avatarInputRef.current) {
        avatarInputRef.current.value = "";
      }
    };

    if (!file.type.startsWith("image/")) {
      push({
        title: "Unsupported file",
        description: "Please choose a PNG, JPG, or WebP image.",
        tone: "error",
      });
      resetInput();
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      push({
        title: "Image too large",
        description: "Avatars must be smaller than 5MB.",
        tone: "error",
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
      push({
        title: "Avatar updated",
        description: "Your profile photo is refreshed.",
        tone: "success",
      });
    } catch (error) {
      push({
        title: "Avatar upload failed",
        description: error instanceof Error ? error.message : String(error),
        tone: "error",
      });
    } finally {
      setAvatarUploading(false);
      resetInput();
    }
  };

  const handleBillingSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId) {
      push({
        title: "Subscription unavailable",
        description: "You must be signed in to manage billing preferences.",
        tone: "error",
      });
      return;
    }
    try {
      const response = await fetch(`/api/billing/subscription?userId=${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(billing),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? "Failed to update billing");
      }
      push({
        title: "Subscription settings saved",
        description: "Billing preferences are now stored in Supabase.",
        tone: "success",
      });
      await loadData();
    } catch (error) {
      push({
        title: "Update failed",
        description: error instanceof Error ? error.message : String(error),
        tone: "error",
      });
    }
  };

  const handleCancelPlan = async () => {
    if (!userId) {
      push({
        title: "Cancellation unavailable",
        description: "You must be signed in to manage your plan.",
        tone: "error",
      });
      return;
    }
    try {
      const response = await fetch(`/api/billing/subscription?userId=${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...billing, autoRenew: false }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? "Failed to schedule cancellation");
      }
      push({
        title: "Cancellation scheduled",
        description: "Your plan will remain active until the current cycle ends.",
        tone: "warning",
      });
      await loadData();
    } catch (error) {
      push({
        title: "Cancellation failed",
        description: error instanceof Error ? error.message : String(error),
        tone: "error",
      });
    }
  };

  return (
    <div className="profile-page">
      <header className="profile-hero">
        <div className="profile-hero-heading">
          <div>
            <h1>Profile &amp; Billing</h1>
            <p>
              Keep your workspace details and subscription preferences tidy. Upload a friendly avatar, confirm how we contact
              you, and tune your billing cadence.
            </p>
          </div>
          <span className="profile-plan-chip">Plan: {billing.plan.toUpperCase()}</span>
        </div>

        <dl className="profile-hero-stats">
          <div>
            <dt>Status</dt>
            <dd className={`status-${subscriptionStatus}`}>{subscriptionStatus}</dd>
          </div>
          <div>
            <dt>Auto-renew</dt>
            <dd>{billing.autoRenew ? "Enabled" : "Disabled"}</dd>
          </div>
          <div>
            <dt>Period end</dt>
            <dd>{periodEnd ? new Date(periodEnd).toLocaleString() : "—"}</dd>
          </div>
          <div>
            <dt>Plan summary</dt>
            <dd>{activePlanSummary}</dd>
          </div>
        </dl>
      </header>

      <div className="profile-layout">
        <div className="profile-main">
          <form className="profile-card profile-form" onSubmit={handleProfileSubmit}>
            <div className="profile-card-header">
              <div>
                <h2>Profile</h2>
                <p>Update the information that appears in your workspace and notifications.</p>
              </div>
              <span className="profile-card-badge">Account Center</span>
            </div>

            <div className="profile-avatar-row">
              <div className="profile-avatar">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={profile.avatarUrl || AVATAR_FALLBACK}
                  alt={profile.fullName ? `${profile.fullName}'s avatar` : "Profile avatar"}
                />
              </div>
              <div className="profile-avatar-actions">
                <input
                  ref={avatarInputRef}
                  id="profile-avatar-input"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={handleAvatarSelect}
                  disabled={avatarUploading || loading}
                />
                <button
                  type="button"
                  className="profile-button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarUploading || loading}
                >
                  {avatarUploading ? "Uploading…" : "Change avatar"}
                </button>
                <p>Use a clear square image under 5MB (PNG, JPG, or WebP).</p>
              </div>
            </div>

            <label className="profile-field">
              <span>Full name</span>
              <input
                value={profile.fullName}
                onChange={(event) => setProfile((state) => ({ ...state, fullName: event.target.value }))}
                disabled={loading}
                placeholder="Your name"
                autoComplete="name"
              />
            </label>

            <label className="profile-field">
              <span>Email</span>
              <input
                type="email"
                value={profile.email}
                onChange={(event) => setProfile((state) => ({ ...state, email: event.target.value }))}
                disabled={loading}
                placeholder="you@company.com"
                autoComplete="email"
              />
            </label>

            <label className="profile-field">
              <span>Company</span>
              <input
                value={profile.company}
                onChange={(event) => setProfile((state) => ({ ...state, company: event.target.value }))}
                disabled={loading}
                placeholder="LexyHub"
              />
            </label>

            <label className="profile-field">
              <span>Bio</span>
              <textarea
                rows={3}
                value={profile.bio}
                onChange={(event) => setProfile((state) => ({ ...state, bio: event.target.value }))}
                disabled={loading}
                placeholder="Share a short intro for teammates."
              />
            </label>

            <label className="profile-field">
              <span>Timezone</span>
              <input
                value={profile.timezone}
                onChange={(event) => setProfile((state) => ({ ...state, timezone: event.target.value }))}
                disabled={loading}
                placeholder="America/Chicago"
                autoComplete="timezone"
              />
            </label>

            <label className="profile-checkbox">
              <input
                type="checkbox"
                checked={profile.notifications}
                onChange={(event) => setProfile((state) => ({ ...state, notifications: event.target.checked }))}
                disabled={loading}
              />
              <span>Send product notifications</span>
            </label>

            <div className="profile-form-actions">
              <button type="submit" className="profile-button" disabled={loading}>
                Save profile
              </button>
            </div>
          </form>

          <form className="profile-card profile-form" onSubmit={handleBillingSubmit}>
            <div className="profile-card-header">
              <div>
                <h2>Billing</h2>
                <p>Control your renewal cadence, billing contact, and saved payment label.</p>
              </div>
            </div>

            <label className="profile-field">
              <span>Plan</span>
              <select
                value={billing.plan}
                onChange={(event) =>
                  setBilling((state) => ({ ...state, plan: event.target.value as BillingPreferences["plan"] }))
                }
                disabled={loading}
              >
                <option value="spark">Spark</option>
                <option value="scale">Scale</option>
                <option value="apex">Apex</option>
              </select>
            </label>

            <label className="profile-field">
              <span>Billing email</span>
              <input
                type="email"
                value={billing.billingEmail}
                onChange={(event) => setBilling((state) => ({ ...state, billingEmail: event.target.value }))}
                disabled={loading}
                placeholder="billing@company.com"
                autoComplete="email"
              />
            </label>

            <label className="profile-checkbox">
              <input
                type="checkbox"
                checked={billing.autoRenew}
                onChange={(event) => setBilling((state) => ({ ...state, autoRenew: event.target.checked }))}
                disabled={loading}
              />
              <span>Auto-renew plan</span>
            </label>

            <label className="profile-field">
              <span>Payment method label</span>
              <input
                value={billing.paymentMethod}
                onChange={(event) => setBilling((state) => ({ ...state, paymentMethod: event.target.value }))}
                disabled={loading}
                placeholder="Corporate Amex"
              />
            </label>

            <div className="profile-form-actions">
              <button type="submit" className="profile-button" disabled={loading}>
                Save billing settings
              </button>
              <button
                type="button"
                className="profile-button profile-button--secondary"
                onClick={handleCancelPlan}
                disabled={loading}
              >
                Cancel at period end
              </button>
            </div>
          </form>
        </div>

        <aside className="profile-sidebar">
          <section className="profile-card profile-summary">
            <h2>Subscription</h2>
            <p>Status and history sync directly from Supabase billing records.</p>

            <dl className="profile-summary-grid">
              <div>
                <dt>Current plan</dt>
                <dd>{billing.plan.toUpperCase()}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd className={`status-${subscriptionStatus}`}>{subscriptionStatus}</dd>
              </div>
              <div>
                <dt>Auto-renew</dt>
                <dd>{billing.autoRenew ? "Enabled" : "Disabled"}</dd>
              </div>
              <div>
                <dt>Current period end</dt>
                <dd>{periodEnd ? new Date(periodEnd).toLocaleString() : "—"}</dd>
              </div>
            </dl>

            <h3>Invoice history</h3>
            <ul className="profile-invoices">
              {invoiceHistory.length === 0 ? <li>No invoices yet.</li> : null}
              {invoiceHistory.map((invoice) => (
                <li key={invoice.id}>
                  <div>
                    <strong>{invoice.period}</strong>
                    <span>{invoice.status}</span>
                  </div>
                  <span>{invoice.total}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
