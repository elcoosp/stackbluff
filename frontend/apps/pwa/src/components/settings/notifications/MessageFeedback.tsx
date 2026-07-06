interface MessageFeedbackProps {
  message: { type: 'success' | 'error'; text: string } | null;
}

export function MessageFeedback({ message }: MessageFeedbackProps) {
  if (!message) return null;

  const colorClass = message.type === 'success'
    ? 'bg-green-500/15 text-green-400'
    : 'bg-red-500/15 text-red-400';

  return (
    <div
      className={`mt-3 p-2.5 px-3 rounded text-xs ${colorClass}`}
      data-testid="notifications-message"
    >
      {message.text}
    </div>
  );
}
