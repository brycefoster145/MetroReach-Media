/**
 * Lead Store — PostgreSQL-backed persistent storage.
 * MetroReach Digital
 *
 * All leads and audit results are stored in Neon Postgres.
 * This ensures reports are accessible from any browser, any device,
 * across all Vercel serverless instances.
 */

import { randomBytes } from "node:crypto";
import { sql } from "~/lib/db";

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
  auditResultJson: string | null;
  createdAt: string;
  updatedAt: string;
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

function buildLeadRecord(
  id: string,
  formData: LeadFormData,
  overrides: Partial<LeadRecord> = {}
): LeadRecord {
  const now = new Date().toISOString();
  return {
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
    auditResultJson: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function createLead(formData: LeadFormData): Promise<LeadRecord> {
  const id = generateLeadId();
  const email = formData.email.toLowerCase();
  const lead = buildLeadRecord(id, formData);

  await sql`
    INSERT INTO leads (id, email, form_data)
    VALUES (${id}, ${email}, ${sql.json(lead)})
  `;

  return lead;
}

export async function getLead(id: string): Promise<LeadRecord | null> {
  const safeId = sanitizeId(id);
  const rows = await sql`
    SELECT form_data FROM leads WHERE id = ${safeId}
  `;
  if (rows.length === 0) return null;
  return rows[0].form_data as LeadRecord;
}

export async function updateLead(
  id: string,
  updates: Partial<LeadRecord>
): Promise<LeadRecord | null> {
  const safeId = sanitizeId(id);
  const lead = await getLead(safeId);
  if (!lead) return null;

  const updated: LeadRecord = {
    ...lead,
    ...updates,
    id: lead.id,
    createdAt: lead.createdAt,
    updatedAt: new Date().toISOString(),
  };

  await sql`
    UPDATE leads
    SET form_data = ${sql.json(updated)}
    WHERE id = ${safeId}
  `;

  return updated;
}

export async function findLeadByEmail(email: string): Promise<LeadRecord | null> {
  const normalized = email.toLowerCase();
  const rows = await sql`
    SELECT form_data FROM leads WHERE email = ${normalized}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return rows[0].form_data as LeadRecord;
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

// ---------------------------------------------------------------------------
// Audit results (separate table for efficient retrieval)
// ---------------------------------------------------------------------------

/**
 * Save the full audit result JSON to the audit_results table.
 * This is the primary retrieval path for the report page — it loads
 * from Postgres, so it works from any browser, any device.
 */
export async function saveAuditResult(id: string, resultJson: string): Promise<void> {
  const safeId = sanitizeId(id);
  // Also store in the lead record for backward compatibility
  await updateLead(id, { auditResultJson: resultJson });

  // Upsert into audit_results
  await sql`
    INSERT INTO audit_results (id, lead_id, result_json)
    VALUES (${`audit-${safeId}`}, ${safeId}, ${sql.json(JSON.parse(resultJson))})
    ON CONFLICT (id) DO UPDATE SET result_json = EXCLUDED.result_json
  `;
}

/**
 * Retrieve the full audit result from the audit_results table.
 * Returns the parsed object or null if not found.
 * Falls back to the lead record if no dedicated audit_result row exists.
 */
export async function getAuditResult(id: string): Promise<Record<string, unknown> | null> {
  const safeId = sanitizeId(id);

  // Try audit_results table first
  const rows = await sql`
    SELECT result_json FROM audit_results WHERE lead_id = ${safeId}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  if (rows.length > 0) {
    return rows[0].result_json as Record<string, unknown>;
  }

  // Fall back to lead record
  const lead = await getLead(safeId);
  if (!lead || !lead.auditResultJson) return null;
  try {
    return JSON.parse(lead.auditResultJson) as Record<string, unknown>;
  } catch {
    return null;
  }
}
