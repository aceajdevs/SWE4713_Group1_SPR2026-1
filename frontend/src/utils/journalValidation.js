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
 * @param {Array} lines 
 * @param {Array} accounts 
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateAccountsExist(lines, accounts) {
  const errors = [];
  const activeIds = new Set(accounts.filter((a) => a.active).map((a) => a.accountID));

/* "No account selected" and "Account is inactive or does not exist" errors. */
  lines.forEach((line, i) => {
    if (!line.accountID) {
      errors.push({
        errorID: '1001',
        code: '1001',
        field: `line-${i}-accountID`,
        lineIndex: i + 1,
      });
    } else if (!activeIds.has(Number(line.accountID))) {
      errors.push({
        errorID: '1002',
        code: '1002',
        field: `line-${i}-accountID`,
        lineIndex: i + 1,
      });
    }
  });

  return { valid: errors.length === 0, errors };
}


export function validateHasDebitAndCredit(lines) {
  const hasDebit = lines.some((l) => parseFloat(l.debit) > 0);
  const hasCredit = lines.some((l) => parseFloat(l.credit) > 0);
  const errors = [];

  /* "Journal entry must have at least one debit line" and "Journal entry must have at least one credit line" errors. */
  if (!hasDebit) {
    errors.push({
      errorID: '1003',
      code: '1003',
      field: 'line',
      lineIndex: null,
    });
  }
  if (!hasCredit) {
    errors.push({
      errorID: '1004',
      code: '1004',
      field: 'line',
      lineIndex: null,
    });
  }

  return { valid: errors.length === 0, errors };
}


// Validate total debits = total credits.

export function validateDebitsEqualCredits(lines) {
  const totalDebits = lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const totalCredits = lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);

  // Round to 2 decimal places
  const diff = Math.abs(Math.round(totalDebits * 100) - Math.round(totalCredits * 100));

  /* "Total debits must equal total credits" */
  if (diff !== 0) {
    return {
      valid: false,
      errors: [
        {
          errorID: '1005',
          code: '1005',
          field: 'line',
          lineIndex: null,
          detail: {
            totalDebits,
            totalCredits,
            diffDollars: diff / 100,
          },
        },
      ],
      totalDebits,
      totalCredits,
    };
  }

  return { valid: true, errors: [], totalDebits, totalCredits };
}


// Validate a debit OR a credit, not both and not neither.

export function validateLineAmounts(lines) {
  const errors = [];

  lines.forEach((line, i) => {
    const debit = parseFloat(line.debit) || 0;
    const credit = parseFloat(line.credit) || 0;

    if (debit === 0 && credit === 0) {
      errors.push({
        errorID: '1006',
        code: '1006',
        field: `line-${i}-debit`,
        lineIndex: i + 1,
      });
    }
    if (debit < 0 || credit < 0) {
      errors.push({
        errorID: '1007',
        code: '1007',
        field: debit < 0 ? `line-${i}-debit` : `line-${i}-credit`,
        lineIndex: i + 1,
      });
    }
  });

  return { valid: errors.length === 0, errors };
}


// debits come before credits.

export function validateDebitBeforeCredit(lines) {
  let foundCredit = false;

  for (let i = 0; i < lines.length; i++) {
    const credit = parseFloat(lines[i].credit) || 0;
    const debit = parseFloat(lines[i].debit) || 0;

    if (credit > 0) foundCredit = true;
    if (debit > 0 && foundCredit) {
      return {
        valid: false,
        errors: [
          {
            errorID: '1008',
            code: '1008',
            field: 'line',
            lineIndex: null,
          },
        ],
      };
    }
  }

  return { valid: true, errors: [] };
}


// validate file type.

export function validateAttachmentType(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      errors: [
        {
          errorID: '1010',
          code: '1010',
          fileName: file.name,
          allowedHint: ALLOWED_EXTENSIONS.join(', '),
        },
      ],
    };
  }
  return { valid: true, errors: [] };
}

/**
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
