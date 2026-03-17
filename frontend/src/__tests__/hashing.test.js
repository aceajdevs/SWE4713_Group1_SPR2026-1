import { describe, it, expect } from 'vitest';
import { hashPassword } from '../utils/passwordHash';
import { hashSecurityAnswer } from '../utils/securityAnswerHash';

describe('hashPassword', () => {
  // ──────────────────────────────────────────────
  // POSITIVE TESTS
  // ──────────────────────────────────────────────
  it('returns a hex string for a normal password', async () => {
    const hash = await hashPassword('MyPassword1!');
    expect(typeof hash).toBe('string');
    expect(hash).toMatch(/^[0-9a-f]{64}$/); // SHA-256 = 64 hex chars
  });

  it('produces deterministic output (same input → same hash)', async () => {
    const hash1 = await hashPassword('TestPass1!');
    const hash2 = await hashPassword('TestPass1!');
    expect(hash1).toBe(hash2);
  });

  it('produces different hashes for different passwords', async () => {
    const hash1 = await hashPassword('Password1!');
    const hash2 = await hashPassword('Password2!');
    expect(hash1).not.toBe(hash2);
  });

  it('trims whitespace before hashing', async () => {
    const hash1 = await hashPassword('  hello  ');
    const hash2 = await hashPassword('hello');
    expect(hash1).toBe(hash2);
  });

  it('is case sensitive', async () => {
    const hash1 = await hashPassword('password');
    const hash2 = await hashPassword('Password');
    expect(hash1).not.toBe(hash2);
  });

  // ──────────────────────────────────────────────
  // EDGE CASES / NEGATIVE TESTS
  // ──────────────────────────────────────────────
  it('handles empty string', async () => {
    const hash = await hashPassword('');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('handles null input (coerces to empty string)', async () => {
    const hash = await hashPassword(null);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('handles undefined input (coerces to empty string)', async () => {
    const hash = await hashPassword(undefined);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('null and undefined produce the same hash (both trimmed to empty)', async () => {
    const hashNull = await hashPassword(null);
    const hashUndefined = await hashPassword(undefined);
    expect(hashNull).toBe(hashUndefined);
  });

  it('handles unicode characters', async () => {
    const hash = await hashPassword('Pässwörd1!');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('handles emoji in password', async () => {
    const hash = await hashPassword('Pass🔒1!');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('handles very long password', async () => {
    const longPw = 'A'.repeat(10000);
    const hash = await hashPassword(longPw);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('whitespace-only string hashes same as empty after trim', async () => {
    const hash1 = await hashPassword('   ');
    const hash2 = await hashPassword('');
    expect(hash1).toBe(hash2);
  });
});

describe('hashSecurityAnswer', () => {
  // ──────────────────────────────────────────────
  // POSITIVE TESTS
  // ──────────────────────────────────────────────
  it('returns a 64-char hex string', async () => {
    const hash = await hashSecurityAnswer('My first pet');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic', async () => {
    const hash1 = await hashSecurityAnswer('Fluffy');
    const hash2 = await hashSecurityAnswer('Fluffy');
    expect(hash1).toBe(hash2);
  });

  it('is case sensitive', async () => {
    const hash1 = await hashSecurityAnswer('fluffy');
    const hash2 = await hashSecurityAnswer('Fluffy');
    expect(hash1).not.toBe(hash2);
  });

  it('trims whitespace', async () => {
    const hash1 = await hashSecurityAnswer('  Fluffy  ');
    const hash2 = await hashSecurityAnswer('Fluffy');
    expect(hash1).toBe(hash2);
  });

  // ──────────────────────────────────────────────
  // EDGE CASES
  // ──────────────────────────────────────────────
  it('handles null input gracefully', async () => {
    const hash = await hashSecurityAnswer(null);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('handles undefined input gracefully', async () => {
    const hash = await hashSecurityAnswer(undefined);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('handles empty string', async () => {
    const hash = await hashSecurityAnswer('');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('different answers produce different hashes', async () => {
    const hash1 = await hashSecurityAnswer('Fluffy');
    const hash2 = await hashSecurityAnswer('Buddy');
    expect(hash1).not.toBe(hash2);
  });

  it('same function logic as hashPassword (same input → same output)', async () => {
    // Both functions do SHA-256 on trimmed input, so they should match
    const pwHash = await hashPassword('test');
    const secHash = await hashSecurityAnswer('test');
    expect(pwHash).toBe(secHash);
  });
});
