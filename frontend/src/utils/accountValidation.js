export function isValidAccountNumber(accountNumber) {
  return /^\d{8}$/.test(accountNumber.toString());
}

export function hasCorrectPrefix(accountNumber, type) {
  const prefixes = {
    Assets: '1',
    Liabilities: '2',
    Equity: '3',
    Revenue: '4',
    Expenses: '5',
  };
  const expected = prefixes[type];
  if (!expected) return true;
  return accountNumber.toString().startsWith(expected);
}

export function sanitizeAccountNumberInput(value) {
  return value.replace(/\D/g, '').slice(0, 8);
}

export function formatCurrency(value) {
  if (value === '' || value === undefined || value === null) return '';
  const number = parseFloat(value);
  if (isNaN(number)) return '';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);
}

export function canDeactivate(account) {
  if (account.initBalance > 0) return false;
  return true;
}