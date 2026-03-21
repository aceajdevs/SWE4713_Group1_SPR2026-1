import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { fetchFromTable, updateRecord } from '../supabaseUtils';
import { sendAdminEmail } from '../services/emailService';
import '../global.css';

function ChartOfAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPopupVisible, setFilterPopupVisible] = useState(false);
  const [filters, setFilters] = useState({ category: '', status: 'Active' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'administrator';

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    loadAccounts();
  }, [user]);

  const loadAccounts = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await fetchFromTable('chartOfAccounts', {
      orderBy: { column: 'accountNumber', ascending: true }
    });
    if (error) {
      setError('Failed to load accounts. You may not have permission.');
      console.error('RLS or fetch error:', error);
    } else {
      setAccounts(data || []);
    }
    setLoading(false);
  };

  const handleDeactivate = async (accountID, currentStatus) => {
    const account = accounts.find(acc => acc.accountID === accountID);

    if (currentStatus && account && (account.initBalance || 0) !== 0) {
      alert(`Cannot deactivate "${account.accountName}" because it has a non-zero balance of $${account.initBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`);
      return;
    }

    const newStatus = !currentStatus;
    const { error } = await updateRecord('chartOfAccounts', accountID, { active: newStatus }, 'accountID');
    if (error) {
      console.error('Update blocked (RLS or network):', error);
      alert('Failed to update account status. You may not have permission.');
      return;
    }
    try {
      const { data: admins, error: adminError } = await fetchFromTable('user', {
        select: 'email, fName, lName',
        filters: { role: 'administrator' }
      });
      if (!adminError && admins && account) {
        const subject = `Account Status Changed: ${account.accountName}`;
        const message = `The status of the following account has been changed to ${newStatus ? 'Active' : 'Inactive'} by ${user.fName} ${user.lName}:

Name: ${account.accountName}
Number: ${account.accountNumber}`;
        for (const admin of admins) {
          await sendAdminEmail(admin.email, `${admin.fName} ${admin.lName}`, subject, message);
        }
      }
    } catch (emailErr) {
      console.warn('Failed to send admin notification emails:', emailErr);
    }
    loadAccounts();
  };

  const handleSearch = () => setSearchQuery(searchTerm);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  const filteredAccounts = accounts.filter(account => {
    const matchesSearch =
      (account.accountName && account.accountName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (account.accountNumber && account.accountNumber.toString().includes(searchQuery));
    const matchesCategory = filters.category === '' || account.type === filters.category;
    const matchesStatus =
      filters.status === '' ||
      (filters.status === 'Active' ? account.active : !account.active);
    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="container">
      <h1>Chart of Accounts</h1>
      <div className="header-row">
        <div className="button-group">
          {isAdmin && (
            <button onClick={() => navigate('/admin/add-account')} className="button">
              Add New Account
            </button>
          )}
          <button onClick={() => navigate('/admin-dashboard')} className="button">
            Back to Dashboard
          </button>
        </div>
        <div className="search-group" style={{ marginRight: '20px' }}>
          <button
            onClick={() => setFilterPopupVisible(!filterPopupVisible)}
            className="button"
            style={{ padding: '8px 15px' }}
          >
            Filters {filterPopupVisible ? '▲' : '▼'}
          </button>
          <input
            type="text"
            placeholder="Search accounts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            className="input-field"
            style={{ width: '250px' }}
          />
          <button onClick={handleSearch} className="button" style={{ padding: '8px 15px' }}>
            Search
          </button>
        </div>
      </div>

      {filterPopupVisible && (
        <div className="filter-popup">
          <div className="filter-item">
            <label>Category:</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="input-field"
              style={{ padding: '5px', width: 'auto' }}
            >
              <option value="">All Categories</option>
              <option value="Assets">Assets</option>
              <option value="Liabilities">Liabilities</option>
              <option value="Equity">Equity</option>
              <option value="Revenue">Revenue</option>
              <option value="Expenses">Expenses</option>
            </select>
          </div>
          {isAdmin && (
            <div className="filter-item">
              <label>Status:</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="input-field"
                style={{ padding: '5px', width: 'auto' }}
              >
                <option value="">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          )}
          <button
            onClick={() => {
              setFilters({ category: '', status: 'Active' });
              setSearchTerm('');
              setSearchQuery('');
            }}
            className="button"
            style={{ padding: '5px 10px', backgroundColor: '#eee', color: '#333' }}
          >
            Reset
          </button>
        </div>
      )}

      {loading && <p>Loading accounts...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {!loading && !error && (
        <table className="user-report-table">
          <thead>
            <tr>
              <th>Number</th>
              <th>Account Name</th>
              <th>Description</th>
              <th>Type</th>
              <th>Normal Side</th>
              <th>Initial Balance</th>
              <th>Debit</th>
              <th>Credit</th>
              <th>Current Balance</th>
              <th>Added At</th>
              <th>Last Modified</th>
              {isAdmin && <th>Status</th>}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAccounts.map((account) => (
              <tr key={account.accountID}>
                <td>
                  <button
                    onClick={() => navigate(`/admin/ledger/${account.accountID}`)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#007bff',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      padding: 0,
                      font: 'inherit'
                    }}
                  >
                    {account.accountNumber}
                  </button>
                </td>
                <td>{account.accountName}</td>
                <td>{account.description || 'N/A'}</td>
                <td>{account.subType}</td>
                <td>{account.normalSide}</td>
                <td>${(account.initBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td>{account.normalSide === 'Debit' ? `$${(account.initBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}</td>
                <td>{account.normalSide === 'Credit' ? `$${(account.initBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}</td>
                <td>${(account.initBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td>{account.createdAt ? new Date(account.createdAt).toLocaleString() : 'N/A'}</td>
                <td>{account.createdAt ? new Date(account.createdAt).toLocaleString() : 'N/A'}</td>
                {isAdmin && <td>{account.active ? 'Active' : 'Inactive'}</td>}
                <td>
                  {isAdmin && (
                    <>
                      <button onClick={() => navigate(`/admin/edit-account/${account.accountID}`)} style={{ marginRight: '5px' }}>
                        Edit
                      </button>
                      <button onClick={() => handleDeactivate(account.accountID, account.active)}>
                        {account.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default ChartOfAccounts;