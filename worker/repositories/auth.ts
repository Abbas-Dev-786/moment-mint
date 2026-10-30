import { newId, nowIso } from "../lib/ids.js"

export const createOAuthState = async (db: D1Database, stateHash: string, expiresAt: string, sessionId: string) => {
  const id = newId("oauth")
  await db.prepare("INSERT INTO oauth_states (id, state_hash, session_id, expires_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5)").bind(id, stateHash, sessionId, expiresAt, nowIso()).run()
  return id
}

export const consumeOAuthState = async (db: D1Database, stateHash: string) => {
  const now = nowIso()
  const result = await db.prepare("UPDATE oauth_states SET used_at = ?1 WHERE state_hash = ?2 AND used_at IS NULL AND expires_at > ?1 RETURNING id, session_id").bind(now, stateHash).first<{ id: string; session_id: string | null }>()
  return result
}

export const createSession = async (db: D1Database, creatorId: string, expiresAt: string) => {
  const id = newId("session")
  await db.prepare("INSERT INTO sessions (id, creator_id, expires_at, created_at) VALUES (?1, ?2, ?3, ?4)").bind(id, creatorId, expiresAt, nowIso()).run()
  return id
}

export const findSessionCreatorId = (db: D1Database, sessionId: string) =>
  db.prepare("SELECT creator_id FROM sessions WHERE id = ?1 AND expires_at > ?2").bind(sessionId, nowIso()).first<{ creator_id: string }>()

export const deleteSession = (db: D1Database, sessionId: string) => db.prepare("DELETE FROM sessions WHERE id = ?1").bind(sessionId).run()
