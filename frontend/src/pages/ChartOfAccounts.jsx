import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchFromTable, updateRecord } from '../supabaseUtils';
import '../global.css';

function ChartOfAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    setLoading(true);
    const { data, error } = await fetchFromTable('charOfAccounts', {
      orderBy: { column: 'account_number', ascending: true }
    });
    if (!error) {
      setAccounts(data || []);
    }
    setLoading(false);
  };

  const handleDeactivate = async (id, currentStatus) => {
    const newStatus = !currentStatus;
    const { error } = await updateRecord('charOfAccounts', id, { active: newStatus });
    if (!error) {
      loadAccounts();
    }
  };

  return (
    <div className="container">
      <h1>Chart of Accounts</h1>
      <div style={{ marginBottom: '20px' }}>
        <button onClick={() => navigate('/admin/add-account')} className="button">
          Add New Account
        </button>
      </div>

      {loading ? (
        <p>Loading accounts...</p>
      ) : (
        <table className="user-report-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f2f2f2' }}>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Name</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Number</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Category</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Subcategory</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Balance</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Status</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id}>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{account.account_name}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{account.account_number}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{account.category}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{account.subcategory}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>${account.balance.toFixed(2)}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{account.active ? 'Active' : 'Inactive'}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                  <button onClick={() => navigate(`/admin/edit-account/${account.id}`)} style={{ marginRight: '5px' }}>
                    Edit
                  </button>
                  <button onClick={() => handleDeactivate(account.id, account.active)}>
                    {account.active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div style={{ marginTop: '20px' }}>
        <button onClick={() => navigate('/admin-dashboard')} className="button">
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}

export default ChartOfAccounts;
