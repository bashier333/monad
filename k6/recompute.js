// k6: 5 concurrent recomputes (P-355). Run: k6 run -e BASE=https://staging... -e SESSION=... k6/recompute.js
import http from "k6/http";
import { check } from "k6";

export const options = { vus: 5, duration: "60s", thresholds: { http_req_duration: ["p(95)<2000"] } };
const WEEKS = ["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05"];

export default function () {
  const week = WEEKS[__VU % WEEKS.length];
  const res = http.post(
    `${__ENV.BASE}/api/answers/recompute`,
    JSON.stringify({ week }),
    { headers: { "Content-Type": "application/json", Cookie: __ENV.SESSION } },
  );
  check(res, { "200": (r) => r.status === 200 });
}
