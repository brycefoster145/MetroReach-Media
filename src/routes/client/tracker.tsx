/**
 * /client/tracker?client_id=XXX — Client Lead Tracker Dashboard
 *
 * Shows leads, clicks, conversion status, and commission totals for a client.
 * Use as an embeddable/shareable dashboard link.
 *
 * MetroReach Digital — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  CheckCircle,
  Clock,
  XCircle,
  CurrencyDollar,
  MouseLeftClick,
  User,
  Envelope,
  Phone,
  Trash,
  PencilSimple,
  CaretDown,
  CaretUp,
  Spinner,
} from "@phosphor-icons/react";

interface Lead {
  id: string;
  client_id: string;
  source: string;
  lead_name: string;
  lead_email: string;
  lead_phone: string;
  created_at: string;
  converted: boolean;
  conversion_value_cents: number;
  commission_cents: number;
  notes: string;
}

interface Stats {
  total_leads: number;
  converted_leads: number;
  total_value_cents: number;
  total_commission_cents: number;
  total_clicks: number;
}

export const Route = createFileRoute("/client/tracker")({
  component: ClientTracker,
});

function ClientTracker() {
  const [clientId, setClientId] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingLead, setEditingLead] = useState<string | null>(null);
  const [editValue, setEditValue] = useState(0);
  const [editNotes, setEditNotes] = useState("");
  const [expandedLead, setExpandedLead] = useState<string | null>(null);

  // Read client_id from query param on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cid = params.get("client_id");
    if (cid) setClientId(cid);
  }, []);

  useEffect(() => {
    if (!clientId) return;
    fetchLeads();
  }, [clientId]);

  async function fetchLeads() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/client/leads?client_id=${encodeURIComponent(clientId)}`);
      const data = await res.json();
      if (res.ok) {
        setLeads(data.leads);
        setStats(data.stats);
      } else {
        setError(data.error || "Failed to load");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function markConverted(lead: Lead) {
    const value = prompt("Conversion value ($):", "0");
    if (value === null) return;
    const valueCents = Math.round(parseFloat(value) * 100);
    if (isNaN(valueCents)) return;

    try {
      const res = await fetch("/api/client/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: lead.id,
          converted: true,
          conversion_value_cents: valueCents,
        }),
      });
      if (res.ok) fetchLeads();
    } catch (err) {
      console.error(err);
    }
  }

  async function updateConversionValue(lead: Lead) {
    try {
      const res = await fetch("/api/client/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: lead.id,
          conversion_value_cents: editValue,
          notes: editNotes,
        }),
      });
      if (res.ok) {
        setEditingLead(null);
        fetchLeads();
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function deleteLead(id: string) {
    if (!confirm("Delete this lead?")) return;
    try {
      const res = await fetch(`/api/client/leads?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) fetchLeads();
    } catch (err) {
      console.error(err);
    }
  }

  function formatCents(c: number): string {
    return `$${(c / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function formatDate(d: string): string {
    return new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  const conversionRate = stats && stats.total_leads > 0
    ? ((stats.converted_leads / stats.total_leads) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="min-h-screen bg-bg-root">
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-bold font-heading text-text-primary mb-2">
            Lead Tracker
          </h1>
          <p className="text-text-secondary text-lg">
            Track clicks, leads, and commission for your client campaigns.
          </p>
        </div>

        {/* Client ID Input */}
        <div className="mb-8 flex gap-3">
          <input
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="Enter client ID..."
            className="flex-1 px-4 py-3 rounded-lg bg-bg-surface border border-border-subtle text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-primary transition-colors"
          />
          <button
            onClick={fetchLeads}
            disabled={!clientId || loading}
            className="px-6 py-3 rounded-lg bg-brand-primary text-text-primary font-semibold hover:bg-brand-primary-glow transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Loading..." : "Load"}
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-error/10 border border-error/30 text-error text-sm">
            {error}
          </div>
        )}

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
            <StatCard
              icon={<MouseLeftClick className="w-5 h-5" />}
              label="Clicks"
              value={stats.total_clicks.toLocaleString()}
              color="text-brand-primary"
            />
            <StatCard
              icon={<User className="w-5 h-5" />}
              label="Leads"
              value={stats.total_leads.toLocaleString()}
              color="text-text-primary"
            />
            <StatCard
              icon={<CheckCircle className="w-5 h-5" />}
              label="Converted"
              value={`${stats.converted_leads} (${conversionRate}%)`}
              color="text-success"
            />
            <StatCard
              icon={<CurrencyDollar className="w-5 h-5" />}
              label="Revenue"
              value={formatCents(stats.total_value_cents)}
              color="text-brand-accent"
            />
            <StatCard
              icon={<CurrencyDollar className="w-5 h-5" />}
              label="Commission"
              value={formatCents(stats.total_commission_cents)}
              color="text-warning"
            />
          </div>
        )}

        {/* Leads Table */}
        {leads.length > 0 && (
          <div className="bg-bg-surface rounded-xl border border-border-subtle overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border-subtle text-text-secondary text-xs uppercase tracking-wider">
                    <th className="px-5 py-3 font-medium">Lead</th>
                    <th className="px-5 py-3 font-medium">Source</th>
                    <th className="px-5 py-3 font-medium hidden md:table-cell">Date</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium text-right">Value</th>
                    <th className="px-5 py-3 font-medium text-right">Commission</th>
                    <th className="px-5 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {leads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="hover:bg-bg-surface-raised transition-colors group"
                    >
                      <td className="px-5 py-3">
                        <div className="font-medium text-text-primary">
                          {lead.lead_name || "—"}
                        </div>
                        <div className="text-text-secondary text-sm flex items-center gap-1 mt-0.5">
                          <Envelope className="w-3 h-3" />
                          {lead.lead_email || "no email"}
                        </div>
                        {lead.lead_phone && (
                          <div className="text-text-secondary text-sm flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {lead.lead_phone}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-text-secondary text-sm max-w-[150px] truncate">
                        {lead.source || "—"}
                      </td>
                      <td className="px-5 py-3 text-text-secondary text-sm hidden md:table-cell">
                        {formatDate(lead.created_at)}
                      </td>
                      <td className="px-5 py-3">
                        {lead.converted ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-success/10 text-success text-xs font-medium">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Converted
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-warning/10 text-warning text-xs font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-sm text-text-primary">
                        {lead.converted ? formatCents(lead.conversion_value_cents) : "—"}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-sm text-brand-accent font-medium">
                        {lead.converted ? formatCents(lead.commission_cents) : "—"}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!lead.converted && (
                            <button
                              onClick={() => markConverted(lead)}
                              className="p-1.5 rounded-md bg-success/10 text-success hover:bg-success/20 transition-colors"
                              title="Mark converted"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          {lead.converted && (
                            <button
                              onClick={() => {
                                setEditingLead(lead.id);
                                setEditValue(lead.conversion_value_cents);
                                setEditNotes(lead.notes || "");
                              }}
                              className="p-1.5 rounded-md bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 transition-colors"
                              title="Edit value"
                            >
                              <PencilSimple className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() =>
                              setExpandedLead(
                                expandedLead === lead.id ? null : lead.id,
                              )
                            }
                            className="p-1.5 rounded-md bg-bg-surface-high text-text-secondary hover:text-text-primary transition-colors"
                          >
                            {expandedLead === lead.id ? (
                              <CaretUp className="w-4 h-4" />
                            ) : (
                              <CaretDown className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => deleteLead(lead.id)}
                            className="p-1.5 rounded-md bg-error/10 text-error hover:bg-error/20 transition-colors"
                            title="Delete"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Expanded lead detail */}
            {expandedLead && (() => {
              const lead = leads.find((l) => l.id === expandedLead);
              if (!lead) return null;
              return (
                <div className="px-5 py-4 border-t border-border-subtle bg-bg-surface-raised">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-text-muted">Lead ID:</span>
                      <p className="text-text-primary font-mono text-xs mt-1 break-all">{lead.id}</p>
                    </div>
                    <div>
                      <span className="text-text-muted">Client ID:</span>
                      <p className="text-text-primary font-mono text-xs mt-1 break-all">{lead.client_id}</p>
                    </div>
                    <div>
                      <span className="text-text-muted">Source:</span>
                      <p className="text-text-primary mt-1">{lead.source || "—"}</p>
                    </div>
                    <div className="md:col-span-3">
                      <span className="text-text-muted">Notes:</span>
                      <p className="text-text-primary mt-1">{lead.notes || "No notes"}</p>
                    </div>
                  </div>

                  {/* Edit form */}
                  {editingLead === lead.id && (
                    <div className="mt-4 p-4 rounded-lg bg-bg-surface border border-border-subtle flex flex-col sm:flex-row gap-3">
                      <div>
                        <label className="text-xs text-text-muted block mb-1">Conversion Value ($)</label>
                        <input
                          type="number"
                          value={editValue / 100}
                          onChange={(e) => setEditValue(Math.round(parseFloat(e.target.value || "0") * 100))}
                          className="w-32 px-3 py-2 rounded-md bg-bg-surface-high border border-border-subtle text-text-primary text-sm focus:outline-none focus:border-brand-primary"
                        />
                        <p className="text-xs text-text-muted mt-1">
                          Commission (50%): {formatCents(Math.round(editValue * 0.5))}
                        </p>
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-text-muted block mb-1">Notes</label>
                        <input
                          type="text"
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          className="w-full px-3 py-2 rounded-md bg-bg-surface-high border border-border-subtle text-text-primary text-sm focus:outline-none focus:border-brand-primary"
                        />
                      </div>
                      <div className="flex items-end gap-2">
                        <button
                          onClick={() => updateConversionValue(lead)}
                          className="px-4 py-2 rounded-md bg-brand-primary text-text-primary text-sm font-semibold hover:bg-brand-primary-glow transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingLead(null)}
                          className="px-4 py-2 rounded-md bg-bg-surface-high text-text-secondary text-sm hover:text-text-primary transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* Empty state */}
        {!loading && stats && leads.length === 0 && (
          <div className="text-center py-16 bg-bg-surface rounded-xl border border-border-subtle">
            <User className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <p className="text-text-secondary text-lg mb-1">No leads yet</p>
            <p className="text-text-muted text-sm">
              Leads will appear here once your tracking links start generating clicks.
            </p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-16">
            <Spinner className="w-8 h-8 text-brand-primary animate-spin mx-auto" />
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
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
