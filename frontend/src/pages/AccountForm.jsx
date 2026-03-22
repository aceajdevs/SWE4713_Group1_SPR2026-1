import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { supabase } from '../supabaseClient';
import {
  createChartAccountWithActor,
  updateChartAccountWithActor,
} from '../services/chartOfAccountsService';
import '../global.css';

const subcategoriesMap = {
  'Assets': ['Current Assets', 'Fixed Assets', 'Intangible Assets', 'Other Assets'],
  'Liabilities': ['Current Liabilities', 'Long-term Liabilities', 'Other Liabilities'],
  'Equity': ["Owner's Equity", 'Retained Earnings', 'Common Stock'],
  'Revenue': ['Operating Revenue', 'Non-operating Revenue'],
  'Expenses': ['Operating Expenses', 'Non-operating Expenses', 'Administrative Expenses', 'Financial Expenses']
};

const prefixes = {
  'Assets': '1',
  'Liabilities': '2',
  'Equity': '3',
  'Revenue': '4',
  'Expenses': '5'
};

const normalSideMap = {
  'Assets': 'Debit',
  'Liabilities': 'Credit',
  'Equity': 'Credit',
  'Revenue': 'Credit',
  'Expenses': 'Debit'
};

const statementTypeMap = {
  'Assets': 'Balance Sheet',
  'Liabilities': 'Balance Sheet',
  'Equity': 'Balance Sheet',
  'Revenue': 'Income Statement',
  'Expenses': 'Income Statement'
};

function AccountForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEditing = !!id;

  const [formData, setFormData] = useState({
    accountName: '',
    accountNumber: '',
    description: '',
    normalSide: 'Debit',
    type: '',
    subType: '',
    initBalance: 0,
    orderNumber: 0,
    active: true,
    statementType: '',
    createdAt: '',
    createdBy: 0
  });

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEditing);

  useEffect(() => {
    if (user && user.role !== 'administrator') {
      alert('Unauthorized: Access to this page is restricted to administrators.');
      navigate('/admin/chart-of-accounts');
      return;
    }
    if (isEditing) loadAccount();
  }, [id, user, navigate]);

  useEffect(() => {
    if (isEditing && formData.type && !formData.statementType) {
      const auto = statementTypeMap[formData.type] || '';
      if (auto) setFormData(prev => ({ ...prev, statementType: auto }));
    }
  }, [isEditing, formData.type, formData.statementType]);

  useEffect(() => {
    if (!isEditing && formData.type && formData.subType) {
      suggestAccountNumber(formData.type, formData.subType);
    }
  }, [formData.type, formData.subType]);

  const suggestAccountNumber = async (type, subType) => {
    const prefix = prefixes[type] || '';
    if (!prefix) return;

    const subcategories = subcategoriesMap[type] || [];
    const subIdx = subcategories.indexOf(subType);
    if (subIdx === -1) return;

    const { data, error } = await fetchFromTable('chartOfAccounts', { select: 'accountNumber' });

    let nextId = Math.max(subIdx * 25, 1);
    if (!error && data) {
      const identifiers = data
        .map(acc => acc.accountNumber?.toString())
        .filter(num => num && num.startsWith(prefix) && num.length === 8)
        .map(num => parseInt(num.substring(1), 10))
        .filter(n => n >= subIdx * 25 && n < (subIdx * 25) + 25);

      if (identifiers.length > 0) nextId = Math.max(...identifiers) + 1;
    }

    if (nextId >= (subIdx * 25) + 25) {
      alert('Maximum number of accounts for this subType reached (24 or 25).');
      return;
    }

    const identifierStr = nextId.toString().padStart(7, '0');
    setFormData(prev => ({ ...prev, accountNumber: `${prefix}${identifierStr}` }));
  };

  const loadAccount = async () => {
    const { data, error } = await fetchFromTable('chartOfAccounts', {
      filters: { accountID: id },
      single: true
    });
    if (!error && data) {
      setFormData(data);
    } else {
      console.error('Error fetching account:', error);
      navigate('/admin/chart-of-accounts');
    }
    setFetching(false);
  };

  const formatCurrency = (value) => {
    if (value === '' || value === undefined || value === null) return '';
    const number = parseFloat(value);
    if (isNaN(number)) return '';
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number);
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    const monetaryFields = ['initBalance'];

    setFormData(prev => {
      let updatedValue;
      if (monetaryFields.includes(name)) {
        const cleanValue = typeof value === 'string' ? value.replace(/,/g, '') : value;
        updatedValue = cleanValue === '' ? 0 : parseFloat(cleanValue);
        if (isNaN(updatedValue)) updatedValue = 0;
      } else if (name === 'accountNumber') {
        // Strip anything that isn't a digit
        updatedValue = value.replace(/\D/g, '').slice(0, 8);
      } else {
        updatedValue = type === 'number' ? parseFloat(value) : value;
      }

      const updated = { ...prev, [name]: updatedValue };

      if (name === 'type') {
        updated.subType = '';
        updated.normalSide = normalSideMap[value] || 'Debit';
        updated.statementType = statementTypeMap[value] || '';
      }

      return updated;
    });
  };

  // Finds the next available account number starting from a given number
  const findAvailableAccountNumber = async (startingNumber, existingNumbers) => {
    let candidate = startingNumber;
    const prefix = startingNumber.toString()[0];
    while (existingNumbers.has(candidate.toString())) {
      candidate += 1;
      // Guard: don't exceed 8 digits
      if (candidate.toString().length > 8) return null;
      // Guard: don't cross into a different prefix
      if (candidate.toString()[0] !== prefix) return null;
    }
    return candidate.toString();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (user?.role !== 'administrator') {
      alert('Unauthorized: Only administrators are authorized to add or edit accounts.');
      return;
    }

    const expectedPrefix = prefixes[formData.type];
    if (expectedPrefix && !formData.accountNumber.toString().startsWith(expectedPrefix)) {
      alert(`Invalid Account Number. Accounts in ${formData.type} must start with ${expectedPrefix}.`);
      return;
    }

    if (!/^\d{8}$/.test(formData.accountNumber.toString())) {
      alert('Account Number must be exactly 8 digits. No letters, decimals, or special characters allowed.');
      return;
    }

    // Check for duplicate account number
    const { data: numberDuplicates } = await supabase
      .from('chartOfAccounts')
      .select('accountID')
      .eq('accountNumber', parseInt(formData.accountNumber, 10));

    const numberConflict = numberDuplicates?.filter(
      (acc) => !isEditing || acc.accountID !== parseInt(id, 10)
    );

    if (numberConflict && numberConflict.length > 0) {
      alert('An account with this account number already exists. Duplicate account numbers are not allowed.');
      return; 
    }

    // Check for duplicate account name
    const { data: nameDuplicates } = await supabase
      .from('chartOfAccounts')
      .select('accountID')
      .eq('accountName', formData.accountName.trim());

    const nameConflict = nameDuplicates?.filter(
      (acc) => !isEditing || acc.accountID !== parseInt(id, 10)
    );

    if (nameConflict && nameConflict.length > 0) {
      alert('An account with this name already exists. Duplicate account names are not allowed');
      return;
    }

    setLoading(true);
    const actorUserId = parseInt(user?.userID, 10);

    if (!Number.isFinite(actorUserId) || actorUserId <= 0) {
      alert('Unable to determine current administrator user ID.');
      setLoading(false);
      return;
    }

    // Check subcategory validity
    const validSubcategories = subcategoriesMap[formData.type] || [];
    if (!validSubcategories.includes(formData.subType)) {
      alert(`Invalid subcategory "${formData.subType}" for category "${formData.type}". Please select a valid subcategory.`);
      setLoading(false);
      return;
    }

    // Check if account number already exists and resolve conflict
    let resolvedAccountNumber = formData.accountNumber.toString();
    if (!isEditing) {
      const { data: allAccounts, error: fetchError } = await fetchFromTable('chartOfAccounts', {
        select: 'accountNumber'
      });

      if (fetchError) {
        alert('Error checking existing account numbers. Please try again.');
        setLoading(false);
        return;
      }

      const existingNumbers = new Set(
        (allAccounts || []).map(acc => acc.accountNumber?.toString())
      );

      if (existingNumbers.has(resolvedAccountNumber)) {
        const next = await findAvailableAccountNumber(parseInt(resolvedAccountNumber, 10) + 1, existingNumbers);
        if (!next) {
          alert('No available account numbers in this range. Please choose a different subcategory or adjust the number manually.');
          setLoading(false);
          return;
        }
        resolvedAccountNumber = next;
        setFormData(prev => ({ ...prev, accountNumber: resolvedAccountNumber }));
        alert(`Account number ${formData.accountNumber} was already taken. Assigned ${resolvedAccountNumber} instead.`);
      }
    }

    const accountData = {
      accountName: formData.accountName,
      accountNumber: parseInt(resolvedAccountNumber, 10),
      description: formData.description,
      normalSide: formData.normalSide,
      type: formData.type,
      subType: formData.subType,
      initBalance: formData.initBalance,
      orderNumber: parseInt(formData.orderNumber, 10) || 0,
      active: isEditing ? formData.active : true,
      statementType: formData.statementType,
      createdBy: isEditing ? formData.createdBy : actorUserId,
      createdAt: isEditing ? formData.createdAt : new Date().toISOString()
    };

    console.log('Submitting account data to Supabase:', accountData);

    try {
      if (isEditing) {
        await updateChartAccountWithActor(parseInt(id, 10), accountData, actorUserId);
      } else {
        await createChartAccountWithActor(accountData, actorUserId);
      }

      alert(`Account ${isEditing ? 'updated' : 'added'} successfully!`);
      try {
        const { data: admins, error: adminError } = await fetchFromTable('user', {
          select: 'email, fName, lName',
          filters: { role: 'administrator' }
        });
        if (!adminError && admins) {
          const subject = `Account ${isEditing ? 'Updated' : 'Added'}: ${accountData.accountName}`;
          const message = `The following account has been ${isEditing ? 'updated' : 'added'} by ${user.fName} ${user.lName}:

Name: ${accountData.accountName}
Number: ${accountData.accountNumber}
Category: ${accountData.type}
Subcategory: ${accountData.subType}
Initial Balance: $${accountData.initBalance}
Normal Side: ${accountData.normalSide}`;
          for (const admin of admins) {
            await sendAdminEmail(admin.email, `${admin.fName} ${admin.lName}`, subject, message);
          }
        }
      } catch (emailErr) {
        console.warn('Failed to send admin notification emails:', emailErr);
      }
      navigate('/admin/chart-of-accounts');
    } catch (error) {
      console.error('Supabase submission error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }

    setLoading(false);
  };

  if (fetching) return <p>Loading account details...</p>;

  return (
    <div className="container">
      <h1>{isEditing ? 'Edit Account' : 'Add New Account'}</h1>
      <form onSubmit={handleSubmit} className="form-grid">
        <div>
          <label>Account Name:</label>
          <input
            type="text"
            name="accountName"
            value={formData.accountName}
            onChange={handleChange}
            required
            className="input-field"
          />
        </div>
        <div>
          <label>Account Number:</label>
          <input
            type="text"
            name="accountNumber"
            value={formData.accountNumber}
            onChange={handleChange}
            required
            className="input-field"
            placeholder="Auto-generated"
          />
        </div>
        <div className="span-2">
          <label>Description:</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            className="input-field"
          />
        </div>
        <div>
          <label>Normal Side:</label>
          <select name="normalSide" value={formData.normalSide} onChange={handleChange} className="input-field">
            <option value="Debit">Debit</option>
            <option value="Credit">Credit</option>
          </select>
        </div>
        <div>
          <label>Category:</label>
          <select name="type" value={formData.type} onChange={handleChange} required className="input-field">
            <option value="">Select a Category</option>
            <option value="Assets">Assets</option>
            <option value="Liabilities">Liabilities</option>
            <option value="Equity">Equity</option>
            <option value="Revenue">Revenue</option>
            <option value="Expenses">Expenses</option>
          </select>
        </div>
        <div>
          <label>Subcategory:</label>
          <select
            name="subType"
            value={formData.subType}
            onChange={handleChange}
            className="input-field"
            disabled={!formData.type}
          >
            <option value="">Select a Subcategory</option>
            {formData.type && subcategoriesMap[formData.type]?.map(sub => (
              <option key={sub} value={sub}>{sub}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Order Number:</label>
          <input
            type="number"
            name="orderNumber"
            value={formData.orderNumber}
            onChange={handleChange}
            className="input-field"
          />
        </div>
        <div>
          <label>Initial Balance:</label>
          <input
            type="text"
            name="initBalance"
            value={formatCurrency(formData.initBalance)}
            onChange={handleChange}
            className="input-field"
          />
        </div>
        <div className="span-2">
          <button type="submit" className="button" disabled={loading}>
            {loading ? 'Saving...' : 'Save Account'}
          </button>
          <button type="button" onClick={() => navigate('/admin/chart-of-accounts')} className="button" style={{ marginLeft: '10px' }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default AccountForm;