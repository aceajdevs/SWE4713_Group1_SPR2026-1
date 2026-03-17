import { useState, useEffect } from 'react';
import '../LoginPage.css';
import { useNavigate } from 'react-router-dom';
import { checkEmail, getSecurityQuestions, admin_createUser } from '../services/userService';
import { validatePassword } from '../utils/passwordValidation';

const ROLES = ['administrator', 'manager', 'accountant'];

function CreateUserPage() {
    const navigate = useNavigate();
    
    const [email, setEmail] = useState('');
    const [emailError, setEmailError] = useState('');
    const [showEmailError, setShowEmailError] = useState(false);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [address, setAddress] = useState('');
    const [dob, setDob] = useState('');
    const [dobError, setDobError] = useState('');
    const [password, setPassword] = useState('');
    const [passwordErrors, setPasswordErrors] = useState([]);
    const [showPasswordErrors, setShowPasswordErrors] = useState(false);
    const [role, setRole] = useState('accountant');
    const [securityQuestions, setSecurityQuestions] = useState([]);
    const [securityQuestion1, setSecurityQuestion1] = useState('');
    const [securityAnswer1, setSecurityAnswer1] = useState('');
    const [securityQuestion2, setSecurityQuestion2] = useState('');
    const [securityAnswer2, setSecurityAnswer2] = useState('');
    const [securityQuestion3, setSecurityQuestion3] = useState('');
    const [securityAnswer3, setSecurityAnswer3] = useState('');
    const [securityQuestionsError, setSecurityQuestionsError] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        const fetchSecurityQuestions = async () => {
            try {
                const questions = await getSecurityQuestions();
                setSecurityQuestions(questions);
            } catch (err) {
                console.error('Failed to load security questions:', err);
            }
        };

        fetchSecurityQuestions();
    }, []);

    const getTodayLocalDateString = () => {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };

    const todayDateString = getTodayLocalDateString();

    const isValidEmail = (value) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    };

    const handleEmailChange = async (e) => {
        const value = e.target.value;
        setEmail(value);
        setError('');
        setSuccess('');

        if (!value.trim()) {
            setShowEmailError(false);
            setEmailError('');
            return;
        }

        setShowEmailError(true);
        
        if (!isValidEmail(value)) {
            setEmailError('Email is not valid.');
            return;
        }

        // Check if email already exists
        try {
            const emailExists = await checkEmail(value);
            if (emailExists) {
                setEmailError('This email is already registered.');
            } else {
                setEmailError('');
            }
        } catch (err) {
            console.error('Error checking email:', err);
            setEmailError('');
        }
    };

    const handleDobChange = (e) => {
        const value = e.target.value;
        setDob(value);

        if (!value) {
            setDobError('');
            return;
        }

        if (value > todayDateString) {
            setDobError('Date of birth cannot be in the future.');
        } else {
            setDobError('');
        }
    };

    const handlePasswordChange = (e) => {
        const newPassword = e.target.value;
        setPassword(newPassword);
        
        const validation = validatePassword(newPassword);
        setPasswordErrors(validation.errors);
        
        if (newPassword.length > 0) {
            setShowPasswordErrors(true);
        } else {
            setShowPasswordErrors(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        // Validation
        if (!email.trim() || !isValidEmail(email)) {
            setError('Please enter a valid email address.');
            return;
        }

        if (!firstName.trim()) {
            setError('Please enter a first name.');
            return;
        }

        if (!lastName.trim()) {
            setError('Please enter a last name.');
            return;
        }

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
            setError('Please fix password errors before submitting.');
            return;
        }

        if (!role) {
            setError('Please select a role.');
            return;
        }

        // Validate security questions
        setSecurityQuestionsError('');
        if (
            !securityQuestion1 ||
            !securityQuestion2 ||
            !securityQuestion3 ||
            !securityAnswer1.trim() ||
            !securityAnswer2.trim() ||
            !securityAnswer3.trim()
        ) {
            setError('Please select and answer all 3 security questions.');
            return;
        }

        const uniqueQuestions = new Set([securityQuestion1, securityQuestion2, securityQuestion3]);
        if (uniqueQuestions.size !== 3) {
            setError('Please select 3 different security questions.');
            return;
        }

        // Check email again before submitting
        try {
            const emailExists = await checkEmail(email);
            if (emailExists) {
                setError('This email is already registered.');
                return;
            }
        } catch (err) {
            console.error('Error checking email:', err);
            setError('Error validating email. Please try again.');
            return;
        }

        setLoading(true);

        try {
            await admin_createUser(
                email,
                firstName,
                lastName,
                address || null,
                dob || null,
                password,
                role,
                securityQuestion1,
                securityAnswer1.trim(),
                securityQuestion2,
                securityAnswer2.trim(),
                securityQuestion3,
                securityAnswer3.trim()
            );

            setSuccess('User created successfully! Username will be auto-generated.');
            
            setEmail('');
            setFirstName('');
            setLastName('');
            setAddress('');
            setDob('');
            setPassword('');
            setPasswordErrors([]);
            setShowPasswordErrors(false);
            setRole('accountant');
            setSecurityQuestion1('');
            setSecurityAnswer1('');
            setSecurityQuestion2('');
            setSecurityAnswer2('');
            setSecurityQuestion3('');
            setSecurityAnswer3('');
            setSecurityQuestionsError('');
            setEmailError('');
            setShowEmailError(false);
            setDobError('');

            // delays navigation to admin dashboard so it can load -- replace with proper wait function later
            setTimeout(() => {
                navigate('/admin-dashboard');
            }, 2000);
        } catch (err) {
            console.error('Error creating user:', err);
            setError(err.message || 'Failed to create user. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleClear = () => {
        setEmail('');
        setFirstName('');
        setLastName('');
        setAddress('');
        setDob('');
        setPassword('');
        setPasswordErrors([]);
        setShowPasswordErrors(false);
        setRole('accountant');
        setSecurityQuestion1('');
        setSecurityAnswer1('');
        setSecurityQuestion2('');
        setSecurityAnswer2('');
        setSecurityQuestion3('');
        setSecurityAnswer3('');
        setSecurityQuestionsError('');
        setEmailError('');
        setShowEmailError(false);
        setDobError('');
        setError('');
        setSuccess('');
    };

    return (
        <div className="login-page">
            <main className="login-main">
                <form className="login-form" onSubmit={handleSubmit}>
                    <h1>Create New User</h1>
                    <p>Fill in the information below to create a new user account.</p>

                    {error && (
                        <div style={{ color: '#dc2626', fontSize: '14px', marginBottom: '12px', padding: '8px', background: '#fef2f2', borderRadius: '6px' }}>
                            {error}
                        </div>
                    )}

                    {success && (
                        <div style={{ color: '#059669', fontSize: '14px', marginBottom: '12px', padding: '8px', background: '#d1fae5', borderRadius: '6px' }}>
                            {success}
                        </div>
                    )}

                    <div className="form-field">
                        <h5>Email *</h5>
                        <input
                            className={`input ${showEmailError && emailError ? 'input-error' : ''}`}
                            type="email"
                            name="email"
                            placeholder="Email"
                            aria-label="email"
                            value={email}
                            onChange={handleEmailChange}
                            required
                        />
                        {showEmailError && emailError && (
                            <div className="error-messages" role="alert">
                                {emailError}
                            </div>
                        )}
                    </div>

                    <div className="form-grid-2">
                        <div className="form-field">
                            <h5>First Name *</h5>
                            <input
                                className="input"
                                type="text"
                                name="firstName"
                                placeholder="First Name"
                                aria-label="first name"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-field">
                            <h5>Last Name *</h5>
                            <input
                                className="input"
                                type="text"
                                name="lastName"
                                placeholder="Last Name"
                                aria-label="last name"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                required
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

                    <div className="form-field">
                        <h5>Date of Birth</h5>
                        <input
                            className={`input compact ${dobError ? 'input-error' : ''}`}
                            type="date"
                            name="dob"
                            placeholder="Date of Birth"
                            aria-label="date of birth"
                            value={dob}
                            onChange={handleDobChange}
                            max={todayDateString}
                        />
                        {dobError && (
                            <div className="error-messages" role="alert">
                                {dobError}
                            </div>
                        )}
                    </div>

                    <div className="form-field">
                        <h5>Password *</h5>
                        <input
                            className={`input ${showPasswordErrors && passwordErrors.length > 0 ? 'input-error' : ''}`}
                            type="password"
                            name="password"
                            placeholder="Password"
                            aria-label="password"
                            value={password}
                            onChange={handlePasswordChange}
                            required
                        />
                        {showPasswordErrors && passwordErrors.length > 0 && (
                            <div className="error-messages" role="alert">
                                <ul style={{ margin: '4px 0', paddingLeft: '20px', color: '#dc2626', fontSize: '13px' }}>
                                    {passwordErrors.map((error, index) => (
                                        <li key={index}>{error}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    <div className="form-field">
                        <h5>Role *</h5>
                        <select
                            className="input"
                            name="role"
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            required
                        >
                            {ROLES.map((r) => (
                                <option key={r} value={r}>
                                    {r.charAt(0).toUpperCase() + r.slice(1)}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div style={{ marginTop: '16px', marginBottom: '8px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>Security Questions *</h3>
                        <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '12px' }}>
                            Select and answer 3 different security questions.
                        </p>
                    </div>

                    {securityQuestionsError && (
                        <div className="error-messages" role="alert" style={{ marginBottom: '8px' }}>
                            {securityQuestionsError}
                        </div>
                    )}

                    <div className="form-field">
                        <h5>Security Question 1 *</h5>
                        <select
                            className="input"
                            aria-label="security question 1"
                            value={securityQuestion1}
                            onChange={(e) => setSecurityQuestion1(Number(e.target.value))}
                            required
                        >
                            <option value="" disabled>Select a question</option>
                            {securityQuestions.map((q) => (
                                <option
                                    key={q.questionID}
                                    value={q.questionID}
                                    disabled={
                                        q.questionID === securityQuestion2 ||
                                        q.questionID === securityQuestion3
                                    }
                                >
                                    {q.question}
                                </option>
                            ))}
                        </select>
                        <input
                            className="input"
                            type="text"
                            name="securityAnswer1"
                            placeholder="Answer"
                            aria-label="security answer 1"
                            value={securityAnswer1}
                            onChange={(e) => setSecurityAnswer1(e.target.value)}
                            required
                            style={{ marginTop: '8px' }}
                        />
                    </div>

                    <div className="form-field">
                        <h5>Security Question 2 *</h5>
                        <select
                            className="input"
                            aria-label="security question 2"
                            value={securityQuestion2}
                            onChange={(e) => setSecurityQuestion2(Number(e.target.value))}
                            required
                        >
                            <option value="" disabled>Select a question</option>
                            {securityQuestions.map((q) => (
                                <option
                                    key={q.questionID}
                                    value={q.questionID}
                                    disabled={
                                        q.questionID === securityQuestion1 ||
                                        q.questionID === securityQuestion3
                                    }
                                >
                                    {q.question}
                                </option>
                            ))}
                        </select>
                        <input
                            className="input"
                            type="text"
                            name="securityAnswer2"
                            placeholder="Answer"
                            aria-label="security answer 2"
                            value={securityAnswer2}
                            onChange={(e) => setSecurityAnswer2(e.target.value)}
                            required
                            style={{ marginTop: '8px' }}
                        />
                    </div>

                    <div className="form-field">
                        <h5>Security Question 3 *</h5>
                        <select
                            className="input"
                            aria-label="security question 3"
                            value={securityQuestion3}
                            onChange={(e) => setSecurityQuestion3(Number(e.target.value))}
                            required
                        >
                            <option value="" disabled>Select a question</option>
                            {securityQuestions.map((q) => (
                                <option
                                    key={q.questionID}
                                    value={q.questionID}
                                    disabled={
                                        q.questionID === securityQuestion1 ||
                                        q.questionID === securityQuestion2
                                    }
                                >
                                    {q.question}
                                </option>
                            ))}
                        </select>
                        <input
                            className="input"
                            type="text"
                            name="securityAnswer3"
                            placeholder="Answer"
                            aria-label="security answer 3"
                            value={securityAnswer3}
                            onChange={(e) => setSecurityAnswer3(e.target.value)}
                            required
                            style={{ marginTop: '8px' }}
                        />
                    </div>

                    <div className="button-row" role="group">
                        <button type="submit" disabled={loading}>
                            {loading ? 'Creating...' : 'Create User'}
                        </button>
                        <button type="button" onClick={handleClear} disabled={loading}>
                            Clear
                        </button>
                    </div>

                    <div className="cancel-wrap">
                        <button 
                            type="button" 
                            className="cancel-button" 
                            onClick={() => navigate('/admin-dashboard')}
                            disabled={loading}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </main>
        </div>
    );
}

export default CreateUserPage;
