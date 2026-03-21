// TODO: Add journal entry rows to the ledger table once journal entries are implemented

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchFromTable } from '../supabaseUtils';
import '../global.css';

function Ledger() {
  const { accountNumber } = useParams();
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAccount();
  }, [accountNumber]);

  const loadAccount = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await fetchFromTable('chartOfAccounts', {
      select: 'accountNumber, accountName',
      filters: { accountNumber: parseInt(accountNumber, 10) },
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

  if (loading) return <p>Loading ledger...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <div className="container">
      <div className="header-row">
        <h1>Ledger</h1>
        <button onClick={() => navigate('/admin/chart-of-accounts')} className="button">
          Back to Chart of Accounts
        </button>
      </div>
      <div style={{ marginBottom: '20px' }}>
        <p><strong>Account Number:</strong> {account.accountNumber}</p>
        <p><strong>Account Name:</strong> {account.accountName}</p>
      </div>
    </div>
  );
}

export default Ledger;