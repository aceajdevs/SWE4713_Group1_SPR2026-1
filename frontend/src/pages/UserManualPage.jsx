import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './UserManualPage.css';

const TOPIC_IDS = new Set([
  'getting-started',
  'login',
  'signup',
  'forgot-password',
  'roles',
  'dashboards',
  'admin-overview',
  'create-user',
  'edit-user',
  'account-requests',
  'field-help',
]);

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
      <header className="user-manual-header">
        <div className="user-manual-header-inner">
          <h1>User manual</h1>
          <button type="button" className="user-manual-back" onClick={goBack}>
            Back
          </button>
        </div>
        <p className="user-manual-lead">
          Documentation for this application, organized by topic. Use the links below to jump to a section.
        </p>
      </header>

      <nav className="user-manual-toc" aria-label="Manual contents">
        <h2 className="user-manual-toc-title">Contents</h2>
        <ul>
          <li>
            <button type="button" className="user-manual-toc-link" onClick={() => jumpToSection('getting-started')}>
              Getting started
            </button>
          </li>
          <li>
            <button type="button" className="user-manual-toc-link" onClick={() => jumpToSection('login')}>
              Sign in
            </button>
          </li>
          <li>
            <button type="button" className="user-manual-toc-link" onClick={() => jumpToSection('signup')}>
              Request an account (sign up)
            </button>
          </li>
          <li>
            <button type="button" className="user-manual-toc-link" onClick={() => jumpToSection('forgot-password')}>
              Forgot password
            </button>
          </li>
          <li>
            <button type="button" className="user-manual-toc-link" onClick={() => jumpToSection('roles')}>
              User roles
            </button>
          </li>
          <li>
            <button type="button" className="user-manual-toc-link" onClick={() => jumpToSection('dashboards')}>
              Dashboards
            </button>
          </li>
          <li>
            <button type="button" className="user-manual-toc-link" onClick={() => jumpToSection('admin-overview')}>
              Administrator tools
            </button>
          </li>
          <li>
            <button type="button" className="user-manual-toc-link" onClick={() => jumpToSection('create-user')}>
              Create user (admin)
            </button>
          </li>
          <li>
            <button type="button" className="user-manual-toc-link" onClick={() => jumpToSection('edit-user')}>
              Edit user (admin)
            </button>
          </li>
          <li>
            <button type="button" className="user-manual-toc-link" onClick={() => jumpToSection('account-requests')}>
              User account requests (admin)
            </button>
          </li>
          <li>
            <button type="button" className="user-manual-toc-link" onClick={() => jumpToSection('field-help')}>
              Screen tips (hover help)
            </button>
          </li>
        </ul>
      </nav>

      <main className="user-manual-body">
        <section id="getting-started" className="user-manual-section">
          <h2>Getting started</h2>
          <p>
            This application provides role-based access for administrators, managers, and accountants.
            New users typically request access from the sign-up flow; an administrator then reviews and approves requests.
          </p>
          <p>
            Use <strong>Help</strong> in the top navigation (when signed in) or the <strong>Help</strong> button on entry screens
            to open this manual at any time.
          </p>
        </section>

        <section id="login" className="user-manual-section">
          <h2>Sign in</h2>
          <p>
            Enter your username and password on the login page. After several failed attempts, your account may be temporarily
            suspended for security. Use <strong>Forgot password</strong> if you cannot sign in.
          </p>
          <p>
            Hover over fields and buttons on many screens to see short explanations (screen tips).
          </p>
        </section>

        <section id="signup" className="user-manual-section">
          <h2>Request an account (sign up)</h2>
          <p>
            Submit your profile information, choose a password that meets the strength rules, and complete three security questions.
            Your request is stored for an administrator to approve before you can sign in.
          </p>
        </section>

        <section id="forgot-password" className="user-manual-section">
          <h2>Forgot password</h2>
          <p>
            Confirm your email and user ID, answer your three security questions, then set a new password. Password rules and
            reuse checks apply the same as elsewhere in the app.
          </p>
        </section>

        <section id="roles" className="user-manual-section">
          <h2>User roles</h2>
          <ul>
            <li><strong>Administrator</strong> — Create and edit users, review account requests, run user reports, suspend accounts, and review password expiry notices.</li>
            <li><strong>Manager</strong> — Uses the manager dashboard and assigned features.</li>
            <li><strong>Accountant</strong> — Uses the accountant dashboard and assigned features.</li>
          </ul>
        </section>

        <section id="dashboards" className="user-manual-section">
          <h2>Dashboards</h2>
          <p>
            After login you are routed to a dashboard for your role (administrator, manager, or accountant). The generic dashboard
            is available for other cases. Each area will host role-specific tools and reports as they are added to the product.
          </p>
        </section>

        <section id="admin-overview" className="user-manual-section">
          <h2>Administrator tools</h2>
          <p>
            From the administrator dashboard you can open <strong>Create user</strong> and <strong>Edit user</strong>, review pending
            sign-up requests, suspend users, inspect expired or expiring passwords, and run user reports.
          </p>
        </section>

        <section id="create-user" className="user-manual-section">
          <h2>Create user (admin)</h2>
          <p>
            Fill in the new user&apos;s email, name, optional address and date of birth, role, password, and three security questions.
            Submitting creates the account in the system (username may be assigned automatically). Use screen tips on the form
            for a quick reminder of each field.
          </p>
        </section>

        <section id="edit-user" className="user-manual-section">
          <h2>Edit user (admin)</h2>
          <p>
            Look up a user, update their profile or role, reset password, or update security answers as supported by the form.
            Save changes when finished.
          </p>
        </section>

        <section id="account-requests" className="user-manual-section">
          <h2>User account requests (admin)</h2>
          <p>
            Review pending account requests from the sign-up flow. Approve with an assigned role or reject as appropriate.
            Refresh the list after actions to see the latest state.
          </p>
        </section>

        <section id="field-help" className="user-manual-section">
          <h2>Screen tips (hover help)</h2>
          <p>
            Throughout the app, many inputs and buttons show a short description when you point at them or move keyboard focus
            into them. This is meant to mirror quick help similar to product documentation tooltips.
          </p>
        </section>
      </main>
    </div>
  );
}

export default UserManualPage;
