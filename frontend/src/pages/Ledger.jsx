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
        <p><strong>Account ID:</strong> {account.accountID}</p>
        <p><strong>Account Number:</strong> {account.accountNumber}</p>
        <p><strong>Account Name:</strong> {account.accountName}</p>
        <p><strong>Description:</strong> {account.description || 'N/A'}</p>
        <p><strong>Category:</strong> {account.type || 'N/A'}</p>
        <p><strong>Subcategory:</strong> {account.subType || 'N/A'}</p>
        <p><strong>Normal Side:</strong> {account.normalSide || 'N/A'}</p>
        <p>
          <strong>Current Balance:</strong>{' '}
          ${(account.initBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <p><strong>Statement Type:</strong> {account.statementType || 'N/A'}</p>
        <p><strong>Status:</strong> {account.active ? 'Active' : 'Inactive'}</p>
      </div>
    </div>
  );
}

export default Ledger;