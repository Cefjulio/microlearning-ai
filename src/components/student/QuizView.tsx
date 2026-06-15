import { useState } from 'react';
import type { QuizQuestion } from '../../types';
import TrueFalseQ from './questions/TrueFalseQ';
import MultipleChoiceQ from './questions/MultipleChoiceQ';
import DragDropQ from './questions/DragDropQ';
import MatchQ from './questions/MatchQ';
import FillBlankQ from './questions/FillBlankQ';
import { CheckCircle, XCircle, ArrowRight } from 'lucide-react';

interface Props {
  questions: QuizQuestion[];
  onComplete: (score: number) => void;
  accentColor: string;
}

export default function QuizView({ questions, onComplete, accentColor }: Props) {
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);

  const question = questions[index];
  const isLast = index === questions.length - 1;

  const handleAnswer = (correct: boolean) => {
    setAnswered(true);
    setIsCorrect(correct);
    if (correct) setCorrectCount(c => c + 1);
  };

  const handleNext = () => {
    if (isLast) {
      const finalCorrect = correctCount;
      const score = Math.round((finalCorrect / questions.length) * 100);
      onComplete(score);
    } else {
      setIndex(i => i + 1);
      setAnswered(false);
      setIsCorrect(false);
    }
  };

  const renderQuestion = () => {
    const props = { key: question.id, question, onAnswer: handleAnswer, answered, accentColor } as const;
    switch (question.type) {
      case 'true_false': return <TrueFalseQ {...props} question={question} />;
      case 'multiple_choice': return <MultipleChoiceQ {...props} question={question} />;
      case 'drag_drop': return <DragDropQ {...props} question={question} />;
      case 'match': return <MatchQ {...props} question={question} />;
      case 'fill_blank': return <FillBlankQ {...props} question={question} />;
      default: return null;
    }
  };

  return (
    <div className="quiz-view">
      <div className="quiz-progress">
        <div className="quiz-progress-track">
          <div
            className="quiz-progress-fill"
            style={{ width: `${((index + (answered ? 1 : 0)) / questions.length) * 100}%`, backgroundColor: accentColor }}
          />
        </div>
        <span className="quiz-progress-label">Question {index + 1} of {questions.length}</span>
      </div>

      <div className="quiz-card">
        <span className="quiz-type-badge">{questionTypeLabel(question.type)}</span>
        {renderQuestion()}

        {answered && (
          <div className={`quiz-feedback ${isCorrect ? 'correct' : 'incorrect'}`}>
            <div className="quiz-feedback-header">
              {isCorrect ? <CheckCircle size={20} /> : <XCircle size={20} />}
              <span>{isCorrect ? 'Correct!' : 'Not quite'}</span>
            </div>
            <p>{question.explanation}</p>
            <button className="btn-primary" onClick={handleNext} style={{ backgroundColor: accentColor }}>
              {isLast ? 'Finish Quiz' : 'Next Question'} <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function questionTypeLabel(type: QuizQuestion['type']): string {
  switch (type) {
    case 'true_false': return 'True or False';
    case 'multiple_choice': return 'Multiple Choice';
    case 'drag_drop': return 'Order It';
    case 'match': return 'Match the Pairs';
    case 'fill_blank': return 'Fill in the Blank';
  }
}
