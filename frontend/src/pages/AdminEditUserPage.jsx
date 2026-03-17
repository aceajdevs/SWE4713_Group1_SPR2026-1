import React, { useState, useEffect } from 'react';
import '../LoginPage.css';
import { useNavigate } from 'react-router-dom';
import {
  getUser,
  getUserSecurityQuestions,
  updateUser,
  updateUserPassword,
  adminUpdateUserSecurityAnswers,
} from '../services/userService';
import { validatePassword } from '../utils/passwordValidation';
import { getAllUsers } from '../services/adminService';

const ROLES = ['administrator', 'manager', 'accountant'];

function AdminEditUserPage() {
  const navigate = useNavigate();

  const [_lookupUserId, setLookupUserId] = useState(''); // kept for internal use
  const [loadedUserId, setLoadedUserId] = useState(null);

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [address, setAddress] = useState('');
  const [dob, setDob] = useState('');
  const [role, setRole] = useState('accountant');
  const [status, setStatus] = useState(true);

  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState([]);
  const [showPasswordErrors, setShowPasswordErrors] = useState(false);
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  const [_loadingUser, setLoadingUser] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [secQuestion1, setSecQuestion1] = useState('');
  const [secQuestion2, setSecQuestion2] = useState('');
  const [secQuestion3, setSecQuestion3] = useState('');
  const [secAnswer1, setSecAnswer1] = useState('');
  const [secAnswer2, setSecAnswer2] = useState('');
  const [secAnswer3, setSecAnswer3] = useState('');

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const users = await getAllUsers();
        setAllUsers(users || []);
      } catch (err) {
        console.error('Error loading users for dropdown:', err);
      }
    };

    loadUsers();
  }, []);

  const handleLoadUserById = async (id) => {
    setError('');
    setSuccess('');

    if (!id || Number.isNaN(id)) {
      setError('Please select a valid user.');
      return;
    }

    setLoadingUser(true);
    try {
      const user = await getUser(id);
      if (!user) {
        setError('User not found.');
        setLoadedUserId(null);
        return;
      }

      setLoadedUserId(user.userID);
      setEmail(user.email ?? '');
      setUsername(user.username ?? '');
      setFirstName(user.fName ?? '');
      setLastName(user.lName ?? '');
      setAddress(user.address ?? '');
      setDob(user.dob ?? '');
      setRole(user.role ?? 'accountant');
      setStatus(user.status ?? true);

      // Load security questions (texts only; answers remain hidden)
      try {
        const qs = await getUserSecurityQuestions(user.email, user.userID);
        setSecQuestion1(qs?.question1 ?? '');
        setSecQuestion2(qs?.question2 ?? '');
        setSecQuestion3(qs?.question3 ?? '');
      } catch (err) {
        console.error('Error loading security questions for admin edit:', err);
        setSecQuestion1('');
        setSecQuestion2('');
        setSecQuestion3('');
      }

      // Clear password and security answer fields
      setNewPassword('');
      setConfirmNewPassword('');
      setPasswordErrors([]);
      setShowPasswordErrors(false);
      setConfirmPasswordError('');
      setSecAnswer1('');
      setSecAnswer2('');
      setSecAnswer3('');

      setSuccess('');
    } catch (err) {
      console.error('Error loading user:', err);
      setError('Error loading user. Please try again.');
      setLoadedUserId(null);
    } finally {
      setLoadingUser(false);
    }
  };

  const handleNewPasswordChange = (e) => {
    const value = e.target.value;
    setNewPassword(value);

    const validation = validatePassword(value);
    setPasswordErrors(validation.errors);

    if (value.length > 0) {
      setShowPasswordErrors(true);
    } else {
      setShowPasswordErrors(false);
    }

    if (confirmNewPassword && value === confirmNewPassword) {
      setConfirmPasswordError('');
    }
  };

  const handleConfirmNewPasswordChange = (e) => {
    const value = e.target.value;
    setConfirmNewPassword(value);

    if (value && value !== newPassword) {
      setConfirmPasswordError('Passwords do not match');
    } else {
      setConfirmPasswordError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!loadedUserId) {
      setError('Please load a user first.');
      return;
    }

    // Optional password change validation
    if (newPassword || confirmNewPassword) {
      const validation = validatePassword(newPassword);
      setPasswordErrors(validation.errors);
      setShowPasswordErrors(true);

      if (newPassword !== confirmNewPassword) {
        setConfirmPasswordError('Passwords do not match');
        return;
      }

      if (!validation.isValid) {
        setError('Please fix password errors before submitting.');
        return;
      }
    }

    setSaving(true);
    try {
      // Update non-hashed fields via updateUser
      await updateUser({
        userId: loadedUserId,
        email: email || null,
        username: username || null,
        fName: firstName || null,
        lName: lastName || null,
        dob: dob || null,
        address: address || null,
        picturePath: null,
        status: status,
        passwordExpires: null,
        role: role || null,
        suspendedTill: null,
        loginAttempts: null,
        passwordHash: null,
      });

      // If a new password was provided, update it separately
      if (newPassword) {
        await updateUserPassword(loadedUserId, newPassword);
      }

      // If any new security answers were provided, update them
      if (secAnswer1 || secAnswer2 || secAnswer3) {
        await adminUpdateUserSecurityAnswers(loadedUserId, secAnswer1, secAnswer2, secAnswer3);
      }

      setSuccess('User updated successfully.');
    } catch (err) {
      console.error('Error updating user:', err);
      setError(err.message || 'Failed to update user. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    setLookupUserId('');
    setLoadedUserId(null);
    setEmail('');
    setUsername('');
    setFirstName('');
    setLastName('');
    setAddress('');
    setDob('');
    setRole('accountant');
    setStatus(true);
    setNewPassword('');
    setConfirmNewPassword('');
    setPasswordErrors([]);
    setShowPasswordErrors(false);
    setConfirmPasswordError('');
    setError('');
    setSuccess('');
    setSecQuestion1('');
    setSecQuestion2('');
    setSecQuestion3('');
    setSecAnswer1('');
    setSecAnswer2('');
    setSecAnswer3('');
  };

  return (
    <div className="login-page">
      <main className="login-main">
        <form className="login-form" onSubmit={handleSubmit}>
          <h1>Edit User</h1>
          <p>Load a user by ID, review their information, and update fields as needed.</p>

          {error && (
            <div
              style={{
                color: '#dc2626',
                fontSize: '14px',
                marginBottom: '12px',
                padding: '8px',
                background: '#fef2f2',
                borderRadius: '6px',
              }}
            >
              {error}
            </div>
          )}

          {success && (
            <div
              style={{
                color: '#059669',
                fontSize: '14px',
                marginBottom: '12px',
                padding: '8px',
                background: '#d1fae5',
                borderRadius: '6px',
              }}
            >
              {success}
            </div>
          )}

          <div className="form-field">
            <h5>Select User</h5>
            <select
              id="user-select"
              className="input"
              value={loadedUserId || ''}
              onChange={async (e) => {
                const selectedId = e.target.value ? parseInt(e.target.value, 10) : null;
                if (!selectedId) return;
                setLookupUserId(String(selectedId));
                await handleLoadUserById(selectedId);
              }}
            >
              <option value="">Select a user...</option>
              {allUsers.map((u) => (
                <option key={u.userID} value={u.userID}>
                  {u.userID} - {u.username || `${u.fName ?? ''} ${u.lName ?? ''}`.trim()}
                </option>
              ))}
            </select>
          </div>

          {loadedUserId && (
            <>
              <div className="form-field">
                <h5>Email</h5>
                <input
                  className="input"
                  type="email"
                  name="email"
                  placeholder="Email"
                  aria-label="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="form-field">
                <h5>Username</h5>
                <input
                  className="input"
                  type="text"
                  name="username"
                  placeholder="Username"
                  aria-label="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div className="form-grid-2">
                <div className="form-field">
                  <h5>First Name</h5>
                  <input
                    className="input"
                    type="text"
                    name="firstName"
                    placeholder="First Name"
                    aria-label="first name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <h5>Last Name</h5>
                  <input
                    className="input"
                    type="text"
                    name="lastName"
                    placeholder="Last Name"
                    aria-label="last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-field">
                <h5>Address</h5>
                <input
                  className="input"
                  type="text"
                  name="address"
                  placeholder="Address"
                  aria-label="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              <div className="form-grid-2">
                <div className="form-field">
                  <h5>Date of Birth</h5>
                  <input
                    className="input compact"
                    type="date"
                    name="dob"
                    aria-label="date of birth"
                    value={dob || ''}
                    onChange={(e) => setDob(e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <h5>Role</h5>
                  <select
                    className="input"
                    name="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r.charAt(0).toUpperCase() + r.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-field" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="user-status"
                  checked={!!status}
                  onChange={(e) => setStatus(e.target.checked)}
                />
                <label htmlFor="user-status">Account Active</label>
              </div>

              <hr style={{ margin: '16px 0' }} />

              {(secQuestion1 || secQuestion2 || secQuestion3) && (
                <>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
                    Security Questions (optional updates)
                  </h3>
                  <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '12px' }}>
                    Existing answers are not shown. Enter new answers only for the questions you want to change.
                  </p>

                  {secQuestion1 && (
                    <div className="form-field">
                      <h5>{secQuestion1}</h5>
                      <input
                        className="input"
                        type="text"
                        name="secAnswer1"
                        placeholder="New answer (leave blank to keep current)"
                        aria-label="security answer 1"
                        value={secAnswer1}
                        onChange={(e) => setSecAnswer1(e.target.value)}
                      />
                    </div>
                  )}

                  {secQuestion2 && (
                    <div className="form-field">
                      <h5>{secQuestion2}</h5>
                      <input
                        className="input"
                        type="text"
                        name="secAnswer2"
                        placeholder="New answer (leave blank to keep current)"
                        aria-label="security answer 2"
                        value={secAnswer2}
                        onChange={(e) => setSecAnswer2(e.target.value)}
                      />
                    </div>
                  )}

                  {secQuestion3 && (
                    <div className="form-field">
                      <h5>{secQuestion3}</h5>
                      <input
                        className="input"
                        type="text"
                        name="secAnswer3"
                        placeholder="New answer (leave blank to keep current)"
                        aria-label="security answer 3"
                        value={secAnswer3}
                        onChange={(e) => setSecAnswer3(e.target.value)}
                      />
                    </div>
                  )}

                  <hr style={{ margin: '16px 0' }} />
                </>
              )}

              <div className="form-field">
                <h5>New Password (optional)</h5>
                <input
                  className={`input ${showPasswordErrors && passwordErrors.length > 0 ? 'input-error' : ''}`}
                  type="password"
                  name="newPassword"
                  placeholder="New Password"
                  aria-label="new password"
                  value={newPassword}
                  onChange={handleNewPasswordChange}
                />

                {showPasswordErrors && passwordErrors.length > 0 && (
                  <div className="error-messages" role="alert">
                    <ul>
                      {passwordErrors.map((err, index) => (
                        <li key={index}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="form-field">
                <h5>Confirm New Password</h5>
                <input
                  className={`input ${confirmPasswordError ? 'input-error' : ''}`}
                  type="password"
                  name="confirmNewPassword"
                  placeholder="Confirm New Password"
                  aria-label="confirm new password"
                  value={confirmNewPassword}
                  onChange={handleConfirmNewPasswordChange}
                />

                {confirmPasswordError && (
                  <div className="error-messages" role="alert">
                    {confirmPasswordError}
                  </div>
                )}
              </div>
            </>
          )}

          <div className="button-row" role="group">
            <button type="submit" disabled={saving || !loadedUserId}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button type="button" onClick={handleClear} disabled={saving}>
              Clear
            </button>
          </div>

          <div className="cancel-wrap">
            <button
              type="button"
              className="cancel-button"
              onClick={() => navigate('/admin-dashboard')}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

export default AdminEditUserPage;

