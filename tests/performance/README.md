# Performance Testing with k6

This directory contains performance test scripts using [k6](https://k6.io/), an open-source load testing tool.

## Installation

Install k6:

### macOS
```bash
brew install k6
```

### Linux
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

### Windows
```bash
choco install k6
```

## Test Scripts

### Load Test (`load-test.js`)
Tests normal expected load with gradual ramp-up and ramp-down.

**Run:**
```bash
k6 run tests/performance/load-test.js
```

**Custom configuration:**
```bash
BASE_URL=https://your-app.com k6 run tests/performance/load-test.js
```

### Spike Test (`spike-test.js`)
Tests sudden increases in load to verify system recovery.

**Run:**
```bash
k6 run tests/performance/spike-test.js
```

### Stress Test (`stress-test.js`)
Tests system limits by gradually increasing load beyond normal capacity.

**Run:**
```bash
k6 run tests/performance/stress-test.js
```

## Test Stages

### Load Test
- 30s ramp up to 10 users
- 1m at 10 users
- 30s ramp up to 20 users
- 1m at 20 users
- 30s ramp down

### Spike Test
- 10s warm up (5 users)
- 10s spike to 50 users
- 30s maintain spike
- 10s recovery to 5 users
- 10s ramp down

### Stress Test
- 1m at 10 users
- 2m ramp to 25 users
- 2m ramp to 50 users
- 2m ramp to 75 users
- 2m ramp to 100 users
- 1m ramp down

## Performance Thresholds

### Load Test
- 95% of requests < 500ms
- Error rate < 10%

### Spike Test
- 95% of requests < 2s
- Error rate < 20%

### Stress Test
- 95% of requests < 3s
- Error rate < 30% (at peak load)

## CI/CD Integration

Add to GitHub Actions:

```yaml
- name: Run Performance Tests
  run: |
    # Install k6
    curl -L https://github.com/grafana/k6/releases/download/v0.47.0/k6-v0.47.0-linux-amd64.tar.gz | tar xvz
    sudo mv k6-v0.47.0-linux-amd64/k6 /usr/local/bin/

    # Run tests
    k6 run tests/performance/load-test.js
```

## Viewing Results

Results are saved to `tests/performance/results/` directory:
- `summary.json` - Detailed metrics from load test
- `stress-test.json` - Stress test results

## Metrics Explained

- **http_req_duration**: Time from request start to response end
- **http_req_failed**: Percentage of failed requests
- **http_reqs**: Total number of requests
- **vus**: Virtual users (concurrent)
- **iterations**: Number of times the default function was executed

## Best Practices

1. **Start with load testing** to establish baseline
2. **Run spike tests** to verify recovery mechanisms
3. **Run stress tests** to find breaking points
4. **Test against staging** before production
5. **Monitor server metrics** during tests (CPU, memory, database)
6. **Run tests regularly** to catch performance regressions

## Custom Scenarios

Create custom test scenarios by modifying the `options.stages` array:

```javascript
export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Simulate 100 users for 2 minutes
    { duration: '5m', target: 200 }, // Increase to 200 users
    { duration: '2m', target: 0 },   // Ramp down
  ],
};
```

## Environment Variables

- `BASE_URL`: Target application URL (default: `http://localhost:3000`)
- `TEST_AUTH_TOKEN`: Authentication token for protected endpoints

Example:
```bash
BASE_URL=https://staging.example.com TEST_AUTH_TOKEN=xxx k6 run tests/performance/load-test.js
```
