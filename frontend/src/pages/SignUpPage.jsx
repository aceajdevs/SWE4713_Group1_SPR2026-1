import React, { useState, useEffect } from 'react'
import '../LoginPage.css'
import logo from '../../assets/Images/resourceDirectory/logo.png'
import { useNavigate } from 'react-router-dom';
import { validatePassword } from '../utils/passwordValidation';
import { hashPassword } from '../utils/passwordHash';
import { createUser, createUserRequest, getSecurityQuestions } from '../services/userService';

function SignUpPage() {
    const navigate = useNavigate();
    const [securityQuestions, setSecurityQuestions] = useState([]);

    const [step, setStep] = useState(1); // 1 = info/password, 2 = security questions

    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [address, setAddress] = useState('');
    const [dob, setDob] = useState('');
    const [dobError, setDobError] = useState('');
    const [email, setemail] = useState('');
    const [emailError, setEmailError] = useState('');
    const [showEmailError, setShowEmailError] = useState(false);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordErrors, setPasswordErrors] = useState([]);
    const [showPasswordErrors, setShowPasswordErrors] = useState(false);
    const [confirmPasswordError, setConfirmPasswordError] = useState('');

    const [securityQuestion1, setSecurityQuestion1] = useState('');
    const [securityAnswer1, setSecurityAnswer1] = useState('');
    const [securityQuestion2, setSecurityQuestion2] = useState('');
    const [securityAnswer2, setSecurityAnswer2] = useState('');
    const [securityQuestion3, setSecurityQuestion3] = useState('');
    const [securityAnswer3, setSecurityAnswer3] = useState('');
    const [securityQuestionsError, setSecurityQuestionsError] = useState('');

    useEffect(() => {
        const fetchSecurityQuestions = async () => {
            try {
                const questions = await getSecurityQuestions();
                setSecurityQuestions(questions);
            } catch (error) {
                console.error('Failed to load security questions:', error);
            }
        };

        fetchSecurityQuestions();
    }, []);

    const isValidEmail = (value) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    };

    const getTodayLocalDateString = () => {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };

    const todayDateString = getTodayLocalDateString();


    
    const handleEmailChange = (e) => {
        const value = e.target.value;
        setemail(value);

        if (!value.trim()) {
            setShowEmailError(false);
            setEmailError('');
            return;
        }

        setShowEmailError(true);
        setEmailError(isValidEmail(value) ? '' : 'Email is not valid.');
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

        if (confirmPassword && newPassword === confirmPassword) {
            setConfirmPasswordError('');
        }
    };

    const handleConfirmPasswordChange = (e) => {
        const newConfirmPassword = e.target.value;
        setConfirmPassword(newConfirmPassword);
        
        if (newConfirmPassword && newConfirmPassword !== password) {
            setConfirmPasswordError('Passwords do not match');
        } else {
            setConfirmPasswordError('');
        }
    };

    const handleClear = () => {
        setStep(1);
        setFirstName('');
        setLastName('');
        setAddress('');
        setDob('');
        setDobError('');
        setemail('');
        setEmailError('');
        setShowEmailError(false);
        setPassword('');
        setConfirmPassword('');
        setPasswordErrors([]);
        setShowPasswordErrors(false);
        setConfirmPasswordError('');
        setSecurityQuestion1('');
        setSecurityAnswer1('');
        setSecurityQuestion2('');
        setSecurityAnswer2('');
        setSecurityQuestion3('');
        setSecurityAnswer3('');
        setSecurityQuestionsError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (step === 1) {
            const emailValid = isValidEmail(email);
            setShowEmailError(true);
            setEmailError(emailValid ? '' : 'Not a proper email');

            const dobValid = !!dob && dob <= todayDateString;
            setDobError(dobValid ? '' : 'Date of birth cannot be in the future.');

            const validation = validatePassword(password);
            setPasswordErrors(validation.errors);
            setShowPasswordErrors(true);

            if (password !== confirmPassword) {
                setConfirmPasswordError('Passwords do not match');
            } else {
                setConfirmPasswordError('');
            }

            if (
                validation.isValid &&
                password === confirmPassword &&
                email.trim() &&
                emailValid &&
                firstName.trim() &&
                lastName.trim() &&
                address.trim() &&
                dob.trim() &&
                dobValid
            ) {
                setStep(2);
            }

            return;
        }

        setSecurityQuestionsError('');

        if (
            !securityQuestion1 ||
            !securityQuestion2 ||
            !securityQuestion3 ||
            !securityAnswer1.trim() ||
            !securityAnswer2.trim() ||
            !securityAnswer3.trim()
        ) {
            setSecurityQuestionsError('Please select and answer all 3 security questions.');
            return;
        }

        const uniqueQuestions = new Set([securityQuestion1, securityQuestion2, securityQuestion3]);
        if (uniqueQuestions.size !== 3) {
            setSecurityQuestionsError('Please select 3 different security questions.');
            return;
        }

        try {
            const hashedPassword = await hashPassword(password);
            console.log('Signup request data:', {
                firstName,
                lastName,
                address,
                dob,
                email,
                passwordHash: hashedPassword,
                securityQuestions: [
                    { questionId: securityQuestion1, answer: securityAnswer1 },
                    { questionId: securityQuestion2, answer: securityAnswer2 },
                    { questionId: securityQuestion3, answer: securityAnswer3 },
                ],
            });

            const result = await createUserRequest(
                email,
                firstName,
                lastName,
                address,
                dob,
                password,
                securityQuestion1,
                securityAnswer1,
                securityQuestion2,
                securityAnswer2,
                securityQuestion3,
                securityAnswer3
            );

            if (!result) {
                alert('Signup request could not be created. Please try again.');
                return;
            }

            navigate('/login');
        } catch (error) {
            console.error('Error creating signup request:', error);
            alert('Signup request failed. Please check your information and try again.');
        }
    };

    const navToWelcome = () => {
        navigate('/');
    }

    const navToLogin = () => {
        navigate('/login');
    }

    return (
        <div className="login-page">
            <header className="login-header">
                <div className="logo" aria-hidden="true">
                    <img src={logo} alt="App Logo" />
                </div>
            </header>

            <main className="login-main">
                <form className="login-form" onSubmit={handleSubmit}>
                    <h1>Sign Up</h1>
                    <p>Request access to the application. Please enter your information.</p>
                    
                    {step === 1 && (
                        <>
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
                                        required
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
                                        required
                                    />
                                </div>
                            </div>

                            <h5>Address</h5>
                            <input
                                className="input"
                                type="text"
                                name="address"
                                placeholder="Address"
                                aria-label="address"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                required
                            />

                            <div className="form-grid-2">
                                <div className="form-field">
                                    <h5>Email</h5>
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
                                <div className="form-field">
                                    <h5>Date of Birth</h5>
                                    <input
                                        className={`input compact ${dobError ? 'input-error' : ''}`}
                                        type="date"
                                        name="dob"
                                        aria-label="date of birth"
                                        value={dob}
                                        onChange={handleDobChange}
                                        max={todayDateString}
                                        required
                                    />
                                    {dobError && (
                                        <div className="error-messages" role="alert">
                                            {dobError}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="form-grid-2">
                                <div className="form-field">
                                    <h5>Password</h5>
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
                                    <h5>Confirm Password</h5>
                                    <input
                                        className={`input ${confirmPasswordError ? 'input-error' : ''}`}
                                        type="password"
                                        name="confirmPassword"
                                        placeholder="Confirm Password"
                                        aria-label="confirm password"
                                        value={confirmPassword}
                                        onChange={handleConfirmPasswordChange}
                                        required
                                    />

                                    {confirmPasswordError && (
                                        <div className="error-messages" role="alert" style={{ color: '#dc2626', fontSize: '13px', marginTop: '4px' }}>
                                            {confirmPasswordError}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="button-row" role="group">
                                <button type="submit" className="login-button">Submit Request</button>
                                <button type="button" onClick={handleClear}>Clear</button>
                            </div>
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <p style={{ marginBottom: '8px' }}>
                                Choose 3 security questions and provide your answers.
                            </p>

                            {securityQuestionsError && (
                                <div className="error-messages" role="alert" style={{ marginBottom: '8px' }}>
                                    {securityQuestionsError}
                                </div>
                            )}

                            <div className="form-field">
                                <h5>Security Question 1</h5>
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
                                />
                            </div>

                            <div className="form-field">
                                <h5>Security Question 2</h5>
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
                                />
                            </div>

                            <div className="form-field">
                                <h5>Security Question 3</h5>
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
                                />
                            </div>

                            <div className="button-row" role="group">
                                <button type="button" onClick={() => { setSecurityQuestionsError(''); setStep(1); }}>
                                    Back
                                </button>
                                <button type="submit" className="login-button">Finish Signup</button>
                                <button type="button" onClick={handleClear}>Clear</button>
                            </div>
                        </>
                    )}

                    <div className="button-row" role="group">
                        <button type="button" onClick={navToLogin}>
                            Already have an account? 
                        </button>
                    </div>
                    <div className="cancel-wrap">
                        <button type="button" className="cancel-button" onClick={navToWelcome}>
                            Cancel
                        </button>
                    </div>

                    
                </form>
            </main>
        </div>
    )
}

export default SignUpPage
