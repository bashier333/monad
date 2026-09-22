import { redirect } from "next/navigation";

// Retired: the legacy model dashboard folded into the ontology platform.
// The URL stays alive as a redirect so bookmarks land somewhere real.
export default function ModelPage() {
  redirect("/platforms/ontology");
}
