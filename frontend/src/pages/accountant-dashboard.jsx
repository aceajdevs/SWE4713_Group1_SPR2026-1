import '../global.css';
import { useNavigate } from 'react-router-dom';

function AccountantDashboard() {
  const navigate = useNavigate();
  
  return (
    <main className="dashboard-main">
      <div className="dashboard-card">
        <div className="dashboard-header">
          <h1>Accountant Dashboard</h1>
          <p className="muted">Welcome! Select a service below.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
          <button className="button" onClick={() => navigate('/journal-entry/new')}>
            New Journal Entry
          </button>
          <button className="button" onClick={() => navigate('/journal-entries')}>
            View Journal Entries
          </button>
          <button className="button" onClick={() => navigate('/admin/chart-of-accounts')}>
            Chart of Accounts
          </button>
        </div>
      </div>
  </main>
  );
}

export default AccountantDashboard;