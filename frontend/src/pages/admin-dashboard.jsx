import '../global.css';
import { useNavigate } from 'react-router-dom';
import { HelpTooltip } from '../components/HelpTooltip';
import UserReport from '../components/admin/UserReport';
import SuspendUser from '../components/admin/SuspendUser';
import ExpiredPasswords from '../components/admin/ExpiredPasswords';
import './admin-dashboard.css'

function AdminDashboard() {
  const navigate = useNavigate();


  return (
    <div className="admin-dashboard">
      <h1>Administrator Dashboard</h1>

      <div className="button-group">
      <div style={{ marginBottom: '16px' }}>
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
        <HelpTooltip text="Open the chart of accounts to view or manage accounts.">
          <button type="button" className="button-primary" onClick={() => navigate('/admin/chart-of-accounts')}>
            Chart of Accounts
          </button>
        </HelpTooltip>
      </div>

      <div className="dashboard-content">
        <div className="left-column">
          <UserReport />
        </div>
        <div className="right-column">
          <div className="right-block">
            <SuspendUser />
          </div>
          <div className="right-block">
            <ExpiredPasswords />
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}

export default AdminDashboard