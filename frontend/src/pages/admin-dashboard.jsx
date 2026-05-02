import '../global.css';
import { useNavigate } from 'react-router-dom';
import { HelpTooltip } from '../components/HelpTooltip';
import UserReport from '../components/admin/UserReport';
import SuspendUser from '../components/admin/SuspendUser';
import ExpiredPasswords from '../components/admin/ExpiredPasswords';
import PasswordExpiryNotifyPanel from '../components/admin/PasswordExpiryNotifyPanel';
import './admin-dashboard.css';

function AdminDashboard() {
  const navigate = useNavigate();


  return (
    <div className="admin-dashboard">
      <h1>Administrator Dashboard</h1>

      <div className="dashboard-content">
        <div className="left-column">
          <div className="user-header-row">
            <h2>All Users</h2>
            <div className="user-header-actions">
              <HelpTooltip text="Open the form to add a new user account (administrator).">
                <button type="button" className="button-primary" onClick={() => navigate('/admin/create-user')} style={{ marginRight: '8px' }}>
                  Create User
                </button>
              </HelpTooltip>
              <HelpTooltip text="Open user search and editing for existing users.">
                <button type="button" className="button-primary" onClick={() => navigate('/admin/edit-user')} style={{ marginRight: '8px' }}>
                  Edit User
                </button>
              </HelpTooltip>
            </div>
          </div>
          <div style={{ marginTop: '12px' }}>
            <UserReport hideHeader />
          </div>
        </div>
        <div className="right-column">
          <div className="right-block">
            <SuspendUser />
          </div>
          <div className="right-block">
            <ExpiredPasswords />
          </div>
          <div className="right-block">
            <PasswordExpiryNotifyPanel />
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard