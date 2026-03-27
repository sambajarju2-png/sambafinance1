import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 100 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    'checks': ['rate>0.95'],
  },
};

const BASE = 'https://app.paywatch.app';

export default function () {
  // Follow redirects and accept 200 or 3xx as success
  const login = http.get(BASE + '/auth/login', { redirects: 5 });
  check(login, {
    'login responds': (r) => r.status === 200 || r.status === 304,
    'login under 500ms': (r) => r.timings.duration < 500,
    'no server error': (r) => r.status < 500,
  });
  sleep(1);

  // Protected route should redirect (not crash)
  const dashboard = http.get(BASE + '/overzicht', { redirects: 5 });
  check(dashboard, {
    'dashboard no server error': (r) => r.status < 500,
    'dashboard under 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1);
}
