# Backoffice Risk Register Reference

The admin backoffice includes a risk management workspace with seeded demo data so that new
teammates can understand how we triage issues even without a live Supabase connection.

## Demo risk appetites

| ID | Label | Category | Notes |
| --- | --- | --- | --- |
| `demo-risk-appetite` | Default eCommerce | Marketplace | Baseline tolerance for marketplace-wide incidents. |
| `demo-risk-appetite-operations` | Fulfillment Continuity | Logistics | Keeps focus on carrier and warehouse slowdowns. |
| `demo-risk-appetite-security` | Customer Data Protection | Security | Zero-tolerance guidance for data exposure. |
| `demo-risk-appetite-growth` | Revenue Operations | Commercial | Balances experimentation with checkout reliability. |

## Demo controls

| ID | Control | Owner | Coverage |
| --- | --- | --- | --- |
| `demo-risk-control` | Manual Etsy QA | Risk | Scraping spot checks that support catalog accuracy. |
| `demo-risk-control-fulfillment` | Carrier SLA Monitoring | Operations | Daily health review for fulfillment partners. |
| `demo-risk-control-security` | Security Log Triage | Security | SOC runbook for auth anomalies and brute force traffic. |
| `demo-risk-control-checkout` | Payment Gateway Failover | Engineering | Automated failover between Stripe and Adyen. |

## Demo risk entries

The risk register is populated with the scenarios we encounter most frequently:

- **Carrier delays across West Coast** — Highlights fulfillment slowdowns that jeopardize delivery SLAs
  and customer retention.
- **Checkout payment gateway latency** — Demonstrates how we mitigate payment incidents using the
  failover control and a short follow-up cycle.
- **Credential stuffing spike** — Represents the ongoing security posture work the SOC team manages.
- **Catalog pricing discrepancy** — Captures merchandising-led investigations tied to exchange-rate drift.
- **Chargeback spike on vintage goods** — Surfaces finance-led fraud monitoring and seller enablement.

Each demo record includes owners, mitigation steps, and due dates so that the dashboard metrics (total,
open, mitigated, and overdue) match what we typically track during weekly risk reviews.
