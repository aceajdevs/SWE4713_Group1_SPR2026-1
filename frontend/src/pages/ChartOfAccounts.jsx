import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { fetchFromTable } from '../supabaseUtils';
import { supabase } from '../supabaseClient';
import { sendAdminEmail } from '../services/emailService';
import { getEmailRecipientsByRoles } from '../services/adminService';
import { setChartAccountActiveWithActor } from '../services/chartOfAccountsService';
import { HelpTooltip } from '../components/HelpTooltip';
import editIcon from '../../assets/Images/resourceDirectory/Edit.png';
import deactivateIcon from '../../assets/Images/resourceDirectory/X.png';
import activateIcon from '../../assets/Images/resourceDirectory/Check.png';
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

function shouldTryLowercaseLedgerTable(error) {
  const message = String(error?.message || '').toLowerCase();
  const isPermission =
    error?.code === '42501' ||
    message.includes('permission denied') ||
    message.includes('row-level security');
  return (
    !isPermission &&
    (error?.code === 'PGRST205' ||
      message.includes('schema cache') ||
      message.includes('does not exist') ||
      (message.includes('could not find') && message.includes('table')))
  );
}

async function fetchLedgerMovementByAccount() {
  const columns = 'accountID, debit, credit';
  const primary = await supabase.from('Ledger').select(columns);
  if (!primary.error) return primary.data || [];

  if (shouldTryLowercaseLedgerTable(primary.error)) {
    const fallback = await supabase.from('ledger').select(columns);
    if (!fallback.error) return fallback.data || [];
  }
  throw primary.error;
}

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
  const [staffRecipients, setStaffRecipients] = useState([]);
  const [staffLoadError, setStaffLoadError] = useState(null);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [staffEmailSubject, setStaffEmailSubject] = useState('');
  const [staffEmailMessage, setStaffEmailMessage] = useState('');
  const [staffEmailSending, setStaffEmailSending] = useState(false);
  const [staffEmailModalOpen, setStaffEmailModalOpen] = useState(false);
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setStaffLoadError(null);
        const list = await getEmailRecipientsByRoles(['manager', 'accountant', 'administrator']);
        const currentUserId = user?.userID != null ? String(user.userID) : null;
        const filtered = currentUserId
          ? (list || []).filter((u) => String(u.userID) !== currentUserId)
          : list;
        if (!cancelled) setStaffRecipients(filtered);
      } catch (e) {
        if (!cancelled) setStaffLoadError(e?.message ?? String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.userID]);

  useEffect(() => {
    if (!staffEmailModalOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && !staffEmailSending) setStaffEmailModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [staffEmailModalOpen, staffEmailSending]);

  const loadAccounts = async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data, error }, ledgerRows] = await Promise.all([
        fetchFromTable('chartOfAccounts', {
          orderBy: { column: 'accountNumber', ascending: true }
        }),
        fetchLedgerMovementByAccount(),
      ]);

      if (error) {
        setError('Failed to load accounts. You may not have permission.');
        console.error('RLS or fetch error:', error);
        setAccounts([]);
        return;
      }

      const movementByAccount = new Map();
      for (const row of ledgerRows || []) {
        const accountId = row.accountID;
        const debit = Number(row.debit) || 0;
        const credit = Number(row.credit) || 0;
        const existing = movementByAccount.get(accountId) || { debit: 0, credit: 0 };
        existing.debit += debit;
        existing.credit += credit;
        movementByAccount.set(accountId, existing);
      }

      const withBalances = (data || []).map((account) => {
        const movement = movementByAccount.get(account.accountID) || { debit: 0, credit: 0 };
        const opening = Number(account.initBalance) || 0;
        const isCreditNormal = String(account.normalSide || '').toLowerCase() === 'credit';
        const netMovement = isCreditNormal
          ? movement.credit - movement.debit
          : movement.debit - movement.credit;
        const currentBalance = opening + netMovement;
        return {
          ...account,
          ledgerDebitTotal: movement.debit,
          ledgerCreditTotal: movement.credit,
          currentBalance,
        };
      });

      setAccounts(withBalances);
    } catch (e) {
      console.error('Failed to load accounts with balances:', e);
      setError(e?.message || 'Failed to load current balances from the ledger.');
      setAccounts([]);
    } finally {
      setLoading(false);
    }
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
    const balance = Number(account.currentBalance ?? account.initBalance ?? 0);

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

  const handleSendStaffEmail = async (e) => {
    e.preventDefault();
    if (!selectedStaffId) {
      alert('Select a manager or accountant to email.');
      return;
    }
    const subject = staffEmailSubject.trim();
    const message = staffEmailMessage.trim();
    if (!subject || !message) {
      alert('Subject and message are required.');
      return;
    }
    const recipient = staffRecipients.find((u) => String(u.userID) === String(selectedStaffId));
    if (!recipient?.email) {
      alert('Selected user has no email on file.');
      return;
    }
    const displayName =
      [recipient.fName, recipient.lName].filter(Boolean).join(' ') || recipient.username || 'User';
    setStaffEmailSending(true);
    try {
      await sendAdminEmail(recipient.email.trim(), displayName, subject, message);
      alert(`Email sent to ${displayName} (${recipient.role}).`);
      setStaffEmailSubject('');
      setStaffEmailMessage('');
      setStaffEmailModalOpen(false);
    } catch (err) {
      console.error(err);
      alert(err?.message ?? 'Failed to send email.');
    } finally {
      setStaffEmailSending(false);
    }
  };

  return (
    <div className="page-chart-of-accounts">
      <div className="page-header">
      <h1>Chart of Accounts</h1>
      </div>
      <div className="header-row">
        <div className="button-group">
          {isAdmin && (
            <HelpTooltip text="Create a new account in the chart of accounts (administrators only).">
              <button className="button-primary" onClick={() => navigate('/admin/add-account')}>Add New Account</button>
            </HelpTooltip>
          )}
          <HelpTooltip text="Open a window to email a manager, accountant, or administrator about the chart of accounts.">
            <button
              type="button"
              onClick={() => setStaffEmailModalOpen(true)}
              className="button-primary"
            >
              Email User
            </button>
          </HelpTooltip>
          <HelpTooltip text="Show all accounts in a single table report.">
            <button className="button-primary" onClick={() => setViewMode('report')}>All Accounts Report</button>
          </HelpTooltip>
          <HelpTooltip text="Pick one account from a list to view its details.">
            <button className="button-primary" onClick={() => setViewMode('individual')}>Individual Account</button>
          </HelpTooltip>
          <HelpTooltip text="Return to your role dashboard without leaving the app.">
            <button className="button-primary" onClick={() => navigate(dashboardPath)}>Back to Dashboard</button>
          </HelpTooltip>
        </div>
      {staffEmailModalOpen && (
              <div
                className="coa-email-modal-backdrop"
                onClick={() => !staffEmailSending && setStaffEmailModalOpen(false)}
                role="presentation"
              >
                <div
                  className="coa-email-modal"
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="coa-email-modal-title"
                >
                  <div className="coa-email-modal-header">
                    <h2 id="coa-email-modal-title" className="coa-email-modal-title">
                      Email a manager or accountant
                    </h2>
                    <button
                      type="button"
                      className="button-primary coa-email-modal-close"
                      aria-label="Close"
                      disabled={staffEmailSending}
                      onClick={() => setStaffEmailModalOpen(false)}
                    >
                      X
                    </button>
                  </div>
                  <p className="coa-email-modal-lead">
                    Send a message about the chart of accounts using the same email integration as other admin notifications.
                  </p>
                  {staffLoadError && (
                    <p style={{ color: 'var(--bff-red)', fontSize: '0.9rem' }} role="alert">
                      Could not load recipients: {staffLoadError}
                    </p>
                  )}
                  {!staffLoadError && staffRecipients.length === 0 && (
                    <p style={{ color: 'var(--bff-dark-text)', fontSize: '0.9rem' }}>
                  No active managers, accountants, or administrators with an email address were found.
                    </p>
                  )}
                  <form onSubmit={handleSendStaffEmail} className="coa-email-staff-form">
                    <div className="coa-email-staff-row">
                      <label htmlFor="coa-staff-recipient" className="coa-email-staff-label">
                        Recipient
                      </label>
                      <select
                        id="coa-staff-recipient"
                        className="input coa-email-staff-select"
                        value={selectedStaffId}
                        onChange={(e) => setSelectedStaffId(e.target.value)}
                        disabled={staffRecipients.length === 0}
                      >
                        <option value="">— Select manager, accountant, or administrator —</option>
                        {staffRecipients.map((u) => (
                          <option key={u.userID} value={u.userID}>
                            {[u.fName, u.lName].filter(Boolean).join(' ') || u.username} ({u.role}) — {u.email}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="coa-email-staff-row">
                      <label htmlFor="coa-staff-subject" className="coa-email-staff-label">
                        Subject
                      </label>
                      <div className="clear-input-container" role="group">
                        <input
                          id="coa-staff-subject"
                          type="text"
                          className="input"
                          value={staffEmailSubject}
                          onChange={(e) => setStaffEmailSubject(e.target.value)}
                          placeholder="e.g., Question about account 10000001"
                          autoComplete="off"
                        />
                        <button type="button" className="button-clear" onClick={() => setStaffEmailSubject('')} aria-label="Clear subject input">X</button>
                      </div>
                    </div>
                    <div className="coa-email-staff-row coa-email-staff-row-grow">
                      <label htmlFor="coa-staff-message" className="coa-email-staff-label">
                        Message
                      </label>
                      <textarea
                        id="coa-staff-message"
                        className="input coa-email-staff-text-area"
                        rows={4}
                        value={staffEmailMessage}
                        onChange={(e) => setStaffEmailMessage(e.target.value)}
                        placeholder="Your message…"
                      />
                    </div>
                    <div className="coa-email-staff-actions">
                      <HelpTooltip text="Send this message to the selected user’s email using the configured EmailJS admin template.">
                        <button type="submit" className="button-secondary" disabled={staffEmailSending || staffRecipients.length === 0}>
                          {staffEmailSending ? 'Sending…' : 'Send Email'}
                        </button>
                      </HelpTooltip>
                    </div>
                  </form>
                </div>
              </div>
            )}
      </div>
      <div className="chart-of-accounts-container">
        <div className="search-and-filter">
          <div className="search-group">
            <div className="clear-input-container" role="group">
              <input className="input" type="text" placeholder="Search by account name or number..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={handleKeyDown}/>
              <button type="button" className="button-clear" onClick={() => setSearchTerm('')} aria-label="Clear search input">X</button>
            </div>
            <HelpTooltip text="Apply the search box and current filters to narrow the account list.">
              <button className="button-secondary" style={{ height: '44px' }} onClick={handleSearch}>Search</button>
            </HelpTooltip>
            <button className="button-primary" onClick={() => setFilterPopupVisible(!filterPopupVisible)}>Filters {filterPopupVisible ? '▲' : '▼'}</button>
          </div>

          {filterPopupVisible && (
            <div className="filter-popup">
              <div className="filter-item">
                <label>Account Name:</label>
                <input
                  type="text"
                  value={filters.accountName}
                  onChange={(e) => setFilters({ ...filters, accountName: e.target.value })}
                  className="input"
                  style={{ width: '180px' }}
                  placeholder="e.g., Cash"
                />
              </div>
              <div className="filter-item">
                <label>Account Number:</label>
                <input
                  type="text"
                  value={filters.accountNumber}
                  onChange={(e) => setFilters({ ...filters, accountNumber: e.target.value })}
                  className="input"
                  style={{ width: '140px' }}
                  placeholder="e.g., 10000001"
                />
              </div>
              <div className="filter-item">
                <label>Category:</label>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                  className="input"
                  style={{ width: 'auto' }}
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
                <label>Subcategory:</label>
                <input
                  type="text"
                  value={filters.subCategory}
                  onChange={(e) => setFilters({ ...filters, subCategory: e.target.value })}
                  className="input"
                  style={{ width: '180px' }}
                  placeholder="e.g., Current Assets"
                />
              </div>
              <div className="filter-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label>Amount:</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <select
                    value={filters.amountOperator}
                    onChange={(e) => setFilters({ ...filters, amountOperator: e.target.value })}
                    className="input"
                    style={{ width: '75px' }}
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
                    className="input"
                    style={{ width: '130px' }}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="filter-item">
                <label>Status:</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="input"
                  style={{  width: 'auto' }}
                >
                  <option value="">All Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <HelpTooltip text="Clear all filter fields in the popup back to defaults.">
                <button
                  onClick={resetAllFilters}
                  className="button-primary"
                  style={{ margin: '0 0 0 12px' }}
                >
                  Reset
                </button>
              </HelpTooltip>
            </div>
          )}
        </div>
        <div className="filter-tokens-container">
                {activeTokens.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {activeTokens.map((token) => (
                    <span
                      key={token.key}
                      style={{
                        color: 'var(--bff-dark-text)',
                        borderRadius: '12px',
                        padding: '2px 10px',
                        fontSize: '0.85rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
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
                            color: 'var(--bff-primary)',
                            fontWeight: 700,
                            lineHeight: 1,
                          }}
                          aria-label={`Clear ${token.label}`}
                          type="button"
                        >
                          X
                        </button>
                      </HelpTooltip>
                    </span>
                  ))}
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
              <th className='money'>Initial Balance</th>
              <th className='money'>Debit</th>
              <th className='money'>Credit</th>
              <th className='money'>Current Balance</th>
              <th>Added At</th>
              <th>Last Modified</th>
              <th>Status</th>
              <th>Event log</th>
              {isAdmin && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredAccounts.length === 0 ? (
              <tr>
                <td
                  colSpan={isAdmin ? 14 : 13}
                  style={{ textAlign: 'center', padding: '20px', color: 'var(--bff-dark-text)' }}
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
                    <span style={{ color: 'var(--bff-primary)', textDecoration: 'underline' }}>{account.accountNumber}</span>
                  </td>
                  <td>{account.accountName}</td>
                  <td>{account.description || 'N/A'}</td>
                  <td>{account.subType}</td>
                  <td>{account.normalSide}</td>
                  <td className="money">${fmt(account.initBalance)}</td>
                  <td className="money">${fmt(account.ledgerDebitTotal)}</td>
                  <td className="money">${fmt(account.ledgerCreditTotal)}</td>
                  <td className="money">${fmt(account.currentBalance ?? account.initBalance)}</td>
                  <td>{account.createdAt ? new Date(account.createdAt).toLocaleString() : 'N/A'}</td>
                  <td>{account.updatedAt ? new Date(account.updatedAt).toLocaleString() : 'N/A'}</td>
                  <td>{account.active ? 'Active' : 'Inactive'}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <HelpTooltip text="View audit events for this account (before/after snapshots, who changed it, when).">
                      <button
                        type="button"
                        className="button-primary"
                        style={{ padding: '4px 10px', fontSize: '13px', }}
                        onClick={() => navigate(`/admin/chart-of-accounts/account/${account.accountID}/events`)}
                      >
                        View
                      </button>
                    </HelpTooltip>
                  </td>
                  {isAdmin && (
                    <td>
                      <HelpTooltip text="Open the form to change this account's details.">
                        <button
                          type="button"
                          className="button-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/admin/edit-account/${account.accountID}`);
                          }}
                          style={{ marginRight: '5px', padding: '4px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <img src={editIcon} alt="Edit" style={{ height: '20px', width: 'auto' }} />
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
                          style={{ marginRight: '5px', padding: '4px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          {account.active ? <img src={deactivateIcon} alt="Deactivate" className="icon-deactivate" style={{ height: '20px', width: 'auto' }} /> : <img src={activateIcon} alt="Activate" className="icon-activate" style={{ height: '20px', width: 'auto'}} />}
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
              className="input"
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
              <>
                <HelpTooltip text="View journal activity and balances for the selected account.">
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/ledger/${selectedAccount.accountNumber}`)}
                    className="button-primary"
                  >
                    Open Ledger
                  </button>
                </HelpTooltip>
                <HelpTooltip text="View audit events for this account (before/after snapshots).">
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/admin/chart-of-accounts/account/${selectedAccount.accountID}/events`)
                    }
                    className="button-primary"
                    style={{ marginLeft: '8px' }}
                  >
                    Event log
                  </button>
                </HelpTooltip>
              </>
            )}
          </div>

            {!selectedAccount && <p>Select an account to view individual details.</p>}

            {selectedAccount &&
            (
              <table>
                <tbody>
                  <tr><th>Account Number</th><td>{selectedAccount.accountNumber}</td></tr>
                  <tr>
                    <th>Account Name</th>
                    <td>
                      <button
                        type="button"
                        className="button-primary"
                        onClick={() => navigate(`/admin/ledger/${selectedAccount.accountNumber}`)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          padding: 0,
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
                  <tr><th className='money'>Initial Balance</th><td className="money">${fmt(selectedAccount.initBalance)}</td></tr>
                  <tr><th className='money'>Current Balance</th><td className="money">${fmt(selectedAccount.currentBalance ?? selectedAccount.initBalance)}</td></tr>
                  <tr><th>Statement Type</th><td>{selectedAccount.statementType || 'N/A'}</td></tr>
                  <tr><th>Status</th><td>{selectedAccount.active ? 'Active' : 'Inactive'}</td></tr>
                  <tr><th>Added At</th><td>{selectedAccount.createdAt ? new Date(selectedAccount.createdAt).toLocaleString() : 'N/A'}</td></tr>
                  <tr><th>Last Modified</th><td>{selectedAccount.updatedAt ? new Date(selectedAccount.updatedAt).toLocaleString() : 'N/A'}</td></tr>
                </tbody>
              </table>
            )}
          </div>
        )}
                  {!loading && !error && (
            <div style={{ marginBottom: '12px' }}>
              <p style={{ marginBottom: '6px' }}>
                Showing {filteredAccounts.length} of {accounts.length} accounts.
              </p>
            </div>
          )}
        </div>
    </div>
  );
}

export default ChartOfAccounts;

