import { HashRouter as Router, Route, Routes, useLocation } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import WelcomeScreen from './pages/welcomeScreen'
import DashboardInitial from './pages/initDashboard'
import Navbar from './navbar'
import { AuthProvider } from './AuthContext'
import ForgotPasswordPage from './pages/ForgotPassword'
import SignUpPage from './pages/SignUpPage'
import AdminDashboard from './pages/admin-dashboard';
import AdminEditUserPage from './pages/AdminEditUserPage';
import AccountantDashboard from './pages/accountant-dashboard'
import ManagerDashboard from './pages/manager-dashboard'
import UserAccountRequestPage from './pages/user-account-request'
import CreateUserPage from './pages/CreateUserPage'
import ChartOfAccounts from './pages/ChartOfAccounts'
import AccountForm from './pages/AccountForm'
import { checkPasswordsAboutToExpire } from './services/passwordExpiryService';
import { useEffect } from 'react';

function AppLayout() {
  const location = useLocation();
  const hideNavbar = location.pathname === '/login' || location.pathname === '/signup' || location.pathname === '/forgot-password' || location.pathname === '/';
  useEffect(() => {
    const runCheck = async () => {
      const expiring = await checkPasswordsAboutToExpire(3);
      if (expiring.length === 0) {
        console.log('[PasswordExpiryCheck] No passwords about to expire');
      } else {
        console.log('[PasswordExpiryCheck] Passwords about to expire:', expiring);
      }
    };
  
    // Run once immediately
    runCheck();
  
    // Then every 30 minutes
    const intervalId = setInterval(runCheck, 30 * 60 * 1000);
  
    return () => clearInterval(intervalId);
  }, []);
  return (
    <>
      {!hideNavbar && <Navbar />}
      <Routes>
        <Route path="/" element={<WelcomeScreen/>} />
        <Route path="/login" element={<LoginPage/>} />
        <Route path="/dashboard" element={<DashboardInitial/>} />
        <Route path='/admin-dashboard' element={<AdminDashboard />} />
        <Route path="/admin/user-account-request" element={<UserAccountRequestPage />} />
        <Route path="/admin/create-user" element={<CreateUserPage />} />
        <Route path="/admin/edit-user" element={<AdminEditUserPage />} />
        <Route path="/admin/chart-of-accounts" element={<ChartOfAccounts />} />
        <Route path="/admin/add-account" element={<AccountForm />} />
        <Route path="/admin/edit-account/:id" element={<AccountForm />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage/>} />
        <Route path="/signup" element={<SignUpPage/>} />
        <Route path="/accountant-dashboard" element={<AccountantDashboard/>} />
        <Route path="/manager-dashboard" element={<ManagerDashboard/>} />
      </Routes>
    </>
  );
}

function App() {
  return(
    <AuthProvider>
      <Router>
        <AppLayout />
      </Router>
    </AuthProvider>
  )
}

export default App
