import { redirect } from "next/navigation";

// Sunset: /dashboard merged into /workspace (10x plan §2, one home).
// Permanent redirect so bookmarks and history land on the surviving home.
export default function DashboardPage() {
  redirect("/workspace");
}
