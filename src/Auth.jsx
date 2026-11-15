
import React, { useState } from 'react';
import { BookOpen, Eye, EyeOff, ArrowRight, Sparkles } from 'lucide-react';
import { supabase } from './lib/supabase';

function Auth() {
  const [mode, setMode] = useState('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const isSignup = mode === 'signup';

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: name.trim()
            }
          }
        });

        if (error) throw error;

        setMessage('Your account is almost ready. Check your email to confirm your address.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;

        setMessage('Welcome back. Your reading universe awaits.');
      }
    } catch (error) {
      setMessage(error.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-decoration auth-decoration-one" />
      <div className="auth-decoration auth-decoration-two" />

      <div className="auth-card">
        <div className="auth-brand-mark">
          <BookOpen size={25} />
        </div>

        <div className="auth-brand">THE READING UNIVERSE</div>
        <div className="auth-tagline">A world between the pages</div>

        <div className="auth-divider">
          <span />
          <Sparkles size={14} />
          <span />
        </div>

        <h1>{isSignup ? 'Find your place' : 'Welcome back'}</h1>
        <p className="auth-intro">
          {isSignup
            ? 'Create a home for every story that stays with you.'
            : 'Your shelves, stories and memories are waiting.'}
        </p>

        <form onSubmit={handleSubmit}>
          {isSignup && (
            <label className="auth-field">
              <span>YOUR NAME</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="How should we call you?"
                required
                maxLength={60}
              />
            </label>
          )}

          <label className="auth-field">
            <span>EMAIL ADDRESS</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          <label className="auth-field">
            <span>PASSWORD</span>
            <div className="auth-password-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                minLength={8}
                required
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </label>

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading
              ? 'PLEASE WAIT...'
              : isSignup
                ? 'CREATE YOUR ACCOUNT'
                : 'ENTER YOUR UNIVERSE'}
            {!loading && <ArrowRight size={17} />}
          </button>
        </form>

        {message && (
          <div className="auth-message" role="status">
            {message}
          </div>
        )}

        <div className="auth-switch">
          {isSignup ? 'Already have an account?' : 'New to this universe?'}
          <button
            type="button"
            onClick={() => {
              setMode(isSignup ? 'login' : 'signup');
              setMessage('');
            }}
          >
            {isSignup ? 'Sign in' : 'Create an account'}
          </button>
        </div>

        <div className="auth-footnote">
          MADE FOR THE LOVE OF STORIES
        </div>
      </div>
    </div>
  );
}

export default Auth;
