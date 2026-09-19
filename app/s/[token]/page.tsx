import Link from "next/link";
import { getWeeklyAnswer } from "@/lib/packs/freight/service";
import { getAgencyAnswer } from "@/lib/packs/agency/service";
import { db } from "@/lib/core/db";
import { logAccess } from "@/lib/core/access";

export const metadata = { robots: "noindex, nofollow" };

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const share = await db.answerShare.findUnique({
    where: { token },
    include: { organization: true },
  });
  if (!share || share.revoked || share.expiresAt < new Date()) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p>This link expired or is invalid. Ask the sender for a fresh one.</p>
      </main>
    );
  }
  await logAccess(share.organizationId, "anonymous", "share:view", share.id);

  if (share.pack === "agency") {
    const answer = await getAgencyAnswer(share.organizationId, share.organization.weekStartsOn, share.weekStart);
    return (
      <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
        <p className="text-sm text-gray-600">
          Shared by {share.organization.name} · week of {answer.meta.weekStart} · read-only
        </p>
        <h1 className="text-xl font-bold">Project margins</h1>
        <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
          <div className="rounded border p-2">Revenue: ${answer.totals.revenue.toFixed(2)}</div>
          <div className="rounded border p-2">Cost: ${answer.totals.cost.toFixed(2)}</div>
          <div className="rounded border p-2">Margin: ${answer.totals.margin.toFixed(2)}</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-1">Project</th>
                <th className="text-right">Rounds</th>
                <th className="text-right">Revenue</th>
                <th className="text-right">Cost</th>
                <th className="text-right">Margin</th>
              </tr>
            </thead>
            <tbody>
              {answer.projects.map((p) => (
                <tr key={p.project} className="border-t">
                  <td className="py-1">{p.project}</td>
                  <td className="text-right">{p.revisions}</td>
                  <td className="text-right">${p.revenue.toFixed(2)}</td>
                  <td className="text-right">${p.cost.toFixed(2)}</td>
                  <td className={`text-right font-medium ${p.margin < 0 ? "text-red-600" : "text-green-700"}`}>
                    ${p.margin.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-gray-600">
          <Link href="/api/auth/signin" className="underline">
            Get answers like this for your own studio
          </Link>
        </p>
      </main>
    );
  }

  const answer = await getWeeklyAnswer(share.organizationId, share.organization.weekStartsOn, share.weekStart);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <p className="text-sm text-gray-600">
        Shared by {share.organization.name} · week of {answer.meta.weekStart} · read-only
      </p>
      <h1 className="text-xl font-bold">Lane margins</h1>
      <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
        <div className="rounded border p-2">Revenue: ${answer.totals.revenue.toFixed(2)}</div>
        <div className="rounded border p-2">Cost: ${answer.totals.cost.toFixed(2)}</div>
        <div className="rounded border p-2">Margin: ${answer.totals.margin.toFixed(2)}</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-1">Lane</th>
              <th className="text-right">Loads</th>
              <th className="text-right">Revenue</th>
              <th className="text-right">Cost</th>
              <th className="text-right">Margin</th>
            </tr>
          </thead>
          <tbody>
            {answer.lanes.map((l) => (
              <tr key={l.lane} className="border-t">
                <td className="py-1">{l.lane}</td>
                <td className="text-right">{l.loads}</td>
                <td className="text-right">${l.revenue.toFixed(2)}</td>
                <td className="text-right">${l.cost.toFixed(2)}</td>
                <td className={`text-right font-medium ${l.margin < 0 ? "text-red-600" : "text-green-700"}`}>
                  ${l.margin.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-gray-600">
        <Link href="/api/auth/signin" className="underline">
          Get answers like this for your own fleet
        </Link>
      </p>
    </main>
  );
}
