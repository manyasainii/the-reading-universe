
import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Compass,
  Library as LibraryIcon,
  Sparkles,
  Quote,
  Trophy,
  Search,
  Bell,
  Menu,
  X,
  Feather,
  LogOut,
} from 'lucide-react';

import Auth from './Auth.jsx';
import Library from './Library.jsx';
import { supabase } from './lib/supabase';

const navItems = [
  { label: 'Your library', icon: LibraryIcon },
  { label: 'Reading journal', icon: Feather },
  { label: 'The observatory', icon: Compass },
  { label: 'Quote vault', icon: Quote },
  { label: 'Hall of fame', icon: Trophy },
];

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeNav, setActiveNav] = useState('Your library');
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const { data, error } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) {
        console.error('Unable to load session:', error.message);
      }

      setSession(data?.session ?? null);
      setAuthLoading(false);
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Sign out failed:', error.message);
    }
  }

  if (authLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#11100f',
          display: 'grid',
          placeItems: 'center',
          color: '#c6a56a',
          fontFamily: 'sans-serif',
        }}
      >
        Opening your universe...
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">
            <BookOpen size={19} />
          </div>

          <div>
            <div className="brand-name">The Reading Universe</div>
            <div className="brand-caption">A world between the pages</div>
          </div>

          <button
            className="icon-button close-menu"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <div className="side-label">YOUR UNIVERSE</div>

        <nav className="main-nav">
          {navItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-item ${
                activeNav === label ? 'nav-active' : ''
              }`}
              onClick={() => {
                setActiveNav(label);
                setMenuOpen(false);
              }}
            >
              <Icon size={17} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-note">
          <Sparkles size={16} />
          <p>Every book leaves a little universe behind.</p>
        </div>

        <div className="profile-mini">
          <div className="avatar">
            {(session.user.email || 'R')[0].toUpperCase()}
          </div>

          <div className="profile-copy">
            <strong>Your reading room</strong>
            <span>{session.user.email}</span>
          </div>

          <button
            className="icon-button"
            title="Sign out"
            aria-label="Sign out"
            onClick={handleSignOut}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {menuOpen && (
        <button
          className="mobile-scrim"
          onClick={() => setMenuOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <main className="main-content">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>

          <div className="breadcrumb">
            THE READING UNIVERSE <span>/</span> {activeNav.toUpperCase()}
          </div>

          <div className="top-actions">
            <div className="search-trigger">
              <Search size={16} />
              <span>Search your universe</span>
              <kbd>⌘ K</kbd>
            </div>

            <button
              className="icon-button notification-button"
              aria-label="Notifications"
            >
              <Bell size={17} />
            </button>

            <div className="avatar avatar-small">
              {(session.user.email || 'R')[0].toUpperCase()}
            </div>
          </div>
        </header>

        <div className="page-wrap">
          {activeNav === 'Your library' ? (
            <Library />
          ) : (
            <section className="library-page">
              <div className="library-intro">
                <div>
                  <div className="library-eyebrow">
                    <span />
                    YOUR READING UNIVERSE
                  </div>
                  <h1>
                    {activeNav === 'Reading journal' && (
                      <>The reading <em>journal.</em></>
                    )}
                    {activeNav === 'The observatory' && (
                      <>The <em>observatory.</em></>
                    )}
                    {activeNav === 'Quote vault' && (
                      <>The quote <em>vault.</em></>
                    )}
                    {activeNav === 'Hall of fame' && (
                      <>The hall of <em>fame.</em></>
                    )}
                  </h1>
                  <p>This part of your universe is still taking shape.</p>
                </div>
              </div>

              <div className="library-empty">
                <div className="library-empty-icon">
                  <Sparkles size={27} />
                </div>
                <h3>Something wonderful is being written.</h3>
                <p>
                  We'll bring this space to life as we build your
                  reading universe, one feature at a time.
                </p>
                <button
                  className="library-add-button"
                  onClick={() => setActiveNav('Your library')}
                >
                  <LibraryIcon size={16} />
                  Return to your library
                </button>
              </div>
            </section>
          )}

          <footer>
            <span>THE READING UNIVERSE</span>
            <span>
              MADE FOR THE LOVE OF STORIES <i>✳</i>
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default App;
