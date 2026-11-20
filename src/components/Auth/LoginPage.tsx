import React, { useState, useEffect, useMemo } from 'react';
import {
  Network,
  Mail,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  Sun,
  Moon,
  AlertCircle,
  ArrowRight,
  Ticket,
  CheckCircle2,
  ShieldCheck
} from 'lucide-react';
import { useAcademy } from '../../context/AcademyContext';

const GoogleMark: React.FC = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
    />
  </svg>
);

export const LoginPage: React.FC = () => {
  const {
    allUsers,
    loginUser,
    registerUser,
    signInWithGoogle,
    setCurrentUser,
    findInvitationByCode,
    darkMode,
    toggleDarkMode
  } = useAcademy();

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Parse ?invite=CODE from URL on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const urlInvite = params.get('invite');
    if (urlInvite && urlInvite.trim()) {
      const trimmed = urlInvite.trim();
      setMode('signup');
      setInviteCode(trimmed);
      const matched = findInvitationByCode(trimmed);
      if (matched) {
        if (matched.fullName) setName(matched.fullName);
        if (matched.email) setEmail(matched.email);
      }
    }
  }, [findInvitationByCode]);

  const resolvedInvite = useMemo(() => {
    if (!inviteCode.trim()) return undefined;
    return findInvitationByCode(inviteCode.trim());
  }, [inviteCode, findInvitationByCode]);

  const isInviteExpired = Boolean(
    resolvedInvite?.expiresAt && new Date(resolvedInvite.expiresAt).getTime() < Date.now()
  );
  const isInviteUsable = Boolean(
    resolvedInvite && resolvedInvite.status === 'pending' && !isInviteExpired
  );

  const handleInviteCodeChange = (val: string) => {
    setInviteCode(val);
    const matched = findInvitationByCode(val.trim());
    if (matched && matched.status === 'pending') {
      if (!name.trim() && matched.fullName) setName(matched.fullName);
      if (!email.trim() && matched.email) setEmail(matched.email);
    }
  };

  const clearInviteUrlParam = () => {
    if (typeof window !== 'undefined' && window.location.search.includes('invite=')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  };

  const handleModeSwitch = (nextMode: 'login' | 'signup') => {
    setMode(nextMode);
    setErrorMsg('');
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setIsGoogleLoading(true);
    const result = await signInWithGoogle(inviteCode.trim() || undefined);
    setIsGoogleLoading(false);
    if (result.success) {
      clearInviteUrlParam();
    } else if (result.error) {
      setErrorMsg(result.error);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (mode === 'login') {
      if (!email.trim() || !password) {
        setErrorMsg('Please enter your email and password.');
        return;
      }
      const ok = loginUser(email, undefined, password);
      if (!ok) {
        setErrorMsg('Invalid email or password. Try signing up or using Google Sign-On.');
      }
    } else {
      if (!name.trim() || !email.trim()) {
        setErrorMsg('Please enter your full name and email address.');
        return;
      }
      if (password.length < 6) {
        setErrorMsg('Password must be at least 6 characters.');
        return;
      }
      const result = registerUser(name, email, password, inviteCode.trim() || undefined);
      if (!result.success) {
        setErrorMsg(result.error || 'Unable to complete registration.');
        return;
      }
      clearInviteUrlParam();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100 flex flex-col justify-between transition-colors">
      {/* Minimal Header */}
      <header className="w-full px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5 select-none">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Network className="w-4 h-4" />
          </div>
          <span className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
            Network Plus Academy
          </span>
        </div>

        <button
          type="button"
          onClick={toggleDarkMode}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1220] text-slate-600 dark:text-slate-300 hover:border-blue-400 dark:hover:border-cyan-500/50 text-xs font-medium transition-colors"
          aria-label={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {darkMode ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span>Light</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-slate-600" />
              <span>Dark</span>
            </>
          )}
        </button>
      </header>

      {/* Centered Simple Login / Sign-Up Card */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md bg-white dark:bg-[#0c1220] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-6 sm:p-8 space-y-6">
          <div className="space-y-1.5 text-center">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Access networking courses, interactive Cisco CLI labs, and certifications.
            </p>
          </div>

          {/* Segmented Mode Switcher */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => handleModeSwitch('login')}
              className={`py-2 rounded-lg transition-colors whitespace-nowrap ${
                mode === 'login'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch('signup')}
              className={`py-2 rounded-lg transition-colors whitespace-nowrap ${
                mode === 'signup'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Active Invitation Card Banner */}
          {inviteCode.trim() && resolvedInvite && isInviteUsable && (
            <div className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
              resolvedInvite.role === 'instructor'
                ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/60 text-indigo-900 dark:text-indigo-200'
                : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200'
            }`}>
              {resolvedInvite.role === 'instructor' ? (
                <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5 min-w-0">
                <p className="font-bold">
                  {resolvedInvite.role === 'instructor'
                    ? 'Verified Instructor Invitation'
                    : 'Verified Student Registration Invite'}
                </p>
                <p className="text-[11px] opacity-90 truncate">
                  Issued for <span className="font-mono font-semibold">{resolvedInvite.email}</span>
                  {resolvedInvite.cohortOrSpecialty ? ` · ${resolvedInvite.cohortOrSpecialty}` : ''}
                </p>
                {resolvedInvite.assignedCourseIds.length > 0 && (
                  <p className="text-[11px] opacity-80">
                    Includes {resolvedInvite.assignedCourseIds.length} pre-assigned course(s)
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Google Sign-On Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-semibold shadow-xs transition-colors disabled:opacity-60"
          >
            <GoogleMark />
            <span>{isGoogleLoading ? 'Signing in with Google...' : 'Continue with Google'}</span>
          </button>

          {/* Divider */}
          <div className="relative flex items-center">
            <div className="flex-1 border-t border-slate-200 dark:border-slate-800" />
            <span className="px-3 text-[11px] text-slate-400 dark:text-slate-500">
              or continue with email
            </span>
            <div className="flex-1 border-t border-slate-200 dark:border-slate-800" />
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div
              role="alert"
              className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Email / Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {mode === 'signup' && (
              <div>
                <label
                  htmlFor="auth-name"
                  className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="auth-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Rivera"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="auth-email"
                className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="auth-password"
                className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter your password'}
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {mode === 'signup' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="auth-invite-code"
                    className="font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Invitation Code
                  </label>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    Optional for students · Required for instructors
                  </span>
                </div>
                <div className="relative">
                  <Ticket className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="auth-invite-code"
                    type="text"
                    value={inviteCode}
                    onChange={(e) => handleInviteCodeChange(e.target.value)}
                    placeholder="e.g. INST-XXXX-XXXX or STUD-XXXX-XXXX"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono placeholder:font-sans placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {inviteCode.trim() && resolvedInvite && !isInviteUsable && (
                  <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                    {resolvedInvite.status === 'accepted'
                      ? 'This invitation code has already been redeemed.'
                      : resolvedInvite.status === 'revoked'
                      ? 'This invitation code has been revoked.'
                      : 'This invitation code has expired.'}
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition-colors"
            >
              <span>
                {mode === 'login'
                  ? 'Sign In'
                  : isInviteUsable && resolvedInvite?.role === 'instructor'
                  ? 'Register as Invited Instructor'
                  : 'Create Student Account'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quiet Quick Demo Access */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <p className="text-[11px] text-center text-slate-400 dark:text-slate-500">
              Quick demo sign-in
            </p>
            <div className="grid grid-cols-3 gap-2">
              {allUsers.slice(0, 3).map(u => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setCurrentUser(u)}
                  className="py-1.5 px-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:border-blue-400 dark:hover:border-cyan-500/50 text-[11px] font-medium capitalize text-slate-700 dark:text-slate-300 transition-colors truncate"
                  title={`Sign in as ${u.name} (${u.email})`}
                >
                  {u.role}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Quiet Footer */}
      <footer className="px-6 py-4 text-center text-[11px] text-slate-400 dark:text-slate-500">
        Network Plus Academy · Enterprise Networking Learning Platform
      </footer>
    </div>
  );
};
