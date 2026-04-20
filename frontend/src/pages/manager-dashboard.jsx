import React from 'react';
import '../global.css';
import LandingDashboard from '../components/LandingDashboard';

function ManagerDashboard() {
  return (
    <LandingDashboard
      title="Manager Dashboard"
      subtitle="Use the shortcuts below to review journals, monitor key ratios, and access core accounting pages."
      actions={[
        { label: 'New Journal Entry', path: '/journal-entry/new' },
        { label: 'Review Journal Entries', path: '/journal-entries' },
        { label: 'Posted Journals', path: '/posted-journal-entries' },
        { label: 'Chart of Accounts', path: '/admin/chart-of-accounts' },
        { label: 'Reports', path: '/report' },
      ]}
    />
  );
}

export default ManagerDashboard;