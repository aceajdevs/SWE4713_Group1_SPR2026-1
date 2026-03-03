import { HashRouter as Router, Route, Routes, useLocation } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import WelcomeScreen from './pages/welcomeScreen'
import DashboardInitial from './pages/initDashboard'
import Navbar from './navbar'
import { AuthProvider } from './AuthContext'
import ForgotPasswordPage from './pages/ForgotPassword'
import SignUpPage from './pages/SignUpPage'

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
        <Route path="/forgot-password" element={<ForgotPasswordPage/>} />
        <Route path="/signup" element={<SignUpPage/>} />
      </Routes>
    </>
  );
}

function App() {
  return(
    <AuthProvider>
      <Router>
        <Navbar />
        <Routes>
          <Route path="/" element={<WelcomeScreen/>} />
          <Route path="/login" element={<LoginPage/>} />
          <Route path="/dashboard" element={<DashboardInitial/>} />
          <Route path="*" element={<h1>404 Not Found</h1>} />
          <Route path="/profile" element={<h1>Profile Page</h1>} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App
