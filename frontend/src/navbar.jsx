import React, { useState } from 'react';
import './navbar.css';
import logo from '../assets/Images/resourceDirectory/logo.png';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

function Navbar() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleNavigation = (path) => {
    navigate(path);
    setIsMenuOpen(false);
  };

  const handleChartOfAccountsNavigation = () => {
    if (user && user.role === 'administrator') {
      handleNavigation('/chart-of-accounts');
      return;
    } else {
      handleNavigation('/chart-of-accounts');
      return;
    }
  };
  const handleDashboardNavigation = () => {
    if (user && user.role) {
      if (user.role === 'administrator') {
        handleNavigation('/admin-dashboard');
        return;
      }
      if (user.role === 'manager') {
        handleNavigation('/manager-dashboard');
        return;
      }
      if (user.role === 'accountant') {
        handleNavigation('/accountant-dashboard');
        return;
      }
    }
    handleNavigation('/dashboard');
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
    setIsMenuOpen(false);
  };
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div
          className="navbar-logo"
          onClick={(e) => {
            e.preventDefault();
            handleDashboardNavigation();
          }}
        >
          <img src={logo} alt="App Logo" className="navbar-logo-img" />
          <span className="navbar-brand">Dashboard</span>
        </div>

        <div className="hamburger" onClick={toggleMenu}>
          <span className={isMenuOpen ? 'open' : ''}></span>
          <span className={isMenuOpen ? 'open' : ''}></span>
          <span className={isMenuOpen ? 'open' : ''}></span>
        </div>

        <ul className={`nav-menu ${isMenuOpen ? 'active' : ''}`}>
          <li className="nav-item">
            <a
              href="#"
              className="nav-link"
              onClick={(e) => {
                e.preventDefault();
                handleDashboardNavigation();
              }}
            >
              Dashboard
            </a>
          </li>
          {user && user.role === 'administrator' && (
            <>
              <li className="nav-item">
                <a
                  href="#/admin/user-account-request"
                  className="nav-link"
                  onClick={() => handleNavigation('/admin/user-account-request')}
                >
                  User Account Requests
                </a>
              </li>
                <li className="nav-item">
                  <a
                    href="#/admin/chart-of-accounts"
                    className="nav-link"
                    onClick={() => handleNavigation('/admin/chart-of-accounts')}
                  >
                    Chart of Accounts
                  </a>
                </li>
              <li className="nav-item">
                <a
                  href="#/admin/create-user"
                  className="nav-link"
                  onClick={() => handleNavigation('/admin/create-user')}
                >
                  Create User
                </a>
              </li>
            </>
          )}
          <li className="nav-item">
            <a
              href="#/help"
              className="nav-link"
              onClick={(e) => {
                e.preventDefault();
                handleNavigation('/help');
              }}
            >
              Help
            </a>
          </li>
          {user && (
            <li className="nav-item nav-user-section">
              <div className="nav-user-display">
                <div className="nav-user-avatar">
                  {user.picture_path || user.picturePath ? (
                    <img 
                      src={user.picture_path || user.picturePath} 
                      alt={`${user.username}'s profile`}
                      className="nav-user-img"
                      onError={(e) => {
                        // placeholder if image fails to load
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div 
                    className="nav-user-placeholder"
                    style={{ display: (user.picture_path || user.picturePath) ? 'none' : 'flex' }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" fill="#9CA3AF"/>
                      <path d="M12 14C7.58172 14 4 16.6863 4 20V22H20V20C20 16.6863 16.4183 14 12 14Z" fill="#9CA3AF"/>
                    </svg>
                  </div>
                </div>
                <div className="nav-user-info">
                  <span className="nav-username">{user.username}</span>
                  <span className="nav-user-role">{user.role}</span>
                </div>
              </div>
            </li>
          )}
          <li className="nav-item">
            <button className="nav-logout-btn" onClick={handleLogout}>Logout</button>
          </li>
        </ul>
      </div>
    </nav>
  );
}

export default Navbar;

