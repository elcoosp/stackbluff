import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';

// // import axios from "axios";

const VALID_COLORS = [
  '#1a6b42',
  '#2d7a5a',
  '#3d8b6b',
  '#4a9c7a',
  '#5aad8a',
  '#0f4c3a',
  '#1e5945',
  '#2a6650',
];
const CHIP_PRESETS = [1, 2, 3, 4, 5];

interface ClubProSettings {
  banner_url?: string | null;
  chip_preset_id?: number | null;
  felt_color?: string | null;
}

export function SettingsTab({ clubId, settings }: { clubId: string; settings?: ClubProSettings }) {
  const { user } = useAuthStore();
  const isPro = user?.club_pro_expires_at ? new Date(user.club_pro_expires_at) > new Date() : false;
  const [local, setLocal] = useState<ClubProSettings>({
    banner_url: settings?.banner_url ?? null,
    chip_preset_id: settings?.chip_preset_id ?? null,
    felt_color: settings?.felt_color ?? null,
  });
  const [preview, setPreview] = useState<string | null>(settings?.banner_url ?? null);
  const qc = useQueryClient();

  const update = useMutation({
    mutationFn: (d: ClubProSettings) =>
      fetch(`/api/clubs/${clubId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['club', clubId] }),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const f = new FormData();
      f.append('banner', file);
      const r = await fetch(`/api/clubs/${clubId}/banner`, { method: 'POST', body: f });
      return r.json().then((data) => data.url);
    },
    onSuccess: (url) => {
      setLocal((s) => ({ ...s, banner_url: url }));
      setPreview(url);
    },
  });

  const onBanner = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const r = new FileReader();
      r.onload = (ev) => setPreview(ev.target?.result as string);
      r.readAsDataURL(file);
      upload.mutate(file);
    },
    [upload],
  );

  if (!isPro) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <h3 className="text-lg font-semibold mb-2">
          <Trans>Club Pro Required</Trans>
        </h3>
        <p className="text-muted-foreground mb-4">
          <Trans>Upgrade to Club Pro to customise your club.</Trans>
        </p>
        <a
          href="/shop?product=club-pro"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Trans>Upgrade to Club Pro</Trans>
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="block text-sm font-medium mb-2">
          <Trans>Club Banner</Trans>
        </div>
        <div className="border rounded-lg p-4">
          {preview && (
            <img
              src={preview}
              alt={t`Banner preview`}
              className="w-full h-32 object-cover rounded mb-2"
            />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={onBanner}
            className="block w-full text-sm"
          />
        </div>
      </div>
      <div>
        <div className="block text-sm font-medium mb-2">
          <Trans>Chip Design</Trans>
        </div>
        <div className="flex gap-3">
          {CHIP_PRESETS.map((id) => (
            <button
              type="button"
              key={id}
              onClick={() => setLocal((s) => ({ ...s, chip_preset_id: id }))}
              className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-xs font-bold ${local.chip_preset_id === id ? 'border-primary ring-2 ring-primary' : 'border-gray-300'}`}
              style={{
                background: `conic-gradient(from 0deg, hsl(${(id * 60) % 360},70%,50%), hsl(${(id * 60 + 180) % 360},70%,50%))`,
              }}
            >
              {id}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="block text-sm font-medium mb-2">
          <Trans>Felt Colour</Trans>
        </div>
        <div className="flex gap-3 flex-wrap">
          {VALID_COLORS.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setLocal((s) => ({ ...s, felt_color: c }))}
              className={`w-10 h-10 rounded-lg border-2 ${local.felt_color === c ? 'border-primary ring-2 ring-primary' : 'border-gray-300'}`}
              style={{ backgroundColor: c }}
              aria-label={t`Select ${c}`}
            />
          ))}
        </div>
      </div>
      <div
        className="rounded-lg p-6 border"
        style={{
          background: local.felt_color
            ? `linear-gradient(135deg,${local.felt_color},${local.felt_color}dd)`
            : 'linear-gradient(135deg,#1a6b42,#2d7a5a)',
        }}
      >
        <p className="text-white/90 text-sm font-medium mb-2">
          <Trans>Live Preview</Trans>
        </p>
        {local.chip_preset_id && (
          <div
            className="w-8 h-8 rounded-full border border-white/30 shadow"
            style={{
              background: `conic-gradient(from 0deg, hsl(${(local.chip_preset_id * 60) % 360},70%,50%), hsl(${(local.chip_preset_id * 60 + 180) % 360},70%,50%))`,
            }}
          />
        )}
      </div>
      <button
        type="button"
        onClick={() => update.mutate(local)}
        disabled={update.isPending}
        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {update.isPending ? <Trans>Saving...</Trans> : <Trans>Save Changes</Trans>}
      </button>
      {update.isError && (
        <p className="text-sm text-destructive">
          <Trans>Failed: {update.error?.message}</Trans>
        </p>
      )}
    </div>
  );
}
