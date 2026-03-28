import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { fetchFromTable } from '../supabaseUtils';
import { sendAdminEmail } from '../services/emailService';
import { setChartAccountActiveWithActor } from '../services/chartOfAccountsService';
import { HelpTooltip } from '../components/HelpTooltip';
import '../global.css';
import './ChartOfAccounts.css';

const defaultFilters = {
  accountName: '',
  accountNumber: '',
  category: '',
  subCategory: '',
  amountOperator: '',
  amountValue: '',
  status: ''
};

function ChartOfAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPopupVisible, setFilterPopupVisible] = useState(false);
  const [filters, setFilters] = useState(defaultFilters);
  const [viewMode, setViewMode] = useState('report');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'administrator';
  const dashboardPath =
    user?.role === 'administrator'
      ? '/admin-dashboard'
      : user?.role === 'manager'
        ? '/manager-dashboard'
        : user?.role === 'accountant'
          ? '/accountant-dashboard'
          : '/dashboard';

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

  const handleDeactivate = async (id, currentStatus) => {
    const actorUserId = parseInt(user?.userID, 10);
    if (!Number.isFinite(actorUserId) || actorUserId <= 0) {
      alert('Unable to determine current administrator user ID.');
      return;
    }

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

      const account = accounts.find((acc) => acc.accountID === id);
      const { data: admins, error: adminError } = await fetchFromTable('user', {
        select: 'email, fName, lName',
        filters: { role: 'administrator' }
      });
      if (!adminError && admins && account) {
        const subject = `Account Status Changed: ${account.accountName}`;
        const message = `The status of the following account has been changed to ${newStatus ? 'Active' : 'Inactive'} by ${user.fName} ${user.lName}:\n\nName: ${account.accountName}\nNumber: ${account.accountNumber}`;
        for (const admin of admins) {
          await sendAdminEmail(admin.email, `${admin.fName} ${admin.lName}`, subject, message);
        }
      }

      loadAccounts();
    } catch (err) {
      console.error('Failed to update account status:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleSearch = () => setSearchQuery(searchTerm);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleAmountValueChange = (value) => {
    if (value === '' || /^\d*(\.\d{0,2})?$/.test(value)) {
      setFilters({ ...filters, amountValue: value });
    }
  };

  const filteredAccounts = accounts.filter(account => {
    const search = searchQuery.trim().toLowerCase();
    const typedName = filters.accountName.trim().toLowerCase();
    const typedNumber = filters.accountNumber.trim();
    const rawAmount = filters.amountValue === '' ? NaN : Number(filters.amountValue);
    const balance = Number(account.initBalance || 0);

    const matchesSearch =
      search === '' ||
      (account.accountName && account.accountName.toLowerCase().includes(search)) ||
      (account.accountNumber && account.accountNumber.toString().includes(search));

    const matchesName =
      typedName === '' ||
      (account.accountName && account.accountName.toLowerCase().includes(typedName));

    const matchesNumber =
      typedNumber === '' ||
      (account.accountNumber && account.accountNumber.toString().includes(typedNumber));

    const matchesCategory = filters.category === '' || account.type === filters.category;
    const matchesSubCategory = filters.subCategory === '' || account.subType === filters.subCategory;

    let matchesAmount = true;
    if (!Number.isNaN(rawAmount) && filters.amountOperator) {
      if (filters.amountOperator === '=') matchesAmount = balance === rawAmount;
      if (filters.amountOperator === '>') matchesAmount = balance > rawAmount;
      if (filters.amountOperator === '<') matchesAmount = balance < rawAmount;
      if (filters.amountOperator === '>=') matchesAmount = balance >= rawAmount;
      if (filters.amountOperator === '<=') matchesAmount = balance <= rawAmount;
    }

    const matchesStatus =
      filters.status === '' ||
      (filters.status === 'Active' ? account.active : !account.active);

    return (
      matchesSearch &&
      matchesName &&
      matchesNumber &&
      matchesCategory &&
      matchesSubCategory &&
      matchesAmount &&
      matchesStatus
    );
  });

  const selectedAccount = accounts.find(account => account.accountID?.toString() === selectedAccountId);

  const activeTokens = [
    searchQuery ? { key: 'searchQuery', label: `Search: ${searchQuery}` } : null,
    filters.accountName ? { key: 'accountName', label: `Name: ${filters.accountName}` } : null,
    filters.accountNumber ? { key: 'accountNumber', label: `Number: ${filters.accountNumber}` } : null,
    filters.category ? { key: 'category', label: `Category: ${filters.category}` } : null,
    filters.subCategory ? { key: 'subCategory', label: `Subcategory: ${filters.subCategory}` } : null,
    filters.amountOperator && filters.amountValue !== ''
      ? {
          key: 'amount',
          label: `Amount ${filters.amountOperator} ${Number(filters.amountValue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        }
      : null,
    filters.status ? { key: 'status', label: `Status: ${filters.status}` } : null
  ].filter(Boolean);

  const resetAllFilters = () => {
    setFilters(defaultFilters);
    setSearchTerm('');
    setSearchQuery('');
  };

  const clearToken = (tokenKey) => {
    if (tokenKey === 'searchQuery') {
      setSearchTerm('');
      setSearchQuery('');
      return;
    }
    if (tokenKey === 'amount') {
      setFilters(prev => ({ ...prev, amountOperator: '', amountValue: '' }));
      return;
    }
    setFilters(prev => ({ ...prev, [tokenKey]: '' }));
  };

  const fmt = (val) => (val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="page-chart-of-accounts">
      <h1>Chart of Accounts</h1>
      <div className="header-row">
        <div className="button-group">
          {isAdmin && (
            <HelpTooltip text="Create a new account in the chart of accounts (administrators only).">
              <button onClick={() => navigate('/admin/add-account')} className="button">
                Add New Account
              </button>
            </HelpTooltip>
          )}
          <HelpTooltip text="Return to your role dashboard without leaving the app.">
            <button onClick={() => navigate(dashboardPath)} className="button">
              Back to Dashboard
            </button>
          </HelpTooltip>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginRight: '20px' }}>
          <HelpTooltip text="Show all accounts in a single table report.">
            <button
              onClick={() => setViewMode('report')}
              className="button"
              style={{ padding: '8px 15px', opacity: viewMode === 'report' ? 1 : 0.8 }}
            >
              All Accounts Report
            </button>
          </HelpTooltip>
          <HelpTooltip text="Pick one account from a list to view its details.">
            <button
              onClick={() => setViewMode('individual')}
              className="button"
              style={{ padding: '8px 15px', opacity: viewMode === 'individual' ? 1 : 0.8 }}
            >
              Individual Account
            </button>
          </HelpTooltip>
        </div>
      </div>
      <div className="search-and-filter">
        <div className="search-group">
          <input
            type="text"
            placeholder="Search by account name or number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            className="input-field"
            style={{ width: '300px' }}
          />
          <HelpTooltip text="Apply the search box and current filters to narrow the account list.">
            <button onClick={handleSearch} className="button" style={{ padding: '8px 15px' }}>
              Search
            </button>
          </HelpTooltip>
          <button
            onClick={() => setFilterPopupVisible(!filterPopupVisible)}
            className="button"
            style={{ padding: '8px 15px' }}
          >
            Filters {filterPopupVisible ? '◀' : '▶'}
          </button>
        </div>

        {filterPopupVisible && (
          <div className="filter-popup">
            <div className="filter-item">
              <label style={{ marginRight: '8px' }}>Account Name:</label>
              <input
                type="text"
                value={filters.accountName}
                onChange={(e) => setFilters({ ...filters, accountName: e.target.value })}
                className="input-field"
                style={{ padding: '5px', width: '180px' }}
                placeholder="e.g., Cash"
              />
            </div>
            <div className="filter-item">
              <label style={{ marginRight: '8px' }}>Account Number:</label>
              <input
                type="text"
                value={filters.accountNumber}
                onChange={(e) => setFilters({ ...filters, accountNumber: e.target.value })}
                className="input-field"
                style={{ padding: '5px', width: '140px' }}
                placeholder="e.g., 10000001"
              />
            </div>
            <div className="filter-item">
              <label style={{ marginRight: '8px' }}>Category:</label>
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
            <div className="filter-item">
              <label style={{ marginRight: '8px' }}>Subcategory:</label>
              <input
                type="text"
                value={filters.subCategory}
                onChange={(e) => setFilters({ ...filters, subCategory: e.target.value })}
                className="input-field"
                style={{ padding: '5px', width: '180px' }}
                placeholder="e.g., Current Assets"
              />
            </div>
            <div className="filter-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ marginRight: '8px' }}>Amount:</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <select
                  value={filters.amountOperator}
                  onChange={(e) => setFilters({ ...filters, amountOperator: e.target.value })}
                  className="input-field"
                  style={{ padding: '5px', width: '75px' }}
                >
                  <option value="">-</option>
                  <option value="=">=</option>
                  <option value=">">&gt;</option>
                  <option value="<">&lt;</option>
                  <option value=">=">&gt;=</option>
                  <option value="<=">&lt;=</option>
                </select>
                <input
                  type="text"
                  inputMode="decimal"
                  value={filters.amountValue}
                  onChange={(e) => handleAmountValueChange(e.target.value)}
                  className="input-field"
                  style={{ padding: '5px', width: '130px' }}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="filter-item">
              <label style={{ marginRight: '8px' }}>Status:</label>
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
            <HelpTooltip text="Clear all filter fields in the popup back to defaults.">
              <button
                onClick={resetAllFilters}
                className="button"
                style={{ padding: '5px 10px', backgroundColor: '#eee', color: '#333' }}
              >
                Reset
              </button>
            </HelpTooltip>
          </div>
        )}

        {!loading && !error && (
          <div style={{ marginBottom: '12px' }}>
            <p style={{ marginBottom: '6px' }}>
              Showing {filteredAccounts.length} of {accounts.length} accounts.
            </p>
            {activeTokens.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {activeTokens.map((token) => (
                  <span
                    key={token.key}
                    style={{
                      backgroundColor: '#e9ecef',
                      border: '1px solid #ced4da',
                      borderRadius: '12px',
                      padding: '2px 10px',
                      fontSize: '0.85rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {token.label}
                    <HelpTooltip text={`Remove the "${token.label}" filter from the active filters.`}>
                      <button
                        onClick={() => clearToken(token.key)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          color: '#6c757d',
                          fontWeight: 700,
                          lineHeight: 1
                        }}
                        aria-label={`Clear ${token.label}`}
                        type="button"
                      >
                        x
                      </button>
                    </HelpTooltip>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {loading && <p>Loading accounts...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {!loading && !error && viewMode === 'report' && (
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
              <th>Status</th>
              {isAdmin && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredAccounts.length === 0 ? (
              <tr>
                <td
                  colSpan={isAdmin ? 13 : 12}
                  style={{ textAlign: 'center', padding: '20px', color: '#6c757d' }}
                >
                  No accounts exist for the selected filters.
                </td>
              </tr>
            ) : (
              filteredAccounts.map((account) => (
                <tr
                  key={account.accountID}
                  onClick={() => navigate(`/admin/ledger/${account.accountNumber}`)}
                  style={{ cursor: 'pointer' }}
                  title="Open account ledger"
                >
                  <td>
                    <span style={{ color: '#007bff', textDecoration: 'underline' }}>{account.accountNumber}</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/admin/ledger/${account.accountNumber}`);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        color: '#007bff',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        font: 'inherit',
                        textAlign: 'left'
                      }}
                    >
                      {account.accountName}
                    </button>
                  </td>
                  <td>{account.description || 'N/A'}</td>
                  <td>{account.subType}</td>
                  <td>{account.normalSide}</td>
                  <td>${fmt(account.initBalance)}</td>
                  <td>{account.normalSide === 'Debit' ? `$${fmt(account.initBalance)}` : '-'}</td>
                  <td>{account.normalSide === 'Credit' ? `$${fmt(account.initBalance)}` : '-'}</td>
                  <td>${fmt(account.initBalance)}</td>
                  <td>{account.createdAt ? new Date(account.createdAt).toLocaleString() : 'N/A'}</td>
                  <td>{account.updatedAt ? new Date(account.updatedAt).toLocaleString() : 'N/A'}</td>
                  <td>{account.active ? 'Active' : 'Inactive'}</td>
                  {isAdmin && (
                    <td>
                      <HelpTooltip text="Open the form to change this account's details.">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/admin/edit-account/${account.accountID}`);
                          }}
                          style={{ marginRight: '5px' }}
                        >
                          Edit
                        </button>
                      </HelpTooltip>
                      <HelpTooltip
                        text={
                          account.active
                            ? 'Mark this account inactive so it cannot be used for new entries.'
                            : 'Mark this account active again for use in the system.'
                        }
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeactivate(account.accountID, account.active);
                          }}
                        >
                          {account.active ? 'Deactivate' : 'Activate'}
                        </button>
                      </HelpTooltip>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}

      {!loading && !error && viewMode === 'individual' && (
        <div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '15px' }}>
            <label htmlFor="account-select"><strong>Select Account:</strong></label>
            <select
              id="account-select"
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="input-field"
              style={{ width: '340px' }}
            >
              <option value="">Choose an account</option>
              {filteredAccounts.map((account) => (
                <option key={account.accountID} value={account.accountID}>
                  {account.accountNumber} - {account.accountName}
                </option>
              ))}
            </select>
            {selectedAccount && (
              <HelpTooltip text="View journal activity and balances for the selected account.">
                <button
                  type="button"
                  onClick={() => navigate(`/admin/ledger/${selectedAccount.accountNumber}`)}
                  className="button"
                >
                  Open Ledger
                </button>
              </HelpTooltip>
            )}
          </div>

          {!selectedAccount && <p>Select an account to view individual details.</p>}

          {selectedAccount && (
            <table className="user-report-table" style={{ maxWidth: '850px' }}>
              <tbody>
                <tr><th>Account Number</th><td>{selectedAccount.accountNumber}</td></tr>
                <tr>
                  <th>Account Name</th>
                  <td>
                    <button
                      type="button"
                      onClick={() => navigate(`/admin/ledger/${selectedAccount.accountNumber}`)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        color: '#007bff',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        font: 'inherit'
                      }}
                    >
                      {selectedAccount.accountName}
                    </button>
                  </td>
                </tr>
                <tr><th>Description</th><td>{selectedAccount.description || 'N/A'}</td></tr>
                <tr><th>Category</th><td>{selectedAccount.type || 'N/A'}</td></tr>
                <tr><th>Subcategory</th><td>{selectedAccount.subType || 'N/A'}</td></tr>
                <tr><th>Normal Side</th><td>{selectedAccount.normalSide || 'N/A'}</td></tr>
                <tr><th>Initial Balance</th><td>${fmt(selectedAccount.initBalance)}</td></tr>
                <tr><th>Current Balance</th><td>${fmt(selectedAccount.initBalance)}</td></tr>
                <tr><th>Statement Type</th><td>{selectedAccount.statementType || 'N/A'}</td></tr>
                <tr><th>Status</th><td>{selectedAccount.active ? 'Active' : 'Inactive'}</td></tr>
                <tr><th>Added At</th><td>{selectedAccount.createdAt ? new Date(selectedAccount.createdAt).toLocaleString() : 'N/A'}</td></tr>
                <tr><th>Last Modified</th><td>{selectedAccount.updatedAt ? new Date(selectedAccount.updatedAt).toLocaleString() : 'N/A'}</td></tr>
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export default ChartOfAccounts;