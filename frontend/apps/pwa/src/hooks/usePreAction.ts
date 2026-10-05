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

  // F-1 FIX: hold the latest `sendAction` in a ref and remove it from the
  // effect dependency list below. TablePage passed an inline arrow function
  // so its identity changed on every render (~10 Hz while a turn timer
  // runs). Each re-render therefore (a) cleared the previous 400 ms timer
  // in the cleanup, and (b) re-ran the effect only to be short-circuited
  // by `executedRef.current === true`. The queued action was never sent.
  const sendActionRef = useRef(sendAction);
  useEffect(() => {
    sendActionRef.current = sendAction;
  });

  // Keep ref in sync with state
  useEffect(() => {
    preActionRef.current = preAction;
  });

  const togglePreAction = useCallback((pa: PreAction | null) => {
    setPreActionState(pa);
    preActionRef.current = pa;
    executedRef.current = false;
  }, []);

  // Execute pre-action when it becomes our turn. Intentionally does NOT
  // depend on `sendAction` — it reads the latest via `sendActionRef`.
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
