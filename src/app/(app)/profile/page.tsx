"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  List,
  ListItem,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

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
    <Stack spacing={3}>
      <Card>
        <CardHeader
          title="Profile & Billing"
          subheader="Control how LexyHub syncs your Etsy shop, AI Market Twin simulations, and billing cadence."
        />
        <CardContent>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
            <Chip label="Account Center" color="primary" variant="outlined" />
            <Typography variant="body2">Plan: {billing.plan.toUpperCase()}</Typography>
          </Stack>
        </CardContent>
      </Card>

      <Grid container spacing={3} alignItems="flex-start">
        <Grid item xs={12} lg={6}>
          <Card component="form" onSubmit={handleProfileSubmit}>
            <CardHeader title="Profile" subheader="Update the contact details stored alongside your Supabase user profile." />
            <CardContent>
              <Stack spacing={2}>
                <TextField
                  label="Full name"
                  value={profile.fullName}
                  onChange={(event) => setProfile((state) => ({ ...state, fullName: event.target.value }))}
                  disabled={loading}
                />
                <TextField
                  label="Email"
                  type="email"
                  value={profile.email}
                  onChange={(event) => setProfile((state) => ({ ...state, email: event.target.value }))}
                  disabled={loading}
                />
                <TextField
                  label="Company"
                  value={profile.company}
                  onChange={(event) => setProfile((state) => ({ ...state, company: event.target.value }))}
                  disabled={loading}
                />
                <TextField
                  label="Bio"
                  value={profile.bio}
                  onChange={(event) => setProfile((state) => ({ ...state, bio: event.target.value }))}
                  disabled={loading}
                  multiline
                  minRows={3}
                />
                <TextField
                  label="Timezone"
                  value={profile.timezone}
                  onChange={(event) => setProfile((state) => ({ ...state, timezone: event.target.value }))}
                  disabled={loading}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={profile.notifications}
                      onChange={(event) =>
                        setProfile((state) => ({ ...state, notifications: event.target.checked }))
                      }
                      disabled={loading}
                    />
                  }
                  label="Send product notifications"
                />
                <Stack direction="row" spacing={2} justifyContent="flex-end">
                  <Button type="submit" variant="contained" disabled={loading}>
                    Save profile
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} lg={6}>
          <Card component="form" onSubmit={handleBillingSubmit}>
            <CardHeader title="Billing" subheader="Manage subscription status, billing email, and payment method labels." />
            <CardContent>
              <Stack spacing={2}>
                <FormControl fullWidth>
                  <InputLabel id="plan-label">Plan</InputLabel>
                  <Select
                    labelId="plan-label"
                    value={billing.plan}
                    label="Plan"
                    onChange={(event) =>
                      setBilling((state) => ({ ...state, plan: event.target.value as BillingPreferences["plan"] }))
                    }
                    disabled={loading}
                  >
                    <MenuItem value="spark">Spark</MenuItem>
                    <MenuItem value="scale">Scale</MenuItem>
                    <MenuItem value="apex">Apex</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label="Billing email"
                  type="email"
                  value={billing.billingEmail}
                  onChange={(event) => setBilling((state) => ({ ...state, billingEmail: event.target.value }))}
                  disabled={loading}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={billing.autoRenew}
                      onChange={(event) => setBilling((state) => ({ ...state, autoRenew: event.target.checked }))}
                      disabled={loading}
                    />
                  }
                  label="Auto-renew plan"
                />
                <TextField
                  label="Payment method label"
                  value={billing.paymentMethod}
                  onChange={(event) => setBilling((state) => ({ ...state, paymentMethod: event.target.value }))}
                  disabled={loading}
                />
                <Stack direction="row" spacing={2} justifyContent="flex-end">
                  <Button type="submit" variant="contained" disabled={loading}>
                    Save billing settings
                  </Button>
                  <Button type="button" variant="outlined" color="warning" onClick={handleCancelPlan} disabled={loading}>
                    Cancel at period end
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardHeader title="Subscription" subheader="Status and history are sourced directly from Supabase billing tables." />
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <Typography variant="caption" color="text.secondary">
                Status
              </Typography>
              <Typography variant="body2">{subscriptionStatus}</Typography>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="caption" color="text.secondary">
                Auto-renew
              </Typography>
              <Typography variant="body2">{billing.autoRenew ? "Enabled" : "Disabled"}</Typography>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="caption" color="text.secondary">
                Current period end
              </Typography>
              <Typography variant="body2">{periodEnd ? new Date(periodEnd).toLocaleString() : "—"}</Typography>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="caption" color="text.secondary">
                Plan summary
              </Typography>
              <Typography variant="body2">{activePlanSummary}</Typography>
            </Grid>
          </Grid>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Invoice history
          </Typography>
          {invoiceHistory.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No invoices yet.
            </Typography>
          ) : (
            <List>
              {invoiceHistory.map((invoice) => (
                <ListItem
                  key={invoice.id}
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 2,
                    py: 1,
                    borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
                  }}
                >
                  <Stack>
                    <Typography variant="subtitle2">{invoice.period}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {invoice.status}
                    </Typography>
                  </Stack>
                  <Typography variant="body2">{invoice.total}</Typography>
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}

type FormatAmountInput = number | null | undefined;

function formatAmount(cents: FormatAmountInput): string {
  if (cents == null) {
    return "$0.00";
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}
