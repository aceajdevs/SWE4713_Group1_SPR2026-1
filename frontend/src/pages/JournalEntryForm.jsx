import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { fetchFromTable } from '../supabaseUtils';
import { createJournalEntry, uploadJournalAttachment } from '../services/journalService';
import {
  validateJournalEntry,
  validateAttachmentType,
  ALLOWED_EXTENSIONS,
} from '../utils/journalValidation';
import { HelpTooltip } from '../components/HelpTooltip';
import '../global.css';

const emptyLine = () => ({ accountID: '', debit: '', credit: '' });

function JournalEntryForm() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [lines, setLines] = useState([emptyLine(), emptyLine()]);
  const [entryType, setEntryType] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [errors, setErrors] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const canCreate = user?.role === 'accountant' || user?.role === 'manager';

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    const { data, error } = await fetchFromTable('chartOfAccounts', {
      filters: { active: true },
      orderBy: { column: 'accountNumber', ascending: true },
    });
    if (!error && data) {
      setAccounts(data);
    }
    setLoading(false);
  };

  const updateLine = (index, field, value) => {
    setLines((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (field === 'debit' && parseFloat(value) > 0) {
        updated[index].credit = '';
      }
      if (field === 'credit' && parseFloat(value) > 0) {
        updated[index].debit = '';
      }
      return updated;
    });
    if (errors.length > 0) setErrors([]);
  };

  const addLine = () => {
    setLines((prev) => [...prev, emptyLine()]);
  };

  const removeLine = (index) => {
    if (lines.length <= 2) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddAttachment = (e) => {
    const files = Array.from(e.target.files);
    const newErrors = [];

    files.forEach((file) => {
      const check = validateAttachmentType(file);
      if (!check.valid) {
        newErrors.push(...check.errors);
      } else {
        setAttachments((prev) => [...prev, file]);
      }
    });

    if (newErrors.length > 0) {
      setErrors((prev) => [...prev, ...newErrors]);
    }

    e.target.value = '';
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleReset = () => {
    setLines([emptyLine(), emptyLine()]);
    setEntryType('');
    setAttachments([]);
    setErrors([]);
  };

  const handleSubmit = async () => {
    const validation = validateJournalEntry(lines, accounts);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setSubmitting(true);
    setErrors([]);

    try {
      const entry = await createJournalEntry({
        entryType,
        createdBy: user.userID,
        lines: lines.map((l) => ({
          accountID: parseInt(l.accountID, 10),
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0,
        })),
      });

      for (const file of attachments) {
        await uploadJournalAttachment(entry.journalEntryID, file);
      }

      alert('Journal entry submitted successfully!');
      navigate('/journal-entries');
    } catch (err) {
      console.error('Submit error:', err);
      setErrors([`Failed to submit: ${err.message}`]);
    } finally {
      setSubmitting(false);
    }
  };

  const totalDebits = lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const totalCredits = lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.005;

  if (!canCreate) {
    return <p style={{ color: 'red' }}>You do not have permission to create journal entries.</p>;
  }

  if (loading) return <p>Loading accounts...</p>;

  return (
    <div className="container">
      <h1>New Journal Entry</h1>

      {errors.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          {errors.map((err, i) => (
            <p key={i} style={{ color: 'red', margin: '4px 0' }}>{err}</p>
          ))}
        </div>
      )}

      <div style={{ marginBottom: '16px' }}>
        <label>Entry Type:</label>
        <HelpTooltip text="Classify this entry (e.g. Regular, Adjusting, Closing).">
          <input
            type="text"
            value={entryType}
            onChange={(e) => setEntryType(e.target.value)}
            placeholder="e.g. Regular, Adjusting, Closing"
            className="input-field"
            style={{ width: '100%' }}
          />
        </HelpTooltip>
      </div>

      <table className="user-report-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Account</th>
            <th>Debit</th>
            <th>Credit</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr key={index}>
              <td>{index + 1}</td>
              <td>
                <HelpTooltip text="Select an active account from the chart of accounts.">
                  <select
                    value={line.accountID}
                    onChange={(e) => updateLine(index, 'accountID', e.target.value)}
                    className="input-field"
                  >
                    <option value="">Select account</option>
                    {accounts
                    .filter((acc) => {
                      // Keep this account if it's the one already selected on this line,
                      // or if no other line has selected it
                      const selectedByOtherLine = lines.some(
                        (l, i) => i !== index && String(l.accountID) === String(acc.accountID)
                      );
                      return !selectedByOtherLine;
                    })
                    .map((acc) => (
                      <option key={acc.accountID} value={acc.accountID}>
                        {acc.accountNumber} - {acc.accountName}
                      </option>
                    ))}
                  </select>
                </HelpTooltip>
              </td>
              <td>
                <HelpTooltip text="Enter the debit amount. Cannot have both debit and credit on the same line.">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.debit}
                    onChange={(e) => updateLine(index, 'debit', e.target.value)}
                    placeholder="0.00"
                    className="input-field"
                    disabled={parseFloat(line.credit) > 0}
                  />
                </HelpTooltip>
              </td>
              <td>
                <HelpTooltip text="Enter the credit amount. Cannot have both debit and credit on the same line.">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.credit}
                    onChange={(e) => updateLine(index, 'credit', e.target.value)}
                    placeholder="0.00"
                    className="input-field"
                    disabled={parseFloat(line.debit) > 0}
                  />
                </HelpTooltip>
              </td>
              <td>
                <HelpTooltip text="Remove this line. At least two lines are required.">
                  <button
                    type="button"
                    onClick={() => removeLine(index)}
                    disabled={lines.length <= 2}
                    style={{ color: 'red' }}
                  >
                    Remove
                  </button>
                </HelpTooltip>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight: 'bold' }}>
            <td colSpan={2}>Totals</td>
            <td style={{ color: isBalanced ? 'inherit' : 'red' }}>
              ${totalDebits.toFixed(2)}
            </td>
            <td style={{ color: isBalanced ? 'inherit' : 'red' }}>
              ${totalCredits.toFixed(2)}
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      <div style={{ margin: '16px 0', display: 'flex', gap: '10px' }}>
        <HelpTooltip text="Add another debit or credit line to this journal entry.">
          <button type="button" onClick={addLine} className="button">
            Add Line
          </button>
        </HelpTooltip>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label>
          <strong>Attachments</strong> (allowed: {ALLOWED_EXTENSIONS.join(', ')}):
        </label>
        <HelpTooltip text="Attach source documents such as receipts, invoices, or supporting files.">
          <input
            type="file"
            multiple
            onChange={handleAddAttachment}
            accept={ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',')}
            style={{ display: 'block', marginTop: '8px' }}
          />
        </HelpTooltip>
        {attachments.length > 0 && (
          <ul style={{ marginTop: '8px' }}>
            {attachments.map((file, i) => (
              <li key={i}>
                {file.name}{' '}
                <button type="button" onClick={() => removeAttachment(i)} style={{ color: 'red', marginLeft: '8px' }}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <HelpTooltip text="Validate and submit this journal entry for manager approval.">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="button"
          >
            {submitting ? 'Submitting...' : 'Submit Journal Entry'}
          </button>
        </HelpTooltip>
        <HelpTooltip text="Clear all fields and start over. This will not delete a submitted entry.">
          <button type="button" onClick={handleReset} className="button" style={{ backgroundColor: '#eee', color: '#333' }}>
            Reset / Cancel
          </button>
        </HelpTooltip>
        <HelpTooltip text="View all journal entries and their approval status.">
          <button type="button" onClick={() => navigate('/journal-entries')} className="button">
            View Journal Entries
          </button>
        </HelpTooltip>
      </div>
    </div>
  );
}

export default JournalEntryForm;
