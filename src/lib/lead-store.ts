/**
 * Lead Store — In-memory primary storage with file-based fallback.
 * MetroReach Digital
 *
 * On Vercel's serverless environment (read-only filesystem), leads are stored
 * in an in-memory Map. On local/dev systems, leads are also persisted to disk
 * at /home/team/shared/data/audit-leads/<id>.json.
 *
 * The in-memory store is sufficient for the full audit flow:
 *   submit → analyze → report
 * all within a single serverless function invocation.
 */

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LeadFormData {
  businessName: string;
  websiteUrl: string;
  industry: string;
  location: string;
  primaryGoal: string;
  facebookUrl: string;
  instagramUrl: string;
  linkedinUrl: string;
  tiktokUrl: string;
  googleBusinessUrl: string;
  contactName: string;
  email: string;
  phone: string;
}

export type AnalysisStatus = "submitted" | "analyzing" | "complete" | "failed";
export type RecommendationConfidence = "high" | "moderate" | "limited";
export type CheckoutStatus = "none" | "pending" | "completed" | "failed";
export type PurchaseStatus = "none" | "paid" | "refunded" | "disputed";
export type OnboardingStatus = "none" | "started" | "in_progress" | "complete";

export interface LeadRecord {
  id: string;
  contactInfo: {
    name: string;
    email: string;
    phone: string;
  };
  businessInfo: LeadFormData;
  analysisStatus: AnalysisStatus;
  reportUrl: string;
  scores: {
    overall: number;
    categories: { name: string; label: string; score: number; observation: string }[];
  };
  findingsSummary: string;
  recommendedPackage: string;
  recommendationConfidence: RecommendationConfidence;
  checkoutStatus: CheckoutStatus;
  purchaseStatus: PurchaseStatus;
  onboardingStatus: OnboardingStatus;
  failureReason: string;
  emailSent: boolean;
  pdfGenerated: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Storage backends
// ---------------------------------------------------------------------------

const LEADS_DIR = "/home/team/shared/data/audit-leads";

/** In-memory store — always available, used as primary storage on Vercel. */
const memoryStore = new Map<string, LeadRecord>();

/**
 * Whether we've confirmed the filesystem is writable.
 * null = unchecked, true = writable, false = read-only (use memory only).
 */
let fsWritable: boolean | null = null;

function leadPath(id: string): string {
  return join(LEADS_DIR, `${id}.json`);
}

/**
 * Probe whether the leads directory is writable. Runs once per cold start.
 */
async function checkWritable(): Promise<boolean> {
  if (fsWritable !== null) return fsWritable;

  const testPath = join(LEADS_DIR, ".write-test");
  try {
    await mkdir(LEADS_DIR, { recursive: true });
    await writeFile(testPath, "ok", "utf-8");
    // Clean up the test file
    try {
      const { unlink } = await import("node:fs/promises");
      await unlink(testPath);
    } catch {
      // Best effort — non-critical
    }
    fsWritable = true;
  } catch {
    fsWritable = false;
  }

  return fsWritable;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function generateLeadId(): string {
  return `lead-${randomBytes(8).toString("hex")}`;
}

function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9\-]/g, "");
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function createLead(formData: LeadFormData): Promise<LeadRecord> {
  const id = generateLeadId();
  const now = new Date().toISOString();

  const lead: LeadRecord = {
    id,
    contactInfo: {
      name: formData.contactName,
      email: formData.email,
      phone: formData.phone || "",
    },
    businessInfo: formData,
    analysisStatus: "submitted",
    reportUrl: `/free-audit/report?id=${id}`,
    scores: { overall: 0, categories: [] },
    findingsSummary: "",
    recommendedPackage: "",
    recommendationConfidence: "limited",
    checkoutStatus: "none",
    purchaseStatus: "none",
    onboardingStatus: "none",
    failureReason: "",
    emailSent: false,
    pdfGenerated: false,
    createdAt: now,
    updatedAt: now,
  };

  // Always store in memory
  memoryStore.set(id, lead);

  // Try disk if writable
  const writable = await checkWritable();
  if (writable) {
    try {
      await mkdir(LEADS_DIR, { recursive: true });
      await writeFile(leadPath(id), JSON.stringify(lead, null, 2), "utf-8");
    } catch {
      // Disk write failed — lead is safe in memory
    }
  }

  return lead;
}

export async function getLead(id: string): Promise<LeadRecord | null> {
  const safeId = sanitizeId(id);

  // Check memory first
  const memLead = memoryStore.get(safeId);
  if (memLead) return memLead;

  // Fall back to disk
  const writable = await checkWritable();
  if (writable) {
    try {
      const raw = await readFile(leadPath(safeId), "utf-8");
      const lead = JSON.parse(raw) as LeadRecord;
      // Populate memory cache
      memoryStore.set(safeId, lead);
      return lead;
    } catch {
      return null;
    }
  }

  return null;
}

export async function updateLead(
  id: string,
  updates: Partial<LeadRecord>
): Promise<LeadRecord | null> {
  const safeId = sanitizeId(id);

  // Get existing lead (checks memory first, then disk)
  const lead = await getLead(safeId);
  if (!lead) return null;

  const updated: LeadRecord = {
    ...lead,
    ...updates,
    id: lead.id, // never overwrite ID
    createdAt: lead.createdAt, // never overwrite created
    updatedAt: new Date().toISOString(),
  };

  // Always update memory
  memoryStore.set(safeId, updated);

  // Try disk if writable
  const writable = await checkWritable();
  if (writable) {
    try {
      await mkdir(LEADS_DIR, { recursive: true });
      await writeFile(leadPath(safeId), JSON.stringify(updated, null, 2), "utf-8");
    } catch {
      // Disk write failed — lead is safe in memory
    }
  }

  return updated;
}

export async function findLeadByEmail(email: string): Promise<LeadRecord | null> {
  const normalized = email.toLowerCase();

  // Check memory first
  for (const [, lead] of memoryStore) {
    if (lead.contactInfo.email.toLowerCase() === normalized) {
      return lead;
    }
  }

  // Fall back to disk
  const writable = await checkWritable();
  if (writable) {
    try {
      await mkdir(LEADS_DIR, { recursive: true });
      const files = await readdir(LEADS_DIR);
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        const raw = await readFile(join(LEADS_DIR, file), "utf-8");
        const lead = JSON.parse(raw) as LeadRecord;
        if (lead.contactInfo.email.toLowerCase() === normalized) {
          // Populate memory
          memoryStore.set(lead.id, lead);
          return lead;
        }
      }
    } catch {
      // Directory doesn't exist or is empty — not an error
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

export async function markAnalyzing(id: string): Promise<void> {
  await updateLead(id, { analysisStatus: "analyzing" });
}

export async function markComplete(
  id: string,
  scores: LeadRecord["scores"],
  findingsSummary: string,
  recommendedPackage: string,
  recommendationConfidence: RecommendationConfidence
): Promise<void> {
  await updateLead(id, {
    analysisStatus: "complete",
    scores,
    findingsSummary,
    recommendedPackage,
    recommendationConfidence,
  });
}

export async function markFailed(id: string, reason: string): Promise<void> {
  await updateLead(id, {
    analysisStatus: "failed",
    failureReason: reason,
  });
}

export async function markCheckout(id: string, status: CheckoutStatus): Promise<void> {
  await updateLead(id, { checkoutStatus: status });
}

export async function markPurchased(id: string): Promise<void> {
  await updateLead(id, {
    checkoutStatus: "completed",
    purchaseStatus: "paid",
    onboardingStatus: "started",
  });
}

export async function markEmailSent(id: string): Promise<void> {
  await updateLead(id, { emailSent: true });
}

export async function markPdfGenerated(id: string): Promise<void> {
  await updateLead(id, { pdfGenerated: true });
}
