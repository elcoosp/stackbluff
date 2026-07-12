import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ message, onRetry, className }: ErrorStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center min-h-[60vh] p-6", className)}>
      <Card className="max-w-md w-full p-6 text-center">
        <h2 className="text-xl font-semibold text-red-400 mb-2">Error</h2>
        <p className="text-on-surface-variant text-sm">
          {message || "Failed to load data."}
        </p>
        {onRetry && (
          <Button onClick={onRetry} className="mt-4">Retry</Button>
        )}
      </Card>
    </div>
  );
}
