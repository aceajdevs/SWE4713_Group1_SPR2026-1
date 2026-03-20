import { useState } from 'react'
import '../LoginPage.css'
import logo from '../../assets/Images/resourceDirectory/logo.png'
import { useNavigate } from 'react-router-dom';
import { validatePassword } from '../utils/passwordValidation';
import { checkEmail, getUserSecurityQuestions, verifySecurityAnswers, updateUserPassword, isPasswordReused } from '../services/userService';

function ForgotPasswordPage() {
    const navigate = useNavigate();

    const [step, setStep] = useState(1);

    const [email, setEmail] = useState('');
    const [userId, setUserId] = useState('');

    const [securityQuestion1, setSecurityQuestion1] = useState('');
    const [securityQuestion2, setSecurityQuestion2] = useState('');
    const [securityQuestion3, setSecurityQuestion3] = useState('');
    const [securityAnswer1, setSecurityAnswer1] = useState('');
    const [securityAnswer2, setSecurityAnswer2] = useState('');
    const [securityAnswer3, setSecurityAnswer3] = useState('');
    const [loadingQuestions, setLoadingQuestions] = useState(false);

    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [passwordErrors, setPasswordErrors] = useState([]);
    const [showPasswordErrors, setShowPasswordErrors] = useState(false);
    const [confirmPasswordError, setConfirmPasswordError] = useState('');

    const [generalError, setGeneralError] = useState('');

    const handleStartReset = async (e) => {
        e.preventDefault();
        setGeneralError('');

        if (!email.trim() || !userId.trim()) {
            setGeneralError('Please enter both your email address and user ID.');
            return;
        }
        try {
            const emailExists = await checkEmail(email);
            console.log('Email exists:', emailExists);
            if(emailExists) {
                setLoadingQuestions(true);
                try {
                    const questions = await getUserSecurityQuestions(email, userId);
                    if (questions && questions.question1 && questions.question2 && questions.question3) {
                        setSecurityQuestion1(questions.question1);
                        setSecurityQuestion2(questions.question2);
                        setSecurityQuestion3(questions.question3);
                        setStep(2);
                    } else {
                        setGeneralError('Could not retrieve security questions. Please contact support.');
                    }
                } catch (qError) {
                    console.error('Error fetching security questions:', qError);
                    setGeneralError('Error loading security questions. Please try again.');
                } finally {
                    setLoadingQuestions(false);
                }
            }
            else {
                setGeneralError('Email does not exist. Please try again.');
                return;
            }
        } catch (error) {
            console.error('Error checking email:', error);
            setGeneralError('Error checking email. Please try again.');
            return;
        }
    };

    const handleSecurityQuestionsSubmit = async (e) => {
        e.preventDefault();
        setGeneralError('');

        if (!securityAnswer1.trim() || !securityAnswer2.trim() || !securityAnswer3.trim()) {
            setGeneralError('Please answer all security questions.');
            return;
        }

        try {
            const isValid = await verifySecurityAnswers(email, userId, securityAnswer1, securityAnswer2, securityAnswer3);
            if (isValid) {
                setStep(3);
            } else {
                setGeneralError('One or more security answers are incorrect. Please try again.');
            }
        } catch (error) {
            console.error('Error verifying security answers:', error);
            setGeneralError('Error verifying answers. Please try again.');
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

    const handleNewPasswordSubmit = async (e) => {
        e.preventDefault();
        setGeneralError('');

        const validation = validatePassword(newPassword);
        setPasswordErrors(validation.errors);
        setShowPasswordErrors(true);

        if (newPassword !== confirmNewPassword) {
            setConfirmPasswordError('Passwords do not match');
            return;
        }

        if (!validation.isValid) {
            return;
        }

        try {
            const reused = await isPasswordReused(userId, newPassword);
            if (reused) {
                setGeneralError('Password used in the past cannot be used when password is reset.');
                console.log('Password reused');
                return;
            }

            await updateUserPassword(parseInt(userId, 10), newPassword);
            navigate('/login');
        } catch (error) {
            console.error('Error updating password:', error);
            setGeneralError('Error saving new password. Please try again.');
        }
    };

    const handleClearAll = () => {
        setEmail('');
        setUserId('');
        setSecurityQuestion1('');
        setSecurityQuestion2('');
        setSecurityQuestion3('');
        setSecurityAnswer1('');
        setSecurityAnswer2('');
        setSecurityAnswer3('');
        setNewPassword('');
        setConfirmNewPassword('');
        setPasswordErrors([]);
        setShowPasswordErrors(false);
        setConfirmPasswordError('');
        setGeneralError('');
        setStep(1);
    };

    const navToWelcome = () => {
        navigate('/');
    }

    return (
        <div className="login-page">
            <header className="login-header">
                <div className="logo" aria-hidden="true">
                    <img src={logo} alt="App Logo" />
                </div>
            </header>

            <main className="login-main">
                <form className="login-form">
                    <h1>Forgot Password</h1>
                    <p>
                        Follow the steps below to reset your password. First confirm your identity,
                        then answer your security questions, and finally choose a new password.
                    </p>

                    {generalError && (
                        <div className="error-messages" role="alert" style={{ marginBottom: '8px' }}>
                            {generalError}
                        </div>
                    )}

                    {step === 1 && (
                        <>
                            <h5>Email</h5>
                            <input
                                className="input"
                                type="email"
                                name="email"
                                placeholder="Email"
                                aria-label="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />

                            <h5>User ID</h5>
                            <input
                                className="input"
                                type="text"
                                name="userId"
                                placeholder="User ID"
                                aria-label="user id"
                                value={userId}
                                onChange={(e) => setUserId(e.target.value)}
                                required
                            />

                            <div className="button-row" role="group">
                                <button type="button" onClick={handleClearAll}>Clear</button>
                                <button type="button" className="login-button" onClick={handleStartReset}>
                                    Continue
                                </button>
                            </div>
                        </>
                    )}

                    {step === 2 && (
                        <>
                            {loadingQuestions ? (
                                <p>Loading security questions...</p>
                            ) : (
                                <>
                                    <h5>Security Question 1</h5>
                                    <input
                                        className="input"
                                        type="text"
                                        name="securityAnswer1"
                                        placeholder={securityQuestion1 || 'Loading question...'}
                                        aria-label="security question 1"
                                        value={securityAnswer1}
                                        onChange={(e) => setSecurityAnswer1(e.target.value)}
                                        required
                                        disabled={!securityQuestion1}
                                    />

                                    <h5>Security Question 2</h5>
                                    <input
                                        className="input"
                                        type="text"
                                        name="securityAnswer2"
                                        placeholder={securityQuestion2 || 'Loading question...'}
                                        aria-label="security question 2"
                                        value={securityAnswer2}
                                        onChange={(e) => setSecurityAnswer2(e.target.value)}
                                        required
                                        disabled={!securityQuestion2}
                                    />

                                    <h5>Security Question 3</h5>
                                    <input
                                        className="input"
                                        type="text"
                                        name="securityAnswer3"
                                        placeholder={securityQuestion3 || 'Loading question...'}
                                        aria-label="security question 3"
                                        value={securityAnswer3}
                                        onChange={(e) => setSecurityAnswer3(e.target.value)}
                                        required
                                        disabled={!securityQuestion3}
                                    />
                                </>
                            )}

                            <div className="button-row" role="group">
                                <button type="button" onClick={handleClearAll}>Clear</button>
                                <button type="button" onClick={() => setStep(1)}>Back</button>
                                <button type="button" className="login-button" onClick={handleSecurityQuestionsSubmit}>
                                    Continue
                                </button>
                            </div>
                        </>
                    )}

                    {step === 3 && (
                        <>
                            <h5>New Password</h5>
                            <input
                                className={`input ${showPasswordErrors && passwordErrors.length > 0 ? 'input-error' : ''}`}
                                type="password"
                                name="newPassword"
                                placeholder="New Password"
                                aria-label="new password"
                                value={newPassword}
                                onChange={handleNewPasswordChange}
                                required
                            />

                            {showPasswordErrors && passwordErrors.length > 0 && (
                                <div className="error-messages" role="alert">
                                    <ul>
                                        {passwordErrors.map((error, index) => (
                                            <li key={index}>{error}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <h5>Confirm New Password</h5>
                            <input
                                className={`input ${confirmPasswordError ? 'input-error' : ''}`}
                                type="password"
                                name="confirmNewPassword"
                                placeholder="Confirm New Password"
                                aria-label="confirm new password"
                                value={confirmNewPassword}
                                onChange={handleConfirmNewPasswordChange}
                                required
                            />

                            {confirmPasswordError && (
                                <div className="error-messages" role="alert">
                                    {confirmPasswordError}
                                </div>
                            )}

                            <div className="button-row" role="group">
                                <button type="button" onClick={handleClearAll}>Clear</button>
                                <button type="button" onClick={() => setStep(2)}>Back</button>
                                <button type="button" className="login-button" onClick={handleNewPasswordSubmit}>
                                    Save New Password
                                </button>
                            </div>
                        </>
                    )}

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
export default ForgotPasswordPage;