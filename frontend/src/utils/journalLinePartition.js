export function uniqueLinesByAccount(lines) {
  const seen = new Set();
  return (lines || []).filter((l) => {
    if (!l?.accountID || seen.has(l.accountID)) return false;
    seen.add(l.accountID);
    return true;
  });
}

export function partitionLinesByDebitCredit(lines) {
  const withMeta = (lines || []).filter((l) => l.accountID && l.accountName && l.accountNumber);
  const debits = withMeta.filter((l) => (Number(l.debit) || 0) > 0);
  const credits = withMeta.filter((l) => (Number(l.credit) || 0) > 0);
  return {
    debitLines: uniqueLinesByAccount(debits),
    creditLines: uniqueLinesByAccount(credits),
  };
}
