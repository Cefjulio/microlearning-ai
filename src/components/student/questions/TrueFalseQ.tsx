import { useState } from 'react';
import type { TrueFalseQuestion } from '../../../types';
import { Check, X } from 'lucide-react';

interface Props {
  question: TrueFalseQuestion;
  onAnswer: (correct: boolean) => void;
  answered: boolean;
  accentColor: string;
}

export default function TrueFalseQ({ question, onAnswer, answered, accentColor }: Props) {
  const [selected, setSelected] = useState<boolean | null>(null);

  const handleSelect = (val: boolean) => {
    if (answered) return;
    setSelected(val);
    onAnswer(val === question.correct);
  };

  return (
    <div className="question-block">
      <h3 className="question-text">{question.text}</h3>
      <div className="tf-options">
        <button
          className={`tf-btn ${selected === true ? 'selected' : ''} ${answered && question.correct === true ? 'correct' : ''} ${answered && selected === true && !question.correct ? 'incorrect' : ''}`}
          onClick={() => handleSelect(true)}
          disabled={answered}
          style={selected === true ? { borderColor: accentColor } : undefined}
        >
          <Check size={20} /> True
        </button>
        <button
          className={`tf-btn ${selected === false ? 'selected' : ''} ${answered && question.correct === false ? 'correct' : ''} ${answered && selected === false && question.correct ? 'incorrect' : ''}`}
          onClick={() => handleSelect(false)}
          disabled={answered}
          style={selected === false ? { borderColor: accentColor } : undefined}
        >
          <X size={20} /> False
        </button>
      </div>
    </div>
  );
}
