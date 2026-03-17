import '../global.css';
import { useNavigate } from 'react-router-dom';
import UserReport from '../components/admin/UserReport';
import SuspendUser from '../components/admin/SuspendUser';
import ExpiredPasswords from '../components/admin/ExpiredPasswords';

function AdminDashboard() {
  const navigate = useNavigate();


  return (
    <div>
      <h1>Administrator Dashboard</h1>

      <div style={{ marginBottom: '16px' }}>
        <button onClick={() => navigate('/admin/create-user')} style={{ marginRight: '8px' }}>
          Create User
        </button>
        <button onClick={() => navigate('/admin/edit-user')}>
          Edit User
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

export default AdminDashboard