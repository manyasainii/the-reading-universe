
import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Pencil,
  Check,
  X,
  Sparkles,
} from 'lucide-react';
import './ReadingTower.css';

const YEAR = 2026;
const DEFAULT_GOAL = 100;
const STORAGE_KEY = 'reading-universe-goal-2026';

const spineColors = [
  '#693d3b',
  '#344b48',
  '#8a6844',
  '#343c55',
  '#76513f',
  '#59634d',
  '#6b4b61',
  '#9a784e',
  '#394b5b',
  '#784d3e',
  '#555044',
  '#7b624e',
];

function ReadingTower({ books = [] }) {
  const [goal, setGoal] = useState(() => {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    return saved > 0 ? saved : DEFAULT_GOAL;
  });

  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(String(goal));
  const [goalError, setGoalError] = useState('');

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
    localStorage.setItem(STORAGE_KEY, String(nextGoal));
    setEditingGoal(false);
    setGoalError('');
  }

  function cancelGoalEdit() {
    setGoalInput(String(goal));
    setGoalError('');
    setEditingGoal(false);
  }

  const towerBooks = completedBooks.slice().reverse();

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

      <div className="tower-main">
        <div className="tower-visual">
          {completedBooks.length === 0 ? (
            <div className="tower-empty">
              <BookOpen size={42} />
              <span>Your first book will go here.</span>
            </div>
          ) : (
            <div className="tower-stack">
              {towerBooks.map((book, index) => {
                const title = book.title || 'Untitled';
                const color =
                  spineColors[
                    (index * 7 + title.length) % spineColors.length
                  ];

                const width = 170 + ((index * 17) % 105);
                const rotation = ((index % 5) - 2) * 0.35;

                return (
                  <div
                    key={book.id}
                    className="tower-book"
                    title={`${title}${book.author ? ` by ${book.author}` : ''}`}
                    style={{
                      width: `${width}px`,
                      background: `linear-gradient(90deg, rgba(0,0,0,.38), transparent 22%, rgba(255,255,255,.09) 50%, rgba(0,0,0,.24)), ${color}`,
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
        </div>
      </div>
    </section>
  );
}

export default ReadingTower;
