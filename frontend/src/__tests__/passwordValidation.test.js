import { describe, it, expect } from 'vitest';
import { validatePassword } from '../utils/passwordValidation';

describe('validatePassword', () => {
  // ──────────────────────────────────────────────
  // POSITIVE TESTS — valid passwords that should pass
  // ──────────────────────────────────────────────
  describe('valid passwords (positive tests)', () => {
    it('accepts a standard valid password', () => {
      const result = validatePassword('Abcdef1!');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts a long complex password', () => {
      const result = validatePassword('Securepassword123!@#');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts password starting with lowercase letter', () => {
      const result = validatePassword('abcdefg1!');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts password starting with uppercase letter', () => {
      const result = validatePassword('Abcdefg1!');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts password with every allowed special character type', () => {
      const specials = ['!', '@', '#', '$', '%', '^', '&', '*', '_', '<', ',', '>', '.', '?'];
      specials.forEach((char) => {
        const pw = `Abcdefg1${char}`;
        const result = validatePassword(pw);
        expect(result.isValid).toBe(true);
      });
    });

    it('accepts password at exactly 8 characters (boundary)', () => {
      const result = validatePassword('Abcdef1!');
      expect(result.isValid).toBe(true);
    });

    it('accepts a very long password (100 chars)', () => {
      const pw = 'A' + 'b'.repeat(96) + '1!x';
      const result = validatePassword(pw);
      expect(result.isValid).toBe(true);
    });
  });

  // ──────────────────────────────────────────────
  // NEGATIVE TESTS — invalid passwords
  // ──────────────────────────────────────────────
  describe('invalid passwords (negative tests)', () => {
    it('rejects an empty string', () => {
      const result = validatePassword('');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects a password shorter than 8 characters', () => {
      const result = validatePassword('Ab1!xyz');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('rejects password at 7 characters (boundary -1)', () => {
      const result = validatePassword('Abcde1!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('rejects a single character', () => {
      const result = validatePassword('A');
      expect(result.isValid).toBe(false);
    });

    it('rejects password starting with a number', () => {
      const result = validatePassword('1Abcdef!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must start with a letter');
    });

    it('rejects password starting with a special character', () => {
      const result = validatePassword('!Abcdef1');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must start with a letter');
    });

    it('rejects password with no letters', () => {
      const result = validatePassword('12345678!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one letter');
      expect(result.errors).toContain('Password must start with a letter');
    });

    it('rejects password with no numbers', () => {
      const result = validatePassword('Abcdefgh!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('rejects password with no special characters', () => {
      const result = validatePassword('Abcdefg1');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one special character (!@#$%^&*_<,>.?)'
      );
    });

    it('rejects all-spaces password', () => {
      const result = validatePassword('        ');
      expect(result.isValid).toBe(false);
    });

    it('rejects password with only special chars and numbers (no letters)', () => {
      const result = validatePassword('!@#$1234');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must start with a letter');
      expect(result.errors).toContain('Password must contain at least one letter');
    });
  });

  // ──────────────────────────────────────────────
  // BOUNDARY VALUE ANALYSIS
  // ──────────────────────────────────────────────
  describe('boundary value analysis', () => {
    it('length 0 — empty', () => {
      const result = validatePassword('');
      expect(result.isValid).toBe(false);
    });

    it('length 1 — single letter (too short, missing number + special)', () => {
      const result = validatePassword('A');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('length 7 — one below minimum', () => {
      const result = validatePassword('Abcde1!');
      expect(result.isValid).toBe(false);
    });

    it('length 8 — exactly minimum', () => {
      const result = validatePassword('Abcdef1!');
      expect(result.isValid).toBe(true);
    });

    it('length 9 — one above minimum', () => {
      const result = validatePassword('Abcdefg1!');
      expect(result.isValid).toBe(true);
    });
  });

  // ──────────────────────────────────────────────
  // EQUIVALENCE PARTITIONING — multiple error combos
  // ──────────────────────────────────────────────
  describe('equivalence partitioning — combined failures', () => {
    it('reports multiple errors when password fails everything', () => {
      const result = validatePassword('');
      // Empty string should fail: length, no letter, no number, no special char
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });

    it('missing number AND special char', () => {
      const result = validatePassword('Abcdefgh');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
      expect(result.errors).toContain(
        'Password must contain at least one special character (!@#$%^&*_<,>.?)'
      );
    });

    it('starts with number AND missing special char', () => {
      const result = validatePassword('1abcdefg');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must start with a letter');
      expect(result.errors).toContain(
        'Password must contain at least one special character (!@#$%^&*_<,>.?)'
      );
    });

    it('too short AND missing number', () => {
      const result = validatePassword('Abcde!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
      expect(result.errors).toContain('Password must contain at least one number');
    });
  });

  // ──────────────────────────────────────────────
  // RETURN VALUE STRUCTURE
  // ──────────────────────────────────────────────
  describe('return value structure', () => {
    it('returns an object with isValid and errors properties', () => {
      const result = validatePassword('anything');
      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('errors');
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('errors is empty array when password is valid', () => {
      const result = validatePassword('Abcdef1!');
      expect(result.errors).toEqual([]);
    });

    it('errors contains only strings', () => {
      const result = validatePassword('');
      result.errors.forEach((err) => {
        expect(typeof err).toBe('string');
      });
    });
  });
});
