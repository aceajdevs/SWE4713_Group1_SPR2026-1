import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { insertRecord, updateRecord, fetchFromTable } from '../supabaseUtils';
import '../global.css';

function AccountForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEditing = !!id;

  const [formData, setFormData] = useState({
    account_name: '',
    account_number: '',
    account_description: '',
    normal_side: 'Debit',
    category: '',
    subcategory: '',
    initial_balance: 0,
    debit: 0,
    credit: 0,
    balance: 0,
    order: '',
    statement: 'BS',
    comment: ''
  });

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEditing);

  useEffect(() => {
    if (isEditing) {
      loadAccount();
    }
  }, [id]);

  useEffect(() => {
    if (!isEditing && formData.category) {
      suggestAccountNumber(formData.category);
    }
  }, [formData.category]);

  const suggestAccountNumber = async (category) => {
    const prefixes = {
      'Assets': '1',
      'Liabilities': '2',
      'Equity': '3',
      'Revenue': '4',
      'Expenses': '5'
    };
    const prefix = prefixes[category] || '';
    if (!prefix) return;

    // Fetch existing accounts to find the next identifier
    const { data, error } = await fetchFromTable('charOfAccounts', {
      select: 'account_number'
    });

    let nextId = 1;
    if (!error && data) {
      // Filter accounts by prefix and find the max identifier (last 2 digits)
      const identifiers = data
        .map(acc => acc.account_number)
        .filter(num => num.startsWith(prefix) && num.length === 8)
        .map(num => parseInt(num.substring(6), 10))
        .filter(id => !isNaN(id));
      
      if (identifiers.length > 0) {
        nextId = Math.max(...identifiers) + 1;
      }
    }

    if (nextId > 99) {
      alert('Maximum number of accounts for this category reached (99).');
      return;
    }

    // Format: prefix (1) + zeros (5) + identifier (2) = 8 digits
    const identifierStr = nextId.toString().padStart(2, '0');
    const newAccountNumber = `${prefix}00000${identifierStr}`;

    setFormData(prev => ({
      ...prev,
      account_number: newAccountNumber
    }));
  };

  const loadAccount = async () => {
    const { data, error } = await fetchFromTable('charOfAccounts', {
      filters: { id }
    });
    if (!error && data && data.length > 0) {
      setFormData(data[0]);
    } else {
      console.error('Error fetching account:', error);
      navigate('/admin/chart-of-accounts');
    }
    setFetching(false);
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation for account number format
    const prefixes = {
      'Assets': '1',
      'Liabilities': '2',
      'Equity': '3',
      'Revenue': '4',
      'Expenses': '5'
    };
    const expectedPrefix = prefixes[formData.category];
    if (expectedPrefix && !formData.account_number.startsWith(expectedPrefix)) {
      alert(`Invalid Account Number. Accounts in ${formData.category} must start with ${expectedPrefix}.`);
      return;
    }

    if (formData.account_number.length !== 8) {
      alert('Account Number must be exactly 8 digits.');
      return;
    }

    setLoading(true);

    const accountData = {
      ...formData,
      user_id: user?.userID || 'unknown',
      added_at: isEditing ? formData.added_at : new Date().toISOString(),
      active: isEditing ? formData.active : true
    };

    let result;
    if (isEditing) {
      result = await updateRecord('charOfAccounts', id, accountData);
    } else {
      result = await insertRecord('charOfAccounts', accountData);
    }

    if (!result.error) {
      alert(`Account ${isEditing ? 'updated' : 'added'} successfully!`);
      navigate('/admin/chart-of-accounts');
    } else {
      alert(`Error: ${result.error.message}`);
    }
    setLoading(false);
  };

  if (fetching) return <p>Loading account details...</p>;

  return (
    <div className="container" style={{ padding: '20px' }}>
      <h1>{isEditing ? 'Edit Account' : 'Add New Account'}</h1>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div>
          <label>Account Name:</label>
          <input
            type="text"
            name="account_name"
            value={formData.account_name}
            onChange={handleChange}
            required
            className="input-field"
          />
        </div>
        <div>
          <label>Account Number:</label>
          <input
            type="text"
            name="account_number"
            value={formData.account_number}
            onChange={handleChange}
            required
            className="input-field"
            placeholder="Auto-generated"
            readOnly
          />
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <label>Description:</label>
          <textarea
            name="account_description"
            value={formData.account_description}
            onChange={handleChange}
            className="input-field"
          />
        </div>
        <div>
          <label>Normal Side:</label>
          <select name="normal_side" value={formData.normal_side} onChange={handleChange} className="input-field">
            <option value="Debit">Debit</option>
            <option value="Credit">Credit</option>
          </select>
        </div>
        <div>
          <label>Category:</label>
          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
            required
            className="input-field"
          >
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
          <input
            type="text"
            name="subcategory"
            value={formData.subcategory}
            onChange={handleChange}
            className="input-field"
            placeholder="e.g., Current Assets"
          />
        </div>
        <div>
          <label>Initial Balance:</label>
          <input
            type="number"
            step="0.01"
            name="initial_balance"
            value={formData.initial_balance}
            onChange={handleChange}
            className="input-field"
          />
        </div>
        <div>
          <label>Debit:</label>
          <input
            type="number"
            step="0.01"
            name="debit"
            value={formData.debit}
            onChange={handleChange}
            className="input-field"
          />
        </div>
        <div>
          <label>Credit:</label>
          <input
            type="number"
            step="0.01"
            name="credit"
            value={formData.credit}
            onChange={handleChange}
            className="input-field"
          />
        </div>
        <div>
          <label>Current Balance:</label>
          <input
            type="number"
            step="0.01"
            name="balance"
            value={formData.balance}
            onChange={handleChange}
            className="input-field"
          />
        </div>
        <div>
          <label>Order:</label>
          <input
            type="text"
            name="order"
            value={formData.order}
            onChange={handleChange}
            className="input-field"
            placeholder="e.g., 01"
          />
        </div>
        <div>
          <label>Statement:</label>
          <select name="statement" value={formData.statement} onChange={handleChange} className="input-field">
            <option value="IS">Income Statement</option>
            <option value="BS">Balance Sheet</option>
            <option value="RE">Retained Earnings</option>
          </select>
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <label>Comment:</label>
          <textarea
            name="comment"
            value={formData.comment}
            onChange={handleChange}
            className="input-field"
          />
        </div>
        <div style={{ gridColumn: 'span 2' }}>
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
