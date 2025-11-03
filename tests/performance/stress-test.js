import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const errorRate = new Rate("errors");

// Stress test: gradually increase load beyond normal capacity
export const options = {
  stages: [
    { duration: "1m", target: 10 }, // Baseline
    { duration: "2m", target: 25 }, // Increase load
    { duration: "2m", target: 50 }, // Push harder
    { duration: "2m", target: 75 }, // Stress point
    { duration: "2m", target: 100 }, // Breaking point
    { duration: "1m", target: 0 }, // Recovery
  ],
  thresholds: {
    http_req_duration: ["p(95)<3000"],
    http_req_failed: ["rate<0.3"], // Allow up to 30% failures at peak stress
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

export default function () {
  // Mix of different endpoint types
  const endpoints = [
    "/api/status",
    "/api/keywords/search?q=test&limit=5",
    "/api/watchlists",
  ];

  const randomEndpoint =
    endpoints[Math.floor(Math.random() * endpoints.length)];
  const response = http.get(`${BASE_URL}${randomEndpoint}`);

  check(response, {
    "status is not 5xx": (r) => r.status < 500,
  });

  errorRate.add(response.status >= 400);

  sleep(Math.random() * 2 + 1); // Random sleep between 1-3 seconds
}

export function handleSummary(data) {
  console.log("\n=== Stress Test Results ===");
  console.log(`Peak concurrent users: 100`);
  console.log(
    `Average response time: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms`
  );
  console.log(
    `95th percentile: ${data.metrics.http_req_duration.values["p(95)"].toFixed(2)}ms`
  );
  console.log(
    `Error rate: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%`
  );
  console.log("========================\n");

  return {
    "tests/performance/results/stress-test.json": JSON.stringify(data, null, 2),
  };
}
