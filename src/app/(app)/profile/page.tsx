"use client";

import Image from "next/image";
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/ui/ToastProvider";

const PLAN_SUMMARY: Record<string, string> = {
  spark: "Starter access with 100 keyword queries and Market Twin previews.",
  scale: "Full Etsy sync, Market Twin history, and quota multipliers.",
  apex: "Unlimited sources, dedicated analyst hours, and real-time refreshes.",
};

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001";

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

export default function ProfilePage(): JSX.Element {
  const { push } = useToast();
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
  const activePlanSummary = useMemo(() => PLAN_SUMMARY[billing.plan], [billing.plan]);
  const formattedSubscriptionStatus = useMemo(
    () => (subscriptionStatus || "unknown").replace(/_/g, " "),
    [subscriptionStatus],
  );
  const subscriptionStatusClass = useMemo(
    () => (subscriptionStatus || "unknown").replace(/[^a-z0-9-]/gi, "-"),
    [subscriptionStatus],
  );
  const avatarFallback = useMemo(() => {
    const source = profile.fullName || profile.email || "LexyHub";
    const character = source.trim().charAt(0).toUpperCase();
    return character || "L";
  }, [profile.fullName, profile.email]);

  const persistProfile = useCallback(async (nextProfile: ProfileDetails) => {
    const response = await fetch(`/api/profile?userId=${DEFAULT_USER_ID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextProfile),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(json.error ?? "Failed to update profile");
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const profileResponse = await fetch(`/api/profile?userId=${DEFAULT_USER_ID}`);
      if (!profileResponse.ok) {
        const payload = await profileResponse.json().catch(() => ({}));
        throw new Error(payload.error ?? `Failed to load profile (${profileResponse.status})`);
      }
      const profileJson = (await profileResponse.json()) as {
        profile?: ProfileDetails;
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
      const response = await fetch(`/api/billing/subscription?userId=${DEFAULT_USER_ID}`);
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
  }, [push]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await persistProfile(profile);
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

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setAvatarUploading(true);
    const previousProfile = { ...profile };

    try {
      const data = new FormData();
      data.append("file", file);

      const response = await fetch(`/api/profile/avatar?userId=${DEFAULT_USER_ID}`, {
        method: "POST",
        body: data,
      });
      const json = (await response.json().catch(() => ({}))) as { url?: string; error?: string };

      if (!response.ok || !json.url) {
        throw new Error(json.error ?? "Failed to upload avatar");
      }

      const nextProfile = { ...profile, avatarUrl: json.url };
      setProfile(nextProfile);
      try {
        await persistProfile(nextProfile);
      } catch (error) {
        setProfile(previousProfile);
        throw error;
      }

      push({
        title: "Avatar updated",
        description: "Your new photo is saved to Supabase.",
        tone: "success",
      });
      await loadData();
    } catch (error) {
      push({
        title: "Avatar upload failed",
        description: error instanceof Error ? error.message : String(error),
        tone: "error",
      });
    } finally {
      setAvatarUploading(false);
      event.target.value = "";
    }
  };

  const handleAvatarRemove = async () => {
    if (!profile.avatarUrl) {
      return;
    }

    setAvatarUploading(true);
    const nextProfile = { ...profile, avatarUrl: "" };

    try {
      await persistProfile(nextProfile);
      setProfile(nextProfile);
      push({
        title: "Avatar removed",
        description: "We cleared your profile photo from Supabase settings.",
        tone: "success",
      });
      await loadData();
    } catch (error) {
      push({
        title: "Avatar removal failed",
        description: error instanceof Error ? error.message : String(error),
        tone: "error",
      });
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleBillingSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const response = await fetch(`/api/billing/subscription?userId=${DEFAULT_USER_ID}`, {
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
    try {
      const response = await fetch(`/api/billing/subscription?userId=${DEFAULT_USER_ID}`, {
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
      <section className="profile-hero">
        <div>
          <h1>Profile &amp; Billing</h1>
          <p>Control how LexyHub syncs your Etsy shop, AI Market Twin simulations, and billing cadence.</p>
        </div>
        <div className="profile-hero__meta">
          <span className="profile-hero__badge">Account Center</span>
          <span className="profile-hero__plan">Plan: {billing.plan.toUpperCase()}</span>
        </div>
      </section>

      <div className="profile-layout">
        <form className="form-card profile-section" onSubmit={handleProfileSubmit}>
          <div className="profile-section__header">
            <div>
              <h2>Profile</h2>
              <p className="profile-section__description">
                Update the contact details stored alongside your Supabase user profile.
              </p>
            </div>
          </div>

          <div className="profile-avatar-upload">
            <div className="profile-avatar-preview">
              {profile.avatarUrl ? (
                <Image
                  src={profile.avatarUrl}
                  alt="User avatar"
                  width={72}
                  height={72}
                  className="profile-avatar-image"
                />
              ) : (
                <span className="profile-avatar-placeholder">{avatarFallback}</span>
              )}
            </div>
            <div className="profile-avatar-actions">
              <span className="profile-avatar-label">Profile photo</span>
              <label className="button button-secondary profile-avatar-picker">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  disabled={loading || avatarUploading}
                />
                {avatarUploading ? "Uploading…" : "Upload new"}
              </label>
              {profile.avatarUrl ? (
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={handleAvatarRemove}
                  disabled={loading || avatarUploading}
                >
                  Remove avatar
                </button>
              ) : null}
              <p className="profile-avatar-hint">PNG, JPG, or GIF up to 5 MB.</p>
            </div>
          </div>

          <div className="form-grid form-grid--profile">
            <label>
              <span>Full name</span>
              <input
                value={profile.fullName}
                onChange={(event) => setProfile((state) => ({ ...state, fullName: event.target.value }))}
                disabled={loading || avatarUploading}
              />
            </label>

            <label>
              <span>Email</span>
              <input
                type="email"
                value={profile.email}
                onChange={(event) => setProfile((state) => ({ ...state, email: event.target.value }))}
                disabled={loading || avatarUploading}
              />
            </label>

            <label>
              <span>Company</span>
              <input
                value={profile.company}
                onChange={(event) => setProfile((state) => ({ ...state, company: event.target.value }))}
                disabled={loading || avatarUploading}
              />
            </label>

            <label>
              <span>Timezone</span>
              <input
                value={profile.timezone}
                onChange={(event) => setProfile((state) => ({ ...state, timezone: event.target.value }))}
                disabled={loading || avatarUploading}
              />
            </label>

            <label className="form-grid--full">
              <span>Bio</span>
              <textarea
                rows={3}
                value={profile.bio}
                onChange={(event) => setProfile((state) => ({ ...state, bio: event.target.value }))}
                disabled={loading || avatarUploading}
              />
            </label>

            <label className="form-checkbox form-grid--full">
              <input
                type="checkbox"
                checked={profile.notifications}
                onChange={(event) => setProfile((state) => ({ ...state, notifications: event.target.checked }))}
                disabled={loading || avatarUploading}
              />
              <span>Send product notifications</span>
            </label>
          </div>

          <div className="profile-actions">
            <button className="button" type="submit" disabled={loading || avatarUploading}>
              Save profile
            </button>
          </div>
        </form>

        <form className="form-card profile-section" onSubmit={handleBillingSubmit}>
          <div className="profile-section__header">
            <div>
              <h2>Billing</h2>
              <p className="profile-section__description">
                Manage subscription status, billing email, and payment method labels.
              </p>
            </div>
          </div>

          <div className="form-grid">
            <label>
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

            <label>
              <span>Billing email</span>
              <input
                type="email"
                value={billing.billingEmail}
                onChange={(event) => setBilling((state) => ({ ...state, billingEmail: event.target.value }))}
                disabled={loading}
              />
            </label>

            <label className="form-checkbox form-grid--full">
              <input
                type="checkbox"
                checked={billing.autoRenew}
                onChange={(event) => setBilling((state) => ({ ...state, autoRenew: event.target.checked }))}
                disabled={loading}
              />
              <span>Auto-renew plan</span>
            </label>

            <label className="form-grid--full">
              <span>Payment method label</span>
              <input
                value={billing.paymentMethod}
                onChange={(event) => setBilling((state) => ({ ...state, paymentMethod: event.target.value }))}
                disabled={loading}
              />
            </label>
          </div>

          <div className="profile-actions">
            <button className="button" type="submit" disabled={loading}>
              Save billing settings
            </button>
            <button
              type="button"
              className="button button-ghost"
              onClick={handleCancelPlan}
              disabled={loading}
            >
              Cancel at period end
            </button>
          </div>
        </form>

        <aside className="form-card profile-subscription">
          <div>
            <h2>Subscription</h2>
            <p className="profile-section__description">
              Status and history are sourced directly from Supabase billing tables.
            </p>
          </div>

          <dl className="profile-subscription__grid">
            <div>
              <dt>Status</dt>
              <dd>
                <span className={`status-pill status-${subscriptionStatusClass}`}>
                  {formattedSubscriptionStatus}
                </span>
              </dd>
            </div>
            <div>
              <dt>Auto-renew</dt>
              <dd>{billing.autoRenew ? "Enabled" : "Disabled"}</dd>
            </div>
            <div>
              <dt>Current period end</dt>
              <dd>{periodEnd ? new Date(periodEnd).toLocaleString() : "—"}</dd>
            </div>
            <div>
              <dt>Plan summary</dt>
              <dd>{activePlanSummary}</dd>
            </div>
          </dl>

          <div>
            <h3>Invoice history</h3>
            <ul className="profile-invoices">
              {invoiceHistory.length === 0 ? <li>No invoices yet.</li> : null}
              {invoiceHistory.map((invoice) => (
                <li key={invoice.id}>
                  <div>
                    <strong>{invoice.period}</strong>
                    <span className="muted">{invoice.status.replace(/_/g, " ")}</span>
                  </div>
                  <span>{invoice.total}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
