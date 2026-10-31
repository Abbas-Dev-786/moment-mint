import { readFileSync } from "node:fs"

const configPath = new URL("../wrangler.jsonc", import.meta.url)
const config = readFileSync(configPath, "utf8")
const failures = []

if (config.includes("00000000000000000000000000000000")) {
  failures.push("wrangler.jsonc still contains the placeholder D1 database_id")
}

if (config.includes("replace-with")) {
  failures.push("wrangler.jsonc still contains a replace-with placeholder")
}

if (config.includes("localhost")) {
  failures.push("wrangler.jsonc still points production variables at localhost")
}

if (!/"database_id"\s*:\s*"[0-9a-f]{32}"/i.test(config)) {
  failures.push("wrangler.jsonc must contain a 32-character D1 database_id")
}

for (const required of ["momentmint-jobs", "momentmint-jobs-dlq", '"binding": "AI"', '"*/5 * * * *"']) {
  if (!config.includes(required)) failures.push(`wrangler.jsonc is missing the required production setting: ${required}`)
}

if (failures.length > 0) {
  console.error("Production configuration is not ready:")
  for (const failure of failures) console.error(`- ${failure}`)
  console.error("Update wrangler.jsonc with real production values, then run this check again.")
  process.exit(1)
}

console.log("Production configuration passed local checks.")
