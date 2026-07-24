/**
 * /client/dashboard — Client Portal Dashboard
 *
 * Premium dark-themed collaboration hub with:
 * 1. Pipeline Progress
 * 2. Content Approvals
 * 3. Deliverables
 * 4. Messages
 * 5. Onboarding Hub
 * 6. Billing
 *
 * MetroReach Digital — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle,
  Clock,
  Circle,
  ArrowRight,
  ChatCircleText,
  PaperPlaneTilt,
  DownloadSimple,
  UploadSimple,
  CreditCard,
  SignOut,
  ListChecks,
  Package,
  UserCircle,
  WarningCircle,
  Check,
  X,
  CaretDown,
  CaretUp,
  Spinner,
  FileText,
  Image,
  VideoCamera,
  Presentation,
  LinkSimple,
} from "@phosphor-icons/react";

// ── Types ──

interface DashboardData {
  profile: {
    id: string;
    email: string;
    name: string;
    company?: string;
    service: string;
    service_slug: string;
    status: string;
    pipeline_status: string;
    onboarding_data: Record<string, unknown> | null;
    stripe_customer_id?: string;
    stripe_subscription_id?: string;
    created_at: string;
    updated_at: string;
  };
  deliverables: Deliverable[];
  messages: Message[];
  pipeline: PipelineStep[];
}

interface Deliverable {
  id: string;
  title: string;
  type: string;
  status: string;
  file_url?: string;
  notes?: string;
  created_at: string;
}

interface Message {
  id: string;
  direction: string;
  message: string;
  created_at: string;
}

interface PipelineStep {
  step_key: string;
  status: string;
  deliverables: unknown;
  created_at: string;
  updated_at: string;
}

// ── Pipeline stages ──

const PIPELINE_STAGES = [
  { key: "research", label: "Research", icon: FileText },
  { key: "create", label: "Create", icon: Presentation },
  { key: "review", label: "Review", icon: ListChecks },
  { key: "deliver", label: "Deliver", icon: Package },
];

// ── Type icon helper ──

function typeIcon(type: string) {
  switch (type.toLowerCase()) {
    case "post":
    case "social_post":
      return Image;
    case "ad":
    case "campaign":
      return Presentation;
    case "video":
      return VideoCamera;
    case "strategy":
    case "report":
      return FileText;
    default:
      return FileText;
  }
}

// ── Status badge ──

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: "bg-text-muted/10 text-text-muted border-text-muted/20",
    pending_review: "bg-warning/10 text-warning border-warning/20",
    approved: "bg-brand-accent/10 text-brand-accent border-brand-accent/20",
    changes_requested: "bg-error/10 text-error border-error/20",
    final: "bg-brand-primary/10 text-brand-primary border-brand-primary/20",
  };

  const labels: Record<string, string> = {
    draft: "Draft",
    pending_review: "Pending Review",
    approved: "Approved",
    changes_requested: "Changes Requested",
    final: "Final",
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${colors[status] || colors.draft}`}>
      {labels[status] || status}
    </span>
  );
}

// ── Main Dashboard Component ──

export const Route = createFileRoute("/client/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — MetroReach Digital Client Portal" },
      { name: "description", content: "Your MetroReach Digital marketing dashboard." },
    ],
  }),
  component: ClientDashboard,
});

function ClientDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<string>("pipeline");

  // Deliverable detail modal
  const [selectedDeliverable, setSelectedDeliverable] = useState<Deliverable | null>(null);
  const [approvalNotes, setApprovalNotes] = useState("");

  // Messages
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

  // Onboarding
  const [onboardingPlatforms, setOnboardingPlatforms] = useState("");
  const [onboardingGoals, setOnboardingGoals] = useState("");
  const [onboardingSubmitting, setOnboardingSubmitting] = useState(false);
  const [onboardingMsg, setOnboardingMsg] = useState("");

  // Upload
  const [uploadMsg, setUploadMsg] = useState("");

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/client/dashboard");
      if (res.status === 401) {
        window.location.href = "/client";
        return;
      }
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // ── Actions ──

  async function handleApprove(deliverableId: string, approved: boolean) {
    try {
      const res = await fetch("/api/client/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliverableId, approved, notes: approvalNotes }),
      });
      if (res.ok) {
        setSelectedDeliverable(null);
        setApprovalNotes("");
        fetchDashboard();
      }
    } catch (e) {
      console.error("Approval failed", e);
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/client/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: newMessage.trim() }),
      });
      if (res.ok) {
        setNewMessage("");
        fetchDashboard();
      }
    } catch (e) {
      console.error("Message failed", e);
    } finally {
      setSending(false);
    }
  }

  async function handleOnboardingSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOnboardingSubmitting(true);
    setOnboardingMsg("");
    try {
      const platformUrls: Record<string, string> = {};
      if (onboardingPlatforms.trim()) {
        for (const line of onboardingPlatforms.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const colon = trimmed.indexOf(":");
          if (colon > 0) {
            platformUrls[trimmed.slice(0, colon).trim()] = trimmed.slice(colon + 1).trim();
          }
        }
      }

      const goals = onboardingGoals.trim()
        ? onboardingGoals.split("\n").map((g) => g.trim()).filter(Boolean)
        : [];

      const res = await fetch("/api/client/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platformUrls: Object.keys(platformUrls).length > 0 ? platformUrls : undefined,
          brandInfo: undefined,
          goals: goals.length > 0 ? goals : undefined,
        }),
      });
      if (res.ok) {
        setOnboardingMsg("Onboarding data submitted successfully.");
        setOnboardingPlatforms("");
        setOnboardingGoals("");
        fetchDashboard();
      } else {
        setOnboardingMsg("Failed to submit. Please try again.");
      }
    } catch (e) {
      setOnboardingMsg("Network error. Please try again.");
    } finally {
      setOnboardingSubmitting(false);
    }
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.querySelector<HTMLInputElement>('input[type="file"]');
    if (!fileInput?.files?.length) return;

    setUploadMsg("");
    const formData = new FormData();
    for (const file of fileInput.files) {
      formData.append("file", file);
    }

    try {
      const res = await fetch("/api/client/upload", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        setUploadMsg("Files uploaded successfully.");
        fileInput.value = "";
        fetchDashboard();
      } else {
        const err = await res.json();
        setUploadMsg(err.error || "Upload failed.");
      }
    } catch (e) {
      setUploadMsg("Network error. Please try again.");
    }
  }

  // ── Loading State ──

  if (loading) {
    return (
      <main className="min-h-dvh bg-bg-root flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Spinner size={32} className="text-brand-primary animate-spin" />
          <p className="text-sm text-text-muted">Loading your dashboard...</p>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-dvh bg-bg-root flex items-center justify-center">
        <div className="text-center">
          <WarningCircle size={48} className="text-error mx-auto mb-4" weight="fill" />
          <p className="text-text-primary font-semibold mb-2">Failed to load dashboard</p>
          <p className="text-sm text-text-muted mb-4">{error}</p>
          <button
            onClick={() => { setLoading(true); setError(""); fetchDashboard(); }}
            className="px-4 py-2 bg-brand-primary text-text-primary rounded-xl text-sm font-semibold"
          >
            Try Again
          </button>
        </div>
      </main>
    );
  }

  const { profile, deliverables, messages, pipeline } = data;
  const pendingDeliverables = deliverables.filter((d) => d.status === "pending_review" || d.status === "changes_requested");
  const hasOnboardingData = profile.onboarding_data && Object.keys(profile.onboarding_data).length > 0;

  // Determine current pipeline stage
  const completedSteps = pipeline.filter((p) => p.status === "completed").map((p) => p.step_key);
  const currentStageIndex = completedSteps.length;

  return (
    <main className="min-h-dvh bg-bg-root">
      {/* ── Top Nav ── */}
      <header className="bg-bg-surface border-b border-border-subtle sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center">
              <UserCircle size={18} className="text-brand-primary" weight="fill" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary font-heading">
                {profile.name}
              </p>
              <p className="text-xs text-text-muted">{profile.service}</p>
            </div>
          </div>

          <a
            href="/api/client/auth"
            onClick={(e) => {
              e.preventDefault();
              // Clear cookie by setting past expiry
              document.cookie = "metroreach_client_token=; Path=/; Max-Age=0; SameSite=Lax";
              window.location.href = "/client";
            }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text-secondary transition-colors"
          >
            <SignOut size={14} />
            Sign Out
          </a>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ── Tab Navigation ── */}
        <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-1">
          {[
            { key: "pipeline", label: "Pipeline", icon: ListChecks },
            { key: "approvals", label: "Approvals", icon: CheckCircle, badge: pendingDeliverables.length },
            { key: "deliverables", label: "Deliverables", icon: Package },
            { key: "messages", label: "Messages", icon: ChatCircleText },
            { key: "onboarding", label: "Onboarding", icon: UploadSimple },
            { key: "billing", label: "Billing", icon: CreditCard },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 whitespace-nowrap ${
                  active
                    ? "bg-brand-primary text-text-primary"
                    : "text-text-secondary hover:text-text-primary hover:bg-bg-surface"
                }`}
              >
                <Icon size={16} weight={active ? "fill" : "regular"} />
                {tab.label}
                {tab.badge && tab.badge > 0 && (
                  <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
                    active ? "bg-white/20 text-white" : "bg-brand-primary/20 text-brand-primary"
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Pipeline Progress ── */}
        {activeTab === "pipeline" && (
          <section className="space-y-6">
            <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6 md:p-8">
              <h2 className="text-lg font-bold font-heading text-text-primary mb-6">
                Pipeline Progress
              </h2>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                {PIPELINE_STAGES.map((stage, i) => {
                  const Icon = stage.icon;
                  const isComplete = completedSteps.includes(stage.key) || i < currentStageIndex;
                  const isCurrent = i === currentStageIndex && currentStageIndex < 4;
                  const isFuture = i > currentStageIndex;

                  return (
                    <div key={stage.key} className="flex items-center gap-0 flex-1 min-w-[120px]">
                      <div className="flex flex-col items-center text-center flex-1">
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center mb-2 transition-all ${
                            isComplete
                              ? "bg-brand-accent/10 border border-brand-accent/30"
                              : isCurrent
                                ? "bg-brand-primary/10 border-2 border-brand-primary"
                                : "bg-bg-surface-raised border border-border-subtle"
                          }`}
                        >
                          <Icon
                            size={22}
                            weight={isComplete ? "fill" : "regular"}
                            className={
                              isComplete
                                ? "text-brand-accent"
                                : isCurrent
                                  ? "text-brand-primary"
                                  : "text-text-muted"
                            }
                          />
                        </div>
                        <p
                          className={`text-xs font-semibold ${
                            isComplete
                              ? "text-brand-accent"
                              : isCurrent
                                ? "text-brand-primary"
                                : "text-text-muted"
                          }`}
                        >
                          {stage.label}
                        </p>
                        {isComplete && (
                          <Check size={12} className="text-brand-accent mt-1" weight="bold" />
                        )}
                        {isCurrent && (
                          <span className="text-[10px] text-brand-primary mt-1 font-medium animate-pulse">
                            In Progress
                          </span>
                        )}
                      </div>
                      {i < PIPELINE_STAGES.length - 1 && (
                        <div className={`h-0.5 flex-1 mx-2 rounded-full ${
                          isComplete ? "bg-brand-accent/50" : "bg-border-subtle"
                        }`} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* ETA */}
              {currentStageIndex < 4 && (
                <div className="mt-6 pt-6 border-t border-border-subtle flex items-center gap-3">
                  <Clock size={18} className="text-text-muted" />
                  <p className="text-sm text-text-secondary">
                    Estimated completion:{" "}
                    <span className="text-text-primary font-semibold">
                      {currentStageIndex <= 1
                        ? "3–5 business days"
                        : currentStageIndex === 2
                          ? "1–2 business days"
                          : "Within 24 hours"}
                    </span>
                  </p>
                </div>
              )}

              {currentStageIndex >= 4 && (
                <div className="mt-6 pt-6 border-t border-border-subtle flex items-center gap-3">
                  <CheckCircle size={18} className="text-brand-accent" weight="fill" />
                  <p className="text-sm text-brand-accent font-semibold">
                    All pipeline stages complete — your service is active.
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Content Approvals ── */}
        {activeTab === "approvals" && (
          <section className="space-y-4">
            <h2 className="text-lg font-bold font-heading text-text-primary mb-1">
              Content Approvals
            </h2>
            <p className="text-sm text-text-secondary mb-6">
              Review and approve content from your MetroReach team.
            </p>

            {deliverables.filter((d) => d.status === "pending_review" || d.status === "changes_requested").length === 0 ? (
              <div className="bg-bg-surface border border-border-subtle rounded-2xl p-12 text-center">
                <CheckCircle size={40} className="text-text-muted mx-auto mb-3" weight="fill" />
                <p className="text-text-primary font-medium">Nothing to review</p>
                <p className="text-sm text-text-muted mt-1">New content awaiting your approval will appear here.</p>
              </div>
            ) : (
              <div className="bg-bg-surface border border-border-subtle rounded-2xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border-subtle">
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-text-muted uppercase tracking-wider">Title</th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-text-muted uppercase tracking-wider">Type</th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-text-muted uppercase tracking-wider">Date</th>
                      <th className="text-right px-5 py-3.5 text-xs font-semibold text-text-muted uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliverables.filter((d) => d.status === "pending_review" || d.status === "changes_requested").map((d) => {
                      const Icon = typeIcon(d.type);
                      return (
                        <tr key={d.id} className="border-b border-border-subtle/50 last:border-0 hover:bg-bg-surface-raised/50 transition-colors">
                          <td className="px-5 py-4">
                            <button
                              onClick={() => setSelectedDeliverable(d)}
                              className="text-sm font-medium text-text-primary hover:text-brand-primary transition-colors text-left"
                            >
                              {d.title}
                            </button>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <Icon size={14} className="text-text-muted" />
                              <span className="text-sm text-text-secondary capitalize">{d.type}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-sm text-text-muted">
                            {new Date(d.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleApprove(d.id, true)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-accent/10 text-brand-accent text-xs font-semibold hover:bg-brand-accent/20 transition-colors"
                              >
                                <Check size={14} weight="bold" />
                                Approve
                              </button>
                              <button
                                onClick={() => setSelectedDeliverable(d)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-warning/10 text-warning text-xs font-semibold hover:bg-warning/20 transition-colors"
                              >
                                <X size={14} weight="bold" />
                                Changes
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Detail Modal */}
            {selectedDeliverable && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="bg-bg-surface border border-border-subtle rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold font-heading text-text-primary">
                          {selectedDeliverable.title}
                        </h3>
                        <p className="text-sm text-text-muted capitalize">{selectedDeliverable.type}</p>
                      </div>
                      <button
                        onClick={() => { setSelectedDeliverable(null); setApprovalNotes(""); }}
                        className="p-1.5 rounded-lg hover:bg-bg-surface-raised text-text-muted hover:text-text-primary transition-colors"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    {selectedDeliverable.file_url && (
                      <a
                        href={selectedDeliverable.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-brand-primary hover:underline mb-4"
                      >
                        <LinkSimple size={16} />
                        View Full Content
                      </a>
                    )}

                    <StatusBadge status={selectedDeliverable.status} />

                    <div className="mt-5">
                      <label className="block text-sm font-medium text-text-secondary mb-2">
                        Notes / Feedback
                      </label>
                      <textarea
                        value={approvalNotes}
                        onChange={(e) => setApprovalNotes(e.target.value)}
                        placeholder="Add notes or request specific changes..."
                        rows={4}
                        className="w-full px-4 py-3 bg-bg-surface-raised border border-border-subtle rounded-xl text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 resize-none"
                      />
                    </div>

                    <div className="flex items-center gap-3 mt-5">
                      <button
                        onClick={() => handleApprove(selectedDeliverable.id, true)}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-accent text-text-primary text-sm font-semibold hover:bg-brand-accent/80 transition-colors"
                      >
                        <Check size={16} weight="bold" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleApprove(selectedDeliverable.id, false)}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-warning/10 text-warning border border-warning/20 text-sm font-semibold hover:bg-warning/20 transition-colors"
                      >
                        <X size={16} weight="bold" />
                        Request Changes
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Deliverables ── */}
        {activeTab === "deliverables" && (
          <section className="space-y-4">
            <h2 className="text-lg font-bold font-heading text-text-primary mb-1">
              Deliverables
            </h2>
            <p className="text-sm text-text-secondary mb-6">
              All completed content, reports, and assets from your MetroReach team.
            </p>

            {deliverables.length === 0 ? (
              <div className="bg-bg-surface border border-border-subtle rounded-2xl p-12 text-center">
                <Package size={40} className="text-text-muted mx-auto mb-3" weight="fill" />
                <p className="text-text-primary font-medium">No deliverables yet</p>
                <p className="text-sm text-text-muted mt-1">Completed items will appear here as your pipeline progresses.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {deliverables.map((d) => {
                  const Icon = typeIcon(d.type);
                  return (
                    <div
                      key={d.id}
                      className="bg-bg-surface border border-border-subtle rounded-2xl p-5 flex items-center justify-between gap-4 card-hover"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-bg-surface-raised flex items-center justify-center flex-shrink-0">
                          <Icon size={18} className="text-brand-primary" weight="fill" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-text-primary truncate">{d.title}</p>
                          <p className="text-xs text-text-muted capitalize">
                            {d.type} &middot; {new Date(d.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <StatusBadge status={d.status} />
                        {d.file_url && (
                          <a
                            href={d.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-primary/10 text-brand-primary text-xs font-semibold hover:bg-brand-primary/20 transition-colors"
                          >
                            <DownloadSimple size={14} weight="bold" />
                            Download
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ── Messages ── */}
        {activeTab === "messages" && (
          <section className="space-y-4">
            <h2 className="text-lg font-bold font-heading text-text-primary mb-1">
              Messages
            </h2>
            <p className="text-sm text-text-secondary mb-6">
              Send messages directly to your MetroReach team.
            </p>

            <div className="bg-bg-surface border border-border-subtle rounded-2xl overflow-hidden flex flex-col h-[500px]">
              {/* Messages list */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <ChatCircleText size={40} className="text-text-muted mx-auto mb-3" weight="fill" />
                      <p className="text-text-primary font-medium">No messages yet</p>
                      <p className="text-sm text-text-muted mt-1">Start a conversation with your team below.</p>
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isClient = msg.direction === "client_to_team";
                    return (
                      <div key={msg.id} className={`flex ${isClient ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                          isClient
                            ? "bg-brand-primary text-text-primary rounded-br-md"
                            : "bg-bg-surface-raised text-text-primary rounded-bl-md border border-border-subtle"
                        }`}>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                          <p className={`text-xs mt-1.5 ${isClient ? "text-white/60" : "text-text-muted"}`}>
                            {new Date(msg.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Message input */}
              <form onSubmit={handleSendMessage} className="border-t border-border-subtle p-4 flex items-end gap-3">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  rows={2}
                  className="flex-1 px-4 py-2.5 bg-bg-surface-raised border border-border-subtle rounded-xl text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-primary text-text-primary text-sm font-semibold hover:bg-gradient-to-r hover:from-brand-primary hover:to-brand-accent transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                >
                  {sending ? (
                    <Spinner size={16} className="animate-spin" />
                  ) : (
                    <PaperPlaneTilt size={16} weight="fill" />
                  )}
                  Send
                </button>
              </form>
            </div>
          </section>
        )}

        {/* ── Onboarding Hub ── */}
        {activeTab === "onboarding" && (
          <section className="space-y-6">
            <h2 className="text-lg font-bold font-heading text-text-primary mb-1">
              Onboarding Hub
            </h2>
            <p className="text-sm text-text-secondary mb-6">
              Help us get everything set up for your campaigns.
            </p>

            {/* Checklist */}
            <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-text-primary mb-4">Setup Checklist</h3>
              <div className="space-y-3">
                {[
                  { label: "Platform URLs submitted", done: hasOnboardingData && profile.onboarding_data?.platformUrls },
                  { label: "Brand guidelines uploaded", done: hasOnboardingData && (profile.onboarding_data?.assets as any[])?.length > 0 },
                  { label: "Business goals shared", done: hasOnboardingData && profile.onboarding_data?.goals },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                      item.done ? "bg-brand-accent/10" : "bg-bg-surface-raised"
                    }`}>
                      {item.done ? (
                        <CheckCircle size={16} className="text-brand-accent" weight="fill" />
                      ) : (
                        <Circle size={16} className="text-text-muted" />
                      )}
                    </div>
                    <span className={`text-sm ${item.done ? "text-text-primary" : "text-text-muted"}`}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Platform URLs */}
            <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-text-primary mb-2">Platform URLs</h3>
              <p className="text-xs text-text-muted mb-4">
                Enter one per line: <code className="text-brand-primary">Platform: URL</code> (e.g. Facebook: https://facebook.com/yourpage)
              </p>
              <textarea
                value={onboardingPlatforms}
                onChange={(e) => setOnboardingPlatforms(e.target.value)}
                placeholder="Facebook: https://facebook.com/...&#10;Instagram: https://instagram.com/..."
                rows={4}
                className="w-full px-4 py-3 bg-bg-surface-raised border border-border-subtle rounded-xl text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 resize-none font-mono"
              />
            </div>

            {/* Goals */}
            <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-text-primary mb-2">Business Goals</h3>
              <p className="text-xs text-text-muted mb-4">
                What are your top marketing goals for this quarter? One per line.
              </p>
              <textarea
                value={onboardingGoals}
                onChange={(e) => setOnboardingGoals(e.target.value)}
                placeholder="Increase qualified leads by 30%&#10;Build brand awareness in Austin metro&#10;Launch seasonal promotion campaign"
                rows={4}
                className="w-full px-4 py-3 bg-bg-surface-raised border border-border-subtle rounded-xl text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 resize-none"
              />
            </div>

            {/* File Upload */}
            <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-text-primary mb-2">Brand Assets</h3>
              <p className="text-xs text-text-muted mb-4">
                Upload your logo, brand guidelines, or any reference files (max 10MB each).
              </p>
              <form onSubmit={handleUpload} className="space-y-4">
                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx"
                    className="text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border file:border-border-subtle file:text-sm file:font-semibold file:bg-bg-surface-raised file:text-text-primary hover:file:border-brand-primary file:transition-colors file:cursor-pointer"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-primary text-text-primary text-sm font-semibold hover:bg-gradient-to-r hover:from-brand-primary hover:to-brand-accent transition-all duration-200"
                  >
                    <UploadSimple size={14} weight="bold" />
                    Upload
                  </button>
                </div>
                {uploadMsg && (
                  <p className={`text-xs ${uploadMsg.includes("fail") ? "text-error" : "text-brand-accent"}`}>
                    {uploadMsg}
                  </p>
                )}
              </form>

              {/* Show existing uploaded assets */}
              {hasOnboardingData && (profile.onboarding_data?.assets as any[])?.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border-subtle">
                  <p className="text-xs text-text-muted mb-2">
                    Uploaded files: {(profile.onboarding_data?.assets as any[]).length}
                  </p>
                  <div className="space-y-1">
                    {(profile.onboarding_data?.assets as any[]).map((asset: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-text-secondary">
                        <FileText size={12} className="text-text-muted" />
                        {asset.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Submit onboarding */}
            <button
              onClick={handleOnboardingSubmit}
              disabled={onboardingSubmitting}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-brand-accent text-text-primary text-sm font-semibold hover:bg-brand-accent/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {onboardingSubmitting ? (
                <Spinner size={16} className="animate-spin" />
              ) : (
                <CheckCircle size={16} weight="fill" />
              )}
              Submit Onboarding Data
            </button>
            {onboardingMsg && (
              <p className={`text-xs text-center ${onboardingMsg.includes("fail") ? "text-error" : "text-brand-accent"}`}>
                {onboardingMsg}
              </p>
            )}
          </section>
        )}

        {/* ── Billing ── */}
        {activeTab === "billing" && (
          <section className="space-y-6">
            <h2 className="text-lg font-bold font-heading text-text-primary mb-1">
              Billing
            </h2>
            <p className="text-sm text-text-secondary mb-6">
              Your plan and payment details.
            </p>

            {/* Current Plan */}
            <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-text-primary">Current Plan</h3>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-accent/10 text-brand-accent text-xs font-semibold">
                  <CheckCircle size={12} weight="fill" />
                  Active
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-text-muted mb-1">Service</p>
                  <p className="text-sm font-semibold text-text-primary">{profile.service}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted mb-1">Status</p>
                  <p className="text-sm font-semibold text-text-primary capitalize">{profile.status}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted mb-1">Next Payment</p>
                  <p className="text-sm font-semibold text-text-primary">
                    {new Date(new Date(profile.updated_at).getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-muted mb-1">Client Since</p>
                  <p className="text-sm font-semibold text-text-primary">
                    {new Date(profile.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Payment History */}
            <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-text-primary mb-4">Payment Method</h3>
              {profile.stripe_customer_id ? (
                <p className="text-sm text-text-secondary">
                  Your payment method is managed securely through Stripe. For changes, please contact{" "}
                  <a href="mailto:support@metroreachagency.com" className="text-brand-primary hover:underline">
                    support@metroreachagency.com
                  </a>.
                </p>
              ) : (
                <p className="text-sm text-text-muted">No payment method on file.</p>
              )}
            </div>

            <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-text-primary mb-4">Need Help?</h3>
              <p className="text-sm text-text-secondary">
                For billing questions or plan changes, contact our team at{" "}
                <a href="mailto:support@metroreachagency.com" className="text-brand-primary hover:underline">
                  support@metroreachagency.com
                </a>.
              </p>
            </div>
          </section>
        )}

      </div>

      {/* Footer */}
      <footer className="border-t border-border-subtle py-6 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs text-text-muted">
            &copy; {new Date().getFullYear()} MetroReach Digital. Premium Social Media Marketing.
          </p>
        </div>
      </footer>
    </main>
  );
}
