
import React, { useState } from 'react';
import {
  BookOpen,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles
} from 'lucide-react';

import { supabase } from './lib/supabase';
import './Auth.css';

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
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              display_name: name.trim()
            }
          }
        });

        if (error) throw error;

        setMessage(
          data.session
            ? 'Your account has been created. Welcome to your universe.'
            : 'Your account was created. Please check your email if confirmation is required.'
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
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

      <section className="auth-showcase">

        <div className="auth-brand-lockup">
          <div className="auth-brand-mark">
            <BookOpen size={24} />
          </div>

          <div className="auth-brand-copy">
            <div className="auth-brand">The Reading Universe</div>
            <div className="auth-tagline">
              A world between the pages
            </div>
          </div>
        </div>

        <div className="auth-showcase-content">
          <div className="auth-kicker">
            A HOME FOR EVERY STORY
          </div>

          <h1>
            Every book
            <br />
            leaves a little
            <br />
            <em>universe.</em>
          </h1>

          <p className="auth-showcase-description">
            Build your literary world. Collect the stories you love,
            preserve the words that move you, and discover readers
            who see the world between the pages.
          </p>

          <div className="auth-book-art" aria-hidden="true">
            <div className="auth-book auth-book-one" />
            <div className="auth-book auth-book-two" />
            <div className="auth-book auth-book-three" />
          </div>
        </div>

        <div className="auth-showcase-footer">
          VOL. I &nbsp; · &nbsp; MADE FOR THE LOVE OF STORIES
        </div>

      </section>

      <section className="auth-form-side">

        <div className="auth-card">

          <div className="auth-form-heading">
            <div className="auth-form-eyebrow">
              {isSignup ? 'YOUR STORY STARTS HERE' : 'GOOD TO HAVE YOU BACK'}
            </div>

            <h2>
              {isSignup ? 'Find your place.' : 'Welcome back.'}
            </h2>

            <p className="auth-intro">
              {isSignup
                ? 'Create your account and give your reading life a home.'
                : 'Your shelves, stories and memories are waiting.'}
            </p>
          </div>

          <form onSubmit={handleSubmit}>

            {isSignup && (
              <label className="auth-field">
                <span>YOUR NAME</span>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="How should we call you?"
                  autoComplete="name"
                  maxLength={60}
                  required
                />
              </label>
            )}

            <label className="auth-field">
              <span>EMAIL ADDRESS</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
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
                  onChange={(event) => setPassword(event.target.value)}
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
                  {showPassword
                    ? <EyeOff size={17} />
                    : <Eye size={17} />}
                </button>
              </div>
            </label>

            <button
              className="auth-submit"
              type="submit"
              disabled={loading}
            >
              <span>
                {loading
                  ? 'PLEASE WAIT...'
                  : isSignup
                    ? 'CREATE YOUR ACCOUNT'
                    : 'ENTER YOUR UNIVERSE'}
              </span>

              {!loading && <ArrowRight size={17} />}
            </button>

          </form>

          {message && (
            <div className="auth-message" role="status">
              {message}
            </div>
          )}

          <div className="auth-switch">
            <span>
              {isSignup
                ? 'Already have an account?'
                : 'New to this universe?'}
            </span>

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
            <Sparkles size={11} />
            &nbsp; MADE FOR THE LOVE OF STORIES
          </div>

        </div>

      </section>
    </div>
  );
}

export default Auth;
