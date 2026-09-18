// k6: 10x spike for 60s, documents degradation mode (P-358, E-435). Run: k6 run -e BASE=... -e SESSION=... [-e PACK=agency] k6/spike.js
import http from "k6/http";
import { check } from "k6";

const PATH = __ENV.PACK === "agency" ? "/api/answers/project-margins?week=2026-09-07" : "/api/answers/lane-margins?week=2026-09-07";

export const options = {
  stages: [
    { duration: "10s", target: 10 },
    { duration: "60s", target: 100 },
    { duration: "10s", target: 0 },
  ],
};

export default function () {
  const res = http.get(`${__ENV.BASE}${PATH}`, {
    headers: { Cookie: __ENV.SESSION },
  });
  check(res, { "not-500": (r) => r.status !== 500 });
}
