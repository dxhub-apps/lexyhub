"use client";

import { FormEvent, useMemo, useState } from "react";

import { useToast } from "@/components/ui/ToastProvider";

const PLAN_SUMMARY: Record<string, string> = {
  spark: "Starter access with 100 keyword queries and Market Twin previews.",
  scale: "Full Etsy sync, Market Twin history, and quota multipliers.",
  apex: "Unlimited sources, dedicated analyst hours, and real-time refreshes.",
};

const BILLING_HISTORY = [
  { id: "inv_1203", period: "May 2024", total: "$249.00", status: "Paid" },
  { id: "inv_1202", period: "Apr 2024", total: "$249.00", status: "Paid" },
  { id: "inv_1201", period: "Mar 2024", total: "$249.00", status: "Paid" },
];

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
  const activePlanSummary = useMemo(() => PLAN_SUMMARY[billing.plan], [billing.plan]);

  const handleProfileSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    push({
      title: "Profile updated",
      description: "Your preferences are saved and synced with upcoming Etsy refreshes.",
      tone: "success",
    });
  };

  const handleBillingSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    push({
      title: "Subscription settings saved",
      description: "Billing preferences now align with your Market Twin quotas.",
      tone: "success",
    });
  };

  const handleCancelPlan = () => {
    push({
      title: "Cancellation scheduled",
      description: "Your plan will remain active until the current cycle ends.",
      tone: "warning",
    });
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
            <div className="profile-plan-selector">
              {(["spark", "scale", "apex"] as BillingPreferences["plan"][]).map((plan) => (
                <button
                  key={plan}
                  type="button"
                  className={`profile-plan ${billing.plan === plan ? "profile-plan-active" : ""}`}
                  onClick={() => setBilling((state) => ({ ...state, plan }))}
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
              {BILLING_HISTORY.map((invoice) => (
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
