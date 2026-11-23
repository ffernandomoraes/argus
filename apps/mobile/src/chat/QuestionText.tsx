import { splitQuestion } from '@argus/shared/questionText';

// Texto da pergunta do Claude. Lista numerada escrita numa linha só ("1) ... → 2) ...") vira
// uma lista de verdade, um item por linha.
export function QuestionText({ text, className }: { text: string; className?: string }) {
  const parts = splitQuestion(text);
  if (!parts) return <p className={`whitespace-pre-line ${className ?? ''}`}>{text}</p>;
  return (
    <div className={className}>
      {parts.intro && <p>{parts.intro}</p>}
      <ol className="my-1 list-decimal space-y-0.5 pl-5">
        {parts.items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ol>
      {parts.outro && <p>{parts.outro}</p>}
    </div>
  );
}
