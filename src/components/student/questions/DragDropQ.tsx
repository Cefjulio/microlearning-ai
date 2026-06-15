import { useState } from 'react';
import {
  DndContext, closestCenter, type DragEndEvent, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { DragDropQuestion } from '../../../types';
import { GripVertical, Check } from 'lucide-react';

interface Props {
  question: DragDropQuestion;
  onAnswer: (correct: boolean) => void;
  answered: boolean;
  accentColor: string;
}

interface SortableItemProps {
  id: string;
  text: string;
  index: number;
  disabled: boolean;
  status: 'idle' | 'correct' | 'incorrect';
}

function SortableItem({ id, text, index, disabled, status }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id, disabled });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`drag-item ${status}`}
      {...attributes}
    >
      <span className="drag-handle" {...listeners}><GripVertical size={16} /></span>
      <span className="drag-position">{index + 1}</span>
      <span className="drag-text">{text}</span>
      {status === 'correct' && <Check size={16} className="icon-green" />}
    </div>
  );
}

export default function DragDropQ({ question, onAnswer, answered, accentColor }: Props) {
  const [items, setItems] = useState(() =>
    question.items.map((text, i) => ({ id: `item-${i}`, text, originalIndex: i }))
  );
  const [submitted, setSubmitted] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    if (submitted) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setItems(prev => {
      const oldIndex = prev.findIndex(i => i.id === active.id);
      const newIndex = prev.findIndex(i => i.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const handleSubmit = () => {
    setSubmitted(true);
    // current order's originalIndex sequence should equal correct_order
    const currentOrder = items.map(i => i.originalIndex);
    const correct = JSON.stringify(currentOrder) === JSON.stringify(question.correct_order);
    onAnswer(correct);
  };

  const getStatus = (originalIndex: number, displayIndex: number): 'idle' | 'correct' | 'incorrect' => {
    if (!answered) return 'idle';
    return question.correct_order[displayIndex] === originalIndex ? 'correct' : 'incorrect';
  };

  return (
    <div className="question-block">
      <h3 className="question-text">{question.text}</h3>
      <p className="question-hint">Drag the items to put them in the correct order</p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          <div className="drag-list">
            {items.map((item, idx) => (
              <SortableItem
                key={item.id}
                id={item.id}
                text={item.text}
                index={idx}
                disabled={submitted}
                status={getStatus(item.originalIndex, idx)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {!submitted && (
        <button className="btn-primary mt-8" onClick={handleSubmit} style={{ backgroundColor: accentColor }}>
          Submit Order
        </button>
      )}
    </div>
  );
}
