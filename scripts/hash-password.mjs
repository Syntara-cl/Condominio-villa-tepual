// Genera el hash de una contraseña para insertarlo en la tabla `usuarios`.
//   node scripts/hash-password.mjs "la-clave"
import { randomBytes, scryptSync } from "crypto"

const plain = process.argv[2]
if (!plain) {
  console.error('Uso: node scripts/hash-password.mjs "la-clave"')
  process.exit(1)
}

const salt = randomBytes(16)
const derived = scryptSync(plain, salt, 64)
console.log(`scrypt$${salt.toString("hex")}$${derived.toString("hex")}`)
