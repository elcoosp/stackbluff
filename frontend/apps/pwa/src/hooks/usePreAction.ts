import { useCallback, useEffect, useRef, useState } from 'react';

export type PreAction =
  | { type: 'fold' }
  | { type: 'check_or_fold' }
  | { type: 'check_or_call_any' }
  | { type: 'call_up_to'; amount: number };

interface UsePreActionParams {
  isMyTurn: boolean;
  toCall: number;
  sendAction: (action: string, amount?: number) => void;
}

export function usePreAction({ isMyTurn, toCall, sendAction }: UsePreActionParams) {
  const [preAction, setPreActionState] = useState<PreAction | null>(null);
  const [executingAction, setExecutingAction] = useState<string | null>(null);
  const preActionRef = useRef<PreAction | null>(null);
  const executedRef = useRef(false);

  // Keep ref in sync with state
  useEffect(() => {
    preActionRef.current = preAction;
  });

  const togglePreAction = useCallback((pa: PreAction | null) => {
    setPreActionState(pa);
    preActionRef.current = pa;
    executedRef.current = false;
  }, []);

  // Execute pre-action when it becomes our turn
  useEffect(() => {
    if (!isMyTurn) {
      executedRef.current = false;
      return;
    }

    const pa = preActionRef.current;
    if (!pa || executedRef.current) return;

    executedRef.current = true;
    const call = toCall;

    let result: { action: string; amount?: number; label: string } | null = null;

    switch (pa.type) {
      case 'fold':
        result = { action: 'fold', label: 'FOLD' };
        break;
      case 'check_or_fold':
        result =
          call === 0 ? { action: 'check', label: 'CHECK' } : { action: 'fold', label: 'FOLD' };
        break;
      case 'check_or_call_any':
        result =
          call === 0 ? { action: 'check', label: 'CHECK' } : { action: 'call', label: 'CALL' };
        break;
      case 'call_up_to':
        if (call <= pa.amount) {
          result =
            call === 0
              ? { action: 'check', label: 'CHECK' }
              : { action: 'call', label: `CALL $${call}` };
        } else {
          result = { action: 'fold', label: 'FOLD' };
        }
        break;
    }

    if (result) {
      // Show the execution flash animation
      setExecutingAction(result.label);

      // Send the action after a short delay so the user sees the flash
      const { action, amount } = result;
      const timer = setTimeout(() => {
        sendAction(action, amount);
        setPreActionState(null);
        preActionRef.current = null;
        setExecutingAction(null);
      }, 400);

      return () => clearTimeout(timer);
    }
  }, [isMyTurn, toCall, sendAction]);

  return { preAction, togglePreAction, executingAction };
}
