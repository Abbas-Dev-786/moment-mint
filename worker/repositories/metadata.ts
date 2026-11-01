import { newId, nowIso } from "../lib/ids.js"
import type { AiContextMode } from "../../shared/contracts/domain.js"

export type MetadataRow = {
  id: string
  moment_id: string
  provider: string
  model_id: string
  status: "PENDING" | "READY" | "FAILED_WITH_FALLBACK"
  title: string
  summary: string
  category: string
  social_caption: string
  prompt_version: string
  creator_note: string | null
  evidence_summary: string | null
  evidence_message_count: number | null
  evidence_window_start: string | null
  evidence_window_end: string | null
  confidence_note: string | null
  context_mode: AiContextMode
  generated_at: string | null
  updated_at: string
}

export const findMetadataForCreator = (db: D1Database, creatorId: string, momentId: string) =>
  db.prepare("SELECT ai_metadata.* FROM ai_metadata JOIN moments ON moments.id = ai_metadata.moment_id WHERE ai_metadata.moment_id = ?1 AND moments.creator_id = ?2").bind(momentId, creatorId).first<MetadataRow>()

export const upsertMetadataForCreator = (db: D1Database, input: {
  creatorId: string
  momentId: string
  modelId: string
  status: string
  title: string
  summary: string
  category: string
  socialCaption: string
  promptVersion: string
  creatorNote?: string | null
  evidenceSummary?: string | null
  evidenceMessageCount?: number | null
  evidenceWindowStart?: string | null
  evidenceWindowEnd?: string | null
  confidenceNote?: string | null
  contextMode?: AiContextMode
  generatedAt?: string | null
}) => {
  const timestamp = nowIso()
  return db.prepare(`INSERT INTO ai_metadata (id, moment_id, provider, model_id, status, title, summary, category, social_caption, prompt_version, creator_note, evidence_summary, evidence_message_count, evidence_window_start, evidence_window_end, confidence_note, context_mode, generated_at, updated_at)
    SELECT ?1, ?2, 'cloudflare-workers-ai', ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18 WHERE EXISTS (SELECT 1 FROM moments WHERE id = ?2 AND creator_id = ?19)
    ON CONFLICT(moment_id) DO UPDATE SET model_id=excluded.model_id, status=excluded.status, title=excluded.title, summary=excluded.summary, category=excluded.category, social_caption=excluded.social_caption, prompt_version=excluded.prompt_version, creator_note=COALESCE(excluded.creator_note, ai_metadata.creator_note), evidence_summary=COALESCE(excluded.evidence_summary, ai_metadata.evidence_summary), evidence_message_count=COALESCE(excluded.evidence_message_count, ai_metadata.evidence_message_count), evidence_window_start=COALESCE(excluded.evidence_window_start, ai_metadata.evidence_window_start), evidence_window_end=COALESCE(excluded.evidence_window_end, ai_metadata.evidence_window_end), confidence_note=COALESCE(excluded.confidence_note, ai_metadata.confidence_note), context_mode=excluded.context_mode, generated_at=excluded.generated_at, updated_at=excluded.updated_at`)
    .bind(newId("metadata"), input.momentId, input.modelId, input.status, input.title, input.summary, input.category, input.socialCaption, input.promptVersion, input.creatorNote ?? null, input.evidenceSummary ?? null, input.evidenceMessageCount ?? null, input.evidenceWindowStart ?? null, input.evidenceWindowEnd ?? null, input.confidenceNote ?? null, input.contextMode ?? "MINIMAL", input.generatedAt ?? null, timestamp, input.creatorId).run()
}
