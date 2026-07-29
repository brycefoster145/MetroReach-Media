/**
 * /portal/review — Client Content Review Portal
 *
 * Shows all posts in 'pending_review' status for the authenticated client.
 * Client can approve or reject each post individually.
 * Rejected posts are automatically regenerated with a different angle.
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle,
  XCircle,
  Clock,
  Spinner,
  ArrowLeft,
  WarningCircle,
  FacebookLogo,
  InstagramLogo,
  CalendarBlank,
  Image,
  ChatText,
  Hash,
} from "@phosphor-icons/react";

// ── Types ──

interface ReviewPost {
  id: string;
  platform: string;
  content: string;
  media_urls: string[];
  hashtags: string;
  due_at: string;
  status: string;
  rejection_count: number;
  created_at: string;
}

// ── Helpers ──

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "America/New_York",
    });
  } catch {
    return iso;
  }
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/New_York",
    });
  } catch {
    return iso;
  }
}

function platformLabel(p: string): string {
  return p.charAt(0).toUpperCase() + p.slice(1);
}

function platformIcon(p: string) {
  switch (p.toLowerCase()) {
    case "facebook":
      return FacebookLogo;
    case "instagram":
      return InstagramLogo;
    default:
      return CalendarBlank;
  }
}

function platformColor(p: string): string {
  switch (p.toLowerCase()) {
    case "facebook":
      return "#1877F2";
    case "instagram":
      return "#E4405F";
    default:
      return "#6B7280";
  }
}

// ── Route ──

export const Route = createFileRoute("/portal/review")({
  head: () => ({
    meta: [
      { title: "Content Review — MetroReach Media Portal" },
      {
        name: "description",
        content:
          "Review and approve your social media content before it goes live.",
      },
    ],
  }),
  component: ReviewPortal,
});

function ReviewPortal() {
  const [posts, setPosts] = useState<ReviewPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // ── Fetch posts ──

  const fetchPosts = useCallback(async () => {
    try {
      const res = await fetch("/api/portal/review");
      if (res.status === 401) {
        window.location.href = "/portal";
        return;
      }
      if (!res.ok) throw new Error("Failed to load posts");
      const json = await res.json();
      setPosts(json);
    } catch (err: any) {
      setError(err.message || "Failed to load review posts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // ── Actions ──

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleApprove(postId: string) {
    setActionLoading(postId);
    try {
      const res = await fetch("/api/portal/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-protection": "1",
        },
        body: JSON.stringify({ action: "approve", post_id: postId }),
      });
      if (res.status === 401) {
        window.location.href = "/portal";
        return;
      }
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Approval failed");
      }
      // Remove approved post from list
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      showToast("Post approved! It will be published on schedule.", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to approve post", "error");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(postId: string) {
    if (!confirm("Reject this post? A replacement will be generated automatically.")) {
      return;
    }
    setActionLoading(postId);
    try {
      const res = await fetch("/api/portal/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-protection": "1",
        },
        body: JSON.stringify({ action: "reject", post_id: postId }),
      });
      if (res.status === 401) {
        window.location.href = "/portal";
        return;
      }
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Rejection failed");
      }
      const result = await res.json();
      // Remove rejected post, then refetch to get the replacement
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      showToast("Replacement post generated. Refresh to see it.", "success");
      // Refetch after a short delay to let DB settle
      setTimeout(() => fetchPosts(), 1500);
    } catch (err: any) {
      showToast(err.message || "Failed to reject post", "error");
    } finally {
      setActionLoading(null);
    }
  }

  // ── Render ──

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-root flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Spinner size={32} className="text-brand-primary animate-spin" />
          <p className="text-text-secondary text-sm">Loading your content...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-root">
      {/* Header */}
      <header className="border-b border-border-subtle bg-bg-surface/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a
              href="/portal/dashboard"
              className="p-1.5 -ml-1.5 rounded-lg hover:bg-bg-surface-raised text-text-secondary hover:text-text-primary transition-colors"
              aria-label="Back to dashboard"
            >
              <ArrowLeft size={20} />
            </a>
            <div>
              <h1 className="text-lg font-bold font-heading text-text-primary">
                Content Review
              </h1>
              <p className="text-xs text-text-muted">
                {posts.length} post{posts.length !== 1 ? "s" : ""} awaiting your
                approval
              </p>
            </div>
          </div>
          <a
            href="/portal/dashboard"
            className="text-sm text-brand-primary hover:underline font-medium"
          >
            Back to Dashboard
          </a>
        </div>
      </header>

      {/* Toast */}
      {toast && (
        <div className="fixed top-20 right-4 z-50 animate-in slide-in-from-right">
          <div
            className={`px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 ${
              toast.type === "success"
                ? "bg-success/10 text-success border border-success/20"
                : "bg-error/10 text-error border border-error/20"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle size={18} weight="fill" />
            ) : (
              <WarningCircle size={18} weight="fill" />
            )}
            {toast.message}
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm flex items-center gap-2">
            <WarningCircle size={18} weight="fill" />
            {error}
          </div>
        )}

        {posts.length === 0 && !loading && (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-bg-surface border border-border-subtle mb-4">
              <CheckCircle size={32} className="text-success" weight="fill" />
            </div>
            <h2 className="text-xl font-bold font-heading text-text-primary mb-2">
              All Caught Up!
            </h2>
            <p className="text-text-secondary max-w-md mx-auto">
              No posts are waiting for your review. Your content team will notify
              you when new posts are ready.
            </p>
          </div>
        )}

        {/* Post grid */}
        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2">
          {posts.map((post) => {
            const Icon = platformIcon(post.platform);
            const color = platformColor(post.platform);
            return (
              <div
                key={post.id}
                className="bg-bg-surface border border-border-subtle rounded-2xl overflow-hidden hover:border-border-default transition-colors"
              >
                {/* Image preview */}
                <div className="relative aspect-square bg-bg-surface-raised overflow-hidden">
                  {post.media_urls && post.media_urls.length > 0 ? (
                    <img
                      src={post.media_urls[0]}
                      alt="Post preview"
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Image
                        size={48}
                        className="text-text-muted/30"
                        weight="light"
                      />
                    </div>
                  )}
                  {/* Platform badge */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm text-white text-xs font-semibold">
                    <Icon size={14} weight="fill" color={color} />
                    {platformLabel(post.platform)}
                  </div>
                  {/* Rejection count badge */}
                  {post.rejection_count > 0 && (
                    <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-warning/90 text-white text-[10px] font-bold">
                      V{post.rejection_count + 1}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4 space-y-3">
                  {/* Schedule info */}
                  <div className="flex items-center gap-3 text-xs text-text-muted">
                    <div className="flex items-center gap-1">
                      <CalendarBlank size={12} />
                      <span>{formatDate(post.due_at)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock size={12} />
                      <span>{formatTime(post.due_at)} EST</span>
                    </div>
                  </div>

                  {/* Copy */}
                  <p className="text-sm text-text-primary leading-relaxed line-clamp-4">
                    {post.content}
                  </p>

                  {/* Hashtags */}
                  {post.hashtags && (
                    <div className="flex items-start gap-1.5">
                      <Hash
                        size={14}
                        className="text-text-muted mt-0.5 shrink-0"
                      />
                      <p className="text-xs text-text-muted leading-relaxed line-clamp-2">
                        {post.hashtags}
                      </p>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => handleApprove(post.id)}
                      disabled={actionLoading === post.id}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-success/10 text-success border border-success/20 hover:bg-success/20 transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {actionLoading === post.id ? (
                        <Spinner size={16} className="animate-spin" />
                      ) : (
                        <CheckCircle size={18} weight="fill" />
                      )}
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(post.id)}
                      disabled={actionLoading === post.id}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-error/10 text-error border border-error/20 hover:bg-error/20 transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {actionLoading === post.id ? (
                        <Spinner size={16} className="animate-spin" />
                      ) : (
                        <XCircle size={18} weight="fill" />
                      )}
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border-subtle py-6 mt-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs text-text-muted">
            MetroReach Media — Premium Social Media Marketing
          </p>
        </div>
      </footer>
    </div>
  );
}
