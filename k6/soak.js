// k6: 30-min soak at 2x pilot load (P-357, E-435). Run: k6 run -e BASE=... -e SESSION=... [-e PACK=agency] k6/soak.js
import http from "k6/http";
import { check } from "k6";

const PATH = __ENV.PACK === "agency" ? "/api/answers/project-margins?week=2026-09-07" : "/api/answers/lane-margins?week=2026-09-07";

export const options = {
  stages: [
    { duration: "5m", target: 20 },
    { duration: "20m", target: 20 },
    { duration: "5m", target: 0 },
  ],
  thresholds: { http_req_duration: ["p(95)<2000"], http_req_failed: ["rate<0.01"] },
};

export default function () {
  const res = http.get(`${__ENV.BASE}${PATH}`, {
    headers: { Cookie: __ENV.SESSION },
  });
  check(res, { "200": (r) => r.status === 200 });
}
