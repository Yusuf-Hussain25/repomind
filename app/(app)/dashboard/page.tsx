import Link from "next/link";
import { listRepos } from "@/lib/store";
import { RepoForm } from "@/components/repo-form";
import { DashboardGrid, KpiRow } from "@/components/dashboard-list";
import { PageHeading } from "@/components/shell/topbar";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const repos = await listRepos();
  const ready = repos.filter((r) => r.status === "ready").length;
  const active = repos.filter((r) => r.status === "fetching" || r.status === "analyzing").length;
  const totalFiles = repos.reduce((acc, r) => acc + (r.fileCount ?? 0), 0);

  return (
    <div className="mx-auto max-w-6xl w-full px-6 py-10">
      <PageHeading
        eyebrow="Workspace"
        title="Your repositories"
        subtitle="Add a public GitHub URL to spin up a multi-agent analysis. Average run cost: ~$0.05."
      />

      <KpiRow
        items={[
          { label: "Repositories", value: repos.length },
          { label: "Ready", value: ready, accent: "success" },
          { label: "In progress", value: active, accent: "accent" },
          { label: "Files indexed", value: totalFiles },
        ]}
      />

      <div className="glass glow rounded-2xl p-2 my-8">
        <RepoForm />
      </div>

      <DashboardGrid repos={repos} />
    </div>
  );
}
