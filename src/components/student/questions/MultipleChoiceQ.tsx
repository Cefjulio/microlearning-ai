import { useState } from 'react';
import type { MultipleChoiceQuestion } from '../../../types';

interface Props {
  question: MultipleChoiceQuestion;
  onAnswer: (correct: boolean) => void;
  answered: boolean;
  accentColor: string;
}

export default function MultipleChoiceQ({ question, onAnswer, answered, accentColor }: Props) {
  const [selected, setSelected] = useState<number | null>(null);

  const handleSelect = (idx: number) => {
    if (answered) return;
    setSelected(idx);
    onAnswer(idx === question.correct_index);
  };

  return (
    <div className="question-block">
      <h3 className="question-text">{question.text}</h3>
      <div className="mc-options">
        {question.options.map((opt, idx) => {
          const isSelected = selected === idx;
          const isCorrectOpt = idx === question.correct_index;
          let cls = '';
          if (answered) {
            if (isCorrectOpt) cls = 'correct';
            else if (isSelected) cls = 'incorrect';
          } else if (isSelected) cls = 'selected';

          return (
            <button
              key={idx}
              className={`mc-option ${cls}`}
              onClick={() => handleSelect(idx)}
              disabled={answered}
              style={isSelected && !answered ? { borderColor: accentColor } : undefined}
            >
              <span className="mc-letter">{String.fromCharCode(65 + idx)}</span>
              <span>{opt}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
