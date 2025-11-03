"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";

type MetricData = {
  label: string;
  value: string | number;
  change?: string;
  trend?: "up" | "down" | "neutral";
};

type UserMetrics = {
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  retentionRate: string;
};

type APIMetrics = {
  totalRequests: number;
  avgResponseTime: number;
  errorRate: string;
  rateLimitHits: number;
};

type RevenueMetrics = {
  mrr: number;
  arr: number;
  churnRate: string;
  ltv: number;
};

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState("7d");
  const [loading, setLoading] = useState(true);
  const [userMetrics, setUserMetrics] = useState<UserMetrics>({
    totalUsers: 0,
    activeUsers: 0,
    newUsersToday: 0,
    retentionRate: "0%",
  });
  const [apiMetrics, setAPIMetrics] = useState<APIMetrics>({
    totalRequests: 0,
    avgResponseTime: 0,
    errorRate: "0%",
    rateLimitHits: 0,
  });
  const [revenueMetrics, setRevenueMetrics] = useState<RevenueMetrics>({
    mrr: 0,
    arr: 0,
    churnRate: "0%",
    ltv: 0,
  });

  useEffect(() => {
    // Fetch analytics data
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        // In a real implementation, fetch from your analytics API
        // const response = await fetch(`/api/admin/analytics?range=${timeRange}`);
        // const data = await response.json();

        // Mock data for demonstration
        setTimeout(() => {
          setUserMetrics({
            totalUsers: 1247,
            activeUsers: 432,
            newUsersToday: 18,
            retentionRate: "67.5%",
          });
          setAPIMetrics({
            totalRequests: 125430,
            avgResponseTime: 245,
            errorRate: "1.2%",
            rateLimitHits: 342,
          });
          setRevenueMetrics({
            mrr: 12450,
            arr: 149400,
            churnRate: "3.2%",
            ltv: 3680,
          });
          setLoading(false);
        }, 500);
      } catch (error) {
        console.error("Failed to fetch analytics:", error);
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [timeRange]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("en-US").format(value);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Analytics Dashboard</h1>
        <p className="text-gray-600">
          Business metrics and system health monitoring
        </p>
      </div>

      {/* Time Range Selector */}
      <div className="mb-6 flex gap-2">
        {["24h", "7d", "30d", "90d"].map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              timeRange === range
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {range}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading analytics...</div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* User Metrics */}
          <section>
            <h2 className="text-xl font-semibold mb-4">User Metrics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                label="Total Users"
                value={formatNumber(userMetrics.totalUsers)}
                change="+12.5%"
                trend="up"
              />
              <MetricCard
                label="Active Users"
                value={formatNumber(userMetrics.activeUsers)}
                change="+5.3%"
                trend="up"
              />
              <MetricCard
                label="New Today"
                value={formatNumber(userMetrics.newUsersToday)}
                change="+8.2%"
                trend="up"
              />
              <MetricCard
                label="Retention Rate"
                value={userMetrics.retentionRate}
                change="-2.1%"
                trend="down"
              />
            </div>
          </section>

          {/* API Performance */}
          <section>
            <h2 className="text-xl font-semibold mb-4">API Performance</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                label="Total Requests"
                value={formatNumber(apiMetrics.totalRequests)}
                change="+18.7%"
                trend="up"
              />
              <MetricCard
                label="Avg Response Time"
                value={`${apiMetrics.avgResponseTime}ms`}
                change="-15.3%"
                trend="up"
              />
              <MetricCard
                label="Error Rate"
                value={apiMetrics.errorRate}
                change="-0.3%"
                trend="up"
              />
              <MetricCard
                label="Rate Limit Hits"
                value={formatNumber(apiMetrics.rateLimitHits)}
                change="+5.4%"
                trend="neutral"
              />
            </div>
          </section>

          {/* Revenue Metrics */}
          <section>
            <h2 className="text-xl font-semibold mb-4">Revenue Metrics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                label="MRR"
                value={formatCurrency(revenueMetrics.mrr)}
                change="+9.2%"
                trend="up"
              />
              <MetricCard
                label="ARR"
                value={formatCurrency(revenueMetrics.arr)}
                change="+9.2%"
                trend="up"
              />
              <MetricCard
                label="Churn Rate"
                value={revenueMetrics.churnRate}
                change="-0.5%"
                trend="up"
              />
              <MetricCard
                label="LTV"
                value={formatCurrency(revenueMetrics.ltv)}
                change="+12.8%"
                trend="up"
              />
            </div>
          </section>

          {/* Feature Usage */}
          <section>
            <h2 className="text-xl font-semibold mb-4">Feature Usage</h2>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="space-y-4">
                <FeatureUsageBar label="Keyword Search" usage={87} />
                <FeatureUsageBar label="Watchlists" usage={65} />
                <FeatureUsageBar label="Tag Optimizer" usage={54} />
                <FeatureUsageBar label="Market Twin" usage={42} />
                <FeatureUsageBar label="Insights" usage={38} />
              </div>
            </div>
          </section>

          {/* System Health */}
          <section>
            <h2 className="text-xl font-semibold mb-4">System Health</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <HealthCard
                service="API Server"
                status="healthy"
                uptime="99.98%"
              />
              <HealthCard
                service="Database"
                status="healthy"
                uptime="99.99%"
              />
              <HealthCard
                service="Background Jobs"
                status="healthy"
                uptime="99.95%"
              />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  change,
  trend,
}: {
  label: string;
  value: string | number;
  change?: string;
  trend?: "up" | "down" | "neutral";
}) {
  const trendColor =
    trend === "up"
      ? "text-green-600"
      : trend === "down"
      ? "text-red-600"
      : "text-gray-600";

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="text-sm text-gray-600 mb-2">{label}</div>
      <div className="text-2xl font-bold mb-1">{value}</div>
      {change && (
        <div className={`text-sm ${trendColor}`}>
          {trend === "up" && "↑ "}
          {trend === "down" && "↓ "}
          {change}
        </div>
      )}
    </div>
  );
}

function FeatureUsageBar({
  label,
  usage,
}: {
  label: string;
  usage: number;
}) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm text-gray-600">{usage}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all"
          style={{ width: `${usage}%` }}
        />
      </div>
    </div>
  );
}

function HealthCard({
  service,
  status,
  uptime,
}: {
  service: string;
  status: "healthy" | "degraded" | "down";
  uptime: string;
}) {
  const statusColor =
    status === "healthy"
      ? "bg-green-100 text-green-800"
      : status === "degraded"
      ? "bg-yellow-100 text-yellow-800"
      : "bg-red-100 text-red-800";

  const statusDot =
    status === "healthy"
      ? "bg-green-500"
      : status === "degraded"
      ? "bg-yellow-500"
      : "bg-red-500";

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">{service}</h3>
        <div className={`w-3 h-3 rounded-full ${statusDot}`} />
      </div>
      <div
        className={`inline-block px-2 py-1 rounded text-xs font-medium mb-2 ${statusColor}`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </div>
      <div className="text-sm text-gray-600">Uptime: {uptime}</div>
    </div>
  );
}
