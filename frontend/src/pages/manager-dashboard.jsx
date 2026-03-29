import React from 'react';
import '../global.css';
import './manager-dashboard.css';
import { useNavigate } from 'react-router-dom';

function ManagerDashboard() {

  const navigate = useNavigate();
  
  return (
    <main className="dashboard-main">
      <div className="dashboard-card">
        <div className="dashboard-header">
          <h1>Manager Dashboard</h1>
          <p className="muted">Welcome! Select a service below.</p>
        </div>
        <div className="dashboard-buttons">
          <button className="button-primary" onClick={() => navigate('/journal-entry/new')}>
            New Journal Entry
          </button>
          <button className="button-primary" onClick={() => navigate('/journal-entries')}>
            Review Journal Entries
          </button>
          <button className="button-primary" onClick={() => navigate('/admin/chart-of-accounts')}>
            Chart of Accounts
          </button>
        </div>
      </div>
  </main>
  );
}

export default ManagerDashboard;