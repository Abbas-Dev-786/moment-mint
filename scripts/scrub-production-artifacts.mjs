import { unlink } from "node:fs/promises"

const generatedLocalVars = new URL("../dist/twitch/.dev.vars", import.meta.url)

try {
  await unlink(generatedLocalVars)
  console.log("Removed generated local vars from the production artifact.")
} catch (error) {
  if (error?.code !== "ENOENT") throw error
}
