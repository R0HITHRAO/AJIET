import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  Sprout,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import { api } from '../api';

export default function AuthModal({ isOpen, initialMode = 'login', locked = false, onClose, onAuthSuccess }) {
  const [mode, setMode] = useState(initialMode); // 'login' | 'register' | 'forgot'
  const [forgotStep, setForgotStep] = useState('email'); // 'email' | 'verify'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [regForm, setRegForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Kitchen Manager',
    organization: 'SMVITM Central Kitchen',
  });
  const [forgotForm, setForgotForm] = useState({
    email: '',
    otp: '',
    new_password: '',
    confirm_password: '',
  });

  useEffect(() => {
    if (!isOpen || locked) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, locked, onClose]);

  useEffect(() => {}, [isOpen, mode]);

  if (!isOpen) return null;

  const switchMode = (next) => {
    setMode(next);
    setForgotStep('email');
    setError('');
    setInfo('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.login(loginForm);
      onAuthSuccess(res.access_token, res.user);
      onClose?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.register(regForm);
      onAuthSuccess(res.access_token, res.user);
      onClose?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');
    try {
      const res = await api.forgotPassword(forgotForm.email);
      setInfo(res.message);
      setForgotStep('verify');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (forgotForm.new_password !== forgotForm.confirm_password) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.resetPassword({
        email: forgotForm.email,
        otp: forgotForm.otp,
        new_password: forgotForm.new_password,
      });
      setLoginForm({ email: forgotForm.email, password: '' });
      switchMode('login');
      setInfo(res.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={
        locked
          ? 'no-print min-h-screen w-full hero-mesh flex items-center justify-center p-4'
          : 'no-print fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4'
      }
    >
      <div className="animate-modal-in bg-white rounded-3xl border border-slate-200/90 shadow-2xl max-w-md w-full overflow-hidden max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="hero-mesh text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/15 flex items-center justify-center">
              <Sprout className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h3 className="font-display text-base font-extrabold leading-tight">
                {mode === 'login'
                  ? 'Sign In to Nourish AI'
                  : mode === 'register'
                  ? 'Create Kitchen Account'
                  : 'Reset Password via Email OTP'}
              </h3>
              <p className="text-[11px] text-emerald-200/90">
                Verified Institutional Kitchen &amp; NGO Portal
              </p>
            </div>
          </div>
          {!locked && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close authentication modal"
              className="p-1.5 rounded-lg text-emerald-200 hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Mode Switcher */}
        {mode !== 'forgot' && (
          <div className="px-6 pt-5">
            <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`py-2 rounded-lg text-xs font-semibold transition ${
                  mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => switchMode('register')}
                className={`py-2 rounded-lg text-xs font-semibold transition ${
                  mode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                Register
              </button>
            </div>
          </div>
        )}

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-700">
              {error}
            </div>
          )}
          {info && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span>{info}</span>
            </div>
          )}

          {/* LOGIN FORM */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="field-label">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    required
                    type="email"
                    placeholder="you@organization.org"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                    className="field-control pl-9"
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotForm({ ...forgotForm, email: loginForm.email });
                      switchMode('forgot');
                    }}
                    className="text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    required
                    type="password"
                    placeholder="Enter your password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    className="field-control pl-9"
                  />
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? 'Signing in...' : 'Sign In'}
              </button>

              <p className="text-[11px] text-center text-slate-400">
                Access is restricted to email-verified kitchen &amp; NGO staff.
              </p>
            </form>
          )}

          {/* REGISTER FORM */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label className="field-label">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    required
                    type="text"
                    placeholder="e.g., Aneesh Acharya"
                    value={regForm.name}
                    onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                    className="field-control pl-9"
                  />
                </div>
              </div>
              <div>
                <label className="field-label">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    required
                    type="email"
                    placeholder="you@institution.edu"
                    value={regForm.email}
                    onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                    className="field-control pl-9"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Role</label>
                  <select
                    value={regForm.role}
                    onChange={(e) => setRegForm({ ...regForm, role: e.target.value })}
                    className="field-control text-xs"
                  >
                    <option value="Kitchen Manager">Kitchen Manager</option>
                    <option value="NGO Coordinator">NGO Coordinator</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">Kitchen / NGO Name</label>
                  <input
                    type="text"
                    value={regForm.organization}
                    onChange={(e) => setRegForm({ ...regForm, organization: e.target.value })}
                    className="field-control text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="field-label">Password (min 6 chars)</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    required
                    minLength={6}
                    type="password"
                    placeholder="Create a strong password"
                    value={regForm.password}
                    onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                    className="field-control pl-9"
                  />
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full">
                <UserPlus className="w-4 h-4" />
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          )}

          {/* FORGOT PASSWORD -> LIVE EMAIL OTP FLOW */}
          {mode === 'forgot' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Sign In
                </button>
              </div>

              {forgotStep === 'email' ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <p className="text-xs text-slate-500">
                    Enter your registered email address and we will send a 6-digit verification OTP to your inbox.
                  </p>
                  <div>
                    <label className="field-label">Registered Email</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        required
                        type="email"
                        placeholder="you@institution.edu"
                        value={forgotForm.email}
                        onChange={(e) => setForgotForm({ ...forgotForm, email: e.target.value })}
                        className="field-control pl-9"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full"
                  >
                    <KeyRound className="w-4 h-4" />
                    {loading ? 'Sending OTP...' : 'Send OTP to Email'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-3.5">
                  <div>
                    <label className="field-label">6-Digit Email OTP</label>
                    <div className="relative">
                      <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        required
                        minLength={6}
                        maxLength={6}
                        type="text"
                        placeholder="Enter 6-digit OTP"
                        value={forgotForm.otp}
                        onChange={(e) => setForgotForm({ ...forgotForm, otp: e.target.value.replace(/\D/g, '') })}
                        className="field-control pl-9 tracking-widest font-mono font-bold stat-value"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="field-label">New Password (min 6 chars)</label>
                    <input
                      required
                      minLength={6}
                      type="password"
                      placeholder="Enter new password"
                      value={forgotForm.new_password}
                      onChange={(e) => setForgotForm({ ...forgotForm, new_password: e.target.value })}
                      className="field-control"
                    />
                  </div>

                  <div>
                    <label className="field-label">Confirm New Password</label>
                    <input
                      required
                      minLength={6}
                      type="password"
                      placeholder="Re-enter new password"
                      value={forgotForm.confirm_password}
                      onChange={(e) => setForgotForm({ ...forgotForm, confirm_password: e.target.value })}
                      className="field-control"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setForgotStep('email')}
                      className="btn-secondary"
                    >
                      Resend OTP
                    </button>
                    <button type="submit" disabled={loading} className="btn-primary flex-1">
                      {loading ? 'Updating...' : 'Reset Password'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
