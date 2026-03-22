// TODO: Add journal entry rows to the ledger table once journal entries are implemented

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchFromTable } from '../supabaseUtils';
import '../global.css';

function Ledger() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAccount();
  }, [id]);

  const loadAccount = async () => {
    setLoading(true);
    setError(null);

    const parsedId = parseInt(id, 10);
    if (Number.isNaN(parsedId)) {
      setError('Invalid account reference.');
      setLoading(false);
      return;
    }

    const { data, error } = await fetchFromTable('chartOfAccounts', {
      select: 'accountID, accountNumber, accountName, description, type, subType, normalSide, initBalance, statementType, active',
      filters: { accountID: parsedId },
      single: true
    });

    if (error || !data) {
      setError('Account not found.');
      console.error('Error fetching account:', error);
    } else {
      setAccount(data);
    }
    setLoading(false);
  };

  const ledgerTitle = account?.accountName ? `Ledger: ${account.accountName}` : 'Ledger';

  return (
    <div className="container">
      <div className="header-row">
        <h1>{loading ? 'Loading Account Ledger...' : ledgerTitle}</h1>
        <button onClick={() => navigate('/admin/chart-of-accounts')} className="button">
          Back to Chart of Accounts
        </button>
      </div>
      {!loading && error && <p style={{ display: 'none' }}>{error}</p>}
    </div>
  );
}

export default Ledger;