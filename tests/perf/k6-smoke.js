import http from 'k6/http'
import { check, sleep } from 'k6'

const baseUrl = __ENV.WORKER_URL || 'http://localhost:8787'

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 100 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<3500'],
    http_req_failed: ['rate<0.01'],
  },
}

export default function () {
  const health = http.get(`${baseUrl}/api/health`)
  check(health, {
    'status is 200': (res) => res.status === 200,
    'ok flag true': (res) => res.json('ok') === true,
  })
  sleep(1)
}
