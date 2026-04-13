import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { fetchFromTable } from '../supabaseUtils';
import { createJournalEntry, uploadJournalAttachment } from '../services/journalService';
import {
  getErrorMessagesByIds,
  getErrorMessage,
  resolveThrownErrorMessage,
  logErrorWithCode,
  ERROR_IDS,
  ERROR_FALLBACK,
} from '../services/errorMessages';
import {
  validateJournalEntry,
  validateAttachmentType,
  ALLOWED_EXTENSIONS,
} from '../utils/journalValidation';
import { HelpTooltip } from '../components/HelpTooltip';
import '../global.css';

const emptyLine = () => ({ accountID: '', debit: '', credit: '' });

function PermissionDeniedMessage() {
  const [text, setText] = useState(() => ERROR_FALLBACK[ERROR_IDS.NO_PERMISSION_CREATE_JOURNAL]);
  useEffect(() => {
    getErrorMessage(ERROR_IDS.NO_PERMISSION_CREATE_JOURNAL).then(setText);
  }, []);
  return <p style={{ color: 'red' }}>{text}</p>;
}

function JournalEntryForm() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [lines, setLines] = useState([emptyLine(), emptyLine()]);
  const [entryType, setEntryType] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [errors, setErrors] = useState([]);
  const [validationMessages, setValidationMessages] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
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

  const runValidation = async () => {
    const validation = validateJournalEntry(lines, accounts);
    const fieldMap = {};

    if (!entryType) {
      validation.valid = false;
      validation.errors.push({
        errorID: '1009',
        code: '1009',
        field: 'entryType',
      });
      fieldMap.entryType = true;
    }

    validation.errors.forEach((err) => {
      if (err?.field) {
        fieldMap[err.field] = true;
      }
      if (err?.field === 'line') {
        // line-level markers apply to every line input
        for (let i = 0; i < lines.length; i += 1) {
          fieldMap[`line-${i}-accountID`] = true;
          fieldMap[`line-${i}-debit`] = true;
          fieldMap[`line-${i}-credit`] = true;
        }
      }
    });

    setFieldErrors(fieldMap);

    if (!validation.valid) {
      const errorIDs = [...new Set(validation.errors.map((e) => (e.errorID || e.code)).filter(Boolean))];
      const dbMessages = await getErrorMessagesByIds(errorIDs);

      const formattedMessages = await Promise.all(
        validation.errors.map(async (err) => {
          const code = err.code || err.errorID || 'UNKNOWN';
          const lineNumber =
            err.lineIndex !== undefined && err.lineIndex !== null
              ? err.lineIndex
              : (err.field?.match(/^line-(\d+)-/) || [])[1];
          const linePart = lineNumber ? `Line ${lineNumber} - ` : '';
          const key = String(err.errorID || err.code);
          let baseMessage =
            dbMessages[key] || ERROR_FALLBACK[Number(key)] || (await getErrorMessage(ERROR_IDS.UNEXPECTED));
          if ((key === '1005' || Number(key) === 1005) && err.detail) {
            const d = err.detail;
            baseMessage += ` Debits: ($${d.totalDebits.toFixed(2)}) Credits: ($${d.totalCredits.toFixed(2)}). Difference: $${d.diffDollars.toFixed(2)}.`;
          }
          return `${code}: ${linePart}${baseMessage}`;
        })
      );

      setValidationMessages(formattedMessages);
      return false;
    }

    setValidationMessages([]);
    return true;
  };

  useEffect(() => {
    runValidation();
  }, [lines, entryType, accounts]);

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

  const handleAddAttachment = async (e) => {
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
      const lines = await Promise.all(
        newErrors.map(async (e) => {
          const base = await getErrorMessage(ERROR_IDS.ATTACHMENT_TYPE_INVALID);
          if (e.fileName) {
            return `${base} (${e.fileName}). Allowed: ${e.allowedHint}.`;
          }
          return base;
        })
      );
      setErrors((prev) => [...prev, ...lines]);
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
    setValidationMessages([]);
    setFieldErrors({});
  };

  const handleSubmit = async () => {
    if (!entryType) {
      setFieldErrors((prev) => ({ ...prev, entryType: true }));
      setValidationMessages([await getErrorMessage(ERROR_IDS.ENTRY_TYPE_REQUIRED)]);
      return;
    }

    const isValid = await runValidation();
    if (!isValid) {
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
      const id = err?.errorID ?? ERROR_IDS.SUBMIT_JOURNAL_FAILED;
      await logErrorWithCode(id, err);
      setErrors([await resolveThrownErrorMessage(err, ERROR_IDS.SUBMIT_JOURNAL_FAILED)]);
    } finally {
      setSubmitting(false);
    }
  };

  const totalDebits = lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const totalCredits = lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.005;

  if (!canCreate) {
    return <PermissionDeniedMessage />;
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
        <HelpTooltip text="Classify this entry (e.g. Regular, Adjusting, Closing).">
          <select
            value={entryType}
            onChange={(e) => setEntryType(e.target.value)}
            className={`input ${fieldErrors.entryType ? 'input-error' : ''}`}
            style={{ width: '100%' }}
          >
            <option value="">Select entry type</option>
            <option value="1">Regular</option>
            <option value="2">Adjusting</option>
            <option value="3">Closing</option>
          </select>
        </HelpTooltip>
      </div>

      <table className="table">
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
                    className={`input ${fieldErrors[`line-${index}-accountID`] ? 'input-error' : ''}`}
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
                    className={`input ${fieldErrors[`line-${index}-debit`] && !(parseFloat(line.credit) > 0) ? 'input-error' : ''}`}
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
                    className={`input ${fieldErrors[`line-${index}-credit`] && !(parseFloat(line.debit) > 0) ? 'input-error' : ''}`}
                    disabled={parseFloat(line.debit) > 0}
                  />
                </HelpTooltip>
              </td>
              <td>
                {lines.length > 2 && (
                  <HelpTooltip text="Remove this line. At least two lines are required.">
                    <button
                      type="button-table"
                      onClick={() => removeLine(index)}
                    >
                      Remove
                    </button>
                  </HelpTooltip>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight: 'bold' }}>
            <td colSpan={2}>Totals</td>
            <td className='money' style={{ color: isBalanced ? 'inherit' : 'var(--color-error)' }}>
              ${totalDebits.toFixed(2)}
            </td>
            <td className='money' style={{ color: isBalanced ? 'inherit' : 'var(--color-error)' }}>
              ${totalCredits.toFixed(2)}
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      <div style={{ margin: '16px 0', display: 'flex', gap: '10px' }}>
        <HelpTooltip text="Add another debit or credit line to this journal entry.">
          <button type="button" onClick={addLine} className="button-primary">
            Add Line
          </button>
        </HelpTooltip>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label>
          <strong>Attachments</strong> (allowed: {ALLOWED_EXTENSIONS.join(', ')}):
        </label>
        <HelpTooltip text="Attach source documents such as receipts, invoices, or supporting files.">
          <label
            className="button-primary"
            style={{ display: 'inline-flex', alignItems: 'center', marginTop: '8px', marginLeft: '12px',cursor: 'pointer' }}
          >
            Browse...
            <input
              type="file"
              multiple
              onChange={handleAddAttachment}
              accept={ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',')}
              style={{ display: 'none' }}
            />
          </label>
        </HelpTooltip>
        {attachments.length > 0 && (
          <ul style={{ marginTop: '8px' }}>
            {attachments.map((file, i) => (
              <li key={i}>
                {file.name}{' '}
                <button type="button" onClick={() => removeAttachment(i)} className="button-secondary">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {validationMessages.length > 0 && (
        <div className="error-messages" style={{ color: 'var(--bff-red)', marginBottom: '12px' }}>
          <ul>
            {validationMessages.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px' }}>
        <HelpTooltip text="Validate and submit this journal entry for manager approval.">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="button-primary"
          >
            {submitting ? 'Submitting...' : 'Submit Journal Entry'}
          </button>
        </HelpTooltip>
        <HelpTooltip text="Clear all fields and start over. This will not delete a submitted entry.">
          <button type="button" onClick={handleReset} className="button-primary">
            Reset
          </button>
        </HelpTooltip>
        <HelpTooltip text="View all journal entries and their approval status.">
          <button type="button" onClick={() => navigate('/journal-entries')} className="button-primary">
            Back to View Journal Entries
          </button>
        </HelpTooltip>
      </div>
    </div>
  );
}

export default JournalEntryForm;
