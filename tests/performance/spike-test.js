import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const errorRate = new Rate("errors");

// Spike test: sudden increase in load
export const options = {
  stages: [
    { duration: "10s", target: 5 }, // Warm up
    { duration: "10s", target: 5 }, // Stable
    { duration: "10s", target: 50 }, // Spike to 50 users
    { duration: "30s", target: 50 }, // Maintain spike
    { duration: "10s", target: 5 }, // Recovery
    { duration: "10s", target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<2000"], // More lenient threshold for spike
    http_req_failed: ["rate<0.2"], // Allow up to 20% errors during spike
    errors: ["rate<0.2"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

export default function () {
  // Test critical endpoints under spike load
  const statusResponse = http.get(`${BASE_URL}/api/status`);

  check(statusResponse, {
    "status is not 5xx": (r) => r.status < 500,
    "responds in reasonable time": (r) => r.timings.duration < 5000,
  });

  errorRate.add(statusResponse.status >= 400);

  sleep(0.5); // Shorter sleep for more aggressive load
}
