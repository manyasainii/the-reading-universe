
import React, { useMemo, useState } from 'react';
import {
  X, Search, LoaderCircle, Check, BookOpen,
  ImageOff, Sparkles, RefreshCw,
} from 'lucide-react';
import { supabase } from './lib/supabase';

const ISBN_GROUP_SIZE = 50;
const REQUEST_GAP = 1100;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalize(value) {
  return (value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function cleanISBN(value) {
  return (value || '').replace(/[^0-9Xx]/g, '').toUpperCase();
}

function getCoverUrl(item) {
  const cover = item?.cover;
  return cover?.medium || cover?.large || cover?.small || null;
}

function CoverRecovery({ onClose, onUpdated }) {
  const [books, setBooks] = useState([]);
  const [results, setResults] = useState([]);
  const [choices, setChoices] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [scanComplete, setScanComplete] = useState(false);

  async function loadBooks() {
    setLoading(true);
    setError('');
    setMessage('');
    setResults([]);
    setChoices({});
    setProgress(0);
    setScanComplete(false);
    setLoaded(false);

    const { data, error: fetchError } = await supabase
      .from('user_books')
      .select('id, title, author, isbn, cover_url')
      .or('cover_url.is.null,cover_url.eq.')
      .order('title', { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setBooks(data || []);
    setLoaded(true);
    setLoading(false);

    if (!data?.length) {
      setMessage('Every book in your library already has a cover.');
    }
  }

  function makeResult(book, candidates = [], searchError = '') {
    const best = candidates[0] || null;

    return {
      ...book,
      candidates,
      best,
      confidence: best?.confidence || 'none',
      searchError,
    };
  }

  async function searchByISBNGroup(group) {
    const uniqueISBNs = [
      ...new Set(group.map((book) => cleanISBN(book.isbn)).filter(Boolean)),
    ];

    if (!uniqueISBNs.length) return new Map();

    const bibkeys = uniqueISBNs
      .map((isbn) => `ISBN:${isbn}`)
      .join(',');

    const url = new URL('https://openlibrary.org/api/books');
    url.searchParams.set('bibkeys', bibkeys);
    url.searchParams.set('format', 'json');
    url.searchParams.set('jscmd', 'data');

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Open Library returned HTTP ${response.status}`);
    }

    const data = await response.json();
    const found = new Map();

    uniqueISBNs.forEach((isbn) => {
      const item = data[`ISBN:${isbn}`];
      const coverUrl = getCoverUrl(item);

      if (!item || !coverUrl) return;

      found.set(isbn, {
        id: item.url || `ISBN:${isbn}`,
        title: item.title || 'Untitled',
        author: (item.authors || []).map((author) => author.name).join(', '),
        cover_url: coverUrl,
        confidence: 'isbn',
      });
    });

    return found;
  }

  async function searchByTitle(book) {
    const url = new URL('https://openlibrary.org/search.json');
    url.searchParams.set('title', book.title);

    if (book.author) {
      url.searchParams.set('author', book.author);
    }

    url.searchParams.set('limit', '5');
    url.searchParams.set(
      'fields',
      'key,title,author_name,cover_i,isbn'
    );

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Open Library returned HTTP ${response.status}`);
    }

    const data = await response.json();

    return (data.docs || [])
      .filter((item) => item.cover_i)
      .map((item) => {
        const titleMatch =
          normalize(item.title) === normalize(book.title);

        const authorMatch =
          Boolean(book.author) &&
          (item.author_name || []).some(
            (author) => normalize(author) === normalize(book.author)
          );

        return {
          id: item.key,
          title: item.title || 'Untitled',
          author: (item.author_name || []).join(', '),
          cover_url: `https://covers.openlibrary.org/b/id/${item.cover_i}-M.jpg`,
          confidence:
            titleMatch && authorMatch ? 'exact' : 'review',
        };
      })
      .sort((a, b) => {
        const rank = { exact: 0, review: 1 };
        return rank[a.confidence] - rank[b.confidence];
      });
  }

  async function runFullScan() {
    if (!books.length) return;

    setLoading(true);
    setError('');
    setMessage('');
    setResults([]);
    setChoices({});
    setProgress(0);
    setScanComplete(false);

    const total = books.length;
    const completed = new Map();
    const fallbackBooks = [];

    // First pass: ISBN lookups in groups of 50.
    const isbnBooks = books.filter((book) => cleanISBN(book.isbn));

    for (
      let start = 0;
      start < isbnBooks.length;
      start += ISBN_GROUP_SIZE
    ) {
      const group = isbnBooks.slice(start, start + ISBN_GROUP_SIZE);

      try {
        const matches = await searchByISBNGroup(group);

        group.forEach((book) => {
          const match = matches.get(cleanISBN(book.isbn));

          if (match) {
            completed.set(
              book.id,
              makeResult(book, [match])
            );
          } else {
            fallbackBooks.push(book);
          }
        });
      } catch (lookupError) {
        group.forEach((book) => fallbackBooks.push(book));
        setError(
          `An ISBN lookup failed. Trying title searches instead. ${lookupError.message}`
        );
      }

      setProgress(completed.size);
    }

    // Books without ISBNs also need a title search.
    books
      .filter((book) => !cleanISBN(book.isbn))
      .forEach((book) => fallbackBooks.push(book));

    // Second pass: title and author searches for unresolved books.
    for (let i = 0; i < fallbackBooks.length; i += 1) {
      if (i > 0) await sleep(REQUEST_GAP);

      const book = fallbackBooks[i];

      try {
        const candidates = await searchByTitle(book);
        completed.set(book.id, makeResult(book, candidates));
      } catch (searchError) {
        completed.set(
          book.id,
          makeResult(book, [], searchError.message)
        );
      }

      setProgress(completed.size);
    }

    const allResults = books.map(
      (book) =>
        completed.get(book.id) ||
        makeResult(book)
    );

    const initialChoices = {};

    allResults.forEach((book) => {
      if (
        book.best &&
        (book.confidence === 'isbn' || book.confidence === 'exact')
      ) {
        initialChoices[book.id] = book.best.cover_url;
      }
    });

    setResults(allResults);
    setChoices(initialChoices);
    setProgress(total);
    setScanComplete(true);
    setLoading(false);
  }

  function chooseCover(bookId, coverUrl) {
    setChoices((current) => ({
      ...current,
      [bookId]: coverUrl,
    }));
  }

  function toggleSelection(book) {
    setChoices((current) => {
      const next = { ...current };

      if (next[book.id]) {
        delete next[book.id];
      } else if (book.best) {
        next[book.id] = book.best.cover_url;
      }

      return next;
    });
  }

  const selectedCount = useMemo(
    () => Object.values(choices).filter(Boolean).length,
    [choices]
  );

  const strongMatches = results.filter(
    (book) =>
      book.confidence === 'isbn' || book.confidence === 'exact'
  );

  const reviewMatches = results.filter(
    (book) => book.confidence === 'review'
  );

  const noMatches = results.filter(
    (book) => book.confidence === 'none'
  );

  function selectAllStrong() {
    const next = { ...choices };

    strongMatches.forEach((book) => {
      if (book.best) {
        next[book.id] = book.best.cover_url;
      }
    });

    setChoices(next);
  }

  function clearAllSelections() {
    setChoices({});
  }

  async function saveSelected() {
    const selected = results.filter((book) => choices[book.id]);

    if (!selected.length) return;

    setSaving(true);
    setError('');
    setMessage('');

    let successful = 0;
    const failedIds = [];

    for (const book of selected) {
      const { data, error: updateError } = await supabase
        .from('user_books')
        .update({ cover_url: choices[book.id] })
        .eq('id', book.id)
        .or('cover_url.is.null,cover_url.eq.')
        .select('id');

      if (updateError || !data?.length) {
        failedIds.push(book.id);
      } else {
        successful += 1;
      }
    }

    const savedIds = new Set(
      selected
        .filter((book) => !failedIds.includes(book.id))
        .map((book) => book.id)
    );

    setSavedCount((current) => current + successful);
    setBooks((current) =>
      current.filter((book) => !savedIds.has(book.id))
    );
    setResults((current) =>
      current.filter((book) => !savedIds.has(book.id))
    );
    setChoices((current) => {
      const next = { ...current };
      savedIds.forEach((id) => delete next[id]);
      return next;
    });

    setSaving(false);

    if (failedIds.length) {
      setError(
        `${successful} covers saved. ${failedIds.length} could not be saved.`
      );
    } else if (successful) {
      setMessage(
        `${successful} cover${successful === 1 ? '' : 's'} saved to your library.`
      );
    }

    if (successful && onUpdated) await onUpdated();
  }

  const remainingCount = books.length;

  return (
    <div
      style={ui.overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading && !saving) {
          onClose();
        }
      }}
    >
      <section style={ui.modal} role="dialog" aria-modal="true">
        <header style={ui.header}>
          <div>
            <div style={ui.eyebrow}>RESTORE YOUR BOOK COVERS</div>
            <h2 style={ui.title}>
              Cover <em style={{ color: '#c5a875' }}>recovery.</em>
            </h2>
            <p style={ui.muted}>
              Scan your entire library, then approve matching covers together.
            </p>
          </div>

          <button
            onClick={onClose}
            disabled={loading || saving}
            style={ui.close}
            aria-label="Close cover recovery"
          >
            <X size={20} />
          </button>
        </header>

        {error && <div style={ui.error}>{error}</div>}
        {message && <div style={ui.message}>{message}</div>}

        {!loaded && (
          <div style={ui.center}>
            <p style={ui.muted}>
              Find every book in your library that still needs a cover.
            </p>
            <button
              style={ui.primary}
              onClick={loadBooks}
              disabled={loading}
            >
              {loading ? <LoaderCircle size={15} /> : <Search size={15} />}
              Find books without covers
            </button>
          </div>
        )}

        {loaded && (
          <>
            <div style={ui.stats}>
              <div style={ui.stat}>
                <strong>{remainingCount}</strong>
                <span>BOOKS STILL NEEDING COVERS</span>
              </div>
              <div style={ui.stat}>
                <strong>{savedCount}</strong>
                <span>COVERS SAVED THIS SESSION</span>
              </div>
              <div style={ui.stat}>
                <strong>{selectedCount}</strong>
                <span>SELECTED TO SAVE</span>
              </div>
            </div>

            {loading && (
              <div style={ui.progressPanel}>
                <div style={ui.progressHeading}>
                  <LoaderCircle size={18} />
                  <strong>Scanning your library</strong>
                  <span>{progress} / {books.length}</span>
                </div>
                <div style={ui.progressTrack}>
                  <div
                    style={{
                      ...ui.progressFill,
                      width: `${books.length ? (progress / books.length) * 100 : 0}%`,
                    }}
                  />
                </div>
                <p style={ui.muted}>
                  ISBNs are being checked in groups. Remaining books are
                  searched by title and author.
                </p>
              </div>
            )}

            {!loading && !scanComplete && books.length > 0 && (
              <div style={ui.center}>
                <p style={ui.muted}>
                  {books.length} books are waiting for cover recovery.
                </p>
                <button style={ui.primary} onClick={runFullScan}>
                  <Sparkles size={15} />
                  Scan all {books.length} books
                </button>
              </div>
            )}

            {!loading && scanComplete && (
              <>
                <div style={ui.summary}>
                  <div>
                    <strong>{strongMatches.length}</strong>
                    <span>STRONG MATCHES</span>
                  </div>
                  <div>
                    <strong>{reviewMatches.length}</strong>
                    <span>NEED YOUR REVIEW</span>
                  </div>
                  <div>
                    <strong>{noMatches.length}</strong>
                    <span>NO COVER FOUND</span>
                  </div>
                </div>

                <div style={ui.actions}>
                  <button
                    style={ui.secondary}
                    onClick={selectAllStrong}
                    disabled={!strongMatches.length || saving}
                  >
                    <Sparkles size={14} />
                    Select all strong matches
                  </button>

                  <button
                    style={ui.secondary}
                    onClick={clearAllSelections}
                    disabled={!selectedCount || saving}
                  >
                    Clear selections
                  </button>

                  <button
                    style={ui.primary}
                    onClick={saveSelected}
                    disabled={!selectedCount || saving}
                  >
                    {saving ? (
                      <LoaderCircle size={15} />
                    ) : (
                      <Check size={15} />
                    )}
                    Save {selectedCount} covers
                  </button>
                </div>

                {strongMatches.length > 0 && (
                  <section style={ui.resultSection}>
                    <div style={ui.sectionHeading}>
                      <div>
                        <h3>Strong matches</h3>
                        <p>ISBN matches and exact title-and-author matches</p>
                      </div>
                      <span style={ui.goodLabel}>
                        {strongMatches.filter((book) => choices[book.id]).length} selected
                      </span>
                    </div>

                    <div style={ui.resultList}>
                      {strongMatches.map((book) => (
                        <article key={book.id} style={ui.resultRow}>
                          <button
                            style={{
                              ...ui.selection,
                              ...(choices[book.id] ? ui.selectionActive : {}),
                            }}
                            onClick={() => toggleSelection(book)}
                            aria-label={`Toggle ${book.title}`}
                          >
                            {choices[book.id] && <Check size={13} />}
                          </button>

                          <img
                            style={ui.cover}
                            src={book.best.cover_url}
                            alt={`Cover of ${book.best.title}`}
                          />

                          <div style={ui.bookInfo}>
                            <strong>{book.title}</strong>
                            <span>{book.author || 'Author unknown'}</span>
                            <small>
                              {book.confidence === 'isbn'
                                ? 'ISBN match'
                                : 'Exact title and author'}
                            </small>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                )}

                {reviewMatches.length > 0 && (
                  <section style={ui.resultSection}>
                    <div style={ui.sectionHeading}>
                      <div>
                        <h3>Needs your review</h3>
                        <p>Possible matches that are not exact</p>
                      </div>
                      <span style={ui.reviewLabel}>
                        {reviewMatches.length} to check
                      </span>
                    </div>

                    <div style={ui.resultList}>
                      {reviewMatches.map((book) => (
                        <article key={book.id} style={ui.reviewRow}>
                          <div style={ui.bookInfo}>
                            <strong>{book.title}</strong>
                            <span>{book.author || 'Author unknown'}</span>
                          </div>

                          <div style={ui.candidates}>
                            {book.candidates.map((candidate) => (
                              <button
                                key={candidate.id}
                                style={{
                                  ...ui.candidate,
                                  borderColor:
                                    choices[book.id] === candidate.cover_url
                                      ? '#c5a875'
                                      : 'rgba(197,168,117,.16)',
                                  background:
                                    choices[book.id] === candidate.cover_url
                                      ? 'rgba(197,168,117,.12)'
                                      : '#171512',
                                }}
                                onClick={() =>
                                  chooseCover(book.id, candidate.cover_url)
                                }
                                title={`${candidate.title} by ${candidate.author}`}
                              >
                                <img
                                  src={candidate.cover_url}
                                  alt={`Suggested cover for ${candidate.title}`}
                                />
                                <span>
                                  {choices[book.id] === candidate.cover_url
                                    ? <Check size={13} />
                                    : 'Select'}
                                </span>
                              </button>
                            ))}
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                )}

                {noMatches.length > 0 && (
                  <section style={ui.resultSection}>
                    <div style={ui.sectionHeading}>
                      <div>
                        <h3>No cover found</h3>
                        <p>Open Library did not return a usable cover</p>
                      </div>
                      <span style={ui.muted}>{noMatches.length} books</span>
                    </div>

                    <div style={ui.noMatchList}>
                      {noMatches.map((book) => (
                        <div key={book.id} style={ui.noMatchRow}>
                          <ImageOff size={14} />
                          <span>{book.title}</span>
                          {book.searchError && (
                            <small>{book.searchError}</small>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {results.length === 0 && (
                  <div style={ui.center}>
                    <BookOpen size={28} color="#c5a875" />
                    <p style={ui.muted}>
                      All books in the queue have been processed.
                    </p>
                  </div>
                )}

                <div style={ui.bottomActions}>
                  <button
                    style={ui.secondary}
                    onClick={runFullScan}
                    disabled={loading || saving || !books.length}
                  >
                    <RefreshCw size={13} />
                    Scan remaining books again
                  </button>
                  <button
                    style={ui.secondary}
                    onClick={loadBooks}
                    disabled={loading || saving}
                  >
                    Refresh queue
                  </button>
                </div>
              </>
            )}

            {!loading && scanComplete && results.length === 0 && (
              <div style={ui.center}>
                <BookOpen size={28} color="#c5a875" />
                <p style={ui.muted}>
                  All your missing covers have been recovered.
                </p>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

const ui = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 210,
    display: 'grid',
    placeItems: 'center',
    padding: 16,
    background: 'rgba(0,0,0,.82)',
    backdropFilter: 'blur(5px)',
  },
  modal: {
    width: 'min(100%, 960px)',
    maxHeight: '92vh',
    overflowY: 'auto',
    padding: 25,
    color: '#e9e2d7',
    background: '#191715',
    border: '1px solid rgba(197,168,117,.3)',
    boxShadow: '0 25px 80px rgba(0,0,0,.6)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 15,
    marginBottom: 20,
  },
  eyebrow: {
    color: '#c5a875',
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: 600,
    marginBottom: 8,
  },
  title: {
    margin: 0,
    font: "500 29px 'Playfair Display', serif",
  },
  muted: {
    color: '#a99a85',
    fontSize: 10,
    lineHeight: 1.6,
  },
  close: {
    border: 0,
    background: 'transparent',
    color: '#a99a85',
    cursor: 'pointer',
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 8,
    marginBottom: 18,
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
    padding: 12,
    background: 'rgba(197,168,117,.045)',
    border: '1px solid rgba(197,168,117,.15)',
  },
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    textAlign: 'center',
    padding: 35,
  },
  primary: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '11px 15px',
    border: '1px solid rgba(197,168,117,.3)',
    background: '#c5a875',
    color: '#211b13',
    font: "600 10px 'DM Sans', sans-serif",
    cursor: 'pointer',
  },
  secondary: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    padding: '10px 13px',
    border: '1px solid rgba(197,168,117,.25)',
    background: 'transparent',
    color: '#c5b69d',
    font: "500 10px 'DM Sans', sans-serif",
    cursor: 'pointer',
  },
  progressPanel: {
    padding: 18,
    marginBottom: 18,
    background: 'rgba(197,168,117,.05)',
    border: '1px solid rgba(197,168,117,.18)',
  },
  progressHeading: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    color: '#c5a875',
    fontSize: 11,
    marginBottom: 12,
  },
  progressTrack: {
    height: 6,
    overflow: 'hidden',
    background: '#332b21',
    borderRadius: 5,
  },
  progressFill: {
    height: '100%',
    background: '#c5a875',
    transition: 'width .2s ease',
  },
  summary: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 8,
    marginBottom: 15,
  },
  summaryCell: {
    padding: 12,
    background: 'rgba(197,168,117,.045)',
    border: '1px solid rgba(197,168,117,.15)',
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 9,
    marginBottom: 20,
  },
  resultSection: {
    marginTop: 20,
  },
  sectionHeading: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  goodLabel: {
    color: '#9ebc91',
    fontSize: 10,
  },
  reviewLabel: {
    color: '#d3b276',
    fontSize: 10,
  },
  resultList: {
    maxHeight: 300,
    overflowY: 'auto',
    borderTop: '1px solid rgba(197,168,117,.15)',
  },
  resultRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 5px',
    borderBottom: '1px solid rgba(197,168,117,.1)',
  },
  selection: {
    width: 22,
    height: 22,
    flex: '0 0 22px',
    display: 'grid',
    placeItems: 'center',
    border: '1px solid rgba(197,168,117,.35)',
    background: 'transparent',
    color: '#211b13',
    cursor: 'pointer',
  },
  selectionActive: {
    background: '#c5a875',
    borderColor: '#c5a875',
  },
  cover: {
    width: 39,
    height: 57,
    objectFit: 'cover',
    background: '#28221b',
  },
  bookInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 0,
    flex: 1,
    fontSize: 10,
  },
  reviewRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(150px, 1fr) 2fr',
    gap: 12,
    padding: '12px 5px',
    borderBottom: '1px solid rgba(197,168,117,.1)',
  },
  candidates: {
    display: 'flex',
    gap: 9,
    overflowX: 'auto',
    alignItems: 'flex-start',
  },
  candidate: {
    flex: '0 0 72px',
    width: 72,
    padding: 5,
    border: '1px solid',
    color: '#c5b69d',
    cursor: 'pointer',
  },
  noMatchList: {
    maxHeight: 180,
    overflowY: 'auto',
    borderTop: '1px solid rgba(197,168,117,.12)',
  },
  noMatchRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 5px',
    color: '#9b8e7e',
    fontSize: 10,
    borderBottom: '1px solid rgba(197,168,117,.08)',
  },
  bottomActions: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 22,
  },
  error: {
    padding: 11,
    marginBottom: 13,
    background: 'rgba(190,100,80,.08)',
    border: '1px solid rgba(190,100,80,.3)',
    color: '#d99b8a',
    fontSize: 10,
  },
  message: {
    padding: 11,
    marginBottom: 13,
    background: 'rgba(197,168,117,.07)',
    border: '1px solid rgba(197,168,117,.2)',
    color: '#c5b69d',
    fontSize: 10,
  },
};

export default CoverRecovery;
