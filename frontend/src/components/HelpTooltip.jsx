import { cloneElement, isValidElement, useId, useEffect, useRef, useState } from 'react';
import './HelpTooltip.css';

/**
 * children = (input, button, select).
 */
export function HelpTooltip({ text, children, className = '' }) {
  const tipId = useId();
  const hoverDelayMs = 800;
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);
  const wrapperRef = useRef(null);

  if (!text) {
    return children;
  }

  if (!isValidElement(children)) {
    return children;
  }

  const existing = children.props['aria-describedby'];
  const describedBy = [existing, tipId].filter(Boolean).join(' ');

  const child = cloneElement(children, {
    'aria-describedby': describedBy,
  });

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, []);

  const show = () => setVisible(true);
  const hide = () => {
    clearTimer();
    setVisible(false);
  };

  const startHoverTimer = () => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      setVisible(true);
      timerRef.current = null;
    }, hoverDelayMs);
  };

  const handleMouseEnter = () => {
    // Delay only for mouse hover, to match typical product help behavior.
    startHoverTimer();
  };

  const handleMouseLeave = () => {
    // If a child is focused (keyboard navigation), keep the tooltip visible.
    if (wrapperRef.current && wrapperRef.current.contains(document.activeElement)) {
      clearTimer();
      return;
    }
    hide();
  };

  const handleFocusCapture = () => {
    clearTimer();
    show(); // Show immediately when focused for accessibility.
  };

  const handleBlurCapture = (e) => {
    // If focus moved to another element inside this wrapper, don't hide.
    const next = e.relatedTarget;
    if (wrapperRef.current && next && wrapperRef.current.contains(next)) {
      return;
    }
    hide();
  };

  return (
    <span
      ref={wrapperRef}
      className={`help-tooltip-wrap ${className}`.trim()}
      data-visible={visible ? 'true' : 'false'}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocusCapture={handleFocusCapture}
      onBlurCapture={handleBlurCapture}
    >
      {child}
      <span id={tipId} role="tooltip" className="help-tooltip-bubble">
        {text}
      </span>
    </span>
  );
}
