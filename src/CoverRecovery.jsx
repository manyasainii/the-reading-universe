
import React, { useMemo, useState } from 'react';
import {
  X, Search, LoaderCircle, Check, BookOpen,
  ChevronLeft, ChevronRight, RefreshCw, ImageOff,
} from 'lucide-react';
import { supabase } from './lib/supabase';

const BATCH_SIZE = 10;
const REQUEST_GAP = 1100;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalize(value) {
  return (value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function CoverRecovery({ onClose, onUpdated }) {
  const [books, setBooks] = useState([]);
  const [batch, setBatch] = useState([]);
  const [choices, setChoices] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  async function loadBooks() {
    setLoading(true);
    setError('');
    setMessage('');
    setBatch([]);
    setChoices({});
    setOffset(0);
    setLoaded(false);

    const { data, error: fetchError, count } = await supabase
      .from('user_books')
      .select('id, title, author, isbn, cover_url', { count: 'exact' })
      .or('cover_url.is.null,cover_url.eq.')
      .order('title', { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setBooks(data || []);
    setTotal(count ?? data?.length ?? 0);
    setLoaded(true);
    setLoading(false);

    if (!data?.length) {
      setMessage('Every book in your library already has a cover.');
    }
  }

  async function searchCover(book) {
    const url = new URL('https://openlibrary.org/search.json');

    if (book.isbn) {
      url.searchParams.set(
        'isbn',
        book.isbn.replace(/[^0-9Xx]/g, '')
      );
    } else {
      url.searchParams.set('title', book.title);
      if (book.author) {
        url.searchParams.set('author', book.author);
      }
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
          !book.author ||
          (item.author_name || []).some(
            (author) =>
              normalize(author) === normalize(book.author)
          );

        return {
          id: item.key,
          title: item.title || 'Untitled',
          author: (item.author_name || []).join(', '),
          cover_url: `https://covers.openlibrary.org/b/id/${item.cover_i}-M.jpg`,
          exactMatch: titleMatch && authorMatch,
          titleMatch,
        };
      })
      .sort((a, b) => {
        if (a.exactMatch !== b.exactMatch) {
          return a.exactMatch ? -1 : 1;
        }
        if (a.titleMatch !== b.titleMatch) {
          return a.titleMatch ? -1 : 1;
        }
        return 0;
      });
  }

  async function prepareBatch(start = offset) {
    if (!books.length || start >= books.length) return;

    setLoading(true);
    setError('');
    setMessage('');
    setBatch([]);
    setChoices({});

    const nextBooks = books.slice(start, start + BATCH_SIZE);
    const results = [];

    try {
      for (let i = 0; i < nextBooks.length; i += 1) {
        if (i > 0) await sleep(REQUEST_GAP);

        const book = nextBooks[i];

        try {
          const candidates = await searchCover(book);
          results.push({ ...book, candidates });
        } catch (searchError) {
          results.push({
            ...book,
            candidates: [],
            searchError: searchError.message,
          });
        }
      }

      setBatch(results);
      setOffset(start);
    } catch (batchError) {
      setError(batchError.message || 'Unable to search for covers.');
    } finally {
      setLoading(false);
    }
  }

  function chooseCover(bookId, coverUrl) {
    setChoices((current) => ({
      ...current,
      [bookId]: coverUrl,
    }));
  }

  const selectedCount = useMemo(
    () => Object.values(choices).filter(Boolean).length,
    [choices]
  );

  async function saveSelected() {
    const selected = batch.filter(
      (book) => choices[book.id]
    );

    if (!selected.length) return;

    setSaving(true);
    setError('');
    let successful = 0;

    for (const book of selected) {
      const { error: updateError } = await supabase
        .from('user_books')
        .update({ cover_url: choices[book.id] })
        .eq('id', book.id)
        .is('cover_url', null);

      if (!updateError) {
        successful += 1;
      }
    }

    setSavedCount((current) => current + successful);
    setBooks((current) =>
      current.filter(
        (book) => !selected.some((item) => item.id === book.id)
      )
    );

    setBatch([]);
    setChoices({});
    setSaving(false);

    if (successful) {
      setMessage(
        `${successful} cover${successful === 1 ? '' : 's'} saved to your library.`
      );
      if (onUpdated) await onUpdated();
    } else {
      setError(
        'No covers were saved. They may already have been updated.'
      );
    }
  }

  function nextBatch() {
    const nextOffset = offset + batch.length;
    if (nextOffset < books.length) {
      prepareBatch(nextOffset);
    } else {
      setBatch([]);
      setMessage('You have reached the end of the cover review queue.');
    }
  }

  const reviewedCount = books.length - batch.length;

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
              Review suggested covers before adding them to your library.
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
              Find books in your library that still need covers.
            </p>
            <button
              style={ui.primary}
              onClick={loadBooks}
              disabled={loading}
            >
              {loading ? (
                <LoaderCircle size={15} />
              ) : (
                <Search size={15} />
              )}
              Find books without covers
            </button>
          </div>
        )}

        {loaded && (
          <>
            <div style={ui.stats}>
              <div>
                <strong>{total}</strong>
                <span>BOOKS NEEDING COVERS</span>
              </div>
              <div>
                <strong>{savedCount}</strong>
                <span>COVERS SAVED THIS SESSION</span>
              </div>
              <div>
                <strong>{BATCH_SIZE}</strong>
                <span>BOOKS PER REVIEW BATCH</span>
              </div>
            </div>

            {loading && (
              <div style={ui.loading}>
                <LoaderCircle size={23} />
                <p>Finding possible covers. This may take a moment...</p>
              </div>
            )}

            {!loading && batch.length === 0 && books.length > 0 && (
              <div style={ui.center}>
                <p style={ui.muted}>
                  {message || 'Ready to review your first batch.'}
                </p>
                <button
                  style={ui.primary}
                  onClick={() => prepareBatch(0)}
                >
                  <Search size={15} />
                  Find first batch
                </button>
              </div>
            )}

            {!loading && batch.length > 0 && (
              <>
                <div style={ui.batchHeading}>
                  <div>
                    <strong>
                      Review batch {Math.floor(offset / BATCH_SIZE) + 1}
                    </strong>
                    <p style={ui.muted}>
                      {batch.length} books · {selectedCount} covers selected
                    </p>
                  </div>
                  <button
                    style={ui.secondary}
                    onClick={() => prepareBatch(offset)}
                    disabled={loading || saving}
                  >
                    <RefreshCw size={13} />
                    Search again
                  </button>
                </div>

                <div style={ui.bookList}>
                  {batch.map((book) => {
                    const selected = choices[book.id];

                    return (
                      <article key={book.id} style={ui.bookRow}>
                        <div style={ui.original}>
                          <div style={ui.placeholder}>
                            <BookOpen size={23} />
                          </div>
                          <strong>{book.title}</strong>
                          <span>{book.author || 'Author unknown'}</span>
                        </div>

                        <div style={ui.candidates}>
                          {book.candidates.length === 0 ? (
                            <div style={ui.noMatch}>
                              <ImageOff size={19} />
                              <span>
                                {book.searchError
                                  ? 'Search failed'
                                  : 'No cover found'}
                              </span>
                            </div>
                          ) : (
                            book.candidates.map((candidate) => (
                              <button
                                type="button"
                                key={candidate.id}
                                onClick={() =>
                                  chooseCover(book.id, candidate.cover_url)
                                }
                                style={{
                                  ...ui.candidate,
                                  borderColor:
                                    selected === candidate.cover_url
                                      ? '#c5a875'
                                      : 'rgba(197,168,117,.15)',
                                  background:
                                    selected === candidate.cover_url
                                      ? 'rgba(197,168,117,.1)'
                                      : '#171512',
                                }}
                                title={`${candidate.title} by ${candidate.author}`}
                              >
                                <img
                                  src={candidate.cover_url}
                                  alt={`Suggested cover for ${candidate.title}`}
                                />
                                <span>
                                  {selected === candidate.cover_url ? (
                                    <Check size={14} />
                                  ) : (
                                    'Select'
                                  )}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>

                <div style={ui.actions}>
                  <button
                    style={ui.secondary}
                    onClick={nextBatch}
                    disabled={saving}
                  >
                    Skip this batch
                    <ChevronRight size={14} />
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
                    Save {selectedCount} selected covers
                  </button>
                </div>
              </>
            )}

            {!loading && batch.length === 0 && books.length === 0 && (
              <div style={ui.center}>
                <BookOpen size={28} color="#c5a875" />
                <p style={ui.muted}>
                  All your books now have covers. Your library is looking good.
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
    width: 'min(100%, 900px)',
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
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    padding: 35,
    color: '#c5a875',
    fontSize: 11,
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
  batchHeading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    margin: '15px 0 10px',
  },
  bookList: {
    maxHeight: '48vh',
    overflowY: 'auto',
    borderTop: '1px solid rgba(197,168,117,.15)',
  },
  bookRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(130px, 1fr) 2fr',
    gap: 14,
    padding: '13px 4px',
    borderBottom: '1px solid rgba(197,168,117,.1)',
  },
  original: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
    minWidth: 0,
  },
  placeholder: {
    width: 48,
    height: 65,
    display: 'grid',
    placeItems: 'center',
    color: '#c5a875',
    background: '#28221b',
    border: '1px solid rgba(197,168,117,.2)',
    marginBottom: 4,
  },
  candidates: {
    display: 'flex',
    gap: 9,
    overflowX: 'auto',
    alignItems: 'flex-start',
  },
  candidate: {
    flex: '0 0 82px',
    width: 82,
    padding: 5,
    border: '1px solid',
    color: '#c5b69d',
    cursor: 'pointer',
  },
  noMatch: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: '#8f806d',
    fontSize: 10,
  },
  actions: {
    display: 'flex',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 17,
  },
};

export default CoverRecovery;
