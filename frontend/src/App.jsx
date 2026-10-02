import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { lazy, Suspense, useEffect } from 'react';
import useAuthStore from './store/useAuthStore';
import AuthLayout from './components/AuthLayout';
import MainLayout from './components/MainLayout';
import TopLoader from './components/TopLoader';
import useGlobalShortcuts from './hooks/useGlobalShortcuts';
import { Lottie } from 'lottie-react';
import loadingAnimation from './assets/Loading V2/loadingV2.json';

// Lazy-loaded pages — each is a separate JS chunk, loaded only when visited
const SignIn         = lazy(() => import('./pages/SignIn'));
const SignUp         = lazy(() => import('./pages/SignUp'));
const VerifyOTP      = lazy(() => import('./pages/VerifyOTP'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const OnboardingFlow = lazy(() => import('./pages/Onboarding/OnboardingFlow'));
const Dashboard      = lazy(() => import('./pages/Dashboard'));
const Profile        = lazy(() => import('./pages/Profile'));
const IDE            = lazy(() => import('./pages/IDE'));
const CreateRepo     = lazy(() => import('./pages/CreateRepo'));
const RepoDetail     = lazy(() => import('./pages/RepoDetail'));
const Notifications  = lazy(() => import('./pages/Notifications'));

const PageFallback = () => (
  <div className="flex items-center justify-center w-full h-full py-20">
    <Lottie 
      animationData={loadingAnimation} 
      loop={true} 
      autoplay={true} 
      className="w-20 h-20 opacity-80" 
    />
  </div>
);

// Mounts the global keyboard shortcuts hook inside Router (needs useNavigate)
function GlobalShortcuts() {
  useGlobalShortcuts();
  return null;
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <Suspense fallback={<PageFallback />}>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/verify" element={<VerifyOTP />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
        </Routes>
      </AnimatePresence>
    </Suspense>
  );
}

function App() {
  const initializeAuth = useAuthStore((state) => state.initializeAuth);

  // Bootstrap auth once on mount — handles the access token refresh
  // automatically via the axios interceptor if only a refreshToken cookie exists.
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return (
    <Router>
      <TopLoader />
      <GlobalShortcuts />
      <Routes>
        <Route path="/onboarding" element={
          <Suspense fallback={<PageFallback />}>
            <OnboardingFlow />
          </Suspense>
        } />
        <Route path="/dashboard" element={
          <Suspense fallback={<PageFallback />}>
            <MainLayout>
              <Dashboard />
            </MainLayout>
          </Suspense>
        } />
        <Route path="/profile" element={
          <Suspense fallback={<PageFallback />}>
            <MainLayout>
              <Profile />
            </MainLayout>
          </Suspense>
        } />
        <Route path="/u/:username" element={
          <Suspense fallback={<PageFallback />}>
            <MainLayout>
              <Profile />
            </MainLayout>
          </Suspense>
        } />
        <Route path="/ide" element={
          <Suspense fallback={<PageFallback />}>
            <IDE />
          </Suspense>
        } />
        <Route path="/notifications" element={
          <Suspense fallback={<PageFallback />}>
            <MainLayout>
              <Notifications />
            </MainLayout>
          </Suspense>
        } />
        <Route path="/new/repository" element={
          <Suspense fallback={<PageFallback />}>
            <MainLayout>
              <CreateRepo />
            </MainLayout>
          </Suspense>
        } />
        <Route path="/repo/:owner/:repo" element={
          <Suspense fallback={<PageFallback />}>
            <MainLayout>
              <RepoDetail />
            </MainLayout>
          </Suspense>
        } />
        <Route path="/repo/:owner/:repo/*" element={
          <Suspense fallback={<PageFallback />}>
            <MainLayout>
              <RepoDetail />
            </MainLayout>
          </Suspense>
        } />
        <Route element={<AuthLayout />}>
          <Route path="/*" element={<AnimatedRoutes />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
