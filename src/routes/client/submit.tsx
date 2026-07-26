/**
 * /client/submit — Client Content Submission
 *
 * Clients upload videos, images, and assets for their social media.
 * Premium-branded form matching MetroReach Digital's agency aesthetic.
 *
 * MetroReach Digital — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useCallback } from "react";
import {
  UploadSimple,
  FileVideo,
  FileImage,
  CheckCircle,
  WarningCircle,
  X,
  PaperPlaneTilt,
  CalendarBlank,
  NotePencil,
  User,
  GlobeHemisphereWest,
  Images,
} from "@phosphor-icons/react";

const ASSET_TYPES = [
  { value: "video", label: "Video", icon: FileVideo },
  { value: "image", label: "Image", icon: FileImage },
  { value: "carousel", label: "Carousel", icon: Images },
  { value: "other", label: "Other", icon: UploadSimple },
] as const;

const PLATFORMS = [
  "Facebook",
  "Instagram",
  "TikTok",
  "Google",
  "YouTube",
  "LinkedIn",
  "X",
] as const;

const VIDEO_MAX_MB = 100;
const IMAGE_MAX_MB = 20;
const VIDEO_MAX = VIDEO_MAX_MB * 1024 * 1024;
const IMAGE_MAX = IMAGE_MAX_MB * 1024 * 1024;
const ALLOWED_VIDEO = ["video/mp4", "video/quicktime"];
const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp"];

interface UploadedFile {
  file: File;
  previewId: string;
}

export const Route = createFileRoute("/client/submit")({
  head: () => ({
    meta: [
      { title: "Submit Content — MetroReach Digital" },
      {
        name: "description",
        content:
          "Submit videos, images, and assets for your social media. Secure upload portal for MetroReach Digital clients.",
      },
      {
        property: "og:url",
        content: "https://www.metroreachagency.com/client/submit",
      },
    ],
    links: [
      {
        rel: "canonical",
        href: "https://www.metroreachagency.com/client/submit",
      },
    ],
  }),
  component: ClientSubmit,
});

function ClientSubmit() {
  const [clientName, setClientName] = useState("");
  const [assetType, setAssetType] = useState<string>("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [preferredDate, setPreferredDate] = useState("");
  const [caption, setCaption] = useState("");
  const [instructions, setInstructions] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [status, setStatus] = useState<
    "idle" | "uploading" | "success" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [referenceId, setReferenceId] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const togglePlatform = (p: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const validateAndAddFiles = useCallback(
    (newFiles: FileList | File[]) => {
      const incoming = Array.from(newFiles);
      const valid: UploadedFile[] = [];
      const errors: string[] = [];

      for (const f of incoming) {
        const isVideo = ALLOWED_VIDEO.includes(f.type);
        const isImage = ALLOWED_IMAGE.includes(f.type);

        if (!isVideo && !isImage) {
          errors.push(
            `${f.name}: Unsupported file type. Use MP4, MOV, JPG, PNG, or WebP.`
          );
          continue;
        }

        const maxSize = isVideo ? VIDEO_MAX : IMAGE_MAX;
        const maxLabel = isVideo ? `${VIDEO_MAX_MB}MB` : `${IMAGE_MAX_MB}MB`;

        if (f.size > maxSize) {
          errors.push(
            `${f.name}: Exceeds ${maxLabel} limit (${(f.size / 1024 / 1024).toFixed(1)}MB).`
          );
          continue;
        }

        valid.push({
          file: f,
          previewId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        });
      }

      if (errors.length > 0) {
        setErrorMsg(errors.join("\n"));
        setStatus("error");
        setTimeout(() => {
          setStatus("idle");
          setErrorMsg("");
        }, 4000);
      }

      if (valid.length > 0) {
        setFiles((prev) => [...prev, ...valid]);
      }
    },
    []
  );

  const removeFile = (previewId: string) => {
    setFiles((prev) => prev.filter((f) => f.previewId !== previewId));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      validateAndAddFiles(e.dataTransfer.files);
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!clientName.trim()) {
      setErrorMsg("Please enter your name or account ID.");
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
      return;
    }
    if (!assetType) {
      setErrorMsg("Please select an asset type.");
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
      return;
    }
    if (selectedPlatforms.length === 0) {
      setErrorMsg("Please select at least one target platform.");
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
      return;
    }
    if (files.length === 0) {
      setErrorMsg("Please upload at least one file.");
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
      return;
    }

    setStatus("uploading");
    setErrorMsg("");

    try {
      const formData = new FormData();
      formData.append("clientName", clientName.trim());
      formData.append("assetType", assetType);
      formData.append("platforms", selectedPlatforms.join(","));
      formData.append("preferredDate", preferredDate);
      formData.append("caption", caption);
      formData.append("instructions", instructions);

      for (const f of files) {
        formData.append("files", f.file);
      }

      const res = await fetch("/api/client/submit", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        setReferenceId(data.referenceId);
        setStatus("success");
      } else {
        setErrorMsg(data.error || "Upload failed. Please try again.");
        setStatus("error");
      }
    } catch {
      setErrorMsg("Network error. Please check your connection and try again.");
      setStatus("error");
    }
  }

  // ── Success State ──
  if (status === "success") {
    return (
      <main className="min-h-dvh bg-bg-root flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          <div className="bg-bg-surface border border-border-subtle rounded-2xl p-10 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-accent/10 mb-6">
              <CheckCircle size={32} className="text-brand-accent" weight="fill" />
            </div>
            <h1 className="text-2xl font-bold font-heading text-text-primary mb-3">
              Content Received
            </h1>
            <p className="text-text-secondary leading-relaxed mb-6">
              Your content has been received. Our team will review and schedule
              it.
            </p>

            {/* Reference ID */}
            <div className="inline-flex items-center gap-2 bg-bg-surface-raised border border-border-subtle rounded-xl px-5 py-3 mb-8">
              <span className="text-xs text-text-muted uppercase tracking-wider">
                Reference
              </span>
              <span className="text-sm font-mono font-semibold text-brand-primary">
                {referenceId}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              <a
                href="/client/submit"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-brand-primary text-text-primary text-sm font-semibold hover:bg-gradient-to-r hover:from-brand-primary hover:to-brand-accent transition-all duration-200"
              >
                Submit More Content
              </a>
              <a
                href="/client"
                className="text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                Back to Client Portal
              </a>
            </div>
          </div>

          <p className="text-xs text-text-muted text-center mt-8">
            &copy; {new Date().getFullYear()} MetroReach Digital. All rights
            reserved.
          </p>
        </div>
      </main>
    );
  }

  // ── Form ──
  return (
    <main className="min-h-dvh bg-bg-root px-4 py-12">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 mb-5">
            <UploadSimple size={24} className="text-brand-primary" weight="fill" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold font-heading text-text-primary mb-2">
            Submit Your Content
          </h1>
          <p className="text-sm text-text-secondary max-w-md mx-auto">
            Upload videos, images, and assets for your social media. Our team
            will review and schedule everything.
          </p>
        </div>

        {/* Error banner */}
        {status === "error" && errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-error/10 border border-error/20 flex items-start gap-3">
            <WarningCircle
              size={20}
              className="text-error flex-shrink-0 mt-0.5"
              weight="fill"
            />
            <div>
              <p className="text-sm font-semibold text-error">
                Something went wrong
              </p>
              <p className="text-xs text-text-secondary mt-1 whitespace-pre-line">
                {errorMsg}
              </p>
            </div>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="bg-bg-surface border border-border-subtle rounded-2xl p-6 md:p-8 space-y-6"
        >
          {/* Client Name */}
          <div>
            <label
              htmlFor="clientName"
              className="block text-sm font-medium text-text-secondary mb-2"
            >
              Your Name or Account ID
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                <User size={18} className="text-text-muted" />
              </div>
              <input
                id="clientName"
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Mike from Ridgeway Heating"
                required
                className="w-full pl-10 pr-4 py-3 bg-bg-surface-raised border border-border-subtle rounded-xl text-text-primary placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-brand-primary focus-visible:outline-offset-2 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 transition-colors text-sm"
              />
            </div>
          </div>

          {/* Asset Type */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-3">
              Asset Type
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {ASSET_TYPES.map((at) => {
                const isSelected = assetType === at.value;
                const Icon = at.icon;
                return (
                  <button
                    key={at.value}
                    type="button"
                    onClick={() => setAssetType(at.value)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200 text-sm font-medium ${
                      isSelected
                        ? "border-brand-primary bg-brand-primary/10 text-brand-primary shadow-[0_0_12px_rgba(59,130,246,0.15)]"
                        : "border-border-subtle bg-bg-surface-raised text-text-secondary hover:border-border-emphasis hover:text-text-primary"
                    }`}
                  >
                    <Icon size={24} weight={isSelected ? "fill" : "regular"} />
                    {at.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target Platforms */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-3">
              Target Platforms
            </label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => {
                const isSelected = selectedPlatforms.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePlatform(p)}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200 ${
                      isSelected
                        ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                        : "border-border-subtle bg-bg-surface-raised text-text-secondary hover:border-border-emphasis hover:text-text-primary"
                    }`}
                  >
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-primary" />
                    )}
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preferred Posting Date */}
          <div>
            <label
              htmlFor="preferredDate"
              className="block text-sm font-medium text-text-secondary mb-2"
            >
              Preferred Posting Date{" "}
              <span className="text-text-muted font-normal">(optional)</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                <CalendarBlank size={18} className="text-text-muted" />
              </div>
              <input
                id="preferredDate"
                type="date"
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="w-full pl-10 pr-4 py-3 bg-bg-surface-raised border border-border-subtle rounded-xl text-text-primary focus-visible:outline-2 focus-visible:outline-brand-primary focus-visible:outline-offset-2 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 transition-colors text-sm [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Caption / Messaging Notes */}
          <div>
            <label
              htmlFor="caption"
              className="block text-sm font-medium text-text-secondary mb-2"
            >
              Caption or Messaging Notes{" "}
              <span className="text-text-muted font-normal">(optional)</span>
            </label>
            <div className="relative">
              <div className="absolute top-3 left-3.5 pointer-events-none">
                <NotePencil size={18} className="text-text-muted" />
              </div>
              <textarea
                id="caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="What should this post say? Key points, tone, call-to-action..."
                rows={3}
                className="w-full pl-10 pr-4 py-3 bg-bg-surface-raised border border-border-subtle rounded-xl text-text-primary placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-brand-primary focus-visible:outline-offset-2 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 transition-colors text-sm resize-y"
              />
            </div>
          </div>

          {/* Special Instructions */}
          <div>
            <label
              htmlFor="instructions"
              className="block text-sm font-medium text-text-secondary mb-2"
            >
              Special Instructions{" "}
              <span className="text-text-muted font-normal">(optional)</span>
            </label>
            <textarea
              id="instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="First post in a series? Needs music? Link in bio? Any compliance notes..."
              rows={2}
              className="w-full px-4 py-3 bg-bg-surface-raised border border-border-subtle rounded-xl text-text-primary placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-brand-primary focus-visible:outline-offset-2 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 transition-colors text-sm resize-y"
            />
          </div>

          {/* File Upload Drop Zone */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-3">
              Upload Files
            </label>

            {/* Drop zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
                dragOver
                  ? "border-brand-primary bg-brand-primary/5"
                  : "border-border-subtle hover:border-border-emphasis bg-bg-surface-raised"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="video/mp4,video/quicktime,image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  if (e.target.files) validateAndAddFiles(e.target.files);
                  e.target.value = "";
                }}
                className="hidden"
              />

              <div className="flex flex-col items-center gap-3">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-primary/10">
                  <UploadSimple size={24} className="text-brand-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    Drag & drop files here, or click to browse
                  </p>
                  <p className="text-xs text-text-muted mt-1">
                    Video: MP4, MOV (max {VIDEO_MAX_MB}MB) &middot; Images: JPG,
                    PNG, WebP (max {IMAGE_MAX_MB}MB)
                  </p>
                </div>
              </div>
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div className="mt-4 space-y-2">
                {files.map((f) => {
                  const isVideo = ALLOWED_VIDEO.includes(f.file.type);
                  return (
                    <div
                      key={f.previewId}
                      className="flex items-center justify-between gap-3 p-3 bg-bg-surface-raised border border-border-subtle rounded-xl"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex-shrink-0">
                          {isVideo ? (
                            <FileVideo
                              size={20}
                              className="text-brand-accent"
                              weight="fill"
                            />
                          ) : (
                            <FileImage
                              size={20}
                              className="text-brand-primary"
                              weight="fill"
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-text-primary truncate">
                            {f.file.name}
                          </p>
                          <p className="text-xs text-text-muted">
                            {(f.file.size / 1024 / 1024).toFixed(1)} MB
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(f.previewId)}
                        className="flex-shrink-0 p-1.5 text-text-muted hover:text-error rounded-lg hover:bg-error/10 transition-colors"
                        aria-label={`Remove ${f.file.name}`}
                      >
                        <X size={16} weight="bold" />
                      </button>
                    </div>
                  );
                })}
                <p className="text-xs text-text-muted">
                  {files.length} file{files.length !== 1 ? "s" : ""} selected
                </p>
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={status === "uploading"}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-brand-primary text-text-primary text-sm font-semibold hover:bg-gradient-to-r hover:from-brand-primary hover:to-brand-accent hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === "uploading" ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                Submit Content
                <PaperPlaneTilt size={16} weight="bold" />
              </>
            )}
          </button>

          <p className="text-xs text-text-muted text-center">
            Your files are transmitted securely. Our team typically reviews
            submissions within 24 hours.
          </p>
        </form>

        {/* Footer */}
        <div className="text-center mt-8">
          <a
            href="/client"
            className="text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            &larr; Back to Client Portal
          </a>
          <p className="text-xs text-text-muted mt-4">
            &copy; {new Date().getFullYear()} MetroReach Digital. All rights
            reserved.
          </p>
        </div>
      </div>
    </main>
  );
}
