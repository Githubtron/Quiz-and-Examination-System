import React, { useState, useRef, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Lock, Mail, Phone, ArrowRight, RotateCcw } from 'lucide-react'
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  sendPasswordResetEmail,
} from 'firebase/auth'
import { firebaseAuth, googleProvider } from '../firebase'
import styles from './AuthPage.module.css'
import fbStyles from './FirebaseLogin.module.css'

// ── helpers ───────────────────────────────────────────────────────────────────
function firebaseMsg(code) {
  const map = {
    'auth/invalid-credential':        'Incorrect email or password.',
    'auth/user-not-found':            'No account found with that email.',
    'auth/wrong-password':            'Incorrect password.',
    'auth/email-already-in-use':      'Email is already registered.',
    'auth/weak-password':             'Password must be at least 6 characters.',
    'auth/invalid-phone-number':      'Invalid phone number. Use international format: +91XXXXXXXXXX',
    'auth/too-many-requests':         'Too many attempts. Please wait a moment and try again.',
    'auth/invalid-verification-code': 'Incorrect OTP code.',
    'auth/popup-closed-by-user':      'Sign-in was cancelled.',
    'auth/network-request-failed':    'Network error — check your connection.',
    'auth/invalid-email':             'Please enter a valid email address.',
    'auth/missing-email':             'Please enter an email address.',
  }
  return map[code] || null
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a11.966 11.966 0 0 1-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
    </svg>
  )
}

// ── component ─────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const { firebaseLogin } = useAuth()
  const navigate = useNavigate()

  const [tab, setTab]               = useState('email')   // 'email' | 'phone'
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [phone, setPhone]           = useState('')
  const [otp, setOtp]               = useState('')
  const [otpSent, setOtpSent]       = useState(false)
  const [confirmResult, setConfirmResult] = useState(null)
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)

  // ── Forgot Password state ─────────────────────────────────────────────────
  const [forgotMode, setForgotMode]       = useState(false)
  const [resetEmail, setResetEmail]       = useState('')
  const [resetLoading, setResetLoading]   = useState(false)
  const [resetError, setResetError]       = useState('')
  const [resetSuccess, setResetSuccess]   = useState(false)

  const recaptchaContainerRef = useRef(null)
  const recaptchaVerifierRef  = useRef(null)

  // Build the invisible reCAPTCHA verifier once the container mounts
  useEffect(() => {
    return () => {
      // Clean up on unmount
      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear()
        recaptchaVerifierRef.current = null
      }
    }
  }, [])

  const getOrCreateVerifier = () => {
    if (!recaptchaVerifierRef.current) {
      recaptchaVerifierRef.current = new RecaptchaVerifier(
        firebaseAuth,
        recaptchaContainerRef.current,
        { size: 'invisible' }
      )
    }
    return recaptchaVerifierRef.current
  }

  const redirect = (role) => {
    if (role === 'ADMIN') navigate('/admin')
    else if (role === 'PROFESSOR') navigate('/professor')
    else navigate('/student')
  }

  // ── Google ────────────────────────────────────────────────────────────────
  const handleGoogle = async () => {
    setError('')
    setLoading(true)
    try {
      const result  = await signInWithPopup(firebaseAuth, googleProvider)
      const idToken = await result.user.getIdToken()
      const session = await firebaseLogin(idToken)
      redirect(session.role)
    } catch (err) {
      setError(firebaseMsg(err.code) || err.message || 'Google sign-in failed.')
    } finally {
      setLoading(false)
    }
  }

  // ── Email / Password ──────────────────────────────────────────────────────
  const handleEmail = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const cred    = await signInWithEmailAndPassword(firebaseAuth, email, password)
      const idToken = await cred.user.getIdToken()
      const session = await firebaseLogin(idToken)
      redirect(session.role)
    } catch (err) {
      setError(firebaseMsg(err.code) || err.message || 'Sign-in failed.')
    } finally {
      setLoading(false)
    }
  }

  // ── Phone: send OTP ───────────────────────────────────────────────────────
  const handleSendOtp = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const verifier = getOrCreateVerifier()
      const result   = await signInWithPhoneNumber(firebaseAuth, phone, verifier)
      setConfirmResult(result)
      setOtpSent(true)
    } catch (err) {
      // Reset verifier so user can try again
      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear()
        recaptchaVerifierRef.current = null
      }
      setError(firebaseMsg(err.code) || err.message || 'Failed to send OTP.')
    } finally {
      setLoading(false)
    }
  }

  // ── Phone: verify OTP ─────────────────────────────────────────────────────
  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const cred    = await confirmResult.confirm(otp)
      const idToken = await cred.user.getIdToken()
      const session = await firebaseLogin(idToken)
      redirect(session.role)
    } catch (err) {
      setError(firebaseMsg(err.code) || 'Invalid OTP. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const switchTab = (t) => {
    setTab(t)
    setError('')
    setOtpSent(false)
    setConfirmResult(null)
    setOtp('')
  }

  // ── Forgot Password ────────────────────────────────────────────────────────
  const openForgot = () => {
    setForgotMode(true)
    setResetEmail(email)   // pre-fill if user already typed email
    setResetError('')
    setResetSuccess(false)
    setError('')
  }

  const closeForgot = () => {
    setForgotMode(false)
    setResetEmail('')
    setResetError('')
    setResetSuccess(false)
  }

  const handleForgotReset = async (e) => {
    e.preventDefault()
    setResetError('')
    setResetSuccess(false)
    setResetLoading(true)
    try {
      await sendPasswordResetEmail(firebaseAuth, resetEmail)
      setResetSuccess(true)
    } catch (err) {
      setResetError(firebaseMsg(err.code) || 'Could not send reset email. Please try again.')
    } finally {
      setResetLoading(false)
    }
  }

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.card}>

        {/* Brand */}
        <div className={styles.brand}>
          <div className={styles.logo}>QM</div>
          <h1 className={styles.title}>Welcome back</h1>
          <p className={styles.sub}>Sign in to your QuizMaster account</p>
        </div>

        {/* Error */}
        {error && <div className={styles.error} role="alert">{error}</div>}

        {/* Google button */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          className={fbStyles.googleBtn}
        >
          <GoogleIcon />
          Continue with Google
        </button>

        {/* Divider */}
        <div className={fbStyles.divider}><span>or</span></div>

        {/* Method tabs */}
        <div className={fbStyles.tabs}>
          <button
            type="button"
            className={`${fbStyles.tab} ${tab === 'email' ? fbStyles.tabActive : ''}`}
            onClick={() => switchTab('email')}
          >
            <Mail size={13} style={{ marginRight: 5 }} />Email
          </button>
          <button
            type="button"
            className={`${fbStyles.tab} ${tab === 'phone' ? fbStyles.tabActive : ''}`}
            onClick={() => switchTab('phone')}
          >
            <Phone size={13} style={{ marginRight: 5 }} />Phone / OTP
          </button>
        </div>

        {/* ── Forgot Password form ── */}
        {tab === 'email' && forgotMode && (
          <div className={styles.form}>
            <p className={fbStyles.forgotTitle}>Reset your password</p>
            <p className={fbStyles.forgotHint}>
              Enter your account email and we'll send you a reset link.
            </p>

            {resetSuccess ? (
              <div className={styles.successMsg} role="status">
                ✓ Check your inbox — a password reset link has been sent to <strong>{resetEmail}</strong>.
              </div>
            ) : (
              <>
                {resetError && (
                  <div className={styles.error} role="alert">{resetError}</div>
                )}
                <form onSubmit={handleForgotReset}>
                  <div className={styles.field}>
                    <div className={styles.inputWrap}>
                      <span className={styles.inputIcon}><Mail size={16} /></span>
                      <input
                        type="email"
                        id="reset-email"
                        placeholder=" "
                        value={resetEmail}
                        onChange={e => setResetEmail(e.target.value)}
                        required
                        autoFocus
                      />
                      <label htmlFor="reset-email">Email address</label>
                    </div>
                  </div>
                  <button
                    type="submit"
                    className={styles.submitBtn}
                    disabled={resetLoading}
                    style={{ marginTop: '1rem' }}
                  >
                    {resetLoading ? 'Sending…' : 'Send Reset Email'}
                  </button>
                </form>
              </>
            )}

            <button
              type="button"
              className={fbStyles.resendBtn}
              onClick={closeForgot}
              style={{ marginTop: '0.75rem' }}
            >
              ← Back to Sign In
            </button>
          </div>
        )}

        {/* ── Email / Password form ── */}
        {tab === 'email' && !forgotMode && (
          <form onSubmit={handleEmail} className={styles.form}>
            <div className={styles.field}>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}><Mail size={16} /></span>
                <input
                  type="email"
                  id="fb-email"
                  placeholder=" "
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                />
                <label htmlFor="fb-email">Email address</label>
              </div>
            </div>

            <div className={styles.field}>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}><Lock size={16} /></span>
                <input
                  type="password"
                  id="fb-password"
                  placeholder=" "
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <label htmlFor="fb-password">Password</label>
              </div>
            </div>

            <div className={fbStyles.forgotRow}>
              <button
                type="button"
                className={fbStyles.forgotLink}
                onClick={openForgot}
              >
                Forgot Password?
              </button>
            </div>

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        )}

        {/* ── Phone: enter number ── */}
        {tab === 'phone' && !otpSent && (
          <form onSubmit={handleSendOtp} className={styles.form}>
            <div className={styles.field}>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}><Phone size={16} /></span>
                <input
                  type="tel"
                  id="fb-phone"
                  placeholder=" "
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  required
                  autoFocus
                />
                <label htmlFor="fb-phone">Phone number (+91XXXXXXXXXX)</label>
              </div>
            </div>

            {/* Invisible reCAPTCHA container */}
            <div ref={recaptchaContainerRef} />

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? 'Sending OTP…' : (
                <><ArrowRight size={15} style={{ marginRight: 6 }} />Send OTP</>
              )}
            </button>
          </form>
        )}

        {/* ── Phone: verify OTP ── */}
        {tab === 'phone' && otpSent && (
          <form onSubmit={handleVerifyOtp} className={styles.form}>
            <p className={fbStyles.otpHint}>
              OTP sent to <strong>{phone}</strong>
            </p>

            <div className={styles.field}>
              <div className={styles.inputWrap}>
                <input
                  type="text"
                  id="fb-otp"
                  inputMode="numeric"
                  placeholder=" "
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  autoFocus
                  maxLength={6}
                  className={fbStyles.otpInput}
                />
                <label htmlFor="fb-otp" style={{ left: '0.9rem' }}>6-digit OTP</label>
              </div>
            </div>

            <button type="submit" className={styles.submitBtn} disabled={loading || otp.length < 6}>
              {loading ? 'Verifying…' : 'Verify & Sign In'}
            </button>

            <button
              type="button"
              className={fbStyles.resendBtn}
              onClick={() => { setOtpSent(false); setConfirmResult(null); setOtp('') }}
              disabled={loading}
            >
              <RotateCcw size={13} style={{ marginRight: 5 }} />Resend OTP
            </button>
          </form>
        )}

        <p className={styles.switchLink}>
          Don't have an account? <Link to="/register">Create one</Link>
        </p>
      </div>
    </div>
  )
}
