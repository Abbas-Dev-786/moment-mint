const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

const base64ToBytes = (value: string) => {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

const secretBytes = async (secret: string) => {
  try {
    const decoded = base64ToBytes(secret)
    if (decoded.length === 32) return decoded
  } catch {
    // Fall through to a deterministic hash for local developer-friendly secrets.
  }
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)))
}

export const sha256Base64 = async (value: string) =>
  bytesToBase64(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))))

export const randomBase64 = (byteLength = 32) => {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength))
  return bytesToBase64(bytes)
}

export const encryptSecret = async (plaintext: string, secret: string) => {
  const key = await crypto.subtle.importKey("raw", await secretBytes(secret), "AES-GCM", false, ["encrypt"])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext))
  return { ciphertext: bytesToBase64(new Uint8Array(ciphertext)), iv: bytesToBase64(iv) }
}

export const decryptSecret = async (ciphertext: string, iv: string, secret: string) => {
  const key = await crypto.subtle.importKey("raw", await secretBytes(secret), "AES-GCM", false, ["decrypt"])
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(iv) }, key, base64ToBytes(ciphertext))
  return new TextDecoder().decode(plaintext)
}

export const signValue = async (value: string, secret: string) => {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  return bytesToBase64(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))))
}

export const hmacSha256Hex = async (value: string, secret: string) => {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

export const constantTimeEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return difference === 0
}

export { base64ToBytes, bytesToBase64 }
