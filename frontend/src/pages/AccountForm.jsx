import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { supabase } from '../supabaseClient';
import {
  createChartAccountWithActor,
  updateChartAccountWithActor,
} from '../services/chartOfAccountsService';
import '../global.css';

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

  const subcategoriesMap = {
    'Assets': ['Current Assets', 'Fixed Assets', 'Intangible Assets', 'Other Assets'],
    'Liabilities': ['Current Liabilities', 'Long-term Liabilities', 'Other Liabilities'],
    'Equity': ["Owner's Equity", 'Retained Earnings', 'Common Stock'],
    'Revenue': ['Operating Revenue', 'Non-operating Revenue'],
    'Expenses': ['Operating Expenses', 'Non-operating Expenses', 'Administrative Expenses', 'Financial Expenses']
  };

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEditing);

  useEffect(() => {
    if (user && user.role !== 'administrator') {
      alert('Unauthorized: Access to this page is restricted to administrators.');
      navigate('/admin/chart-of-accounts');
      return;
    }
    if (isEditing) {
      loadAccount();
    }
  }, [id, user, navigate]);

  useEffect(() => {
    if (isEditing && formData.type && !formData.statementType) {
      const statementTypeMap = {
        'Assets': 'Balance Sheet',
        'Liabilities': 'Balance Sheet',
        'Equity': 'Balance Sheet',
        'Revenue': 'Income Statement',
        'Expenses': 'Income Statement'
      };
      const autoStatementType = statementTypeMap[formData.type] || '';
      if (autoStatementType) {
        setFormData(prev => ({ ...prev, statementType: autoStatementType }));
      }
    }
  }, [isEditing, formData.type, formData.statementType]);

  useEffect(() => {
    if (!isEditing && formData.type && formData.subType) {
      suggestAccountNumber(formData.type, formData.subType);
    }
  }, [formData.type, formData.subType]);

  const suggestAccountNumber = async (type, subType) => {
    const prefixes = {
      'Assets': '1',
      'Liabilities': '2',
      'Equity': '3',
      'Revenue': '4',
      'Expenses': '5'
    };
    const prefix = prefixes[type] || '';
    if (!prefix) return;

    // Determine subType index to find the starting point (e.g., 00, 25, 50, 75)
    const subcategories = subcategoriesMap[type] || [];
    const subIdx = subcategories.indexOf(subType);
    if (subIdx === -1) return; // Wait for subType selection

    const baseOffset = subIdx * 25;

    // Fetch existing accounts to find the next identifier
    const { data, error } = await supabase
      .from('chartOfAccounts')
      .select('accountNumber');

    let nextId = Math.max(subIdx * 25, 1);
    if (!error && data) {
      const identifiers = data
        .map(acc => acc.accountNumber?.toString())
        .filter(num => num && num.startsWith(prefix) && num.length === 8)
        .map(num => parseInt(num.substring(1), 10))
        .filter(id => id >= nextId && id < (subIdx * 25) + 25);
      
      if (identifiers.length > 0) {
        nextId = Math.max(...identifiers) + 1;
      }
    }

    if (nextId >= (subIdx * 25) + 25) {
      alert(`Maximum number of accounts for this subType reached (24 or 25).`);
      return;
    }

    // Format: prefix (1) + zeros (as needed) + identifier = 8 digits
    const identifierStr = nextId.toString().padStart(7, '0');
    const newAccountNumber = `${prefix}${identifierStr}`;

    setFormData(prev => ({
      ...prev,
      accountNumber: newAccountNumber
    }));
  };

  const loadAccount = async () => {
    const { data, error } = await supabase
      .from('chartOfAccounts')
      .select('*')
      .eq('accountID', id)
      .single();
    
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
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(number);
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    
    // Check if the input is a monetary field
    const monetaryFields = ['initBalance'];
    
    setFormData(prev => {
      let updatedValue;
      if (monetaryFields.includes(name)) {
        // Remove commas before saving to state as a number
        const cleanValue = typeof value === 'string' ? value.replace(/,/g, '') : value;
        updatedValue = cleanValue === '' ? 0 : parseFloat(cleanValue);
        if (isNaN(updatedValue)) updatedValue = 0;
      } else {
        updatedValue = type === 'number' ? parseFloat(value) : value;
      }

      const updated = {
        ...prev,
        [name]: updatedValue
      };
      
      // If type changes, reset subType and set normalSide
      if (name === 'type') {
        updated.subType = '';
        const normalSideMap = {
          'Assets': 'Debit',
          'Liabilities': 'Credit',
          'Equity': 'Credit',
          'Revenue': 'Credit',
          'Expenses': 'Debit'
        };
        updated.normalSide = normalSideMap[value] || 'Debit';

        // Automatically set statementType based on account type
        const statementTypeMap = {
          'Assets': 'Balance Sheet',
          'Liabilities': 'Balance Sheet',
          'Equity': 'Balance Sheet',
          'Revenue': 'Income Statement',
          'Expenses': 'Income Statement'
        };
        updated.statementType = statementTypeMap[value] || '';
      }
      
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Check if the user is an admin before submitting
    if (user?.role !== 'administrator') {
      alert('Unauthorized: Only administrators are authorized to add or edit accounts.');
      return;
    }
    
    // Validation for account number format
    const prefixes = {
      'Assets': '1',
      'Liabilities': '2',
      'Equity': '3',
      'Revenue': '4',
      'Expenses': '5'
    };
    const expectedPrefix = prefixes[formData.type];
    if (expectedPrefix && !formData.accountNumber.toString().startsWith(expectedPrefix)) {
      alert(`Invalid Account Number. Accounts in ${formData.type} must start with ${expectedPrefix}.`);
      return;
    }

    if (formData.accountNumber.toString().length !== 8) {
      alert('Account Number must be exactly 8 digits.');
      return;
    }

    setLoading(true);
    const actorUserId = parseInt(user?.userID, 10);

    if (!Number.isFinite(actorUserId) || actorUserId <= 0) {
      alert('Unable to determine current administrator user ID.');
      setLoading(false);
      return;
    }

    const accountData = {
      accountName: formData.accountName,
      accountNumber: parseInt(formData.accountNumber, 10),
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
      navigate('/admin/chart-of-accounts');
    } catch (error) {
      console.error('Supabase submission error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
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
          <select
            name="type"
            value={formData.type}
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
