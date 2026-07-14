import { Trans } from "@lingui/react/macro";

export function BlockedHelp() {
  return (
    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs leading-relaxed mb-3">
      <Trans>
        <strong>How to enable:</strong>
        <br />
        Click the lock/info icon in your browser's address bar → Site settings →
        Notifications → Allow
      </Trans>
    </div>
  );
}
