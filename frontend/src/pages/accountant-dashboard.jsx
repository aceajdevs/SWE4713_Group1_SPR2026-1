import '../global.css';
import LandingDashboard from '../components/LandingDashboard';

function AccountantDashboard() {
  return (
    <LandingDashboard
      title="Accountant Dashboard"
      actions={[
        { label: 'New Journal Entry', path: '/journal-entry/new' },
        { label: 'View Journal Entries', path: '/journal-entries' },
        { label: 'Posted Journals', path: '/posted-journal-entries' },
        { label: 'Chart of Accounts', path: '/admin/chart-of-accounts' },
      ]}
    />
  );
}

export default AccountantDashboard;