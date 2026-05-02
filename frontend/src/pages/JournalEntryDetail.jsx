import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import {
  getJournalEntryWithLines,
  getJournalAttachments,
  getJournalAttachmentSignedUrl,
} from '../services/journalService';
import { fetchFromTable } from '../supabaseUtils';
import { HelpTooltip } from '../components/HelpTooltip';
import { getJournalEntryTypeLabel } from '../utils/journalEntryTypes';
import { getErrorMessage, logErrorWithCode, ERROR_IDS } from '../services/errorMessages';
import '../global.css';

function JournalEntryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canOpenLedger = user?.role !== 'administrator';

  const [entry, setEntry] = useState(null);
  const [lines, setLines] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [attachmentRows, setAttachmentRows] = useState([]);
  const [accountMap, setAccountMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadEntry();
  }, [id]);

  const loadEntry = async () => {
    setLoading(true);
    setError(null);
    setAttachmentRows([]);

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!attachments.length) {
        setAttachmentRows([]);
        return;
      }
      const rows = await Promise.all(
        attachments.map(async (att) => {
          const name = att.filePath?.split('/').pop() || 'attachment';
          try {
            const url = await getJournalAttachmentSignedUrl(att.filePath, 3600);
            return {
              id: att.jAttachmentID,
              name,
              url,
              fileType: att.fileType || '',
              uploadedAt: att.uploadedAt,
              error: !url,
            };
          } catch {
            return {
              id: att.jAttachmentID,
              name,
              url: null,
              fileType: att.fileType || '',
              uploadedAt: att.uploadedAt,
              error: true,
            };
          }
        }),
      );
      if (!cancelled) setAttachmentRows(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [attachments]);

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
        <p><strong>Entry Type:</strong> {getJournalEntryTypeLabel(entry.entryType, { emptyLabel: 'N/A' })}</p>
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
      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Account</th>
            <th className='money'>Debit</th>
            <th className='money'>Credit</th>
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
                    canOpenLedger ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/ledger/${acc.accountNumber}`)}
                        style={{ background: 'none', border: 'none', color: '#0066cc', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        {acc.accountNumber} - {acc.accountName}
                      </button>
                    ) : (
                      <span>{acc.accountNumber} - {acc.accountName}</span>
                    )
                  ) : (
                    `Account ID: ${line.accountID}`
                  )}
                </td>
                <td className='money'>{Number(line.debit) > 0 ? formatCurrency(line.debit) : '-'}</td>
                <td className='money'>{Number(line.credit) > 0 ? formatCurrency(line.credit) : '-'}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight: 'bold', borderTop: '2px solid #333' }}>
            <td colSpan={2}>Totals</td>
            <td className='money'>{formatCurrency(totalDebits)}</td>
            <td className='money'>{formatCurrency(totalCredits)}</td>
          </tr>
        </tfoot>
      </table>

      <h2 style={{ marginTop: '28px' }}>Attachments</h2>
      {attachments.length === 0 ? (
        <p style={{ color: 'var(--bff-dark-text)' }}>No files attached to this entry.</p>
      ) : attachmentRows.length !== attachments.length ? (
        <p style={{ color: 'var(--bff-dark-text)' }}>Loading attachment links…</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxWidth: '720px' }}>
          {attachmentRows.map((row) => {
            const isImage = /^image\//i.test(row.fileType);
            return (
              <li
                key={row.id}
                style={{
                  border: '1px solid var(--bff-secondary, #D1D5DB)',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  marginBottom: '12px',
                  background: 'var(--bff-light-text, #fff)',
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
                  <strong>{row.name}</strong>
                  {row.fileType ? (
                    <span style={{ fontSize: '0.9rem', color: 'var(--bff-dark-text)' }}>{row.fileType}</span>
                  ) : null}
                  {row.uploadedAt ? (
                    <span style={{ fontSize: '0.85rem', color: 'var(--bff-dark-text)' }}>
                      Uploaded: {row.uploadedAt}
                    </span>
                  ) : null}
                </div>
                {row.error || !row.url ? (
                  <p style={{ margin: '8px 0 0', color: 'var(--bff-red)', fontSize: '0.9rem' }}>
                    Could not create a download link. Check that the file exists in Storage and policies allow read access.
                  </p>
                ) : (
                  <>
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link"
                      style={{ display: 'inline-block', marginTop: '8px' }}
                    >
                      Open / download
                    </a>
                    {isImage ? (
                      <div style={{ marginTop: '10px' }}>
                        <img
                          src={row.url}
                          alt={row.name}
                          style={{ maxWidth: '100%', maxHeight: '320px', objectFit: 'contain', borderRadius: '4px' }}
                        />
                      </div>
                    ) : null}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default JournalEntryDetail;
