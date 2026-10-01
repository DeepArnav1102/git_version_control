import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';

// Configure NProgress once
NProgress.configure({
  showSpinner: false,   // hide the spinner circle
  minimum: 0.1,
  speed: 250,
  trickleSpeed: 100,
});

/**
 * TopLoader — mounts inside <Router> and starts/stops the NProgress bar
 * on every route change. Rendered once in App.jsx.
 */
export default function TopLoader() {
  const location = useLocation();

  useEffect(() => {
    NProgress.start();
    // A tiny delay lets the bar appear before the new page renders
    const timer = setTimeout(() => NProgress.done(), 300);
    return () => {
      clearTimeout(timer);
      NProgress.done();
    };
  }, [location.pathname, location.search]);

  return null; // purely side-effect component, renders nothing
}
