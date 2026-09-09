import { Dialog } from '../Dialog';
import { FeedbackSettings } from './FeedbackSettings';

interface FeedbackSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function FeedbackSettingsDialog({ open, onClose }: FeedbackSettingsDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} className="max-w-md">
      {/* Header — fixed at top */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/5 shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-on-surface">Feedback Settings</h2>
          <p className="text-[11px] text-on-surface-variant mt-0.5">
            Configure haptic and audio feedback
          </p>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="dialog-scroll overflow-y-auto flex-1 px-5 py-4">
        <FeedbackSettings />
      </div>
    </Dialog>
  );
}
