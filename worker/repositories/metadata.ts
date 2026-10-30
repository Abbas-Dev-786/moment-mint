import { newId, nowIso } from "../lib/ids.js"

export const findMetadataForCreator = (db: D1Database, creatorId: string, momentId: string) =>
  db.prepare("SELECT ai_metadata.* FROM ai_metadata JOIN moments ON moments.id = ai_metadata.moment_id WHERE ai_metadata.moment_id = ?1 AND moments.creator_id = ?2").bind(momentId, creatorId).first()

export const upsertMetadataForCreator = (db: D1Database, input: { creatorId: string; momentId: string; modelId: string; status: string; title: string; summary: string; category: string; socialCaption: string; promptVersion: string }) => {
  const timestamp = nowIso()
  return db.prepare(`INSERT INTO ai_metadata (id, moment_id, provider, model_id, status, title, summary, category, social_caption, prompt_version, updated_at)
    SELECT ?1, ?2, 'cloudflare-workers-ai', ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10 WHERE EXISTS (SELECT 1 FROM moments WHERE id = ?2 AND creator_id = ?11)
    ON CONFLICT(moment_id) DO UPDATE SET model_id=excluded.model_id, status=excluded.status, title=excluded.title, summary=excluded.summary, category=excluded.category, social_caption=excluded.social_caption, prompt_version=excluded.prompt_version, updated_at=excluded.updated_at`)
    .bind(newId("metadata"), input.momentId, input.modelId, input.status, input.title, input.summary, input.category, input.socialCaption, input.promptVersion, timestamp, input.creatorId).run()
}
