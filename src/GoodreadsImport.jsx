
import React, { useMemo, useRef, useState } from 'react';
import {
  Upload, FileSpreadsheet, X, Check, AlertCircle,
  LoaderCircle, BookOpen, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { supabase } from './lib/supabase';

const PAGE_SIZE = 50;

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 200,
    background: 'rgba(0,0,0,.82)',
    backdropFilter: 'blur(5px)',
    display: 'grid',
    placeItems: 'center',
    padding: 16,
  },
  modal: {
    width: 'min(100%, 850px)',
    maxHeight: '92vh',
    overflowY: 'auto',
    background: '#191715',
    border: '1px solid rgba(197,168,117,.3)',
    boxShadow: '0 25px 80px rgba(0,0,0,.6)',
    padding: 26,
    color: '#e9e2d7',
  },
  muted: {
    color: '#a99a85',
    fontSize: 11,
    lineHeight: 1.6,
  },
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '11px 16px',
    border: '1px solid rgba(197,168,117,.3)',
    background: '#c5a875',
    color: '#211b13',
    font: "600 11px 'DM Sans', sans-serif",
    cursor: 'pointer',
  },
  secondaryButton: {
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
  input: {
    width: '100%',
    padding: 12,
    background: '#12110f',
    border: '1px solid rgba(197,168,117,.25)',
    color: '#e9e2d7',
    font: "11px 'DM Sans', sans-serif",
  },
  stat: {
    padding: 13,
    background: 'rgba(197,168,117,.045)',
    border: '1px solid rgba(197,168,117,.15)',
  },
};

function parseCSV(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        value += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(value);

      if (row.some((cell) => cell.trim() !== '')) {
        rows.push(row);
      }

      row = [];
      value = '';
    } else {
      value += char;
    }
  }

  if (value.length || row.length) {
    row.push(value);
    rows.push(row);
  }

  if (!rows.length) return [];

  const headers = rows[0].map((header) => header.trim());

  return rows.slice(1).map((cells) => {
    const record = {};

    headers.forEach((header, index) => {
      record[header] = (cells[index] || '').trim();
    });

    return record;
  });
}

function cleanISBN(value) {
  if (!value) return null;

  const cleaned = value
    .replace(/^="?/, '')
    .replace(/"?$/, '')
    .trim();

  return cleaned || null;
}

function numberOrNull(value) {
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function integerOrNull(value) {
  const number = numberOrNull(value);
  return number == null ? null : Math.round(number);
}

function parseDate(value) {
  if (!value) return null;

  const match = value.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);

  if (!match) return null;

  const [, year, month, day] = match;

  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function normalizeText(value) {
  return (value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function mapStatus(value) {
  const status = (value || '').toLowerCase().trim();

  if (status === 'read') return 'read';

  if (
    status === 'currently-reading' ||
    status === 'currently_reading'
  ) {
    return 'currently_reading';
  }

  if (
    status === 'did-not-finish' ||
    status === 'did_not_finish'
  ) {
    return 'did_not_finish';
  }

  return 'want_to_read';
}

function mapGoodreadsBook(row, index) {
  const rating = Number(row['My Rating']);

  return {
    importId: `${row['Book Id'] || 'book'}-${index}`,
    goodreads_book_id: row['Book Id'] || null,
    title: row.Title?.trim() || '',
    author: row.Author?.trim() || null,
    isbn: cleanISBN(row.ISBN13) || cleanISBN(row.ISBN),
    rating: Number.isFinite(rating) && rating > 0 ? rating : null,
    publisher: row.Publisher?.trim() || null,
    page_count: integerOrNull(row['Number of Pages']),
    publication_year: integerOrNull(row['Year Published']),
    original_publication_year: integerOrNull(
      row['Original Publication Year']
    ),
    book_format: row.Binding?.trim() || null,
    date_finished: parseDate(row['Date Read']),
    reading_status: mapStatus(row['Exclusive Shelf']),
    read_count: integerOrNull(row['Read Count']) || 0,
    owned_copies: integerOrNull(row['Owned Copies']) || 0,
  };
}

function GoodreadsImport({ existingBooks = [], onClose, onImported }) {
  const fileInput = useRef(null);

  const [fileName, setFileName] = useState('');
  const [records, setRecords] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [error, setError] = useState('');
  const [stage, setStage] = useState('upload');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [failedTitles, setFailedTitles] = useState([]);

  const existingGoodreadsIds = useMemo(
    () => new Set(
      existingBooks
        .map((book) => String(book.goodreads_book_id || ''))
        .filter(Boolean)
    ),
    [existingBooks]
  );

  const existingTitleAuthors = useMemo(
    () => new Set(
      existingBooks.map((book) =>
        `${normalizeText(book.title)}|${normalizeText(book.author)}`
      )
    ),
    [existingBooks]
  );

  const analysedRecords = useMemo(() => {
    return records.map((book) => {
      const duplicateById =
        book.goodreads_book_id &&
        existingGoodreadsIds.has(String(book.goodreads_book_id));

      const duplicateByTitle =
        existingTitleAuthors.has(
          `${normalizeText(book.title)}|${normalizeText(book.author)}`
        );

      return {
        ...book,
        duplicate: Boolean(duplicateById || duplicateByTitle),
      };
    });
  }, [records, existingGoodreadsIds, existingTitleAuthors]);

  const duplicateCount = analysedRecords.filter(
    (book) => book.duplicate
  ).length;

  const newBooks = analysedRecords.filter(
    (book) => !book.duplicate
  );

  const statusCounts = useMemo(() => ({
    read: records.filter((book) => book.reading_status === 'read').length,
    currently_reading: records.filter(
      (book) => book.reading_status === 'currently_reading'
    ).length,
    want_to_read: records.filter(
      (book) => book.reading_status === 'want_to_read'
    ).length,
    did_not_finish: records.filter(
      (book) => book.reading_status === 'did_not_finish'
    ).length,
  }), [records]);

  function selectDefaultBooks(mappedBooks) {
    const existingIds = new Set(
      existingBooks
        .map((book) => String(book.goodreads_book_id || ''))
        .filter(Boolean)
    );

    const existingNames = new Set(
      existingBooks.map((book) =>
        `${normalizeText(book.title)}|${normalizeText(book.author)}`
      )
    );

    const ids = mappedBooks
      .filter((book) => {
        const duplicateById =
          book.goodreads_book_id &&
          existingIds.has(String(book.goodreads_book_id));

        const duplicateByName = existingNames.has(
          `${normalizeText(book.title)}|${normalizeText(book.author)}`
        );

        return !duplicateById && !duplicateByName;
      })
      .map((book) => book.importId);

    setSelectedIds(ids);
  }

  async function handleFile(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    setError('');
    setRecords([]);
    setSelectedIds([]);
    setFileName(file.name);

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please upload a Goodreads CSV file.');
      return;
    }

    try {
      const text = await file.text();
      const parsed = parseCSV(text);

      if (!parsed.length) {
        throw new Error('The CSV file appears to be empty.');
      }

      const requiredColumns = [
        'Book Id',
        'Title',
        'Author',
        'Exclusive Shelf',
      ];

      const missing = requiredColumns.filter(
        (column) => !(column in parsed[0])
      );

      if (missing.length) {
        throw new Error(
          `This does not look like a standard Goodreads export. Missing columns: ${missing.join(', ')}`
        );
      }

      const mapped = parsed
        .map(mapGoodreadsBook)
        .filter((book) => book.title);

      if (!mapped.length) {
        throw new Error('No books with valid titles were found.');
      }

      setRecords(mapped);
      selectDefaultBooks(mapped);
      setStage('preview');
    } catch (fileError) {
      setError(fileError.message || 'Unable to read this CSV file.');
    }
  }

  function toggleBook(id) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  function toggleAll() {
    const selectableIds = newBooks.map((book) => book.importId);

    const allSelected = selectableIds.every(
      (id) => selectedIds.includes(id)
    );

    setSelectedIds((current) =>
      allSelected
        ? current.filter((id) => !selectableIds.includes(id))
        : [...new Set([...current, ...selectableIds])]
    );
  }

  async function importSelected() {
    const selected = analysedRecords.filter(
      (book) => selectedIds.includes(book.importId) && !book.duplicate
    );

    if (!selected.length) {
      setError('Select at least one book to import.');
      return;
    }

    setImporting(true);
    setError('');
    setProgress(0);
    setImportedCount(0);
    setFailedCount(0);
    setFailedTitles([]);

    let success = 0;
    let failed = 0;
    const failures = [];

    const payload = selected.map(({ importId, duplicate, ...book }) => book);
    const totalBatches = Math.ceil(payload.length / PAGE_SIZE);

    for (let i = 0; i < totalBatches; i += 1) {
      const batch = payload.slice(
        i * PAGE_SIZE,
        (i + 1) * PAGE_SIZE
      );

      const { data, error: insertError } = await supabase
        .from('user_books')
        .insert(batch)
        .select('id');

      if (insertError) {
        failed += batch.length;
        failures.push(
          ...batch.map((book) => book.title)
        );
      } else {
        success += data?.length || batch.length;
      }

      setImportedCount(success);
      setFailedCount(failed);
      setFailedTitles([...failures]);
      setProgress(Math.round(((i + 1) / totalBatches) * 100));
    }

    setImporting(false);

    if (success > 0) {
      setStage('complete');
      if (onImported) await onImported();
    } else {
      setError(
        'No books were imported. Check the error details and try again.'
      );
    }
  }

  const selectedCount = selectedIds.filter((id) =>
    newBooks.some((book) => book.importId === id)
  ).length;

  return (
    <div style={styles.overlay} onMouseDown={(event) => {
      if (event.target === event.currentTarget && !importing) onClose();
    }}>
      <section style={styles.modal} role="dialog" aria-modal="true">
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          marginBottom: 22,
        }}>
          <div>
            <div style={{
              color: '#c5a875',
              fontSize: 9,
              letterSpacing: 1.5,
              fontWeight: 600,
              marginBottom: 9,
            }}>
              EXPAND YOUR COLLECTION
            </div>
            <h2 style={{
              margin: 0,
              font: "500 30px 'Playfair Display', serif",
              color: '#eee5d7',
            }}>
              Goodreads <em style={{ color: '#c5a875' }}>import.</em>
            </h2>
            <p style={styles.muted}>
              Bring your reading history into your universe.
            </p>
          </div>

          <button
            onClick={onClose}
            disabled={importing}
            aria-label="Close importer"
            style={{
              background: 'transparent',
              border: 0,
              color: '#a99a85',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <X size={20} />
          </button>
        </header>

        {error && (
          <div style={{
            display: 'flex',
            gap: 9,
            alignItems: 'flex-start',
            padding: 12,
            marginBottom: 16,
            background: 'rgba(190,100,80,.08)',
            border: '1px solid rgba(190,100,80,.3)',
            color: '#d99b8a',
            fontSize: 11,
            lineHeight: 1.5,
          }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {stage === 'upload' && (
          <div>
            <div
              onClick={() => fileInput.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files?.[0];
                if (file) {
                  const transfer = new DataTransfer();
                  transfer.items.add(file);
                  fileInput.current.files = transfer.files;
                  handleFile({ target: { files: [file] } });
                }
              }}
              style={{
                minHeight: 230,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center',
                gap: 12,
                padding: 25,
                border: '1px dashed rgba(197,168,117,.4)',
                background: 'rgba(197,168,117,.035)',
                cursor: 'pointer',
              }}
            >
              <div style={{
                width: 54,
                height: 54,
                display: 'grid',
                placeItems: 'center',
                color: '#c5a875',
                border: '1px solid rgba(197,168,117,.3)',
              }}>
                <FileSpreadsheet size={25} />
              </div>

              <strong style={{
                font: "500 17px 'Playfair Display', serif",
                color: '#e9e2d7',
              }}>
                Choose your Goodreads export
              </strong>

              <span style={styles.muted}>
                Drag and drop your CSV here, or click to browse
              </span>

              <span style={{
                color: '#c5a875',
                fontSize: 9,
                letterSpacing: 1,
              }}>
                CSV FILES ONLY
              </span>

              <input
                ref={fileInput}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFile}
                style={{ display: 'none' }}
              />
            </div>

            <p style={{ ...styles.muted, marginTop: 15 }}>
              Your Goodreads export is processed in your browser. Books are
              added to your private library only after you confirm the import.
            </p>
          </div>
        )}

        {stage === 'preview' && (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 8,
              marginBottom: 18,
            }}>
              {[
                ['TOTAL BOOKS', records.length],
                ['NEW BOOKS', newBooks.length],
                ['DUPLICATES', duplicateCount],
                ['SELECTED', selectedCount],
              ].map(([label, value]) => (
                <div key={label} style={styles.stat}>
                  <div style={{
                    color: '#d9c9ae',
                    font: "500 24px 'Playfair Display', serif",
                  }}>
                    {value}
                  </div>
                  <div style={{
                    color: '#8e806d',
                    fontSize: 8,
                    letterSpacing: .8,
                    marginTop: 4,
                  }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              marginBottom: 17,
            }}>
              {[
                ['Read', statusCounts.read],
                ['Currently reading', statusCounts.currently_reading],
                ['Want to read', statusCounts.want_to_read],
                ['Did not finish', statusCounts.did_not_finish],
              ].map(([label, value]) => (
                <span key={label} style={{
                  padding: '6px 9px',
                  border: '1px solid rgba(197,168,117,.17)',
                  color: '#b7a78e',
                  fontSize: 9,
                }}>
                  {label}: {value}
                </span>
              ))}
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10,
              paddingBottom: 11,
              borderBottom: '1px solid rgba(197,168,117,.18)',
            }}>
              <div style={{ ...styles.muted }}>
                <strong style={{ color: '#d9c9ae' }}>{fileName}</strong>
                <br />
                Duplicates are excluded by default.
              </div>

              <button
                onClick={toggleAll}
                style={styles.secondaryButton}
              >
                <Check size={13} />
                Toggle all new books
              </button>
            </div>

            <div style={{
              maxHeight: 340,
              overflowY: 'auto',
              marginTop: 7,
            }}>
              {analysedRecords.map((book) => {
                const checked = selectedIds.includes(book.importId);

                return (
                  <label
                    key={book.importId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 11,
                      padding: '10px 7px',
                      borderBottom: '1px solid rgba(197,168,117,.08)',
                      opacity: book.duplicate ? .48 : 1,
                      cursor: book.duplicate ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={book.duplicate}
                      onChange={() => toggleBook(book.importId)}
                      style={{ accentColor: '#c5a875' }}
                    />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        color: '#e5dbca',
                        font: "500 12px 'Playfair Display', serif",
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {book.title}
                      </div>
                      <div style={{
                        color: '#968a79',
                        fontSize: 9,
                        marginTop: 3,
                      }}>
                        {book.author || 'Author unknown'}
                        {book.rating != null && ` · ${book.rating}/5`}
                        {book.page_count && ` · ${book.page_count} pages`}
                      </div>
                    </div>

                    {book.duplicate ? (
                      <span style={{
                        color: '#a28e70',
                        fontSize: 8,
                        whiteSpace: 'nowrap',
                      }}>
                        ALREADY IN LIBRARY
                      </span>
                    ) : (
                      <span style={{
                        color: '#8f806a',
                        fontSize: 8,
                        whiteSpace: 'nowrap',
                      }}>
                        {book.reading_status.replaceAll('_', ' ').toUpperCase()}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              marginTop: 19,
            }}>
              <button
                onClick={() => {
                  setStage('upload');
                  setRecords([]);
                  setSelectedIds([]);
                  setFileName('');
                  setError('');
                }}
                style={styles.secondaryButton}
              >
                Choose another file
              </button>

              <button
                onClick={importSelected}
                disabled={!selectedCount}
                style={{
                  ...styles.button,
                  opacity: selectedCount ? 1 : .45,
                }}
              >
                <Upload size={15} />
                Import {selectedCount} books
              </button>
            </div>
          </>
        )}

        {stage === 'complete' && (
          <div style={{ textAlign: 'center', padding: '25px 5px' }}>
            <div style={{
              width: 65,
              height: 65,
              margin: '0 auto 18px',
              display: 'grid',
              placeItems: 'center',
              border: '1px solid rgba(197,168,117,.35)',
              color: '#c5a875',
              background: 'rgba(197,168,117,.08)',
            }}>
              <CheckCircle2 size={31} />
            </div>

            <h3 style={{
              color: '#eee5d7',
              font: "500 24px 'Playfair Display', serif",
              margin: '0 0 8px',
            }}>
              Your library has grown.
            </h3>

            <p style={styles.muted}>
              Your Goodreads import has finished.
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 10,
              margin: '25px 0',
            }}>
              <div style={styles.stat}>
                <div style={{
                  color: '#c5a875',
                  font: "500 27px 'Playfair Display', serif",
                }}>
                  {importedCount}
                </div>
                <div style={styles.muted}>Books imported</div>
              </div>

              <div style={styles.stat}>
                <div style={{
                  color: '#c5a875',
                  font: "500 27px 'Playfair Display', serif",
                }}>
                  {failedCount}
                </div>
                <div style={styles.muted}>Books not imported</div>
              </div>
            </div>

            {failedTitles.length > 0 && (
              <div style={{
                textAlign: 'left',
                padding: 12,
                marginBottom: 18,
                border: '1px solid rgba(190,100,80,.3)',
                color: '#d99b8a',
                fontSize: 10,
              }}>
                <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                  <AlertTriangle size={14} />
                  Some books could not be imported.
                </div>
                <p style={styles.muted}>
                  {failedTitles.slice(0, 8).join(', ')}
                  {failedTitles.length > 8 ? ' and more.' : ''}
                </p>
              </div>
            )}

            <button onClick={onClose} style={styles.button}>
              <BookOpen size={15} />
              Return to my library
            </button>
          </div>
        )}

        {importing && (
          <div style={{ marginTop: 20 }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              color: '#c5a875',
              fontSize: 10,
              marginBottom: 8,
            }}>
              <span>
                <LoaderCircle
                  size={13}
                  style={{
                    display: 'inline-block',
                    verticalAlign: 'middle',
                    marginRight: 7,
                    animation: 'goodreads-spin 1s linear infinite',
                  }}
                />
                Importing your books...
              </span>
              <strong>{progress}%</strong>
            </div>

            <div style={{
              height: 5,
              background: '#30271d',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${progress}%`,
                height: '100%',
                background: '#c5a875',
                transition: 'width .2s ease',
              }} />
            </div>
          </div>
        )}
      </section>

      <style>{`
        @keyframes goodreads-spin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 560px) {
          .goodreads-import-modal {
            padding: 18px !important;
          }
        }
      `}</style>
    </div>
  );
}

export default GoodreadsImport;
