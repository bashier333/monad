import type { CanonicalField } from "@/lib/ingest/columns";

export interface VendorPreset {
  vendor: string;
  headers: Partial<Record<CanonicalField, string[]>>;
}

export const PRESETS: VendorPreset[] = [
  {
    vendor: "generic",
    headers: {
      loadId: ["LoadID", "Load #"],
      date: ["PickupDate"],
      origin: ["Origin"],
      destination: ["Destination"],
      revenue: ["Revenue"],
      miles: ["Miles"],
    },
  },
  {
    vendor: "mcleod",
    headers: {
      loadId: ["Order ID", "Movement ID"],
      date: ["Pickup Date", "Ship Date"],
      origin: ["Origin City", "Pickup City"],
      destination: ["Dest City", "Delivery City"],
      revenue: ["Linehaul", "Total Revenue"],
      miles: ["Loaded Miles", "Mileage"],
      driver: ["Driver ID", "Driver Name"],
      truck: ["Tractor ID", "Unit"],
    },
  },
  {
    vendor: "tmw",
    headers: {
      loadId: ["Order Number", "Trip Number"],
      date: ["Requested Pickup", "Pickup Appt"],
      origin: ["Origin", "Shipper City"],
      destination: ["Destination", "Consignee City"],
      revenue: ["Billed Amount", "Revenue"],
      miles: ["Paid Miles", "Miles"],
      broker: ["Customer", "Bill-To"],
    },
  },
  {
    vendor: "prophesy",
    headers: {
      loadId: ["Dispatch #", "Load Number"],
      date: ["Dispatch Date"],
      origin: ["From"],
      destination: ["To"],
      revenue: ["Customer Rate", "Gross"],
      miles: ["Miles"],
      driver: ["Driver"],
      truck: ["Truck #"],
    },
  },
  {
    vendor: "ascend",
    headers: {
      loadId: ["Load ID", "Reference"],
      date: ["Pickup"],
      origin: ["Pickup Location"],
      destination: ["Delivery Location"],
      revenue: ["Rate", "Amount"],
      miles: ["Distance"],
      broker: ["Customer"],
    },
  },
];

export function applyPreset(
  headers: string[],
  preset: VendorPreset,
): Partial<Record<CanonicalField, number>> {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const keys = headers.map(norm);
  const mapping: Partial<Record<CanonicalField, number>> = {};
  for (const [field, names] of Object.entries(preset.headers)) {
    for (const name of names ?? []) {
      const idx = keys.indexOf(norm(name));
      if (idx !== -1) {
        mapping[field as CanonicalField] = idx;
        break;
      }
    }
  }
  return mapping;
}
