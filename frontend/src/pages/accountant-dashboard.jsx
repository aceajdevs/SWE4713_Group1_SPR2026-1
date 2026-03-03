import React from 'react';
import '../global.css';
import logo from '../../assets/Images/resourceDirectory/logo.png';
import { useNavigate } from 'react-router-dom';

function AccountantDashboard() {
  const navigate = useNavigate();

  return (
    <div className="dashboard-page">
      <header className="login-header">
      </header>

      <main className="dashboard-main">
        <div className="dashboard-card">
          <div className="dashboard-header">
            <h1>Dashboard</h1>
            <p className="muted">Welcome to the Better Financial Future Accountant Dashboard.  Here is where the stuff will go</p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default AccountantDashboard;