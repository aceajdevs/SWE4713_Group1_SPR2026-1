import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../navbar';
import './UserManualPage.css';
import '../global.css';

const TOPIC_IDS = new Set([
  'getting-started',
  'login',
  'signup',
  'forgot-password',
  'roles',
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
  'event-log',
  'ui-help-layout',
  'field-help',
]);

const MANUAL_TOC = [
  { id: 'getting-started', label: 'Introduction' },
  { id: 'roles', label: 'User roles (administrator, manager, accountant)' },
  { id: 'login', label: 'Sign-in screen' },
  { id: 'session-nav', label: 'After you sign in (profile, logo)' },
  { id: 'passwords-security', label: 'Passwords & account security' },
  { id: 'signup', label: 'First-time access & account requests' },
  { id: 'forgot-password', label: 'Forgot password' },
  { id: 'password-expiry', label: 'Password expiry reminders' },
  { id: 'username-format', label: 'How usernames are assigned' },
  { id: 'dashboards', label: 'Dashboards' },
  { id: 'admin-overview', label: 'Administrator tools (overview)' },
  { id: 'create-user', label: 'Creating users (administrator)' },
  { id: 'edit-user', label: 'Updating & activating users (administrator)' },
  { id: 'account-requests', label: 'Approving account requests (administrator)' },
  { id: 'chart-of-accounts', label: 'Chart of accounts — overview' },
  { id: 'chart-of-accounts-admin', label: 'Chart of accounts — administrators' },
  { id: 'chart-of-accounts-viewers', label: 'Chart of accounts — managers & accountants' },
  { id: 'chart-of-accounts-data', label: 'Accounts: fields, search & filters' },
  { id: 'event-log', label: 'Audit trail & event log' },
  { id: 'ui-help-layout', label: 'Layout, help & accessibility' },
  { id: 'field-help', label: 'Screen tips (hover help)' },
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
          <h1>User manual</h1>
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

        <section id="roles" className="user-manual-section">
          <h2>User roles</h2>
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

        <section id="login" className="user-manual-section">
          <h2>Sign-in screen</h2>
          <p>The login page is where you enter your credentials after your account exists in the system.</p>
          <ul>
            <li><strong>Username</strong> — Enter the username assigned to you (see &quot;How usernames are assigned&quot;).</li>
            <li><strong>Password</strong> — Enter your password; it is masked as you type.</li>
            <li><strong>Sign in</strong> — Submits your credentials.</li>
            <li><strong>Forgot password</strong> — Starts the reset flow using your email, user ID, and security questions.</li>
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
          <h2>After you sign in</h2>
          <p>
            When you are signed in, the top area of the application shows who you are: typically your <strong>username</strong> and,
            if you have a profile photo, your <strong>picture</strong>. The <strong>logo</strong> remains visible so pages share a
            consistent identity. Use <strong>Help</strong> to open this manual and <strong>Logout</strong> when you are finished.
          </p>
        </section>

        <section id="passwords-security" className="user-manual-section">
          <h2>Passwords &amp; account security</h2>
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
          <h2>First-time access &amp; account requests</h2>
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
          <h2>Forgot password</h2>
          <p>
            If you forgot your password, use the forgot-password path from the login screen. You will be asked for the
            <strong> email</strong> and <strong>user ID</strong> associated with your account, then to answer your security
            questions. If you succeed, you can set a new password that meets the current rules and is not a previously used
            password.
          </p>
        </section>

        <section id="password-expiry" className="user-manual-section">
          <h2>Password expiry reminders</h2>
          <p>
            If your organization uses password expiration, you may receive notice shortly before your password expires so you
            can change it in time. Administrators may also have views or reports related to expiring or expired passwords,
            depending on deployment.
          </p>
        </section>

        <section id="username-format" className="user-manual-section">
          <h2>How usernames are assigned</h2>
          <p>
            Usernames are generated by the system using a consistent pattern: typically the first letter of your first name,
            your full last name, and a date-based suffix (often reflecting when the account was created). This helps keep names
            unique and recognizable. If you are unsure of your username after approval, ask your administrator.
          </p>
        </section>

        <section id="dashboards" className="user-manual-section">
          <h2>Dashboards</h2>
          <p>
            After a successful login, you are taken to a <strong>dashboard</strong> suited to your role—administrator, manager,
            or accountant—or a general landing area. Dashboards are the starting point for navigation to reports, user tools,
            chart of accounts, and other modules your team enables.
          </p>
        </section>

        <section id="admin-overview" className="user-manual-section">
          <h2>Administrator tools (overview)</h2>
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
        </section>

        <section id="create-user" className="user-manual-section">
          <h2>Creating users (administrator)</h2>
          <p>
            Administrators can create new users by entering required profile fields, assigning a role (administrator, manager,
            or accountant), setting an initial password that meets policy, and configuring security questions. The system records
            who performed the action in audit logs where that feature is enabled.
          </p>
        </section>

        <section id="edit-user" className="user-manual-section">
          <h2>Updating &amp; activating users (administrator)</h2>
          <p>
            Administrators can look up a user, update profile information, change role where allowed, reset passwords, adjust
            security answers, and activate or deactivate accounts. Deactivation prevents sign-in until the account is
            reactivated. Suspensions with start and end dates may be used for temporary access restrictions.
          </p>
        </section>

        <section id="account-requests" className="user-manual-section">
          <h2>Approving account requests (administrator)</h2>
          <p>
            Pending sign-up requests appear in a dedicated workflow. For each request, an administrator can approve (usually
            assigning a role) or reject. Approved users can then sign in according to your process; rejected requests do not
            receive active credentials.
          </p>
        </section>

        <section id="chart-of-accounts" className="user-manual-section">
          <h2>Chart of accounts — overview</h2>
          <p>
            The <strong>chart of accounts</strong> is the master list of financial accounts your organization uses. Each account
            has a name, number, category, balances, and other attributes used by reporting and (where implemented) ledgers and
            journals.
          </p>
        </section>

        <section id="chart-of-accounts-admin" className="user-manual-section">
          <h2>Chart of accounts — administrators</h2>
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
          <h2>Chart of accounts — managers &amp; accountants</h2>
          <p>
            <strong>Managers</strong> and <strong>accountants</strong> can usually <strong>view</strong> the chart of accounts
            and use related services they are permitted to use, but they <strong>cannot</strong> add, edit, or deactivate
            accounts.
          </p>
        </section>

        <section id="chart-of-accounts-data" className="user-manual-section">
          <h2>Accounts: fields, search &amp; filters</h2>
          <p>
            The chart-of-accounts list supports finding accounts by <strong>name</strong> or <strong>number</strong>, and may
            offer filters by category, status (active/inactive), and other attributes. Some deployments add a calendar control,
            additional filter tokens, or links to other modules at the top of the page—use what your screen provides.
          </p>
        </section>

        <section id="event-log" className="user-manual-section">
          <h2>Audit trail &amp; event log</h2>
          <p>
            Data changes are recorded in an <strong>event log</strong>: what table and record changed, what
            action occurred (insert, update, delete), before and after snapshots of the row, and <strong>who </strong>
            made the change together with a <strong>timestamp</strong>. Each event has a unique identifier. This supports
            accountability and troubleshooting.
          </p>
        </section>

        <section id="ui-help-layout" className="user-manual-section">
          <h2>Layout, help &amp; accessibility</h2>
          <p>
            Pages use a consistent color and layout scheme so navigation feels familiar. Every page provides access to
            <strong> Help</strong> (this manual), organized by topic, similar to help in many desktop products.
          </p>
          <p>
            Controls may include short <strong>screen tips</strong> on hover or keyboard focus; see the next section.
          </p>
        </section>

        <section id="field-help" className="user-manual-section">
          <h2>Screen tips (hover help)</h2>
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
