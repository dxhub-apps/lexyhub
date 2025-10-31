"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

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
  const activePlanSummary = useMemo(() => PLAN_SUMMARY[billing.plan], [billing.plan]);

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
      const response = await fetch(`/api/profile?userId=${DEFAULT_USER_ID}`, {
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
      <header className="profile-header">
        <div>
          <h1>Profile &amp; Billing</h1>
          <p>Control how LexyHub syncs your Etsy shop, AI Market Twin simulations, and billing cadence.</p>
        </div>
        <div className="profile-header-meta">
          <span className="badge">Account Center</span>
          <span>Plan: {billing.plan.toUpperCase()}</span>
        </div>
      </header>

      <div className="profile-grid">
        <form className="profile-card" onSubmit={handleProfileSubmit}>
          <h2>Profile</h2>
          <p className="profile-muted">Update the contact details stored alongside your Supabase user profile.</p>

          <label>
            <span>Full name</span>
            <input
              value={profile.fullName}
              onChange={(event) => setProfile((state) => ({ ...state, fullName: event.target.value }))}
              disabled={loading}
            />
          </label>

          <label>
            <span>Email</span>
            <input
              type="email"
              value={profile.email}
              onChange={(event) => setProfile((state) => ({ ...state, email: event.target.value }))}
              disabled={loading}
            />
          </label>

          <label>
            <span>Company</span>
            <input
              value={profile.company}
              onChange={(event) => setProfile((state) => ({ ...state, company: event.target.value }))}
              disabled={loading}
            />
          </label>

          <label>
            <span>Bio</span>
            <textarea
              rows={3}
              value={profile.bio}
              onChange={(event) => setProfile((state) => ({ ...state, bio: event.target.value }))}
              disabled={loading}
            />
          </label>

          <label>
            <span>Timezone</span>
            <input
              value={profile.timezone}
              onChange={(event) => setProfile((state) => ({ ...state, timezone: event.target.value }))}
              disabled={loading}
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

          <button type="submit" disabled={loading}>
            Save profile
          </button>
        </form>

        <form className="profile-card" onSubmit={handleBillingSubmit}>
          <h2>Billing</h2>
          <p className="profile-muted">Manage subscription status, billing email, and payment method labels.</p>

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

          <label className="profile-checkbox">
            <input
              type="checkbox"
              checked={billing.autoRenew}
              onChange={(event) => setBilling((state) => ({ ...state, autoRenew: event.target.checked }))}
              disabled={loading}
            />
            <span>Auto-renew plan</span>
          </label>

          <label>
            <span>Payment method label</span>
            <input
              value={billing.paymentMethod}
              onChange={(event) => setBilling((state) => ({ ...state, paymentMethod: event.target.value }))}
              disabled={loading}
            />
          </label>

          <button type="submit" disabled={loading}>
            Save billing settings
          </button>

          <button type="button" className="profile-secondary" onClick={handleCancelPlan} disabled={loading}>
            Cancel at period end
          </button>
        </form>

        <aside className="profile-card">
          <h2>Subscription</h2>
          <p className="profile-muted">Status and history are sourced directly from Supabase billing tables.</p>

          <dl className="profile-subscription">
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
            <div>
              <dt>Plan summary</dt>
              <dd>{activePlanSummary}</dd>
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
        </aside>
      </div>
    </div>
  );
}
