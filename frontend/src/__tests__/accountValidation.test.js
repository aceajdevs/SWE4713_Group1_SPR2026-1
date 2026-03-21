import { describe, it, expect } from 'vitest';
import {
  isValidAccountNumber,
  hasCorrectPrefix,
  sanitizeAccountNumberInput,
  formatCurrency,
  canDeactivate,
} from '../utils/accountValidation';

// Account Number Validation tests
describe('Account number validation', () => {
  describe('isValidAccountNumber', () => {
    it('accepts exactly 8 digits', () => {
      expect(isValidAccountNumber('10000001')).toBe(true);
    });

    it('accepts account numbers starting with each valid prefix', () => {
      expect(isValidAccountNumber('10000001')).toBe(true); // Assets
      expect(isValidAccountNumber('20000001')).toBe(true); // Liabilities
      expect(isValidAccountNumber('30000001')).toBe(true); // Equity
      expect(isValidAccountNumber('40000001')).toBe(true); // Revenue
      expect(isValidAccountNumber('50000001')).toBe(true); // Expenses
    });

    it('rejects letters', () => {
      expect(isValidAccountNumber('1000000A')).toBe(false);
    });

    it('rejects mixed alphanumeric', () => {
      expect(isValidAccountNumber('1ABC2345')).toBe(false);
    });

    it('rejects decimal points', () => {
      expect(isValidAccountNumber('1000.001')).toBe(false);
    });

    it('rejects fewer than 8 digits', () => {
      expect(isValidAccountNumber('1234567')).toBe(false);
    });

    it('rejects more than 8 digits', () => {
      expect(isValidAccountNumber('123456789')).toBe(false);
    });

    it('rejects empty string', () => {
      expect(isValidAccountNumber('')).toBe(false);
    });

    it('rejects spaces', () => {
      expect(isValidAccountNumber('1000 001')).toBe(false);
    });

    it('rejects special characters', () => {
      expect(isValidAccountNumber('1000!001')).toBe(false);
      expect(isValidAccountNumber('10000-01')).toBe(false);
    });

    it('rejects negative sign', () => {
      expect(isValidAccountNumber('-1000001')).toBe(false);
    });

    it('accepts numeric input passed as a number type', () => {
      expect(isValidAccountNumber(10000001)).toBe(true);
    });
  });

  describe('hasCorrectPrefix', () => {
    it('Assets must start with 1', () => {
      expect(hasCorrectPrefix('10000001', 'Assets')).toBe(true);
      expect(hasCorrectPrefix('20000001', 'Assets')).toBe(false);
    });

    it('Liabilities must start with 2', () => {
      expect(hasCorrectPrefix('20000001', 'Liabilities')).toBe(true);
      expect(hasCorrectPrefix('10000001', 'Liabilities')).toBe(false);
    });

    it('Equity must start with 3', () => {
      expect(hasCorrectPrefix('30000001', 'Equity')).toBe(true);
      expect(hasCorrectPrefix('50000001', 'Equity')).toBe(false);
    });

    it('Revenue must start with 4', () => {
      expect(hasCorrectPrefix('40000001', 'Revenue')).toBe(true);
      expect(hasCorrectPrefix('10000001', 'Revenue')).toBe(false);
    });

    it('Expenses must start with 5', () => {
      expect(hasCorrectPrefix('50000001', 'Expenses')).toBe(true);
      expect(hasCorrectPrefix('30000001', 'Expenses')).toBe(false);
    });

    it('returns true when no type is selected', () => {
      expect(hasCorrectPrefix('99999999', '')).toBe(true);
      expect(hasCorrectPrefix('99999999', undefined)).toBe(true);
    });
  });

  describe('sanitizeAccountNumberInput', () => {
    it('strips letters from input', () => {
      expect(sanitizeAccountNumberInput('1ABC2345')).toBe('12345');
    });

    it('strips decimal points', () => {
      expect(sanitizeAccountNumberInput('1000.0001')).toBe('10000001');
    });

    it('strips special characters', () => {
      expect(sanitizeAccountNumberInput('10!@#001')).toBe('10001');
    });

    it('strips spaces', () => {
      expect(sanitizeAccountNumberInput('1000 0001')).toBe('10000001');
    });

    it('truncates to 8 digits maximum', () => {
      expect(sanitizeAccountNumberInput('123456789012')).toBe('12345678');
    });

    it('allows valid 8-digit input through unchanged', () => {
      expect(sanitizeAccountNumberInput('10000001')).toBe('10000001');
    });

    it('returns empty string for all non-digit input', () => {
      expect(sanitizeAccountNumberInput('abcdefgh')).toBe('');
    });

    it('strips negative sign', () => {
      expect(sanitizeAccountNumberInput('-10000001')).toBe('10000001');
    });
  });
});

// Monetary formatting tests
describe('Monetary formatting', () => {
  describe('formatCurrency', () => {
    it('formats with two decimal places', () => {
      expect(formatCurrency(1000)).toBe('1,000.00');
    });

    it('formats zero with two decimals', () => {
      expect(formatCurrency(0)).toBe('0.00');
    });

    it('adds commas for thousands', () => {
      expect(formatCurrency(1234567.89)).toBe('1,234,567.89');
    });

    it('rounds to two decimal places', () => {
      expect(formatCurrency(99.999)).toBe('100.00');
    });

    it('handles single decimal place input', () => {
      expect(formatCurrency(50.5)).toBe('50.50');
    });

    it('handles string number input', () => {
      expect(formatCurrency('2500')).toBe('2,500.00');
    });

    it('returns empty string for empty input', () => {
      expect(formatCurrency('')).toBe('');
    });

    it('returns empty string for null', () => {
      expect(formatCurrency(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(formatCurrency(undefined)).toBe('');
    });

    it('returns empty string for non-numeric string', () => {
      expect(formatCurrency('abc')).toBe('');
    });

    it('formats small decimal values correctly', () => {
      expect(formatCurrency(0.01)).toBe('0.01');
    });

    it('formats large numbers with commas', () => {
      expect(formatCurrency(1000000)).toBe('1,000,000.00');
    });

    it('handles negative values', () => {
      const result = formatCurrency(-500.5);
      expect(result).toContain('500.50');
    });
  });
});

// Deactivation guard tests
describe('Deactivation guard', () => {
  describe('canDeactivate', () => {
    it('blocks deactivation when balance is greater than zero', () => {
      expect(canDeactivate({ initBalance: 5000 })).toBe(false);
    });

    it('blocks deactivation for small positive balance', () => {
      expect(canDeactivate({ initBalance: 0.01 })).toBe(false);
    });

    it('allows deactivation when balance is zero', () => {
      expect(canDeactivate({ initBalance: 0 })).toBe(true);
    });

    it('allows deactivation when balance is negative', () => {
      expect(canDeactivate({ initBalance: -100 })).toBe(true);
    });

    it('allows deactivation when balance is null', () => {
      expect(canDeactivate({ initBalance: null })).toBe(true);
    });

    it('allows deactivation when balance is undefined', () => {
      expect(canDeactivate({ initBalance: undefined })).toBe(true);
    });
  });
});

// Duplicate detection tasks
describe('Duplicate detection', () => {
  // Mirrors the filtering logic from AccountForm handleSubmit
  function findDuplicates(existingAccounts, newValue, field, currentId) {
    return existingAccounts.filter(
      (acc) => acc[field] === newValue && acc.accountID !== currentId
    );
  }

  const existing = [
    { accountID: 1, accountNumber: 10000001, accountName: 'Cash' },
    { accountID: 2, accountNumber: 20000001, accountName: 'Accounts Payable' },
    { accountID: 3, accountNumber: 30000001, accountName: 'Owner Equity' },
  ];

  describe('duplicate account numbers', () => {
    it('detects duplicate account number on create', () => {
      const dupes = findDuplicates(existing, 10000001, 'accountNumber', null);
      expect(dupes.length).toBe(1);
    });

    it('allows unique account number on create', () => {
      const dupes = findDuplicates(existing, 10000099, 'accountNumber', null);
      expect(dupes.length).toBe(0);
    });

    it('ignores self when editing (not a duplicate of itself)', () => {
      const dupes = findDuplicates(existing, 10000001, 'accountNumber', 1);
      expect(dupes.length).toBe(0);
    });

    it('detects conflict with another account when editing', () => {
      const dupes = findDuplicates(existing, 10000001, 'accountNumber', 2);
      expect(dupes.length).toBe(1);
    });
  });

  describe('duplicate account names', () => {
    it('detects duplicate account name on create', () => {
      const dupes = findDuplicates(existing, 'Cash', 'accountName', null);
      expect(dupes.length).toBe(1);
    });

    it('allows unique account name on create', () => {
      const dupes = findDuplicates(existing, 'Petty Cash', 'accountName', null);
      expect(dupes.length).toBe(0);
    });

    it('ignores self when editing', () => {
      const dupes = findDuplicates(existing, 'Cash', 'accountName', 1);
      expect(dupes.length).toBe(0);
    });

    it('detects name conflict with another account when editing', () => {
      const dupes = findDuplicates(existing, 'Cash', 'accountName', 3);
      expect(dupes.length).toBe(1);
    });
  });
});
