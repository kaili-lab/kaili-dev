import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import {
  AiConfigError,
  decryptSecret,
  encryptSecret,
  maskSecret,
} from '../src/features/ai-secrets.ts'

const masterKey = Buffer.from('a'.repeat(32)).toString('base64')
const otherMasterKey = Buffer.from('b'.repeat(32)).toString('base64')

describe('T8.2 AI secret encryption', () => {
  it('round-trips a secret with AES-GCM', async () => {
    const encrypted = await encryptSecret('sk-test-0000', masterKey)

    expect(encrypted.iv).not.toContain('sk-test-0000')
    expect(encrypted.ciphertext).not.toContain('sk-test-0000')
    await expect(decryptSecret(encrypted, masterKey)).resolves.toBe(
      'sk-test-0000',
    )
  })

  it('uses a fresh 12-byte IV for every encryption', async () => {
    const first = await encryptSecret('sk-test-0000', masterKey)
    const second = await encryptSecret('sk-test-0000', masterKey)

    expect(first.iv).not.toBe(second.iv)
    expect(Buffer.from(first.iv, 'base64')).toHaveLength(12)
    expect(Buffer.from(second.iv, 'base64')).toHaveLength(12)
  })

  it('does not decrypt with another valid master key', async () => {
    const encrypted = await encryptSecret('sk-test-0000', masterKey)

    await expect(decryptSecret(encrypted, otherMasterKey)).rejects.toThrow()
  })

  it.each(['', Buffer.from('too short').toString('base64'), 'not base64!'])(
    'rejects a missing or invalid master key: %j',
    async (invalidKey) => {
      const encrypted = await encryptSecret('sk-test-0000', masterKey)
      await expect(
        encryptSecret('sk-test-0000', invalidKey),
      ).rejects.toBeInstanceOf(AiConfigError)
      await expect(decryptSecret(encrypted, invalidKey)).rejects.toBeInstanceOf(
        AiConfigError,
      )
    },
  )

  it.each([
    ['', '••••'],
    ['12345678', '••••'],
    ['123456789', '123…6789'],
    ['sk-test-0000', 'sk-…0000'],
  ])('masks %j as %j', (plain, expected) => {
    expect(maskSecret(plain)).toBe(expected)
  })
})
