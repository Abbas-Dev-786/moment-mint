import { creatorSettingsSchema, type CreatorSettings } from "../../shared/contracts/domain.js"
import { newId, nowIso, parseJson } from "../lib/ids.js"

export type CreatorRow = {
  id: string
  twitch_user_id: string
  twitch_login: string
  display_name: string
  access_token_ciphertext: string | null
  access_token_iv: string | null
  refresh_token_ciphertext: string | null
  refresh_token_iv: string | null
  token_expires_at: string | null
  scopes_json: string
  settings_json: string
  connection_status: "CONNECTED" | "RECONNECT_REQUIRED" | "DISCONNECTED"
}

export const defaultSettings: CreatorSettings = {
  nominationCommand: "!moment",
  groupWindowSeconds: 30,
  uniqueViewerThreshold: 2,
  autoClipEnabled: false,
}

export const creatorSettings = (row: Pick<CreatorRow, "settings_json">) =>
  creatorSettingsSchema.parse({ ...defaultSettings, ...parseJson<Partial<CreatorSettings>>(row.settings_json, {}) })

export const findCreatorById = (db: D1Database, creatorId: string) =>
  db.prepare("SELECT * FROM creators WHERE id = ?1").bind(creatorId).first<CreatorRow>()

export const findCreatorByTwitchId = (db: D1Database, twitchUserId: string) =>
  db.prepare("SELECT * FROM creators WHERE twitch_user_id = ?1").bind(twitchUserId).first<CreatorRow>()

export const upsertCreator = async (db: D1Database, input: {
  twitchUserId: string
  login: string
  displayName: string
  accessTokenCiphertext: string
  accessTokenIv: string
  refreshTokenCiphertext: string
  refreshTokenIv: string
  tokenExpiresAt: string
  scopes: string[]
}) => {
  const existing = await findCreatorByTwitchId(db, input.twitchUserId)
  const id = existing?.id ?? newId("creator")
  const timestamp = nowIso()
  await db.prepare(`INSERT INTO creators (id, twitch_user_id, twitch_login, display_name, access_token_ciphertext, access_token_iv, refresh_token_ciphertext, refresh_token_iv, token_expires_at, scopes_json, settings_json, connection_status, created_at, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 'CONNECTED', ?12, ?12)
    ON CONFLICT(twitch_user_id) DO UPDATE SET twitch_login=excluded.twitch_login, display_name=excluded.display_name, access_token_ciphertext=excluded.access_token_ciphertext, access_token_iv=excluded.access_token_iv, refresh_token_ciphertext=excluded.refresh_token_ciphertext, refresh_token_iv=excluded.refresh_token_iv, token_expires_at=excluded.token_expires_at, scopes_json=excluded.scopes_json, connection_status='CONNECTED', updated_at=excluded.updated_at`)
    .bind(id, input.twitchUserId, input.login, input.displayName, input.accessTokenCiphertext, input.accessTokenIv, input.refreshTokenCiphertext, input.refreshTokenIv, input.tokenExpiresAt, JSON.stringify(input.scopes), JSON.stringify(existing ? creatorSettings(existing) : defaultSettings), timestamp).run()
  return findCreatorByTwitchId(db, input.twitchUserId)
}

export const updateCreatorStatus = (db: D1Database, creatorId: string, status: CreatorRow["connection_status"]) =>
  db.prepare("UPDATE creators SET connection_status = ?1, updated_at = ?2 WHERE id = ?3").bind(status, nowIso(), creatorId).run()
