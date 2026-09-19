import "server-only"
import { randomBytes, scryptSync, timingSafeEqual } from "crypto"

const KEY_LEN = 64
const HASH_PREFIX = "scrypt"

export function hashPassword(plain: string): string {
  const salt = randomBytes(16)
  const derived = scryptSync(plain, salt, KEY_LEN)
  return `${HASH_PREFIX}$${salt.toString("hex")}$${derived.toString("hex")}`
}

export function verifyPassword(stored: string | null | undefined, provided: string): boolean {
  if (!stored || !stored.startsWith(`${HASH_PREFIX}$`)) return false
  const [, saltHex, hashHex] = stored.split("$")
  try {
    const saltBuf = Buffer.from(saltHex, "hex")
    const hashBuf = Buffer.from(hashHex, "hex")
    const derivedBuf = scryptSync(provided, saltBuf, hashBuf.length)
    return hashBuf.length === derivedBuf.length && timingSafeEqual(hashBuf, derivedBuf)
  } catch {
    return false
  }
}
