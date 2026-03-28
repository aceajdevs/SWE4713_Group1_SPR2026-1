const ALLOWED_ATTACHMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'image/jpeg',
  'image/png',
];

const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'jpg', 'jpeg', 'png'];

/**
 * Validate that every line references a real account from the chart of accounts.
 * @param {Array} lines 
 * @param {Array} accounts 
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateAccountsExist(lines, accounts) {
  const errors = [];
  const activeIds = new Set(accounts.filter((a) => a.active).map((a) => a.accountID));

  lines.forEach((line, i) => {
    if (!line.accountID) {
      errors.push(`Line ${i + 1}: No account selected.`);
    } else if (!activeIds.has(Number(line.accountID))) {
      errors.push(`Line ${i + 1}: Account is inactive or does not exist.`);
    }
  });

  return { valid: errors.length === 0, errors };
}

// Validate that journal entry has at least one debit line and one credit line.

export function validateHasDebitAndCredit(lines) {
  const hasDebit = lines.some((l) => parseFloat(l.debit) > 0);
  const hasCredit = lines.some((l) => parseFloat(l.credit) > 0);
  const errors = [];

  if (!hasDebit) errors.push('Journal entry must have at least one debit line.');
  if (!hasCredit) errors.push('Journal entry must have at least one credit line.');

  return { valid: errors.length === 0, errors };
}


// Validate that total debits equal total credits.

export function validateDebitsEqualCredits(lines) {
  const totalDebits = lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const totalCredits = lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);

  // Round to 2 decimal places to avoid floating point issues
  const diff = Math.abs(Math.round(totalDebits * 100) - Math.round(totalCredits * 100));

  if (diff !== 0) {
    return {
      valid: false,
      errors: [
        `Total debits ($${totalDebits.toFixed(2)}) must equal total credits ($${totalCredits.toFixed(2)}). Difference: $${(diff / 100).toFixed(2)}.`,
      ],
      totalDebits,
      totalCredits,
    };
  }

  return { valid: true, errors: [], totalDebits, totalCredits };
}


// Validate that each line has either a debit OR a credit, not both and not neither.

export function validateLineAmounts(lines) {
  const errors = [];

  lines.forEach((line, i) => {
    const debit = parseFloat(line.debit) || 0;
    const credit = parseFloat(line.credit) || 0;

    if (debit > 0 && credit > 0) {
      errors.push(`Line ${i + 1}: A line cannot have both a debit and a credit.`);
    }
    if (debit === 0 && credit === 0) {
      errors.push(`Line ${i + 1}: A line must have either a debit or a credit amount.`);
    }
    if (debit < 0 || credit < 0) {
      errors.push(`Line ${i + 1}: Amounts cannot be negative.`);
    }
  });

  return { valid: errors.length === 0, errors };
}


// Validate that debits come before credits in the line ordering.

export function validateDebitBeforeCredit(lines) {
  let foundCredit = false;

  for (let i = 0; i < lines.length; i++) {
    const credit = parseFloat(lines[i].credit) || 0;
    const debit = parseFloat(lines[i].debit) || 0;

    if (credit > 0) foundCredit = true;
    if (debit > 0 && foundCredit) {
      return {
        valid: false,
        errors: ['All debit lines must appear before credit lines in the journal entry.'],
      };
    }
  }

  return { valid: true, errors: [] };
}


// Validate attached file type is allowed.

export function validateAttachmentType(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      errors: [`File "${file.name}" is not an allowed type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}.`],
    };
  }
  return { valid: true, errors: [] };
}

/**
 * Run all journal entry validations at once.
 * @param {Array} lines 
 * @param {Array} accounts 
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateJournalEntry(lines, accounts) {
  const allErrors = [];

  const checks = [
    validateHasDebitAndCredit(lines),
    validateLineAmounts(lines),
    validateDebitBeforeCredit(lines),
    validateDebitsEqualCredits(lines),
    validateAccountsExist(lines, accounts),
  ];

  checks.forEach((result) => {
    allErrors.push(...result.errors);
  });

  return { valid: allErrors.length === 0, errors: allErrors };
}

export { ALLOWED_EXTENSIONS, ALLOWED_ATTACHMENT_TYPES };
