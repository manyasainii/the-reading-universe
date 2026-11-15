
import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus, Search, BookOpen, BookMarked, Clock3, Bookmark,
  Star, X, Trash2, SlidersHorizontal, Library as LibraryIcon,
  LoaderCircle, Check,
} from 'lucide-react';
import { supabase } from './lib/supabase';
import './Library.css';

const shelves = [
  { id: 'all', label: 'All books', icon: LibraryIcon },
  { id: 'currently_reading', label: 'Currently reading', icon: BookOpen },
  { id: 'read', label: 'Read', icon: BookMarked },
  { id: 'want_to_read', label: 'Want to read', icon: Bookmark },
  { id: 'did_not_finish', label: 'Did not finish', icon: Clock3 },
];

const ratingOptions = [
  { value: '', label: 'Not rated' },
  ...Array.from({ length: 10 }, (_, index) => {
    const rating = (index + 1) / 2;
    return {
      value: String(rating),
      label: `${rating} ${rating === 1 ? 'star' : 'stars'}`,
    };
  }),
];

const emptyForm = {
  title: '',
  author: '',
  reading_status: 'want_to_read',
  rating: '',
  cover_url: '',
};

function Library() {
  const [books, setBooks] = useState([]);
  const [activeShelf, setActiveShelf] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const [bookSearch, setBookSearch] = useState('');
  const [bookResults, setBookResults] = useState([]);
  const [searchingBooks, setSearchingBooks] = useState(false);
  const [bookSearchError, setBookSearchError] = useState('');
  const [selectedBook, setSelectedBook] = useState(null);

  useEffect(() => {
    fetchBooks();
  }, []);

  async function fetchBooks() {
    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from('user_books')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setBooks([]);
    } else {
      setBooks(data || []);
    }

    setLoading(false);
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

   async function searchForBooks(event) {   event.preventDefault();    const query = bookSearch.trim();   if (!query) return;    setSearchingBooks(true);   setBookSearchError('');   setBookResults([]);   setSelectedBook(null);    try {     const url = new URL('https://www.googleapis.com/books/v1/volumes');      url.searchParams.set('q', `intitle:${query}`);     url.searchParams.set('maxResults', '10');     url.searchParams.set('printType', 'books');      const response = await fetch(url);     const data = await response.json().catch(() => ({}));      if (!response.ok) {       const detail =         data.error?.message ||         response.statusText ||         'Unknown server error';        throw new Error(         `Google Books returned HTTP ${response.status}: ${detail}`       );     }      const results = (data.items || []).map((item) => {       const info = item.volumeInfo || {};       const imageLinks = info.imageLinks || {};        let cover =         imageLinks.thumbnail ||         imageLinks.smallThumbnail ||         '';        if (cover.startsWith('http://')) {         cover = cover.replace('http://', 'https://');       }        return {         id: item.id,         title: info.title || 'Untitled',         author: (info.authors || []).join(', '),         cover_url: cover,         publisher: info.publisher || '',         published_date: info.publishedDate || '',       };     });      setBookResults(results);      if (results.length === 0) {       setBookSearchError(         'No books found. Try another title or add it manually.'       );     }   } catch (searchError) {     console.error('Book catalogue search failed:', searchError);      setBookSearchError(       searchError.message?.includes('HTTP')         ? searchError.message         : `Could not reach Google Books: ${searchError.message || 'Network error'}`     );   } finally {     setSearchingBooks(false);   } }
    event.preventDefault();

    const query = bookSearch.trim();

    if (!query) return;

    setSearchingBooks(true);
    setBookSearchError('');
    setBookResults([]);
    setSelectedBook(null);

    try {
      const url = new URL('https://www.googleapis.com/books/v1/volumes');
      url.searchParams.set('q', `intitle:${query}`);
      url.searchParams.set('maxResults', '10');
      url.searchParams.set('printType', 'books');

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('The book search service is unavailable. Try again.');
      }

      const data = await response.json();

      const results = (data.items || []).map((item) => {
        const info = item.volumeInfo || {};
        const imageLinks = info.imageLinks || {};

        let cover = imageLinks.thumbnail || imageLinks.smallThumbnail || '';

        if (cover.startsWith('http://')) {
          cover = cover.replace('http://', 'https://');
        }

        return {
          id: item.id,
          title: info.title || 'Untitled',
          author: (info.authors || []).join(', '),
          cover_url: cover,
          publisher: info.publisher || '',
          published_date: info.publishedDate || '',
        };
      });

      setBookResults(results);

      if (results.length === 0) {
        setBookSearchError('No books found. Try another title or add it manually.');
      }
    } catch (searchError) {
      setBookSearchError(
        searchError.message || 'Something went wrong. Please try again.'
      );
    }

    setSearchingBooks(false);
  }

  function chooseBook(book) {
    setSelectedBook(book);

    setForm((current) => ({
      ...current,
      title: book.title,
      author: book.author,
      cover_url: book.cover_url,
    }));
  }

  async function addBook(event) {
    event.preventDefault();

    if (!form.title.trim()) {
      setError('A book title is required.');
      return;
    }

    setSaving(true);
    setError('');

    const newBook = {
      title: form.title.trim(),
      author: form.author.trim() || null,
      reading_status: form.reading_status,
      rating: form.rating ? Number(form.rating) : null,
      cover_url: form.cover_url || null,
      date_finished:
        form.reading_status === 'read'
          ? new Date().toISOString().slice(0, 10)
          : null,
    };

    const { data, error: insertError } = await supabase
      .from('user_books')
      .insert(newBook)
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setBooks((current) => [data, ...current]);
    setForm(emptyForm);
    setModalOpen(false);
    resetBookSearch();
    setSaving(false);
  }

  function resetBookSearch() {
    setBookSearch('');
    setBookResults([]);
    setBookSearchError('');
    setSelectedBook(null);
  }

  async function updateBook(id, changes) {
    setError('');

    const { data, error: updateError } = await supabase
      .from('user_books')
      .update(changes)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setBooks((current) =>
      current.map((book) => (book.id === id ? data : book))
    );
  }

  async function deleteBook(id) {
    const confirmed = window.confirm(
      'Remove this book from your library?'
    );

    if (!confirmed) return;

    const { error: deleteError } = await supabase
      .from('user_books')
      .delete()
      .eq('id', id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setBooks((current) => current.filter((book) => book.id !== id));
  }

  const filteredBooks = useMemo(() => {
    let result = [...books];

    if (activeShelf !== 'all') {
      result = result.filter(
        (book) => book.reading_status === activeShelf
      );
    }

    if (search.trim()) {
      const term = search.toLowerCase();

      result = result.filter(
        (book) =>
          book.title.toLowerCase().includes(term) ||
          (book.author || '').toLowerCase().includes(term)
      );
    }

    if (sortBy === 'title') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'author') {
      result.sort((a, b) =>
        (a.author || '').localeCompare(b.author || '')
      );
    } else if (sortBy === 'rating') {
      result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else {
      result.sort(
        (a, b) =>
          new Date(b.created_at) - new Date(a.created_at)
      );
    }

    return result;
  }, [books, activeShelf, search, sortBy]);

  const counts = useMemo(() => ({
    all: books.length,
    currently_reading: books.filter(
      (book) => book.reading_status === 'currently_reading'
    ).length,
    read: books.filter(
      (book) => book.reading_status === 'read'
    ).length,
    want_to_read: books.filter(
      (book) => book.reading_status === 'want_to_read'
    ).length,
    did_not_finish: books.filter(
      (book) => book.reading_status === 'did_not_finish'
    ).length,
  }), [books]);

  const activeShelfLabel =
    shelves.find((shelf) => shelf.id === activeShelf)?.label || 'All books';

  function openAddBook() {
    setError('');
    setForm(emptyForm);
    resetBookSearch();
    setModalOpen(true);
  }

  return (
    <div className="library-page">
      <section className="library-intro">
        <div>
          <div className="library-eyebrow">
            <span />
            YOUR PERSONAL COLLECTION
          </div>
          <h1>Your <em>library.</em></h1>
          <p>Every story you've read, and every story still waiting.</p>
        </div>

        <button className="library-add-button" onClick={openAddBook}>
          <Plus size={17} />
          Add a book
        </button>
      </section>

      <section className="library-summary">
        <div>
          <span className="summary-number">{books.length}</span>
          <span className="summary-label">BOOKS IN YOUR COLLECTION</span>
        </div>
        <div className="summary-divider" />
        <div>
          <span className="summary-number">{counts.read}</span>
          <span className="summary-label">BOOKS COMPLETED</span>
        </div>
        <div className="summary-divider" />
        <div>
          <span className="summary-number">{counts.currently_reading}</span>
          <span className="summary-label">STORIES IN PROGRESS</span>
        </div>
      </section>

      <section className="library-workspace">
        <aside className="shelf-sidebar">
          <div className="shelf-heading">YOUR SHELVES</div>

          {shelves.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`shelf-button ${
                activeShelf === id ? 'shelf-selected' : ''
              }`}
              onClick={() => setActiveShelf(id)}
            >
              <Icon size={16} />
              <span>{label}</span>
              <small>{counts[id]}</small>
            </button>
          ))}

          <div className="shelf-note">
            <Star size={15} />
            <p>
              A library is not measured by its size, but by the worlds
              it contains.
            </p>
          </div>
        </aside>

        <div className="book-collection">
          <div className="collection-toolbar">
            <div>
              <h2>{activeShelfLabel}</h2>
              <span>
                {filteredBooks.length}{' '}
                {filteredBooks.length === 1 ? 'book' : 'books'}
              </span>
            </div>

            <div className="collection-controls">
              <label className="library-search">
                <Search size={15} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search titles or authors"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </label>

              <label className="library-sort">
                <SlidersHorizontal size={14} />
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value)}
                  aria-label="Sort books"
                >
                  <option value="recent">Recently added</option>
                  <option value="title">Title</option>
                  <option value="author">Author</option>
                  <option value="rating">Highest rated</option>
                </select>
                <span className="sort-chevron">⌄</span>
              </label>
            </div>
          </div>

          {error && (
            <div className="library-error" role="alert">{error}</div>
          )}

          {loading ? (
            <div className="library-loading">
              <BookOpen size={25} />
              <p>Gathering your books...</p>
            </div>
          ) : filteredBooks.length === 0 ? (
            <div className="library-empty">
              <div className="library-empty-icon">
                <BookOpen size={28} />
              </div>
              <h3>
                {search
                  ? 'No books found.'
                  : activeShelf === 'all'
                  ? 'Your shelves are waiting.'
                  : 'Nothing on this shelf yet.'}
              </h3>
              <p>
                {search
                  ? 'Try another title or author.'
                  : 'Add a book and give this little universe a beginning.'}
              </p>
              {!search && (
                <button
                  className="library-add-button"
                  onClick={openAddBook}
                >
                  <Plus size={16} />
                  Add your first book
                </button>
              )}
            </div>
          ) : (
            <div className="book-grid">
              {filteredBooks.map((book) => (
                <article className="book-card" key={book.id}>
                  <div className="book-cover">
                    {book.cover_url ? (
                      <img
                        src={book.cover_url}
                        alt={`Cover of ${book.title}`}
                      />
                    ) : (
                      <div className="book-cover-placeholder">
                        <BookOpen size={27} />
                        <span>{book.title}</span>
                        {book.author && <small>{book.author}</small>}
                      </div>
                    )}

                    <button
                      className="book-delete"
                      onClick={() => deleteBook(book.id)}
                      title="Remove book"
                      aria-label={`Remove ${book.title}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="book-card-details">
                    <h3>{book.title}</h3>
                    <p>{book.author || 'Author unknown'}</p>

                    <div className="book-card-meta">
                      {book.rating != null && (
                        <span className="book-rating">
                          <Star size={12} fill="currentColor" />
                          {Number(book.rating).toFixed(1).replace('.0', '')}/5
                        </span>
                      )}
                    </div>

                    <select
                      className="book-status-select"
                      value={book.reading_status}
                      onChange={(event) => {
                        const nextStatus = event.target.value;
                        updateBook(book.id, {
                          reading_status: nextStatus,
                          ...(nextStatus === 'read' && !book.date_finished
                            ? {
                                date_finished: new Date()
                                  .toISOString()
                                  .slice(0, 10),
                              }
                            : {}),
                        });
                      }}
                      aria-label={`Reading status for ${book.title}`}
                    >
                      <option value="currently_reading">Currently reading</option>
                      <option value="read">Read</option>
                      <option value="want_to_read">Want to read</option>
                      <option value="did_not_finish">Did not finish</option>
                    </select>

                    <select
                      className="book-rating-select"
                      value={book.rating ?? ''}
                      onChange={(event) =>
                        updateBook(book.id, {
                          rating: event.target.value
                            ? Number(event.target.value)
                            : null,
                        })
                      }
                      aria-label={`Rating for ${book.title}`}
                    >
                      {ratingOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {modalOpen && (
        <div
          className="book-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setModalOpen(false);
            }
          }}
        >
          <section
            className="book-modal book-modal-compact"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-book-title"
          >
            <div className="book-modal-header">
              <div>
                <div className="library-eyebrow">
                  <span />
                  A NEW ARRIVAL
                </div>
                <h2 id="add-book-title">Add a <em>book.</em></h2>
              </div>

              <button
                className="book-modal-close"
                onClick={() => setModalOpen(false)}
                aria-label="Close form"
              >
                <X size={19} />
              </button>
            </div>

            <div className="book-lookup">
              <div className="book-lookup-heading">
                FIND YOUR BOOK
              </div>

              <form className="book-lookup-form" onSubmit={searchForBooks}>
                <Search size={16} />
                <input
                  value={bookSearch}
                  onChange={(event) => setBookSearch(event.target.value)}
                  placeholder="Search by book title..."
                  aria-label="Search book catalogue"
                />
                <button
                  type="submit"
                  disabled={searchingBooks || !bookSearch.trim()}
                >
                  {searchingBooks ? (
                    <LoaderCircle size={16} className="lookup-spinner" />
                  ) : (
                    'Search'
                  )}
                </button>
              </form>

              {bookSearchError && (
                <p className="book-lookup-message">{bookSearchError}</p>
              )}

              {bookResults.length > 0 && (
                <div className="book-search-results">
                  {bookResults.map((book) => (
                    <button
                      type="button"
                      key={book.id}
                      className={`book-search-result ${
                        selectedBook?.id === book.id ? 'result-selected' : ''
                      }`}
                      onClick={() => chooseBook(book)}
                    >
                      <div className="book-result-cover">
                        {book.cover_url ? (
                          <img src={book.cover_url} alt="" />
                        ) : (
                          <BookOpen size={20} />
                        )}
                      </div>

                      <div className="book-result-copy">
                        <strong>{book.title}</strong>
                        <span>{book.author || 'Author unavailable'}</span>
                        {book.publisher && (
                          <small>{book.publisher}</small>
                        )}
                      </div>

                      {selectedBook?.id === book.id ? (
                        <Check size={17} className="result-check" />
                      ) : (
                        <Plus size={17} className="result-plus" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              <p className="book-lookup-hint">
                Choose a result to fill in the title, author and cover.
              </p>
            </div>

            <div className="book-form-divider">
              <span>OR ADD MANUALLY</span>
            </div>

            <form onSubmit={addBook}>
              <label className="book-form-field">
                Book title *
                <input
                  required
                  autoFocus
                  value={form.title}
                  onChange={(event) => {
                    updateForm('title', event.target.value);
                    setSelectedBook(null);
                  }}
                  placeholder="The name of the book"
                />
              </label>

              <label className="book-form-field">
                Author
                <input
                  value={form.author}
                  onChange={(event) => updateForm('author', event.target.value)}
                  placeholder="Who wrote it?"
                />
              </label>

              <label className="book-form-field">
                Reading status
                <select
                  value={form.reading_status}
                  onChange={(event) =>
                    updateForm('reading_status', event.target.value)
                  }
                >
                  <option value="want_to_read">Want to read</option>
                  <option value="currently_reading">Currently reading</option>
                  <option value="read">Read</option>
                  <option value="did_not_finish">Did not finish</option>
                </select>
              </label>

              <label className="book-form-field">
                Your rating
                <select
                  value={form.rating}
                  onChange={(event) => updateForm('rating', event.target.value)}
                >
                  {ratingOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              {error && (
                <div className="library-error" role="alert">{error}</div>
              )}

              <div className="book-modal-actions">
                <button
                  type="button"
                  className="book-cancel-button"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="library-add-button"
                  disabled={saving}
                >
                  <Plus size={16} />
                  {saving ? 'Adding...' : 'Add to my library'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default Library;
