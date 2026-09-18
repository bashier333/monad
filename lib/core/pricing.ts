export interface TierDef {
  id: string;
  name: string;
  price: string;
  unit: string;
  blurb: string;
  features: string[];
  cta: string;
  highlight?: boolean;
}

export interface PackPrice {
  pack: string;
  team: string;
  note: string;
}

export const PACK_PRICES: PackPrice[] = [
  { pack: "freight", team: "$499+/mo", note: "per terminal running on the answer" },
  { pack: "agency", team: "$499+/mo", note: "per studio running on the answer" },
];

export const TIERS: TierDef[] = [
  {
    id: "analyst",
    name: "Analyst",
    price: "Free",
    unit: "forever",
    blurb: "One analyst, trying it on their own fleet.",
    features: ["1 workspace", "10 uploads/month", "90-day answer history", "Weekly brief"],
    cta: "Start free",
  },
  {
    id: "team",
    name: "Team",
    price: "$499+",
    unit: "/month",
    blurb: "One terminal or ops team running on the answer.",
    features: [
      "Unlimited uploads",
      "Full history + replay",
      "Corrections feed-back into rules",
      "Unlimited seats",
      "Monday brief by email",
    ],
    cta: "Upgrade to Team",
    highlight: true,
  },
  {
    id: "org",
    name: "Org",
    price: "$25k+",
    unit: "/year",
    blurb: "The whole carrier or 3PL, every terminal.",
    features: ["Everything in Team", "All terminals", "Anomaly agents + briefs", "SSO", "Dedicated support"],
    cta: "Talk to us",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    unit: "",
    blurb: "Large 3PLs, after the vertical is won.",
    features: ["Everything in Org", "Self-host option", "Full retention", "SLAs"],
    cta: "Talk to us",
  },
];
