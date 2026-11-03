/**
 * 1:1 port of PWA `apps/pwa/src/hooks/usePreAction.ts` (F-1 fix included:
 * latest sendAction held in a ref, effect keyed only on turn/toCall).
 */
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
  const sendActionRef = useRef(sendAction);

  useEffect(() => {
    sendActionRef.current = sendAction;
  });

  useEffect(() => {
    preActionRef.current = preAction;
  });

  const togglePreAction = useCallback((pa: PreAction | null) => {
    setPreActionState(pa);
    preActionRef.current = pa;
    executedRef.current = false;
  }, []);

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
      setExecutingAction(result.label);
      const { action, amount } = result;
      const timer = setTimeout(() => {
        sendActionRef.current(action, amount);
        setPreActionState(null);
        preActionRef.current = null;
        setExecutingAction(null);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isMyTurn, toCall]);

  return { preAction, togglePreAction, executingAction };
}
