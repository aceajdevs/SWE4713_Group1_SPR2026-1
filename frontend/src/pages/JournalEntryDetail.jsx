import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { getJournalEntryWithLines, getJournalAttachments } from '../services/journalService';
import { fetchFromTable } from '../supabaseUtils';
import { HelpTooltip } from '../components/HelpTooltip';
import { getErrorMessage, logErrorWithCode, ERROR_IDS } from '../services/errorMessages';
import '../global.css';

function JournalEntryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [entry, setEntry] = useState(null);
  const [lines, setLines] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [accountMap, setAccountMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadEntry();
  }, [id]);

  const loadEntry = async () => {
    setLoading(true);
    setError(null);

    try {
      const { entry: entryData, lines: lineData } = await getJournalEntryWithLines(parseInt(id, 10));
      setEntry(entryData);
      setLines(lineData);

      // Load account names for all lines
      const accountIds = [...new Set(lineData.map((l) => l.accountID))];
      if (accountIds.length > 0) {
        const { data: accounts } = await fetchFromTable('chartOfAccounts', {
          select: 'accountID, accountName, accountNumber',
        });
        if (accounts) {
          const map = {};
          accounts.forEach((a) => { map[a.accountID] = a; });
          setAccountMap(map);
        }
      }

      // Load attachments
      try {
        const attachData = await getJournalAttachments(parseInt(id, 10));
        setAttachments(attachData);
      } catch (attErr) {
        await logErrorWithCode(ERROR_IDS.LOAD_JOURNAL_ENTRY_FAILED, attErr);
      }
    } catch (err) {
      await logErrorWithCode(err?.errorID ?? ERROR_IDS.JOURNAL_NOT_FOUND, err);
      setError(await getErrorMessage(err?.errorID ?? ERROR_IDS.JOURNAL_NOT_FOUND));
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    if (!value && value !== 0) return '-';
    return `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (value) => {
    if (!value) return 'N/A';
    return new Date(value).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const statusColor = (status) => {
    if (status === 'approved') return 'green';
    if (status === 'rejected') return 'red';
    return '#c58b00';
  };

  const entryTypeLabel = (val) => {
    const map = { 1: 'Regular', 2: 'Adjusting', 3: 'Closing' };
    return map[val] || val || 'N/A';
  };

  if (loading) return <p>Loading journal entry...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;
  if (!entry) return <p>Entry not found.</p>;

  const totalDebits = lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
  const totalCredits = lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);

  return (
    <div className="container">
      <div className="header-row">
        <h1>Journal Entry #{entry.journalEntryID}</h1>
        <HelpTooltip text="Return to the journal entries list.">
          <button type="button" onClick={() => navigate('/journal-entries')} className="button-primary" style={{ marginLeft: '16px' }}>
            Back to Journal Entries
          </button>
        </HelpTooltip>
      </div>

      <div style={{ marginBottom: '24px', lineHeight: '1.8' }}>
        <p><strong>Entry Type:</strong> {entryTypeLabel(entry.entryType)}</p>
        <p><strong>Created:</strong> {formatDate(entry.createdAt)}</p>
        <p><strong>Created By:</strong> User {entry.createdBy}</p>
        <p>
          <strong>Status:</strong>{' '}
          <span style={{ color: statusColor(entry.status), fontWeight: 'bold' }}>
            {entry.status}
          </span>
        </p>
        {entry.status === 'approved' && (
          <>
            <p><strong>Approved By:</strong> User {entry.approvedBy}</p>
            <p><strong>Approved At:</strong> {formatDate(entry.approvedAt)}</p>
          </>
        )}
        {entry.status === 'rejected' && entry.rejectReason && (
          <p><strong>Rejection Reason:</strong> <span style={{ color: 'red' }}>{entry.rejectReason}</span></p>
        )}
      </div>

      <h2>Lines</h2>
      <table className="user-report-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Account</th>
            <th>Debit</th>
            <th>Credit</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => {
            const acc = accountMap[line.accountID];
            return (
              <tr key={line.lineID || index}>
                <td>{index + 1}</td>
                <td>
                  {acc ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/admin/ledger/${acc.accountNumber}`)}
                      style={{ background: 'none', border: 'none', color: '#0066cc', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      {acc.accountNumber} - {acc.accountName}
                    </button>
                  ) : (
                    `Account ID: ${line.accountID}`
                  )}
                </td>
                <td>{Number(line.debit) > 0 ? formatCurrency(line.debit) : '-'}</td>
                <td>{Number(line.credit) > 0 ? formatCurrency(line.credit) : '-'}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight: 'bold', borderTop: '2px solid #333' }}>
            <td colSpan={2}>Totals</td>
            <td>{formatCurrency(totalDebits)}</td>
            <td>{formatCurrency(totalCredits)}</td>
          </tr>
        </tfoot>
      </table>

      {attachments.length > 0 && (
        <>
          <h2 style={{ marginTop: '24px' }}>Attachments</h2>
          <ul>
            {attachments.map((att, i) => (
              <li key={att.jAttachmentID || i}>
                {att.filePath?.split('/').pop() || 'File'} ({att.fileType || 'unknown'})
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default JournalEntryDetail;
