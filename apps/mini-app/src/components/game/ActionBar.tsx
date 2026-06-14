import { useState } from 'react';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { ActionButton, RaiseSlider } from './';
export const ActionBar = ({ isDesktop, actionRequired, toCall, minRaise, maxRaise, onAction }: any) => {
  const [raiseOpen, setRaiseOpen] = useState(false);
  if (!actionRequired) return null;
  if (isDesktop) {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex gap-4 bg-black/80 backdrop-blur-md px-6 py-3 rounded-full">
        <ActionButton variant="fold" onClick={() => onAction('fold')}>Fold</ActionButton>
        <ActionButton variant="call" onClick={() => onAction('call')}>Call ${toCall}</ActionButton>
        <ActionButton variant="raise" onClick={() => setRaiseOpen(true)}>Raise</ActionButton>
        <ActionButton variant="all-in" onClick={() => onAction('all-in')}>All-in</ActionButton>
        {raiseOpen && <RaiseSlider min={minRaise} max={maxRaise} step={10} pot={0} onConfirm={(amt) => { onAction('raise', amt); setRaiseOpen(false); }} />}
      </div>
    );
  }
  return (
    <Dialog>
      <DialogTrigger asChild><button className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-accent text-black px-6 py-2 rounded-full">Actions</button></DialogTrigger>
      <DialogContent className="bottom-0 top-auto translate-y-0 rounded-t-xl">
        <div className="flex flex-col gap-3 p-4">
          <ActionButton variant="fold" onClick={() => onAction('fold')}>Fold</ActionButton>
          <ActionButton variant="call" onClick={() => onAction('call')}>Call ${toCall}</ActionButton>
          <ActionButton variant="raise" onClick={() => setRaiseOpen(true)}>Raise</ActionButton>
          <ActionButton variant="all-in" onClick={() => onAction('all-in')}>All-in</ActionButton>
          {raiseOpen && <RaiseSlider min={minRaise} max={maxRaise} step={10} pot={0} onConfirm={(amt) => { onAction('raise', amt); setRaiseOpen(false); }} />}
        </div>
      </DialogContent>
    </Dialog>
  );
};
