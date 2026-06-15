import { useMemo, useState } from 'react';
import type { MatchQuestion } from '../../../types';
import { Check, X } from 'lucide-react';

interface Props {
  question: MatchQuestion;
  onAnswer: (correct: boolean) => void;
  answered: boolean;
  accentColor: string;
}

// Simple shuffle with stable seed based on text
function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function MatchQ({ question, onAnswer, accentColor }: Props) {
  const rightOptions = useMemo(() => shuffle(question.pairs.map(p => p.right)), [question]);
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [matches, setMatches] = useState<Record<number, string>>({}); // leftIndex -> right text
  const [submitted, setSubmitted] = useState(false);

  const handleLeftClick = (idx: number) => {
    if (submitted) return;
    setSelectedLeft(idx);
  };

  const handleRightClick = (rightText: string) => {
    if (submitted || selectedLeft === null) return;
    setMatches(prev => ({ ...prev, [selectedLeft]: rightText }));
    setSelectedLeft(null);
  };

  const allMatched = Object.keys(matches).length === question.pairs.length;

  const handleSubmit = () => {
    setSubmitted(true);
    const correct = question.pairs.every((pair, idx) => matches[idx] === pair.right);
    onAnswer(correct);
  };

  const usedRights = new Set(Object.values(matches));

  return (
    <div className="question-block">
      <h3 className="question-text">{question.text}</h3>
      <p className="question-hint">Tap a term, then tap its matching definition</p>

      <div className="match-grid">
        <div className="match-column">
          {question.pairs.map((pair, idx) => {
            const isMatched = matches[idx] !== undefined;
            const isCorrect = submitted && matches[idx] === pair.right;
            const isIncorrect = submitted && isMatched && matches[idx] !== pair.right;
            return (
              <button
                key={idx}
                className={`match-item left ${selectedLeft === idx ? 'selected' : ''} ${isMatched ? 'matched' : ''} ${isCorrect ? 'correct' : ''} ${isIncorrect ? 'incorrect' : ''}`}
                onClick={() => handleLeftClick(idx)}
                disabled={submitted}
                style={selectedLeft === idx ? { borderColor: accentColor } : undefined}
              >
                {pair.left}
                {matches[idx] && <span className="match-arrow">→ {matches[idx]}</span>}
                {isCorrect && <Check size={14} className="icon-green" />}
                {isIncorrect && <X size={14} className="icon-red" />}
              </button>
            );
          })}
        </div>
        <div className="match-column">
          {rightOptions.map((right, idx) => (
            <button
              key={idx}
              className={`match-item right ${usedRights.has(right) ? 'used' : ''}`}
              onClick={() => handleRightClick(right)}
              disabled={submitted || usedRights.has(right)}
            >
              {right}
            </button>
          ))}
        </div>
      </div>

      {!submitted && (
        <button
          className="btn-primary mt-8"
          onClick={handleSubmit}
          disabled={!allMatched}
          style={{ backgroundColor: accentColor }}
        >
          Submit Matches
        </button>
      )}
    </div>
  );
}
