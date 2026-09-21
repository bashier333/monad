// k6: 20-concurrent ontology search (10x plan §1). Run: k6 run -e BASE=... -e SESSION=... k6/ontology-search.js
import http from "k6/http";
import { check } from "k6";

export const options = {
  vus: 20,
  duration: "60s",
  thresholds: { http_req_duration: ["p(95)<2000"], http_req_failed: ["rate<0.01"] },
};

export default function () {
  const res = http.get(`${__ENV.BASE}/api/ontology/search?q=shipment`, {
    headers: { Cookie: __ENV.SESSION },
  });
  check(res, { "200": (r) => r.status === 200 });
}
