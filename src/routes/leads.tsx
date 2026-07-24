import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Container } from "~/components/Container";
import { SectionHeading } from "~/components/SectionHeading";

interface Lead {
  id: string;
  name: string;
  email: string;
  company: string;
  phone: string;
  industry: string;
  message: string;
  source: string;
  created_at: string;
}

const getLeads = createServerFn({ method: "GET" }).handler(async (): Promise<Lead[]> => {
  try {
    const { sql } = await import("~/lib/db");
    const rows = await sql`
      SELECT id, name, email, company, phone, industry, message, source, created_at
      FROM contact_leads
      ORDER BY created_at DESC
      LIMIT 200
    `;
    return rows.map((row: any) => ({
      id: String(row.id),
      name: String(row.name || ""),
      email: String(row.email || ""),
      company: String(row.company || ""),
      phone: String(row.phone || ""),
      industry: String(row.industry || ""),
      message: String(row.message || ""),
      source: String(row.source || ""),
      created_at: row.created_at ? new Date(row.created_at).toISOString() : "",
    }));
  } catch {
    return [];
  }
});

export const Route = createFileRoute("/leads")({
  loader: () => getLeads(),
  component: LeadsPage,
});

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function LeadsPage() {
  const leads = Route.useLoaderData() as Lead[];

  return (
    <section className="py-24 bg-bg-root min-h-dvh">
      <Container>
        <SectionHeading
          headline="Leads Dashboard"
          description="All contact form submissions across the MetroReach Media website."
        />

        <div className="mb-8">
          <p className="text-lg font-semibold text-text-primary">
            {leads.length} lead{leads.length !== 1 ? "s" : ""} received
          </p>
        </div>

        {leads.length === 0 ? (
          <div className="bg-bg-surface border border-border-subtle rounded-2xl p-12 text-center">
            <p className="text-text-secondary text-lg">
              No leads yet — contact form submissions will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="py-3 px-4 text-sm font-semibold text-text-muted uppercase tracking-wider">
                    Date / Time
                  </th>
                  <th className="py-3 px-4 text-sm font-semibold text-text-muted uppercase tracking-wider">
                    Name
                  </th>
                  <th className="py-3 px-4 text-sm font-semibold text-text-muted uppercase tracking-wider">
                    Business
                  </th>
                  <th className="py-3 px-4 text-sm font-semibold text-text-muted uppercase tracking-wider">
                    Industry
                  </th>
                  <th className="py-3 px-4 text-sm font-semibold text-text-muted uppercase tracking-wider">
                    Email
                  </th>
                  <th className="py-3 px-4 text-sm font-semibold text-text-muted uppercase tracking-wider">
                    Source
                  </th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-b border-border-subtle/50 hover:bg-bg-surface transition-colors"
                  >
                    <td className="py-3 px-4 text-sm text-text-secondary font-mono whitespace-nowrap">
                      {formatDate(lead.created_at)}
                    </td>
                    <td className="py-3 px-4 text-sm text-text-primary font-medium">
                      {lead.name}
                    </td>
                    <td className="py-3 px-4 text-sm text-text-secondary">
                      {lead.company}
                    </td>
                    <td className="py-3 px-4 text-sm text-text-secondary">
                      <span className="inline-block bg-brand-primary/10 text-brand-primary text-xs font-medium px-2 py-0.5 rounded-full">
                        {lead.industry}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-text-secondary">
                      {lead.email}
                    </td>
                    <td className="py-3 px-4 text-sm text-text-secondary">
                      <span className="inline-block bg-bg-root text-text-muted text-xs font-medium px-2 py-0.5 rounded-full border border-border-subtle">
                        {lead.source}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Container>
    </section>
  );
}
