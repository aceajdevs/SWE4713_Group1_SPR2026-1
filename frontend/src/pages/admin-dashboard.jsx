import React from 'react';
import '../global.css';
import logo from '../../assets/Images/resourceDirectory/logo.png';
import { useNavigate } from 'react-router-dom';
import UserReport from '../components/admin/UserReport';
import SuspendUser from '../components/admin/SuspendUser';
import ExpiredPasswords from '../components/admin/ExpiredPasswords';
function AdminDashboard() {
  const navigate = useNavigate();

  return (
    <div>
      <h1>Administrator Dashboard</h1>

      <UserReport />
      <hr />

      <SuspendUser />
      <hr />

      <ExpiredPasswords />

    </div>
  );
}

export default AdminDashboard