
import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Compass,
  Library,
  Sparkles,
  Quote,
  Trophy,
  Search,
  Bell,
  ChevronDown,
  Plus,
  ArrowUpRight,
  Bookmark,
  Feather,
  Menu,
  X,
  Star,
  Clock3,
  BookMarked,
  LogOut
} from 'lucide-react';

import Auth from './Auth.jsx';
import { supabase } from './lib/supabase';

const navItems = [
  { label: 'Your library', icon: Library },
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
            <button className="search-trigger">
              <Search size={16} />
              <span>Search your universe</span>
              <kbd>⌘ K</kbd>
            </button>

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
          <section className="welcome-row">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-line" />
                YOUR PRIVATE LIBRARY
              </div>

              <h1>
                A universe of <em>stories.</em>
              </h1>

              <p className="welcome-subtitle">
                A home for the books that stay with you.
              </p>
            </div>

            <button className="primary-button">
              <Plus size={17} /> Add a book
            </button>
          </section>

          <section className="hero-card">
            <div className="hero-texture" />

            <div className="hero-content">
              <div className="hero-kicker">
                <Sparkles size={13} /> YOUR STORY STARTS HERE
              </div>

              <h2>
                Somewhere, a book
                <br />
                is waiting to <em>find you.</em>
              </h2>

              <p>
                Collect your reads, keep the passages that move you,
                and watch your literary universe take shape.
              </p>

              <button className="text-link">
                Explore your library <ArrowUpRight size={15} />
              </button>
            </div>

            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="orbit-core">
              <BookOpen size={34} />
            </div>

            <span className="hero-star star-one">✳</span>
            <span className="hero-star star-two">✧</span>
            <span className="hero-star star-three">·</span>

            <div className="hero-foot">
              VOL. I <span>·</span> THE BEGINNING
            </div>
          </section>

          <section className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">
                <BookMarked size={17} />
              </div>
              <div className="stat-label">BOOKS IN YOUR ORBIT</div>
              <div className="stat-value">
                — <small>books</small>
              </div>
              <div className="stat-foot">Your collection begins here</div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">
                <Clock3 size={17} />
              </div>
              <div className="stat-label">CURRENTLY READING</div>
              <div className="stat-value">
                — <small>in progress</small>
              </div>
              <div className="stat-foot">Stories still unfolding</div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">
                <Star size={17} />
              </div>
              <div className="stat-label">FIVE-STAR READS</div>
              <div className="stat-value">
                — <small>favourites</small>
              </div>
              <div className="stat-foot">The ones that linger</div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">
                <Quote size={17} />
              </div>
              <div className="stat-label">WORDS TO REMEMBER</div>
              <div className="stat-value">
                — <small>saved quotes</small>
              </div>
              <div className="stat-foot">Passages worth keeping</div>
            </div>
          </section>

          <section className="library-section">
            <div className="section-heading">
              <div>
                <div className="eyebrow">
                  A FEW OF YOUR FAVOURITE THINGS
                </div>

                <h3>
                  {activeNav === 'Your library'
                    ? 'The shelves are waiting'
                    : activeNav}
                </h3>
              </div>

              <button className="subtle-link">
                View collection <ArrowUpRight size={14} />
              </button>
            </div>

            <div className="empty-library">
              <div className="empty-icon">
                <Library size={23} />
              </div>

              <div>
                <strong>Your library is a blank page.</strong>
                <p>
                  Import your Goodreads history or add your first book to
                  begin.
                </p>
              </div>

              <button className="outline-button">
                <Plus size={15} /> Start your collection
              </button>
            </div>
          </section>

          <section className="discover-strip">
            <div className="discover-icon">
              <Bookmark size={17} />
            </div>

            <div>
              <strong>A universe takes time.</strong>
              <p>
                Your reading history, discoveries and favourite passages
                will find their home here.
              </p>
            </div>

            <div className="discover-decoration">✧</div>
          </section>

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
