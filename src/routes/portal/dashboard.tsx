/**
 * /portal/dashboard — Client Portal Dashboard
 *
 * Clean, simple dashboard: approvals, messages, upload, activity.
 * Think: Basecamp meets Slack but simpler.
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  CheckCircle,
  Clock,
  ChatCircleText,
  PaperPlaneTilt,
  UploadSimple,
  SignOut,
  WarningCircle,
  Check,
  X,
  Spinner,
  FileText,
  Image,
  VideoCamera,
  UserCircle,
  BellRinging,
  ArrowUpRight,
  ArrowRight,
  NotePencil,
  CalendarBlank,
  GlobeHemisphereWest,
  ClipboardText,
} from "@phosphor-icons/react";

interface DashboardData {
  profile: {
    id: string;
    email: string;
    name: string;
    company?: string;
    service: string;
    status: string;
    pipeline_status: string;
    onboarding_data: Record<string, unknown> | null;
    created_at: string;
  };
  approvals: Approval[];
  messages: PortalMessage[];
  deliverables: Deliverable[];
  pendingApprovals: number;
}

interface Approval {
  id: string;
  title: string;
  content_type: string;
  platform: string;
  scheduled_date: string;
  status: string;
  content_preview: string;
  client_notes: string;
  team_notes: string;
  created_at: string;
  updated_at: string | null;
}

interface PortalMessage {
  id: string;
  sender_type: string;
  message: string;
  created_at: string;
}

interface Deliverable {
  id: string;
  title: string;
  type: string;
  status: string;
  created_at: string;
}

// ── Status badge ──
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-warning/10 text-warning border-warning/20",
    approved: "bg-brand-accent/10 text-brand-accent border-brand-accent/20",
    changes_requested: "bg-error/10 text-error border-error/20",
    published: "bg-brand-primary/10 text-brand-primary border-brand-primary/20",
  };
  const labels: Record<string, string> = {
    pending: "Pending Review",
    approved: "Approved",
    changes_requested: "Changes Requested",
    published: "Published",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${colors[status] || colors.pending}`}>
      {labels[status] || status}
    </span>
  );
}

function typeIcon(type: string) {
  switch (type.toLowerCase()) {
    case "social_post": return Image;
    case "video": return VideoCamera;
    case "campaign": return GlobeHemisphereWest;
    default: return FileText;
  }
}

// ── Main Dashboard ──
export const Route = createFileRoute("/portal/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — MetroReach Media Portal" },
      { name: "description", content: "Your MetroReach Media marketing dashboard." },
    ],
  }),
  component: PortalDashboard,
});

function PortalDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Messages
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Approval detail
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);
  const [approvalNotes, setApprovalNotes] = useState("");

  // Upload
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadMsg, setUploadMsg] = useState("");
  const [uploadMsgType, setUploadMsgType] = useState<"success" | "error" | "">("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Onboarding success toast
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  // Active section
  const [section, setSection] = useState<"activity" | "approvals" | "messages" | "upload">("activity");

  // Check for onboarding=complete query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("onboarding") === "complete") {
      setOnboardingComplete(true);
      window.history.replaceState(null, "", "/portal/dashboard");
    }
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/portal/dashboard");
      if (res.status === 401) {
        window.location.href = "/portal";
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

  // Scroll messages to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages]);

  // Escape key — close approval modal
  useEffect(() => {
    if (!selectedApproval) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeApprovalModal();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedApproval, approvalNotes]);

  function closeApprovalModal() {
    if (approvalNotes.trim().length > 0) {
      if (!confirm("You have unsaved notes. Close without saving?")) return;
    }
    setSelectedApproval(null);
    setApprovalNotes("");
  }

  // ── Actions ──

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim()) return;
    setSending(true);

    // Optimistic UI — add message immediately
    const optimisticMsg: PortalMessage = {
      id: `opt-${Date.now()}`,
      sender_type: "client",
      message: newMessage.trim(),
      created_at: new Date().toISOString(),
    };

    setData((prev) => prev ? { ...prev, messages: [...prev.messages, optimisticMsg] } : prev);
    setNewMessage("");

    try {
      const res = await fetch("/api/portal/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-protection": "1" },
        body: JSON.stringify({ message: optimisticMsg.message }),
      });
      if (res.status === 401) {
        window.location.href = "/portal";
        return;
      }
      if (!res.ok) {
        // Remove optimistic message on failure
        setData((prev) => prev ? { ...prev, messages: prev.messages.filter((m) => m.id !== optimisticMsg.id) } : prev);
      }
    } catch (e) {
      console.error("Message failed", e);
      // Remove optimistic message on failure
      setData((prev) => prev ? { ...prev, messages: prev.messages.filter((m) => m.id !== optimisticMsg.id) } : prev);
    } finally {
      setSending(false);
    }
  }

  async function handleApprovalAction(approvalId: string, status: string) {
    try {
      const res = await fetch("/api/portal/approvals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-csrf-protection": "1" },
        body: JSON.stringify({ id: approvalId, status, notes: approvalNotes }),
      });
      if (res.status === 401) {
        window.location.href = "/portal";
        return;
      }
      if (res.ok) {
        setSelectedApproval(null);
        setApprovalNotes("");
        fetchDashboard();
      }
    } catch (e) {
      console.error("Approval action failed", e);
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (uploadFiles.length === 0) return;

    // Client-side file validation
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const ALLOWED_TYPES = ["video/mp4", "video/quicktime", "image/jpeg", "image/png", "image/webp"];
    for (const f of uploadFiles) {
      if (!ALLOWED_TYPES.includes(f.type)) {
        setUploadMsg(`Unsupported file type: "${f.name}". Use MP4, MOV, JPG, PNG, or WebP.`);
        setUploadMsgType("error");
        return;
      }
      if (f.size > MAX_FILE_SIZE) {
        setUploadMsg(`File "${f.name}" exceeds the 10MB limit.`);
        setUploadMsgType("error");
        return;
      }
    }

    setUploading(true);
    setUploadMsg("");
    setUploadMsgType("");

    const formData = new FormData();
    for (const f of uploadFiles) {
      formData.append("files", f);
    }

    try {
      const res = await fetch("/api/client/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
        headers: { "x-csrf-protection": "1" },
      });
      if (res.status === 401) {
        window.location.href = "/portal";
        return;
      }
      if (res.ok) {
        setUploadMsg("Files uploaded successfully.");
        setUploadMsgType("success");
        setUploadFiles([]);
      } else {
        const err = await res.json();
        setUploadMsg(err.error || "Upload failed.");
        setUploadMsgType("error");
      }
    } catch {
      setUploadMsg("Network error.");
      setUploadMsgType("error");
    } finally {
      setUploading(false);
    }
  }

  async function handleSignOut() {
    try {
      await fetch("/api/portal/logout", { method: "POST", credentials: "include", headers: { "x-csrf-protection": "1" } });
    } catch {}
    window.location.href = "/portal";
  }

  // ── Loading ──
  if (loading) {
    return (
      <main className="min-h-dvh bg-bg-root flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Spinner size={32} className="text-brand-primary animate-spin" />
          <p className="text-sm text-text-muted">Loading your portal...</p>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-dvh bg-bg-root flex items-center justify-center px-4">
        <div className="text-center">
          <WarningCircle size={48} className="text-error mx-auto mb-4" weight="fill" />
          <p className="text-text-primary font-semibold mb-2">Failed to load portal</p>
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

  const { profile, approvals, messages, deliverables, pendingApprovals } = data;

  const navItems = [
    { key: "activity" as const, label: "Activity", icon: BellRinging },
    { key: "approvals" as const, label: "Approvals", icon: CheckCircle, badge: pendingApprovals },
    { key: "messages" as const, label: "Messages", icon: ChatCircleText },
    { key: "upload" as const, label: "Upload", icon: UploadSimple },
  ];

  return (
    <main className="min-h-dvh bg-bg-root">
      {/* ── Top Bar ── */}
      <header className="bg-bg-surface border-b border-border-subtle sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center">
              <UserCircle size={18} className="text-brand-primary" weight="fill" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary font-heading">
                {profile.name}
              </p>
              {profile.company && (
                <p className="text-xs text-text-muted">{profile.company}</p>
              )}
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text-secondary transition-colors"
          >
            <SignOut size={14} />
            Sign Out
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* ── Welcome Card ── */}
        <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-lg font-bold font-heading text-text-primary">
                Welcome back{profile.name ? `, ${profile.name.split(" ")[0]}` : ""}
              </h2>
              <p className="text-sm text-text-secondary mt-0.5">
                {profile.service} &middot; {profile.status === "active" ? (
                  <span className="text-brand-accent">Active</span>
                ) : (
                  <span className="text-warning capitalize">{profile.status}</span>
                )}
              </p>
            </div>
            {pendingApprovals > 0 && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-warning/10 border border-warning/20">
                <BellRinging size={16} className="text-warning" weight="fill" />
                <span className="text-sm font-semibold text-warning">
                  {pendingApprovals} pending approval{pendingApprovals !== 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Onboarding Success Toast ── */}
        {onboardingComplete && (
          <div className="mb-6 p-4 rounded-xl bg-success/10 border border-success/20 flex items-start gap-3 animate-fade-in">
            <CheckCircle size={20} className="text-success flex-shrink-0 mt-0.5" weight="fill" />
            <div>
              <p className="text-sm font-semibold text-success">Onboarding complete!</p>
              <p className="text-xs text-text-secondary mt-1">
                Your information has been submitted. Our team will review everything and reach out within 24 hours to kick off your strategy.
              </p>
            </div>
          </div>
        )}

        {/* ── Onboarding Nudge Banner ── */}
        {!profile.onboarding_data && !onboardingComplete && (
          <div className="mb-6 p-5 rounded-2xl bg-brand-primary/5 border border-brand-primary/15 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-brand-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                <ClipboardText size={18} className="text-brand-primary" weight="fill" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  Complete your onboarding to get started
                </p>
                <p className="text-xs text-text-secondary mt-0.5">
                  Tell us about your business, goals, and social media accounts so our team can build your custom strategy.
                </p>
              </div>
            </div>
            <a
              href="/portal/onboarding"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-primary text-text-primary text-sm font-semibold hover:bg-gradient-to-r hover:from-brand-primary hover:to-brand-primary transition-all duration-200 whitespace-nowrap flex-shrink-0"
            >
              Start Onboarding
              <ArrowRight size={16} weight="bold" />
            </a>
          </div>
        )}

        {/* ── Nav tabs ── */}
        <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1 portal-tabs">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = section === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setSection(item.key)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 whitespace-nowrap ${
                  active
                    ? "bg-brand-primary text-text-primary"
                    : "text-text-secondary hover:text-text-primary hover:bg-bg-surface"
                }`}
              >
                <Icon size={16} weight={active ? "fill" : "regular"} />
                {item.label}
                {item.badge && item.badge > 0 && (
                  <span className={`inline-flex items-center justify-center min-w-[20px] h-5 rounded-full text-xs font-bold px-1.5 ${
                    active ? "bg-white/20 text-white" : "bg-warning/20 text-warning"
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Activity Feed ── */}
        {section === "activity" && (
          <div key="activity" className="space-y-4 tab-panel-enter">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Recent Activity</h3>
            {deliverables.length === 0 ? (
              <div className="bg-bg-surface border border-border-subtle rounded-2xl p-10 text-center">
                <Clock size={36} className="text-text-muted mx-auto mb-3" />
                <p className="text-text-primary font-medium">No activity yet</p>
                <p className="text-sm text-text-muted mt-1">Your campaign activity will appear here.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {deliverables.slice(0, 15).map((d) => {
                  const Icon = typeIcon(d.type);
                  return (
                    <div key={d.id} className="bg-bg-surface border border-border-subtle rounded-xl p-4 flex items-center gap-4">
                      <div className="w-9 h-9 rounded-lg bg-bg-surface-raised flex items-center justify-center flex-shrink-0">
                        <Icon size={16} className="text-brand-primary" weight="fill" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{d.title}</p>
                        <p className="text-xs text-text-muted capitalize">{d.type} &middot; {new Date(d.created_at).toLocaleDateString()}</p>
                      </div>
                      <StatusBadge status={d.status} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Content Approvals ── */}
        {section === "approvals" && (
          <div key="approvals" className="space-y-4 tab-panel-enter">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Content for Review</h3>
            {approvals.length === 0 ? (
              <div className="bg-bg-surface border border-border-subtle rounded-2xl p-10 text-center">
                <CheckCircle size={36} className="text-text-muted mx-auto mb-3" weight="fill" />
                <p className="text-text-primary font-medium">Nothing to review</p>
                <p className="text-sm text-text-muted mt-1">New content awaiting your approval will appear here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {approvals.map((a) => (
                  <div key={a.id} className="bg-bg-surface border border-border-subtle rounded-xl p-4">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-text-primary">{a.title}</h4>
                        <p className="text-xs text-text-muted mt-1">
                          {a.platform && `${a.platform} · `}
                          {a.content_type && `${a.content_type.replace("_", " ")} · `}
                          {a.scheduled_date && `Scheduled: ${a.scheduled_date} · `}
                          {new Date(a.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <StatusBadge status={a.status} />
                    </div>
                    {a.content_preview && (
                      <p className="text-sm text-text-secondary bg-bg-surface-raised rounded-lg p-3 mb-3 line-clamp-3">
                        {a.content_preview}
                      </p>
                    )}
                    {a.team_notes && (
                      <p className="text-xs text-text-muted mb-3">
                        <span className="font-medium text-text-secondary">Team note:</span> {a.team_notes}
                      </p>
                    )}
                    {(a.status === "pending" || a.status === "changes_requested") && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApprovalAction(a.id, "approved")}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-accent/10 text-brand-accent text-xs font-semibold hover:bg-brand-accent/20 transition-colors"
                        >
                          <Check size={14} weight="bold" /> Approve
                        </button>
                        <button
                          onClick={() => { setSelectedApproval(a); setApprovalNotes(""); }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-warning/10 text-warning text-xs font-semibold hover:bg-warning/20 transition-colors"
                        >
                          <NotePencil size={14} weight="bold" /> Request Changes
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Approval detail modal */}
            {selectedApproval && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="bg-bg-surface border border-border-subtle rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold font-heading text-text-primary">{selectedApproval.title}</h3>
                        <p className="text-sm text-text-muted capitalize">{selectedApproval.content_type.replace("_", " ")}</p>
                      </div>
                      <button
                        onClick={closeApprovalModal}
                        className="p-1.5 rounded-lg hover:bg-bg-surface-raised text-text-muted hover:text-text-primary transition-colors"
                      >
                        <X size={20} />
                      </button>
                    </div>
                    <StatusBadge status={selectedApproval.status} />
                    <div className="mt-5">
                      <label className="block text-sm font-medium text-text-secondary mb-2">
                        Feedback Notes
                      </label>
                      <textarea
                        value={approvalNotes}
                        onChange={(e) => setApprovalNotes(e.target.value)}
                        placeholder="Add notes or request specific changes..."
                        rows={4}
                        maxLength={2000}
                        className="w-full px-4 py-3 bg-bg-surface-raised border border-border-subtle rounded-xl text-text-primary placeholder:text-text-muted text-sm focus-visible:outline-2 focus-visible:outline-brand-primary resize-none"
                      />
                    </div>
                    <div className="flex items-center gap-3 mt-5">
                      <button
                        onClick={() => handleApprovalAction(selectedApproval.id, "approved")}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-accent text-text-primary text-sm font-semibold hover:bg-brand-accent/80 transition-colors"
                      >
                        <Check size={16} weight="bold" /> Approve
                      </button>
                      <button
                        onClick={() => handleApprovalAction(selectedApproval.id, "changes_requested")}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-warning/10 text-warning border border-warning/20 text-sm font-semibold hover:bg-warning/20 transition-colors"
                      >
                        <X size={16} weight="bold" /> Request Changes
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Messages ── */}
        {section === "messages" && (
          <div key="messages" className="space-y-4 tab-panel-enter">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Messages</h3>
            <div className="bg-bg-surface border border-border-subtle rounded-2xl overflow-hidden flex flex-col h-[500px]">
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <ChatCircleText size={40} className="text-text-muted mx-auto mb-3" weight="fill" />
                      <p className="text-text-primary font-medium">No messages yet</p>
                      <p className="text-sm text-text-muted mt-1">Start a conversation with your MetroReach team.</p>
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isClient = msg.sender_type === "client";
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
                <div ref={messagesEndRef} />
              </div>
              <form onSubmit={handleSendMessage} className="border-t border-border-subtle p-4 flex items-end gap-3">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  rows={2}
                  maxLength={5000}
                  className="flex-1 px-4 py-2.5 bg-bg-surface-raised border border-border-subtle rounded-xl text-text-primary placeholder:text-text-muted text-sm focus-visible:outline-2 focus-visible:outline-brand-primary resize-none"
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
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-primary text-text-primary text-sm font-semibold hover:bg-gradient-to-r hover:from-brand-primary hover:to-brand-primary transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                >
                  {sending ? <Spinner size={16} className="animate-spin" /> : <PaperPlaneTilt size={16} weight="fill" />}
                  Send
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── Upload Assets ── */}
        {section === "upload" && (
          <div key="upload" className="space-y-4 tab-panel-enter">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Submit Assets</h3>
            <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
              <p className="text-sm text-text-secondary mb-4">
                Upload images, videos, or documents for your campaigns. Our team will review and schedule everything.
              </p>
              <form onSubmit={handleUpload} className="space-y-4">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border-subtle hover:border-border-emphasis rounded-xl p-8 text-center cursor-pointer transition-colors bg-bg-surface-raised"
                >
                  <UploadSimple size={32} className="text-text-muted mx-auto mb-3" />
                  <p className="text-sm font-medium text-text-primary">Click to browse or drag files here</p>
                  <p className="text-xs text-text-muted mt-1">Video: MP4, MOV · Images: JPG, PNG, WebP</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="video/mp4,video/quicktime,image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      if (e.target.files) setUploadFiles(Array.from(e.target.files));
                    }}
                    className="hidden"
                  />
                </div>
                {uploadFiles.length > 0 && (
                  <div className="space-y-2">
                    {uploadFiles.map((f, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 p-3 bg-bg-surface-raised border border-border-subtle rounded-xl">
                        <div className="flex items-center gap-3 min-w-0">
                          {f.type.startsWith("video/") ? (
                            <VideoCamera size={18} className="text-brand-accent flex-shrink-0" weight="fill" />
                          ) : (
                            <Image size={18} className="text-brand-primary flex-shrink-0" weight="fill" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm text-text-primary truncate">{f.name}</p>
                            <p className="text-xs text-text-muted">{(f.size / 1024 / 1024).toFixed(1)} MB</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setUploadFiles((prev) => prev.filter((_, j) => j !== i))}
                          className="p-1.5 text-text-muted hover:text-error rounded-lg hover:bg-error/10 transition-colors"
                        >
                          <X size={16} weight="bold" />
                        </button>
                      </div>
                    ))}
                    <p className="text-xs text-text-muted">{uploadFiles.length} file{uploadFiles.length !== 1 ? "s" : ""} selected</p>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={uploading || uploadFiles.length === 0}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-brand-primary text-text-primary text-sm font-semibold hover:bg-gradient-to-r hover:from-brand-primary hover:to-brand-primary transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <><Spinner size={16} className="animate-spin" /> Uploading...</>
                  ) : (
                    <><UploadSimple size={16} weight="bold" /> Upload Files</>
                  )}
                </button>
                {uploadMsg && (
                  <p className={`text-xs text-center ${uploadMsgType === "error" ? "text-error" : "text-brand-accent"}`}>
                    {uploadMsg}
                  </p>
                )}
              </form>
            </div>
          </div>
        )}

      </div>

      {/* Footer */}
      <footer className="border-t border-border-subtle py-5 mt-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs text-text-muted">
            &copy; {new Date().getFullYear()} MetroReach Media. Premium Social Media Marketing.
          </p>
        </div>
      </footer>
    </main>
  );
}
