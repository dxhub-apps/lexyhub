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

export default function ProfilePage(): JSX.Element {
  const { push } = useToast();
  const [profile, setProfile] = useState<ProfileDetails>({
    fullName: "Aaliyah Growth",
    email: "aaliyah@lexyhub.ai",
    company: "LexyHub Labs",
    bio: "Commerce intelligence lead connecting Etsy sellers with AI Market Twins.",
    timezone: "America/Chicago",
    notifications: true,
  });
  const [billing, setBilling] = useState<BillingPreferences>({
    plan: "scale",
    billingEmail: "billing@lexyhub.ai",
    autoRenew: true,
    paymentMethod: "Visa •••• 4242",
  });
  const [invoiceHistory, setInvoiceHistory] = useState<InvoiceHistoryRow[]>([]);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>("active");
  const [periodEnd, setPeriodEnd] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const activePlanSummary = useMemo(() => PLAN_SUMMARY[billing.plan], [billing.plan]);

  const loadBilling = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/billing/subscription?userId=${DEFAULT_USER_ID}`);
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? "Failed to load billing data");
      }

      setBilling((state) => {
        const candidatePlan = (json.profile?.plan ?? json.subscription?.plan ?? state.plan) as BillingPreferences["plan"];
        const normalizedPlan: BillingPreferences["plan"] =
          candidatePlan === "spark" || candidatePlan === "scale" || candidatePlan === "apex"
            ? candidatePlan
            : state.plan;
        return {
          plan: normalizedPlan,
          billingEmail: json.subscription?.metadata?.billing_email ?? state.billingEmail,
          autoRenew: !(json.subscription?.cancel_at_period_end ?? false),
          paymentMethod: json.profile?.settings?.payment_method_label ?? state.paymentMethod,
        };
      });

      setInvoiceHistory(
        (json.invoices ?? []).map((invoice: {
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
        })),
      );

      setSubscriptionStatus(json.subscription?.status ?? "active");
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
    loadBilling();
  }, [loadBilling]);

  const handleProfileSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    push({
      title: "Profile updated",
      description: "Your preferences are saved and synced with upcoming Etsy refreshes.",
      tone: "success",
    });
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
        description: "Billing preferences now align with your Market Twin quotas.",
        tone: "success",
      });
      await loadBilling();
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
      await loadBilling();
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
          <span className="badge">Sprint 4 Feature</span>
          <span>Plan: {billing.plan.toUpperCase()}</span>
        </div>
      </header>

      <div className="profile-grid">
        <form className="profile-card" onSubmit={handleProfileSubmit}>
          <div className="profile-card-header">
            <h2>Account preferences</h2>
            <p>Update your personal details, company context, and notification cadence.</p>
          </div>
          <div className="profile-form-grid">
            <label>
              <span>Full name</span>
              <input
                type="text"
                value={profile.fullName}
                onChange={(event) => setProfile((state) => ({ ...state, fullName: event.target.value }))}
                required
              />
            </label>
            <label>
              <span>Email</span>
              <input
                type="email"
                value={profile.email}
                onChange={(event) => setProfile((state) => ({ ...state, email: event.target.value }))}
                required
              />
            </label>
            <label>
              <span>Company</span>
              <input
                type="text"
                value={profile.company}
                onChange={(event) => setProfile((state) => ({ ...state, company: event.target.value }))}
                placeholder="LexyHub Labs"
              />
            </label>
            <label>
              <span>Timezone</span>
              <select
                value={profile.timezone}
                onChange={(event) => setProfile((state) => ({ ...state, timezone: event.target.value }))}
              >
                <option value="America/Chicago">America/Chicago</option>
                <option value="America/New_York">America/New_York</option>
                <option value="Europe/London">Europe/London</option>
                <option value="Asia/Tokyo">Asia/Tokyo</option>
              </select>
            </label>
            <label className="profile-textarea">
              <span>Mission brief</span>
              <textarea
                value={profile.bio}
                onChange={(event) => setProfile((state) => ({ ...state, bio: event.target.value }))}
                rows={4}
              />
            </label>
          </div>

          <label className="profile-toggle">
            <input
              type="checkbox"
              checked={profile.notifications}
              onChange={(event) => setProfile((state) => ({ ...state, notifications: event.target.checked }))}
            />
            <div>
              <strong>Send product and billing notifications</strong>
              <span>Receive AI Market Twin insights, billing reminders, and quota alerts.</span>
            </div>
          </label>

          <div className="profile-card-actions">
            <button type="submit" className="profile-primary">
              Save profile
            </button>
            <button type="button" className="profile-secondary" onClick={() => window.history.back()}>
              Cancel
            </button>
          </div>
        </form>

        <form className="profile-card" onSubmit={handleBillingSubmit}>
          <div className="profile-card-header">
            <h2>Subscription &amp; billing</h2>
            <p>Control your plan, payment method, and invoice routing.</p>
          </div>

          <div className="profile-plan-details">
            <div>
              <span className="profile-plan-label">Active plan</span>
              <strong>{billing.plan.toUpperCase()}</strong>
            </div>
            <p>{activePlanSummary}</p>
            <div className="profile-subscription-meta">
              <span>Status: {subscriptionStatus}</span>
              {periodEnd && <span>Renews {new Date(periodEnd).toLocaleDateString()}</span>}
            </div>
            <div className="profile-plan-selector">
              {(["spark", "scale", "apex"] as BillingPreferences["plan"][]).map((plan) => (
                <button
                  key={plan}
                  type="button"
                  className={`profile-plan ${billing.plan === plan ? "profile-plan-active" : ""}`}
                  onClick={() => setBilling((state) => ({ ...state, plan }))}
                  disabled={loading}
                >
                  <span>{plan.toUpperCase()}</span>
                  <small>{PLAN_SUMMARY[plan]}</small>
                </button>
              ))}
            </div>
          </div>

          <label>
            <span>Billing email</span>
            <input
              type="email"
              value={billing.billingEmail}
              onChange={(event) => setBilling((state) => ({ ...state, billingEmail: event.target.value }))}
            />
          </label>

          <label>
            <span>Payment method</span>
            <input
              type="text"
              value={billing.paymentMethod}
              onChange={(event) => setBilling((state) => ({ ...state, paymentMethod: event.target.value }))}
            />
          </label>

          <label className="profile-toggle">
            <input
              type="checkbox"
              checked={billing.autoRenew}
              onChange={(event) => setBilling((state) => ({ ...state, autoRenew: event.target.checked }))}
            />
            <div>
              <strong>Auto-renew subscription</strong>
              <span>Keep your Market Twin insights live without quota interruptions.</span>
            </div>
          </label>

          <div className="profile-card-actions">
            <button type="submit" className="profile-primary">
              Update billing
            </button>
            <button type="button" className="profile-danger" onClick={handleCancelPlan}>
              Cancel plan
            </button>
          </div>

          <section className="profile-card-subsection">
            <header>
              <h3>Billing history</h3>
              <span>Invoices route to {billing.billingEmail}</span>
            </header>
            <ul>
              {invoiceHistory.length === 0 && <li className="profile-history-empty">No invoices available yet.</li>}
              {invoiceHistory.map((invoice) => (
                <li key={invoice.id}>
                  <div>
                    <strong>{invoice.period}</strong>
                    <span>{invoice.id}</span>
                  </div>
                  <div>
                    <span>{invoice.total}</span>
                    <span className="profile-status-paid">{invoice.status}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </form>
      </div>
    </div>
  );
}
