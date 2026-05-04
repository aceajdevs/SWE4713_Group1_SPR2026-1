import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../navbar';
import './UserManualPage.css';
import '../global.css';

const TOPIC_IDS = new Set([
  'getting-started',
  'system-requirements',
  'login',
  'signup',
  'forgot-password',
  'roles',
  'role-access-matrix',
  'session-nav',
  'passwords-security',
  'password-expiry',
  'dashboards',
  'admin-overview',
  'create-user',
  'edit-user',
  'account-requests',
  'username-format',
  'chart-of-accounts',
  'chart-of-accounts-admin',
  'chart-of-accounts-viewers',
  'chart-of-accounts-data',
  'journal-entries',
  'posted-journals-ledger',
  'reports',
  'financial-ratios',
  'event-log',
  'security-controls',
  'faq',
  'troubleshooting',
  'ui-help-layout',
  'field-help',
]);

const MANUAL_TOC = [
  { id: 'getting-started', label: 'Introduction' },
  { id: 'system-requirements', label: 'System Requirements' },
  { id: 'roles', label: 'User Roles (Administrator, Manager, Accountant)' },
  { id: 'role-access-matrix', label: 'Role Access Matrix' },
  { id: 'login', label: 'Sign-In Screen' },
  { id: 'session-nav', label: 'Post Sign-in' },
  { id: 'passwords-security', label: 'Passwords & Account Security' },
  { id: 'signup', label: 'First-Time Access & Account Requests' },
  { id: 'forgot-password', label: 'Forgot Password' },
  { id: 'password-expiry', label: 'Password Expiry Reminders' },
  { id: 'username-format', label: 'How Usernames Are Assigned' },
  { id: 'dashboards', label: 'Dashboards' },
  { id: 'admin-overview', label: 'Administrator Tools (Overview)' },
  { id: 'create-user', label: 'Creating Users (Administrator)' },
  { id: 'edit-user', label: 'Updating & Activating Users (Administrator)' },
  { id: 'account-requests', label: 'Approving Account Requests (Administrator)' },
  { id: 'chart-of-accounts', label: 'Chart of Accounts — Overview' },
  { id: 'chart-of-accounts-admin', label: 'Chart of Accounts — Administrators' },
  { id: 'chart-of-accounts-viewers', label: 'Chart of Accounts — Managers & Accountants' },
  { id: 'chart-of-accounts-data', label: 'Accounts: Fields, Search & Filters' },
  { id: 'journal-entries', label: 'Journal Entries & Approvals' },
  { id: 'posted-journals-ledger', label: 'Posted Journals & General Ledger' },
  { id: 'reports', label: 'Reports' },
  { id: 'financial-ratios', label: 'Financial Ratios' },
  { id: 'event-log', label: 'Event Logging & Account Auditing' },
  { id: 'security-controls', label: 'Security & Data Controls' },
  { id: 'faq', label: 'Frequently Asked Questions' },
  { id: 'troubleshooting', label: 'Troubleshooting' },
  { id: 'ui-help-layout', label: 'Layout, Help & Accessibility' },
  { id: 'field-help', label: 'Screen Tips (Tooltips)' },
];

function UserManualPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const raw = searchParams.get('topic');
    const topic = raw && TOPIC_IDS.has(raw) ? raw : null;
    if (!topic) return;
    const el = document.getElementById(topic);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [searchParams]);

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/login');
    }
  };

  const jumpToSection = (sectionId) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="user-manual-page">
      <Navbar />
      <header className="user-manual-header">
        <div className="user-manual-header-inner">
          <h1>User Manual</h1>
          <button type="button" className="button-primary" onClick={goBack}>
            Back
          </button>
        </div>
        <p className="user-manual-lead">
          This guide describes how to use the application: signing in, roles, security expectations, administrator tools,
          and the chart of accounts. Use the contents below to jump to a topic. Open <strong>Help</strong> from the navigation
          bar (when signed in) or the <strong>Help</strong> button on entry screens anytime.
        </p>
      </header>

      <nav className="user-manual-toc" aria-label="Manual contents">
        <h2 className="user-manual-toc-title">Contents</h2>
        <ul>
          {MANUAL_TOC.map(({ id, label }) => (
            <li key={id}>
              <button type="button" className="user-manual-toc-link" onClick={() => jumpToSection(id)}>
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <main className="user-manual-body">
        <section id="getting-started" className="user-manual-section">
          <h2>Introduction</h2>
          <p>
            This application supports three kinds of signed-in users: <strong>administrators</strong>, <strong>managers</strong>,
            and <strong>accountants</strong> (regular business users). Access to menus and actions depends on your role.
            People who do not yet have an account can request one; an administrator approves or rejects those requests.
          </p>
          <p>
            Credential and profile data are stored in the system database. Passwords and similar secrets are never shown in
            plain text in the user interface and are handled using secure storage practices on the server.
          </p>
        </section>

        <section id="system-requirements" className="user-manual-section">
          <h2>System Requirements</h2>
          <ul>
            <li><strong>Device</strong> — Desktop or laptop is recommended for wide accounting tables.</li>
            <li><strong>Memory</strong> — At least 4 GB RAM is recommended for smooth browser performance.</li>
            <li><strong>Browser</strong> — Primary support is Google Chrome and Opera GX; current Edge, Safari, and Firefox may also work.</li>
            <li><strong>Network</strong> — Reliable internet is required for app usage, email actions, and report/PDF features.</li>
            <li><strong>Install</strong> — No local install is required; open the deployment URL in a browser.</li>
          </ul>
        </section>

        <section id="roles" className="user-manual-section">
          <h2>User Roles</h2>
          <p>
            <strong>Administrator</strong> can create and maintain user accounts, assign roles, review sign-up requests,
            run user-related reports, manage suspensions and password-related notices where those features are available,
            and fully manage the chart of accounts (add, edit, deactivate) where your deployment enables it.
          </p>
          <p>
            <strong>Manager</strong> and <strong>accountant</strong> users sign in with the same login experience and see
            navigation appropriate to their role. Typically they can view chart-of-accounts information and use shared
            business features, but they <strong>cannot</strong> add, edit, or deactivate accounts in the chart of accounts
            unless your organization has customized permissions.
          </p>
        </section>

        <section id="role-access-matrix" className="user-manual-section">
          <h2>Role Access Matrix</h2>
          <ul>
            <li><strong>Administrator</strong> — Admin dashboard, user account requests, create/edit users, chart-of-accounts maintenance, event logs, and ratio snapshots.</li>
            <li><strong>Manager</strong> — Manager dashboard, new/review journal entries, posted journals, chart of accounts viewing, reports, and financial ratios.</li>
            <li><strong>Accountant</strong> — Accountant dashboard, new/view journal entries, posted journals, chart of accounts viewing, and financial ratios.</li>
            <li><strong>General Ledger access</strong> — Available to manager/accountant in current app flows; administrators are blocked from ledger detail pages.</li>
            <li><strong>Reports access</strong> — The Reports page is manager-oriented in current navigation.</li>
          </ul>
        </section>

        <section id="login" className="user-manual-section">
          <h2>Sign-In Screen</h2>
          <p>The login page is where you enter your credentials after your account exists in the system.</p>
          <ul>
            <li><strong>Username</strong> — Enter the username assigned to you (see &quot;How usernames are assigned&quot;).</li>
            <li><strong>Password</strong> — Enter your password; it is masked as you type.</li>
            <li><strong>Sign in</strong> — Submits your credentials.</li>
            <li><strong>Forgot password</strong> — Starts the reset flow using your email, username, and security questions.</li>
            <li><strong>Sign up / request access</strong> — For first-time users who need to submit a request before an account exists.</li>
            <li><strong>Clear</strong> — Clears the fields on the form.</li>
            <li><strong>Logo</strong> — Branding appears on entry screens and throughout the app for a consistent look.</li>
          </ul>
          <p>
            Repeated failed sign-in attempts can trigger a temporary lockout to protect your account. If you are locked out,
            wait for the stated period or contact an administrator.
          </p>
        </section>

        <section id="session-nav" className="user-manual-section">
          <h2>After You Sign In</h2>
          <p>
            When you are signed in, the top area of the application shows who you are: typically your <strong>username</strong> and,
            if you have a profile photo, your <strong>picture</strong>. The <strong>logo</strong> remains visible so pages share a
            consistent identity. Use <strong>Help</strong> to open this manual and <strong>Logout</strong> when you are finished.
          </p>
          <ul>
            <li><strong>Dashboard logo</strong> returns to your role-specific dashboard.</li>
            <li><strong>Calendar icon</strong> opens the calendar utility.</li>
            <li><strong>Calculator icon</strong> opens the in-page calculator.</li>
            <li><strong>Profile area</strong> opens your profile details and picture URL setting.</li>
          </ul>
        </section>

        <section id="passwords-security" className="user-manual-section">
          <h2>Passwords &amp; Account Security</h2>
          <h3>Rules for new and reset passwords</h3>
          <p>
            Passwords must meet minimum strength rules enforced by the application, including length, starting character,
            and a mix of character types. If your password does not qualify, the form will show specific validation messages
            so you can correct it.
          </p>
          <h3>Reuse</h3>
          <p>
            When you change or reset your password, you may not reuse a password you have used before in the system. If you
            try, you will see an error and should choose a different password.
          </p>
          <h3>Storage</h3>
          <p>
            Passwords are not stored in readable form. Only secure verification data is kept on the server.
          </p>
          <h3>Sign-in attempts</h3>
          <p>
            Only a limited number of failed password attempts are allowed before sign-in is temporarily blocked for that account.
            This reduces the risk of guessing attacks.
          </p>
        </section>

        <section id="signup" className="user-manual-section">
          <h2>First-Time Access &amp; Account Requests</h2>
          <p>
            If you are using the system for the first time and do not yet have credentials, use the sign-up or request-access
            flow. You will provide personal information (such as first name, last name, address, and date of birth), choose a
            password that meets the rules, and set up security questions.
          </p>
          <p>
            Your submission becomes a <strong>request</strong>. An administrator reviews it and may approve or reject it.
            If approved, you may receive email with instructions to sign in.
          </p>
        </section>

        <section id="forgot-password" className="user-manual-section">
          <h2>Forgot Password</h2>
          <p>
            If you forgot your password, use the forgot-password path from the login screen. You will be asked for the
            <strong> email</strong> and <strong>username</strong> associated with your account, then to answer your security
            questions. If you succeed, you can set a new password that meets the current rules and is not a previously used
            password.
          </p>
        </section>

        <section id="password-expiry" className="user-manual-section">
          <h2>Password Expiry Reminders</h2>
          <p>
            If your organization uses password expiration, you may receive notice shortly before your password expires so you
            can change it in time. Administrators may also have views or reports related to expiring or expired passwords,
            depending on deployment.
          </p>
        </section>

        <section id="username-format" className="user-manual-section">
          <h2>How Usernames Are Assigned</h2>
          <p>
            Usernames are assigned by the system during account creation/approval workflows. The exact generated pattern is
            managed on the backend and may vary by deployment. If you are unsure of your username after approval, ask your
            administrator.
          </p>
        </section>

        <section id="dashboards" className="user-manual-section">
          <h2>Dashboards</h2>
          <p>
            After a successful login, you are taken to a <strong>dashboard</strong> suited to your role—administrator, manager,
            or accountant—or a general landing area. Dashboards are the starting point for navigation to reports, user tools,
            chart of accounts, and other modules your team enables.
          </p>
          <ul>
            <li><strong>Manager dashboard shortcuts</strong> include New Journal Entry, Review Journal Entries, Posted Journals, Chart of Accounts, and Reports.</li>
            <li><strong>Accountant dashboard shortcuts</strong> include New Journal Entry, View Journal Entries, Posted Journals, and Chart of Accounts.</li>
            <li><strong>Administrator dashboard</strong> combines an all-users report, user actions (create/edit/suspend/password tools), and ratio cards.</li>
          </ul>
        </section>

        <section id="admin-overview" className="user-manual-section">
          <h2>Administrator Tools (Overview)</h2>
          <p>
            Administrators maintain the user directory: creating accounts, editing profiles and roles, activating or deactivating
            users, reviewing sign-up requests, and using reports that list users without opening raw database tables. Depending
            on configuration, administrators may also suspend accounts for a date range (for example extended leave), review
            expired-password reports, and send email to users from within the system.
          </p>
          <p>
            These capabilities are spread across the admin dashboard and linked pages; use the navigation items your deployment
            exposes.
          </p>
          <p>
            The admin dashboard also includes an <strong>all users</strong> table with report-style fields and inline admin workflows
            for password-expiry monitoring and notifications.
          </p>
        </section>

        <section id="create-user" className="user-manual-section">
          <h2>Creating Users (Administrator)</h2>
          <p>
            Administrators can create new users by entering required profile fields, assigning a role (administrator, manager,
            or accountant), setting an initial password that meets policy, and configuring security questions. The system records
            who performed the action in audit logs where that feature is enabled.
          </p>
        </section>

        <section id="edit-user" className="user-manual-section">
          <h2>Updating &amp; Activating Users (Administrator)</h2>
          <p>
            Administrators can look up a user, update profile information, change role where allowed, reset passwords, adjust
            security answers, and activate or deactivate accounts. Deactivation prevents sign-in until the account is
            reactivated. Suspensions with start and end dates may be used for temporary access restrictions.
          </p>
        </section>

        <section id="account-requests" className="user-manual-section">
          <h2>Approving Account Requests (Administrator)</h2>
          <p>
            Pending sign-up requests appear in a dedicated workflow. For each request, an administrator can approve (usually
            assigning a role) or reject. Approved users can then sign in according to your process; rejected requests do not
            receive active credentials.
          </p>
          <ul>
            <li>Use <strong>Select User Request ID</strong> to load request details.</li>
            <li><strong>Assign Role</strong> is required before approval.</li>
            <li><strong>Approve</strong> creates the account and attempts to send an account-created email.</li>
            <li><strong>Reject</strong> removes the request after confirmation.</li>
          </ul>
        </section>

        <section id="chart-of-accounts" className="user-manual-section">
          <h2>Chart of Accounts — Overview</h2>
          <p>
            The <strong>chart of accounts</strong> is the master list of financial accounts your organization uses. Each account
            has a name, number, category, balances, and other attributes used by reporting and (where implemented) ledgers and
            journals.
          </p>
        </section>

        <section id="chart-of-accounts-admin" className="user-manual-section">
          <h2>Chart of Accounts — Administrators</h2>
          <p>
            Administrators can <strong>add</strong>, <strong>view</strong>, <strong>edit</strong>, and <strong>deactivate</strong>
            accounts through dedicated screens. When adding or editing, you typically enter or adjust:
          </p>
          <ul>
            <li>Account name and account number (numeric; no letters or decimals in the number)</li>
            <li>Description (comment)</li>
            <li>Normal side (debit or credit)</li>
            <li>Category and subcategory (for example asset / current assets)</li>
            <li>Initial balance and presentation of debit, credit, and balance columns as designed for your ledger rules</li>
            <li>Order for display, statement type (income statement, balance sheet, retained earnings, etc.)</li>
            <li>When the account was added and which user created or last changed it (see audit trail)</li>
          </ul>
          <p>
            Business rules may prevent deactivating an account that still has a non-zero balance. Your screens will indicate
            when an action is not allowed.
          </p>
          <p>
            Depending on release, selecting an account may open its <strong>ledger</strong> or related detail; navigation may
            also include shortcuts to other services (such as journalizing) from the top of the page where implemented.
          </p>
        </section>

        <section id="chart-of-accounts-viewers" className="user-manual-section">
          <h2>Chart of Accounts — Managers &amp; Accountants</h2>
          <p>
            <strong>Managers</strong> and <strong>accountants</strong> can usually <strong>view</strong> the chart of accounts
            and use related services they are permitted to use, but they <strong>cannot</strong> add, edit, or deactivate
            accounts.
          </p>
        </section>

        <section id="chart-of-accounts-data" className="user-manual-section">
          <h2>Accounts: Fields, Search &amp; Filters</h2>
          <p>
            The chart-of-accounts list supports finding accounts by <strong>name</strong> or <strong>number</strong>, and may
            offer filters by category, status (active/inactive), and other attributes. Some deployments add a calendar control,
            additional filter tokens, or links to other modules at the top of the page—use what your screen provides.
          </p>
          <p>
            Standard account categories follow number prefixes: assets (1), liabilities (2), equity (3), revenue (4), and
            expenses (5). Account numbers are expected to align with their selected category.
          </p>
          <p>
            The current page supports both <strong>All Accounts</strong> and <strong>Individual Account</strong> modes, quick search,
            advanced filters, active filter tokens with one-click clearing, and optional staff email actions from the page header.
          </p>
        </section>

        <section id="journal-entries" className="user-manual-section">
          <h2>Journal Entries &amp; Approvals</h2>
          <p>
            Managers and accountants can create journal entries using active accounts and balanced debit/credit lines. A
            journal requires at least two lines and equal total debits and credits before it can be submitted.
          </p>
          <p>
            Submitted entries are marked pending. Managers review entries, then approve or reject them. Rejections require a
            reason and that reason appears on list/detail views.
          </p>
          <p>
            Attachments are supported for common business file types, including PDF, Office documents, CSV, and image files.
          </p>
          <p>
            The Journal Entries page supports search, status filtering (pending/approved/rejected), date-range filtering, and entry
            detail navigation by journal ID.
          </p>
        </section>

        <section id="posted-journals-ledger" className="user-manual-section">
          <h2>Posted Journals &amp; General Ledger</h2>
          <p>
            Posted Journal Entries displays approved entries with key details (entry type, posted date, affected accounts, and
            amount). The PR reference links back to source journal details. In the current app, this page is available to
            manager and accountant roles.
          </p>
          <p>
            The General Ledger is organized by account and shows opening balance, debit/credit rows, and running balance.
            Users can search by account and filter by date or amount to review activity. In the current app, administrators
            cannot open ledger detail pages.
          </p>
        </section>

        <section id="reports" className="user-manual-section">
          <h2>Reports</h2>
          <p>
            Managers can generate Trial Balance, Income Statement, Balance Sheet, and Retained Earnings reports using
            selected dates. Generated reports can be previewed, saved as PDF, and emailed to a selected user where email
            services are configured.
          </p>
          <p>
            Date controls support period-based and as-of reporting. Report preview links may also provide direct ledger navigation
            for referenced accounts.
          </p>
        </section>

        <section id="financial-ratios" className="user-manual-section">
          <h2>Financial Ratios</h2>
          <p>
            Financial ratio dashboards are available to administrators, managers, and accountants. Ratios are grouped into
            profitability, liquidity, leverage, and activity categories, each with trend visuals and health labels.
          </p>
          <p>
            Ratio cards display recent trend points and health states such as <strong>Healthy</strong>, <strong>Caution</strong>, and
            <strong> Risk</strong>, based on configured thresholds.
          </p>
        </section>

        <section id="event-log" className="user-manual-section">
          <h2>Audit Trail &amp; Event Log</h2>
          <p>
            Data changes are recorded in an <strong>event log</strong>: what table and record changed, what
            action occurred (insert, update, delete), before and after snapshots of the row, and <strong>who </strong>
            made the change together with a <strong>timestamp</strong>. Each event has a unique identifier. This supports
            accountability and troubleshooting.
          </p>
        </section>

        <section id="security-controls" className="user-manual-section">
          <h2>Security &amp; Data Controls</h2>
          <p>
            Access is role-based throughout the application. Passwords and security-question answers are hashed (SHA-256)
            before storage, and sensitive values are not shown in plain text in the interface.
          </p>
          <p>
            After three failed sign-in attempts, accounts are temporarily suspended for one minute. Audit events capture
            before/after snapshots, user identity, action, and timestamp for account-configuration changes.
          </p>
          <p>
            Password reset and admin password updates also trigger password-history checks to prevent reuse and can generate
            email confirmations when messaging services are configured.
          </p>
        </section>

        <section id="faq" className="user-manual-section">
          <h2>Frequently Asked Questions</h2>
          <ul>
            <li><strong>Cannot sign in?</strong> Check username/password, account active status, and retry after lockout windows.</li>
            <li><strong>Sign-up did not grant access?</strong> Requests must be approved and assigned a role by an administrator.</li>
            <li><strong>Missing administrator links?</strong> Only administrator accounts can see user-management/account-maintenance actions.</li>
            <li><strong>Cannot deactivate an account?</strong> Accounts with non-zero current balance cannot be deactivated.</li>
            <li><strong>Cannot submit a journal?</strong> Use active accounts, include debit and credit lines, and balance totals.</li>
            <li><strong>No report results?</strong> Confirm posted ledger activity and verify the selected date range/as-of date.</li>
          </ul>
        </section>

        <section id="troubleshooting" className="user-manual-section">
          <h2>Troubleshooting</h2>
          <ul>
            <li><strong>Page will not load</strong> — Refresh, confirm internet, test another supported browser, and verify deployment URL status.</li>
            <li><strong>Search returns no rows</strong> — Clear filters, check spelling, and remove restrictive amount/date criteria.</li>
            <li><strong>Email action fails</strong> — Confirm the user has an email and that email services are configured in the deployment.</li>
            <li><strong>PDF report does not save</strong> — Generate first, then save; allow browser downloads for the site if blocked.</li>
            <li><strong>Security questions do not appear</strong> — Verify email and username match the same account; contact administrator if needed.</li>
            <li><strong>Tables hard to read on phone</strong> — Use desktop where possible or rotate the device for wider table layouts.</li>
          </ul>
        </section>

        <section id="ui-help-layout" className="user-manual-section">
          <h2>Layout, Help &amp; Accessibility</h2>
          <p>
            Pages use a consistent color and layout scheme so navigation feels familiar. Every page provides access to
            <strong> Help</strong> (this manual), organized by topic, similar to help in many desktop products.
          </p>
          <p>
            Controls may include short <strong>screen tips</strong> on hover or keyboard focus; see the next section.
          </p>
        </section>

        <section id="field-help" className="user-manual-section">
          <h2>Screen Tips (Tooltips)</h2>
          <p>
            Many fields and buttons show a brief explanation when you point at them or move focus to them with the keyboard.
            Tips explain what the control does so you can work faster without memorizing every label.
          </p>
        </section>
      </main>
    </div>
  );
}

export default UserManualPage;
