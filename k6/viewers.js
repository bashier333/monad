// k6: 50 answer viewers (P-356). Run: k6 run -e BASE=... -e SESSION=... k6/viewers.js
import http from "k6/http";
import { check } from "k6";

export const options = { vus: 50, duration: "120s", thresholds: { http_req_duration: ["p(95)<2000"] } };

export default function () {
  const res = http.get(`${__ENV.BASE}/api/answers/lane-margins?week=2026-09-07`, {
    headers: { Cookie: __ENV.SESSION },
  });
  check(res, { "200": (r) => r.status === 200 });
}
