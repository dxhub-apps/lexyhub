import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// Custom metrics
const errorRate = new Rate("errors");
const apiLatency = new Trend("api_latency");

// Test configuration
export const options = {
  stages: [
    { duration: "30s", target: 10 }, // Ramp up to 10 users
    { duration: "1m", target: 10 }, // Stay at 10 users
    { duration: "30s", target: 20 }, // Ramp up to 20 users
    { duration: "1m", target: 20 }, // Stay at 20 users
    { duration: "30s", target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"], // 95% of requests should be below 500ms
    http_req_failed: ["rate<0.1"], // Error rate should be less than 10%
    errors: ["rate<0.1"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

export default function () {
  // Test 1: Homepage load
  const homeResponse = http.get(`${BASE_URL}/`);
  check(homeResponse, {
    "homepage status is 200 or 307 (redirect)": (r) =>
      r.status === 200 || r.status === 307,
    "homepage loads in less than 1s": (r) => r.timings.duration < 1000,
  });
  errorRate.add(homeResponse.status >= 400);
  apiLatency.add(homeResponse.timings.duration);

  sleep(1);

  // Test 2: API Status endpoint
  const statusResponse = http.get(`${BASE_URL}/api/status`);
  check(statusResponse, {
    "status API returns 200": (r) => r.status === 200,
    "status API returns JSON": (r) =>
      r.headers["Content-Type"]?.includes("application/json"),
    "status API responds in less than 200ms": (r) =>
      r.timings.duration < 200,
  });
  errorRate.add(statusResponse.status >= 400);
  apiLatency.add(statusResponse.timings.duration);

  sleep(1);

  // Test 3: Keywords search (may require auth)
  const keywordsResponse = http.get(
    `${BASE_URL}/api/keywords/search?q=test&limit=10`
  );
  check(keywordsResponse, {
    "keywords API responds": (r) => r.status < 500,
    "keywords API has acceptable response time": (r) =>
      r.timings.duration < 2000,
  });
  errorRate.add(keywordsResponse.status >= 500);
  apiLatency.add(keywordsResponse.timings.duration);

  sleep(2);

  // Test 4: Static assets
  const staticResponse = http.get(`${BASE_URL}/_next/static/css/app.css`, {
    tags: { name: "static_assets" },
  });
  check(staticResponse, {
    "static assets load quickly": (r) => r.timings.duration < 300,
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    "tests/performance/results/summary.json": JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: " ", enableColors: true }),
  };
}

function textSummary(data, options = {}) {
  const indent = options.indent || "";
  const enableColors = options.enableColors || false;

  let summary = `\n${indent}Performance Test Summary\n`;
  summary += `${indent}========================\n\n`;

  // HTTP metrics
  if (data.metrics.http_req_duration) {
    summary += `${indent}HTTP Request Duration:\n`;
    summary += `${indent}  avg: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
    summary += `${indent}  min: ${data.metrics.http_req_duration.values.min.toFixed(2)}ms\n`;
    summary += `${indent}  max: ${data.metrics.http_req_duration.values.max.toFixed(2)}ms\n`;
    summary += `${indent}  p95: ${data.metrics.http_req_duration.values["p(95)"].toFixed(2)}ms\n\n`;
  }

  // Request count
  if (data.metrics.http_reqs) {
    summary += `${indent}Total Requests: ${data.metrics.http_reqs.values.count}\n`;
    summary += `${indent}Request Rate: ${data.metrics.http_reqs.values.rate.toFixed(2)}/s\n\n`;
  }

  // Error rate
  if (data.metrics.http_req_failed) {
    const failRate = (data.metrics.http_req_failed.values.rate * 100).toFixed(
      2
    );
    summary += `${indent}Failed Requests: ${failRate}%\n\n`;
  }

  // Virtual users
  if (data.metrics.vus) {
    summary += `${indent}Virtual Users: ${data.metrics.vus.values.value}\n\n`;
  }

  return summary;
}
