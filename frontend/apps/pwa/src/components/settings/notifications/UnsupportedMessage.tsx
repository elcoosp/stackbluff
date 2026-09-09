import { Trans } from '@lingui/react/macro';

export function UnsupportedMessage() {
  return (
    <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-xs leading-relaxed">
      <Trans>
        Push notifications are not supported in this browser. Try using Chrome, Firefox, or Safari
        16.4+.
      </Trans>
    </div>
  );
}
