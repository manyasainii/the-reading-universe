
import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpen,
  Pencil,
  Check,
  X,
  Sparkles,
  Plus,
  Trash2,
  Search,
  Settings2,
} from 'lucide-react';

const YEAR = 2026;
const DEFAULT_GOAL = 100;
const GOAL_STORAGE_KEY = 'reading-universe-goal-2026';
const TOWER_STORAGE_KEY = 'reading-universe-tower-books-2026';

const spineColors = [
  '#344b78',
  '#493d78',
  '#285c63',
  '#59466f',
  '#405b83',
  '#52617c',
  '#654b78',
  '#356b70',
  '#4b477f',
  '#6b526f',
  '#36536b',
  '#655c88',
];

function readSavedTower() {
  try {
    const saved = localStorage.getItem(TOWER_STORAGE_KEY);
    return saved === null ? null : JSON.parse(saved);
  } catch {
    return null;
  }
}

function ReadingTower({ books = [] }) {
  const [goal, setGoal] = useState(() => {
    const saved = Number(localStorage.getItem(GOAL_STORAGE_KEY));
    return saved > 0 ? saved : DEFAULT_GOAL;
  });

  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(String(goal));
  const [goalError, setGoalError] = useState('');

  const [customTowerIds, setCustomTowerIds] = useState(readSavedTower);
  const [editorOpen, setEditorOpen] = useState(false);
  const [towerSearch, setTowerSearch] = useState('');

  const completedBooks = useMemo(() => {
    return books
      .filter((book) => {
        if (book.reading_status !== 'read' || !book.date_finished) {
          return false;
        }

        return Number(String(book.date_finished).slice(0, 4)) === YEAR;
      })
      .sort((a, b) =>
        String(a.date_finished).localeCompare(String(b.date_finished))
      );
  }, [books]);

  const completed = completedBooks.length;
  const percentage = Math.min((completed / goal) * 100, 100);
  const remaining = Math.max(goal - completed, 0);
  const reachedGoal = completed >= goal;

  const towerBooks = useMemo(() => {
    if (customTowerIds === null) {
      return completedBooks.slice().reverse();
    }

    const bookMap = new Map(books.map((book) => [book.id, book]));

    return customTowerIds
      .map((id) => bookMap.get(id))
      .filter(Boolean);
  }, [books, completedBooks, customTowerIds]);

  const availableBooks = useMemo(() => {
    const term = towerSearch.trim().toLowerCase();

    return books
      .filter((book) => {
        if (!term) return true;

        return (
          (book.title || '').toLowerCase().includes(term) ||
          (book.author || '').toLowerCase().includes(term)
        );
      })
      .sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  }, [books, towerSearch]);

  const selectedIds = customTowerIds === null
    ? completedBooks.map((book) => book.id)
    : customTowerIds;

  function saveTowerSelection(nextIds) {
    setCustomTowerIds(nextIds);
    localStorage.setItem(TOWER_STORAGE_KEY, JSON.stringify(nextIds));
  }

  function addToTower(bookId) {
    if (selectedIds.includes(bookId)) return;
    saveTowerSelection([...selectedIds, bookId]);
  }

  function removeFromTower(bookId) {
    saveTowerSelection(selectedIds.filter((id) => id !== bookId));
  }

  function resetTower() {
    setCustomTowerIds(null);
    localStorage.removeItem(TOWER_STORAGE_KEY);
  }

  function saveGoal() {
    const nextGoal = Number(goalInput);

    if (
      !Number.isInteger(nextGoal) ||
      nextGoal < 1 ||
      nextGoal > 1000
    ) {
      setGoalError('Enter a whole number between 1 and 1,000.');
      return;
    }

    setGoal(nextGoal);
    localStorage.setItem(GOAL_STORAGE_KEY, String(nextGoal));
    setEditingGoal(false);
    setGoalError('');
  }

  function cancelGoalEdit() {
    setGoalInput(String(goal));
    setGoalError('');
    setEditingGoal(false);
  }

  return (
    <section className="reading-tower">
      <div className="tower-heading">
        <div className="tower-heading-copy">
          <div className="tower-eyebrow">
            <Sparkles size={12} />
            YOUR YEAR IN BOOKS · {YEAR}
          </div>

          <h2>
            The Reading <em>Tower.</em>
          </h2>

          <p>
            Every finished book adds another volume to your year.
          </p>
        </div>

        <div className="tower-heading-actions">
          <button
            className="tower-edit-button"
            onClick={() => {
              setTowerSearch('');
              setEditorOpen(true);
            }}
          >
            <Settings2 size={14} />
            Edit tower
          </button>

          <div className="tower-goal">
            <span className="tower-goal-label">ANNUAL GOAL</span>

            {editingGoal ? (
              <div className="tower-goal-edit">
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={goalInput}
                  onChange={(event) => {
                    setGoalInput(event.target.value);
                    setGoalError('');
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') saveGoal();
                    if (event.key === 'Escape') cancelGoalEdit();
                  }}
                  autoFocus
                  aria-label="Annual reading goal"
                />

                <button onClick={saveGoal} aria-label="Save goal">
                  <Check size={14} />
                </button>

                <button
                  onClick={cancelGoalEdit}
                  aria-label="Cancel editing"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                className="tower-goal-value"
                onClick={() => {
                  setGoalInput(String(goal));
                  setEditingGoal(true);
                }}
                title="Edit annual goal"
              >
                <strong>{goal}</strong>
                <Pencil size={12} />
              </button>
            )}

            {goalError && (
              <span className="tower-goal-error">{goalError}</span>
            )}
          </div>
        </div>
      </div>

      <div className="tower-main">
        <div className="tower-visual">
          {towerBooks.length === 0 ? (
            <div className="tower-empty">
              <BookOpen size={42} />
              <span>Your tower is waiting for its first book.</span>
              <button
                className="tower-empty-action"
                onClick={() => setEditorOpen(true)}
              >
                <Plus size={14} /> Add books
              </button>
            </div>
          ) : (
            <div className="tower-stack">
              {towerBooks.map((book, index) => {
                const title = book.title || 'Untitled';
                const color =
                  spineColors[
                    (index * 7 + title.length) % spineColors.length
                  ];

                const width = 220 + ((index * 23) % 145);
                const rotation = ((index % 5) - 2) * 0.3;

                return (
                  <div
                    key={book.id}
                    className="tower-book"
                    title={`${title}${book.author ? ` by ${book.author}` : ''}`}
                    style={{
                      width: `${width}px`,
                      background: `linear-gradient(90deg, rgba(0,0,0,.4), transparent 22%, rgba(255,255,255,.11) 50%, rgba(0,0,0,.25)), ${color}`,
                      transform: `rotate(${rotation}deg)`,
                    }}
                  >
                    <span className="tower-book-title">
                      {title}
                    </span>

                    <span className="tower-book-author">
                      {book.author || ''}
                    </span>

                    <span className="tower-book-pages" />
                  </div>
                );
              })}

              <div className="tower-base" />
            </div>
          )}
        </div>

        <div className="tower-progress">
          <div className="tower-count">
            <strong>{completed}</strong>
            <span>BOOKS READ</span>
          </div>

          <div
            className="tower-progress-track"
            role="progressbar"
            aria-valuenow={Math.round(percentage)}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-label="Annual reading goal progress"
          >
            <div
              className="tower-progress-fill"
              style={{ width: `${percentage}%` }}
            />
          </div>

          <div className="tower-progress-labels">
            <span>{Math.round(percentage)}% of your goal</span>
            <span>{goal} books</span>
          </div>

          <div className="tower-message">
            {reachedGoal ? (
              <>
                <Sparkles size={16} />
                <span>
                  You've reached your reading goal. Extraordinary.
                </span>
              </>
            ) : (
              <>
                <BookOpen size={16} />
                <span>
                  {remaining} more {remaining === 1 ? 'book' : 'books'} to
                  reach your goal.
                </span>
              </>
            )}
          </div>

          <div className="tower-date-note">
            Counting books marked Read with a completion date in {YEAR}.
          </div>

          <div className="tower-selection-note">
            {towerBooks.length} {towerBooks.length === 1 ? 'book' : 'books'} displayed in your tower
          </div>
        </div>
      </div>

      {editorOpen && createPortal(
        (
          <div
            className="tower-editor-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setEditorOpen(false);
              }
            }}
          >
            <section
              className="tower-editor"
              role="dialog"
              aria-modal="true"
              aria-labelledby="tower-editor-title"
            >
              <div className="tower-editor-header">
                <div>
                  <div className="tower-eyebrow">
                    <Sparkles size={12} />
                    YOUR PERSONAL COLLECTION
                  </div>
                  <h2 id="tower-editor-title">
                    Edit your <em>tower.</em>
                  </h2>
                  <p>
                    Choose which books deserve a place in your display.
                  </p>
                </div>

                <button
                  className="tower-editor-close"
                  onClick={() => setEditorOpen(false)}
                  aria-label="Close tower editor"
                >
                  <X size={19} />
                </button>
              </div>

              <div className="tower-editor-summary">
                <strong>{towerBooks.length} books in your tower</strong>
                <button onClick={resetTower}>
                  Reset to 2026 completed books
                </button>
              </div>

              <label className="tower-editor-search">
                <Search size={16} />
                <input
                  value={towerSearch}
                  onChange={(event) => setTowerSearch(event.target.value)}
                  placeholder="Find a book in your library..."
                  autoFocus
                />
                {towerSearch && (
                  <button
                    onClick={() => setTowerSearch('')}
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </label>

              <div className="tower-editor-list">
                {availableBooks.map((book) => {
                  const isSelected = selectedIds.includes(book.id);

                  return (
                    <div className="tower-editor-book" key={book.id}>
                      <div className="tower-editor-book-copy">
                        <strong>{book.title}</strong>
                        <span>{book.author || 'Unknown author'}</span>
                        <small>
                          {book.reading_status === 'read'
                            ? 'Read'
                            : book.reading_status === 'currently_reading'
                            ? 'Currently reading'
                            : book.reading_status === 'did_not_finish'
                            ? 'Did not finish'
                            : 'Want to read'}
                        </small>
                      </div>

                      {isSelected ? (
                        <button
                          className="tower-remove-button"
                          onClick={() => removeFromTower(book.id)}
                        >
                          <Trash2 size={14} />
                          Remove
                        </button>
                      ) : (
                        <button
                          className="tower-add-button"
                          onClick={() => addToTower(book.id)}
                        >
                          <Plus size={14} />
                          Add
                        </button>
                      )}
                    </div>
                  );
                })}

                {availableBooks.length === 0 && (
                  <div className="tower-editor-empty">
                    No matching books in your library.
                  </div>
                )}
              </div>

              <div className="tower-editor-footer">
                <span>
                  Changes are saved automatically and won't alter your reading records.
                </span>
                <button onClick={() => setEditorOpen(false)}>
                  Done
                </button>
              </div>
            </section>
          </div>
        ),
        document.body
      )}
    </section>
  );
}

export default ReadingTower;
