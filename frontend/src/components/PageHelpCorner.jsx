import { useNavigate } from 'react-router-dom';
import { HelpTooltip } from './HelpTooltip';
import './PageHelpCorner.css';

/**
 * Microsoft-style entry to the user manual from pages that do not show the main navbar.
 * Optional `topic` scrolls that section on the manual (must match a section id there).
 */
export default function PageHelpCorner({ topic }) {
  const navigate = useNavigate();

  const openHelp = () => {
    if (topic) {
      navigate(`/help?topic=${encodeURIComponent(topic)}`);
    } else {
      navigate('/help');
    }
  };

  return (
    <HelpTooltip text="Open the user manual and help topics for this screen.">
      <button
        type="button"
        className="page-help-corner"
        onClick={openHelp}
        aria-label="Open help and user manual"
      >
        Help
      </button>
    </HelpTooltip>
  );
}
