import { useState } from 'react';
import type { FillBlankQuestion } from '../../../types';

interface Props {
  question: FillBlankQuestion;
  onAnswer: (correct: boolean) => void;
  answered: boolean;
  accentColor: string;
}

export default function FillBlankQ({ question, onAnswer, answered, accentColor }: Props) {
  const [value, setValue] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const parts = question.text.split('___');

  const handleSubmit = () => {
    if (!value.trim()) return;
    setSubmitted(true);
    const normalized = value.trim().toLowerCase();
    const acceptable = [question.correct_answer, ...question.acceptable_answers].map(a => a.toLowerCase().trim());
    onAnswer(acceptable.includes(normalized));
  };

  return (
    <div className="question-block">
      <h3 className="question-text fill-blank-text">
        {parts[0]}
        <input
          type="text"
          className="fill-blank-input"
          value={value}
          onChange={e => setValue(e.target.value)}
          disabled={submitted || answered}
          placeholder="type here"
          style={{ borderColor: accentColor }}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />
        {parts[1]}
      </h3>

      {answered && (
        <p className="fill-blank-answer">
          Correct answer: <strong>{question.correct_answer}</strong>
        </p>
      )}

      {!submitted && (
        <button className="btn-primary mt-8" onClick={handleSubmit} style={{ backgroundColor: accentColor }}>
          Submit Answer
        </button>
      )}
    </div>
  );
}
