/**
 * /admin/leads — Admin Lead Tracking Dashboard
 *
 * Shows all clients with aggregated lead stats, clicks, conversions,
 * and total commission owed across all clients.
 *
 * MetroReach Digital — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  CheckCircle,
  CurrencyDollar,
  MousePointerClick,
  User,
  Buildings,
  Spinner,
  ArrowRight,
} from "@phosphor-icons/react";

interface ClientOverview {
  id: string;
  name: string;
  company: string;
  service: string;
  service_slug: string;
  status: string;
  landing_url: string;
  created_at: string;
  total_leads: number;
  converted_leads: number;
  total_value_cents: number;
  total_commission_cents: number;
  total_clicks: number;
}

export const Route = createFileRoute("/admin/leads")({
  component: AdminLeads,
});

function AdminLeads() {
  const [clients, setClients] = useState<ClientOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchOverview();
  }, []);

  async function fetchOverview() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/leads-overview");
      const data = await res.json();
      if (res.ok) {
        setClients(data);
      } else {
        setError(data.error || "Failed to load");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  function formatCents(c: number): string {
    return `$${(c / 100).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  // Aggregate totals
  const totals = clients.reduce(
    (acc, c) => ({
      total_leads: acc.total_leads + c.total_leads,
      converted_leads: acc.converted_leads + c.converted_leads,
      total_value_cents: acc.total_value_cents + c.total_value_cents,
      total_commission_cents: acc.total_commission_cents + c.total_commission_cents,
      total_clicks: acc.total_clicks + c.total_clicks,
    }),
    {
      total_leads: 0,
      converted_leads: 0,
      total_value_cents: 0,
      total_commission_cents: 0,
      total_clicks: 0,
    },
  );

  const overallRate =
    totals.total_leads > 0
      ? ((totals.converted_leads / totals.total_leads) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="min-h-screen bg-bg-root">
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-2 text-text-muted text-sm mb-2">
            <Link to="/" className="hover:text-text-primary transition-colors">
              Home
            </Link>
            <span>/</span>
            <span className="text-text-primary">Admin</span>
            <span>/</span>
            <span className="text-brand-primary">Lead Tracking</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold font-heading text-text-primary mb-2">
            Lead Tracking Dashboard
          </h1>
          <p className="text-text-secondary text-lg">
            All clients, leads, conversions, and commission owed — at a glance.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-error/10 border border-error/30 text-error text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-20">
            <Spinner className="w-8 h-8 text-brand-primary animate-spin mx-auto" />
          </div>
        ) : (
          <>
            {/* Aggregate Stats */}
            {clients.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
                <AggStat
                  icon={<Buildings className="w-5 h-5" />}
                  label="Clients"
                  value={clients.length.toString()}
                  color="text-text-primary"
                />
                <AggStat
                  icon={<MousePointerClick className="w-5 h-5" />}
                  label="Total Clicks"
                  value={totals.total_clicks.toLocaleString()}
                  color="text-brand-primary"
                />
                <AggStat
                  icon={<User className="w-5 h-5" />}
                  label="Total Leads"
                  value={totals.total_leads.toLocaleString()}
                  color="text-text-primary"
                />
                <AggStat
                  icon={<CheckCircle className="w-5 h-5" />}
                  label={`Converted (${overallRate}%)`}
                  value={totals.converted_leads.toLocaleString()}
                  color="text-success"
                />
                <AggStat
                  icon={<CurrencyDollar className="w-5 h-5" />}
                  label="Commission Owed"
                  value={formatCents(totals.total_commission_cents)}
                  color="text-warning"
                />
              </div>
            )}

            {/* Client Table */}
            {clients.length > 0 ? (
              <div className="bg-bg-surface rounded-xl border border-border-subtle overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-border-subtle text-text-secondary text-xs uppercase tracking-wider">
                        <th className="px-5 py-3 font-medium">Client</th>
                        <th className="px-5 py-3 font-medium">Service</th>
                        <th className="px-5 py-3 font-medium text-center">Clicks</th>
                        <th className="px-5 py-3 font-medium text-center">Leads</th>
                        <th className="px-5 py-3 font-medium text-center">Converted</th>
                        <th className="px-5 py-3 font-medium text-right">Revenue</th>
                        <th className="px-5 py-3 font-medium text-right">Commission</th>
                        <th className="px-5 py-3 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {clients.map((client) => {
                        const rate =
                          client.total_leads > 0
                            ? ((client.converted_leads / client.total_leads) * 100).toFixed(1)
                            : "0.0";
                        return (
                          <tr
                            key={client.id}
                            className="hover:bg-bg-surface-raised transition-colors group"
                          >
                            <td className="px-5 py-3">
                              <div className="font-medium text-text-primary">
                                {client.name}
                              </div>
                              <div className="text-text-secondary text-sm">
                                {client.company || "—"}
                              </div>
                            </td>
                            <td className="px-5 py-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary text-xs font-medium">
                                {client.service}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-center font-mono text-sm text-text-primary">
                              {client.total_clicks.toLocaleString()}
                            </td>
                            <td className="px-5 py-3 text-center font-mono text-sm text-text-primary">
                              {client.total_leads.toLocaleString()}
                            </td>
                            <td className="px-5 py-3 text-center">
                              <span className="font-mono text-sm text-text-primary">
                                {client.converted_leads}
                              </span>
                              <span className="text-text-muted text-xs ml-1">
                                ({rate}%)
                              </span>
                            </td>
                            <td className="px-5 py-3 text-right font-mono text-sm text-text-primary">
                              {formatCents(client.total_value_cents)}
                            </td>
                            <td className="px-5 py-3 text-right font-mono text-sm text-brand-accent font-medium">
                              {formatCents(client.total_commission_cents)}
                            </td>
                            <td className="px-5 py-3">
                              <a
                                href={`/client/tracker?client_id=${encodeURIComponent(client.id)}`}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-brand-primary/10 text-brand-primary text-xs font-medium hover:bg-brand-primary/20 transition-colors opacity-0 group-hover:opacity-100"
                              >
                                Details
                                <ArrowRight className="w-3 h-3" />
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Totals row */}
                <div className="border-t-2 border-border-emphasis bg-bg-surface-raised">
                  <div className="px-5 py-3 flex items-center">
                    <div className="font-semibold text-text-primary flex-1">
                      Totals
                    </div>
                    <div className="flex items-center gap-0">
                      <div className="w-[88px] text-center font-mono text-sm font-semibold text-text-primary">
                        {totals.total_clicks.toLocaleString()}
                      </div>
                      <div className="w-[72px] text-center font-mono text-sm font-semibold text-text-primary">
                        {totals.total_leads.toLocaleString()}
                      </div>
                      <div className="w-[88px] text-center font-mono text-sm font-semibold text-text-primary">
                        {totals.converted_leads.toLocaleString()}
                      </div>
                      <div className="w-[96px] text-right font-mono text-sm font-semibold text-text-primary">
                        {formatCents(totals.total_value_cents)}
                      </div>
                      <div className="w-[112px] text-right font-mono text-sm font-semibold text-brand-accent">
                        {formatCents(totals.total_commission_cents)}
                      </div>
                      <div className="w-[88px]"></div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 bg-bg-surface rounded-xl border border-border-subtle">
                <Buildings className="w-12 h-12 text-text-muted mx-auto mb-4" />
                <p className="text-text-secondary text-lg mb-1">No clients yet</p>
                <p className="text-text-muted text-sm">
                  Client lead data will appear here once clients are onboarded and
                  tracking links go live.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function AggStat({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-bg-surface rounded-xl border border-border-subtle p-4">
      <div className={`${color} mb-2`}>{icon}</div>
      <div className="text-xs text-text-muted mb-1">{label}</div>
      <div className={`text-lg font-bold font-heading ${color}`}>{value}</div>
    </div>
  );
}
