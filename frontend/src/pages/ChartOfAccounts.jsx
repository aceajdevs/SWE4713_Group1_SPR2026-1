import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { fetchFromTable } from '../supabaseUtils';
import { setChartAccountActiveWithActor } from '../services/chartOfAccountsService';
import '../global.css';

const ROLES = ['administrator', 'manager', 'accountant'];

function ChartOfAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPopupVisible, setFilterPopupVisible] = useState(false);
  const [filters, setFilters] = useState({
    category: '',
    status: 'Active'
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'administrator';

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    setLoading(true);
    const { data, error } = await fetchFromTable('chartOfAccounts', {
      orderBy: { column: 'accountNumber', ascending: true }
    });
    if (!error) {
      setAccounts(data || []);
    }
    setLoading(false);
  };

  const handleDeactivate = async (id, currentStatus) => {
    const actorUserId = parseInt(user?.userID, 10);
    if (!Number.isFinite(actorUserId) || actorUserId <= 0) {
      alert('Unable to determine current administrator user ID.');
      return;
    }

    // If we're trying to deactivate, check balance first
    if (currentStatus) {
      const account = accounts.find((acc) => acc.accountID === id);
      if (account && account.initBalance > 0) {
        alert('Cannot deactivate an account with a balance greater than zero. Please zero out the balance first.');
        return;
      }
    }

    try {
      const newStatus = !currentStatus;
      await setChartAccountActiveWithActor(id, newStatus, actorUserId);
      loadAccounts();
    } catch (error) {
      console.error('Failed to update account status:', error);
      alert(`Error: ${error.message}`)
    }
  }

  const handleSearch = () => {
    setSearchQuery(searchTerm);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const filteredAccounts = accounts.filter(account => {
    const matchesSearch = (account.accountName && account.accountName.toLowerCase().includes(searchQuery.toLowerCase())) ||
                         (account.accountNumber && account.accountNumber.toString().includes(searchQuery));
    const matchesCategory = filters.category === '' || account.type === filters.category;
    const matchesStatus = filters.status === '' || 
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
          <button 
            onClick={handleSearch} 
            className="button"
            style={{ padding: '8px 15px' }}
          >
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
              onChange={(e) => setFilters({...filters, category: e.target.value})}
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
                onChange={(e) => setFilters({...filters, status: e.target.value})}
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

      {loading ? (
        <p>Loading accounts...</p>
      ) : (
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
                <td>{account.accountNumber}</td>
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
