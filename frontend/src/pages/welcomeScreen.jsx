import React from 'react';
import './welcomeScreen.css';
import { useNavigate } from 'react-router-dom';
import logo from '../../assets/Images/resourceDirectory/logo.png';
import PageHelpCorner from '../components/PageHelpCorner';
import { HelpTooltip } from '../components/HelpTooltip';


function WelcomeScreen() {
    const navigate = useNavigate();

    const navToLogin = () => {
        navigate('/login');
    }

  return (
    <div className="welcome-screen">
      <PageHelpCorner topic="getting-started" />
      <header className="login-header">
      </header>

      <main className="welcome-main">
        <div className="welcome-card">
          <h1>Welcome to</h1>
          <div className="logo" aria-hidden="true">
            <img src={logo} alt="App Logo" />
          </div>
          <p>Please log in to continue.</p>
          <div className="actions">
            <HelpTooltip text="Open the sign-in page to enter your username and password.">
              <button type="button" className="button-primary" onClick={navToLogin}>
                Login
              </button>
            </HelpTooltip>
          </div>
        </div>
      </main>
    </div>
  );
}

export default WelcomeScreen;