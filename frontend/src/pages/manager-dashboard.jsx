import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../global.css';
import UserReport from '../components/admin/UserReport';
import SuspendUser from '../components/admin/SuspendUser';
import ExpiredPasswords from '../components/admin/ExpiredPasswords';

function ManagerDashboard() {
  const navigate = useNavigate();

  return (
    <div>
      <h1>Manager Dashboard</h1>

      <div style={{ marginBottom: '16px' }}>
        <button onClick={() => navigate('/admin/edit-user')} style={{ marginRight: '8px' }}>
          Edit User
        </button>
        <button onClick={() => navigate('/admin/chart-of-accounts')}>
          Chart of Accounts
        </button>
      </div>

      <UserReport />
      <hr />

      <SuspendUser />
      <hr />

      <ExpiredPasswords />
    </div>
  );
}

export default ManagerDashboard;