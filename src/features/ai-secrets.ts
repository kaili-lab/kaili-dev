const encoder = new TextEncoder()
const decoder = new TextDecoder()

export type EncryptedSecret = {
  iv: string
  ciphertext: string
}

export class AiConfigError extends Error {
  constructor() {
    super('AI_MASTER_KEY must decode to exactly 32 bytes')
    this.name = 'AiConfigError'
  }
}

function decodeBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index)
  return bytes
}

function encodeBase64(bytes: Uint8Array<ArrayBuffer>): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function masterKey(masterKeyB64: string): Uint8Array<ArrayBuffer> {
  let bytes: Uint8Array<ArrayBuffer>
  try {
    bytes = decodeBase64(masterKeyB64)
  } catch {
    throw new AiConfigError()
  }
  if (bytes.byteLength !== 32) throw new AiConfigError()
  return bytes
}

async function importMasterKey(
  masterKeyB64: string,
  usage: KeyUsage,
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    masterKey(masterKeyB64),
    { name: 'AES-GCM' },
    false,
    [usage],
  )
}

export async function encryptSecret(
  plain: string,
  masterKeyB64: string,
): Promise<EncryptedSecret> {
  const key = await importMasterKey(masterKeyB64, 'encrypt')
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plain),
  )
  return {
    iv: encodeBase64(iv),
    ciphertext: encodeBase64(new Uint8Array(ciphertext)),
  }
}

export async function decryptSecret(
  record: EncryptedSecret,
  masterKeyB64: string,
): Promise<string> {
  const key = await importMasterKey(masterKeyB64, 'decrypt')
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: decodeBase64(record.iv) },
    key,
    decodeBase64(record.ciphertext),
  )
  return decoder.decode(plain)
}

export function maskSecret(plain: string): string {
  if (plain.length <= 8) return '••••'
  return `${plain.slice(0, 3)}…${plain.slice(-4)}`
}
