import { HashRouter as Router, Route, Routes, useLocation } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import WelcomeScreen from './pages/welcomeScreen'
import DashboardInitial from './pages/initDashboard'
import Navbar from './navbar'
import { AuthProvider } from './AuthContext'
import ForgotPasswordPage from './pages/ForgotPassword'
import SignUpPage from './pages/SignUpPage'
import AdminDashboard from './pages/admin-dashboard';
import AccountantDashboard from './pages/accountant-dashboard'
import ManagerDashboard from './pages/manager-dashboard'

function AppLayout() {
  const location = useLocation();
  const hideNavbar = location.pathname === '/login' || location.pathname === '/signup' || location.pathname === '/forgot-password' || location.pathname === '/';

  return (
    <>
      {!hideNavbar && <Navbar />}
      <Routes>
        <Route path="/" element={<WelcomeScreen/>} />
        <Route path="/login" element={<LoginPage/>} />
        <Route path="/dashboard" element={<DashboardInitial/>} />
        <Route path='/admin-dashboard' element={<AdminDashboard />} />
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
