import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const Route = createFileRoute('/settings/appearance')({
  component: AppearanceSettingsPage,
});

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

function AppearanceSettingsPage() {
  const {} = useAuthStore();
  const [feltColor, setFeltColor] = useState(VALID_COLORS[0]);

  const handleColorChange = (color: string) => {
    setFeltColor(color);
    toast.success(t`Felt color preview updated`);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/settings" className="p-2 rounded-lg hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5 text-on-surface-variant" />
        </Link>
        <h1 className="font-display-lg text-2xl text-on-surface">
          <Trans>Appearance Settings</Trans>
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-on-surface">
            <Trans>Felt Color</Trans>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            {VALID_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => handleColorChange(color)}
                className={`w-10 h-10 rounded-lg border-2 transition-all ${
                  feltColor === color
                    ? 'border-tertiary ring-2 ring-tertiary/50'
                    : 'border-white/10 hover:border-white/30'
                }`}
                style={{ backgroundColor: color }}
                aria-label={t`Select ${color}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-on-surface-variant text-xs">
              <Trans>Custom color (hex)</Trans>
            </Label>
            <Input
              type="text"
              value={feltColor}
              onChange={(e) => setFeltColor(e.target.value)}
              className="w-32 bg-surface-container-high border-outline-variant/50 text-on-surface font-mono text-sm"
              placeholder="#1a6b42"
            />
          </div>

          <div
            className="w-full h-32 rounded-lg border border-white/10 transition-colors"
            style={{ backgroundColor: feltColor }}
          >
            <div className="p-4">
              <p className="text-white/80 text-sm">
                <Trans>Felt preview</Trans>
              </p>
              <div className="flex gap-2 mt-2">
                <div className="w-8 h-8 rounded-full bg-white/20 border border-white/30"></div>
                <div className="w-8 h-8 rounded-full bg-white/20 border border-white/30"></div>
                <div className="w-8 h-8 rounded-full bg-white/20 border border-white/30"></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
