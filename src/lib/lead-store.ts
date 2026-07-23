/**
 * Lead Store — JSON file-based persistence for audit leads.
 * MetroReach Digital
 *
 * Saves to /home/team/shared/data/audit-leads/<id>.json
 * Each lead persists independently — analysis, PDF, email, or checkout
 * failure never loses the lead.
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
// Paths
// ---------------------------------------------------------------------------

const LEADS_DIR = "/home/team/shared/data/audit-leads";

function leadPath(id: string): string {
  return join(LEADS_DIR, `${id}.json`);
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

  await mkdir(LEADS_DIR, { recursive: true });
  await writeFile(leadPath(id), JSON.stringify(lead, null, 2), "utf-8");
  return lead;
}

export async function getLead(id: string): Promise<LeadRecord | null> {
  const safeId = sanitizeId(id);
  try {
    const raw = await readFile(leadPath(safeId), "utf-8");
    return JSON.parse(raw) as LeadRecord;
  } catch {
    return null;
  }
}

export async function updateLead(
  id: string,
  updates: Partial<LeadRecord>
): Promise<LeadRecord | null> {
  const lead = await getLead(id);
  if (!lead) return null;

  const updated = {
    ...lead,
    ...updates,
    id: lead.id, // never overwrite ID
    createdAt: lead.createdAt, // never overwrite created
    updatedAt: new Date().toISOString(),
  };

  await writeFile(leadPath(id), JSON.stringify(updated, null, 2), "utf-8");
  return updated;
}

export async function findLeadByEmail(email: string): Promise<LeadRecord | null> {
  try {
    await mkdir(LEADS_DIR, { recursive: true });
    const files = await readdir(LEADS_DIR);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const raw = await readFile(join(LEADS_DIR, file), "utf-8");
      const lead = JSON.parse(raw) as LeadRecord;
      if (lead.contactInfo.email.toLowerCase() === email.toLowerCase()) {
        return lead;
      }
    }
  } catch {
    // Directory doesn't exist or is empty
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
