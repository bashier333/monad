// k6: 30-min soak at 2x pilot load (P-357). Run: k6 run -e BASE=... -e SESSION=... k6/soak.js
import http from "k6/http";
import { check } from "k6";

export const options = {
  stages: [
    { duration: "5m", target: 20 },
    { duration: "20m", target: 20 },
    { duration: "5m", target: 0 },
  ],
  thresholds: { http_req_duration: ["p(95)<2000"], http_req_failed: ["rate<0.01"] },
};

export default function () {
  const res = http.get(`${__ENV.BASE}/api/answers/lane-margins?week=2026-09-07`, {
    headers: { Cookie: __ENV.SESSION },
  });
  check(res, { "200": (r) => r.status === 200 });
}
