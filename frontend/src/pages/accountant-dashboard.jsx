import '../global.css';
import LandingDashboard from '../components/LandingDashboard';

function AccountantDashboard() {
  return (
    <LandingDashboard
      title="Accountant Dashboard"
      subtitle="Use this landing page to create journal entries, track approvals, and review financial ratio health."
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