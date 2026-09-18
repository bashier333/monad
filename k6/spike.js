// k6: 10x spike for 60s, documents degradation mode (P-358). Run: k6 run -e BASE=... -e SESSION=... k6/spike.js
import http from "k6/http";
import { check } from "k6";

export const options = {
  stages: [
    { duration: "10s", target: 10 },
    { duration: "60s", target: 100 },
    { duration: "10s", target: 0 },
  ],
};

export default function () {
  const res = http.get(`${__ENV.BASE}/api/answers/lane-margins?week=2026-09-07`, {
    headers: { Cookie: __ENV.SESSION },
  });
  check(res, { "not-500": (r) => r.status !== 500 });
}
