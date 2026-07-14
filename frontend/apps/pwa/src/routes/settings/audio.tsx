import { createFileRoute, Link } from '@tanstack/react-router';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ArrowLeft, Volume2, VolumeX, Music, Play } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { requireAuth } from '@/lib/authGuard';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

export const Route = createFileRoute('/settings/audio')({
  component: AudioSettingsPage,
});

function AudioSettingsPage() {
  const {} = useAuthStore();
  const [masterVolume, setMasterVolume] = useState([70]);
  const [sfxVolume, setSfxVolume] = useState([80]);
  const [musicVolume, setMusicVolume] = useState([50]);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);

  const handleTestSound = () => {
    toast.info(t`🔊 Test sound played`);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/settings" className="p-2 rounded-lg hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5 text-on-surface-variant" />
        </Link>
        <h1 className="font-display-lg text-2xl text-on-surface"><Trans>Audio Settings</Trans></h1>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-on-surface flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-tertiary" />
              <Trans>Master Volume</Trans>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <VolumeX className="w-4 h-4 text-on-surface-variant" />
              <Slider
                value={masterVolume}
                onValueChange={setMasterVolume}
                min={0}
                max={100}
                step={1}
                className="flex-1"
              />
              <span className="text-sm text-on-surface-variant font-mono w-12 text-right">{masterVolume[0]}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-on-surface flex items-center gap-2">
              <Play className="w-4 h-4 text-tertiary" />
              <Trans>Sound Effects</Trans>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Volume2 className="w-4 h-4 text-on-surface-variant" />
              <Slider
                value={sfxVolume}
                onValueChange={setSfxVolume}
                min={0}
                max={100}
                step={1}
                className="flex-1"
              />
              <span className="text-sm text-on-surface-variant font-mono w-12 text-right">{sfxVolume[0]}%</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestSound}
              className="mt-4 border-white/10 text-on-surface-variant hover:text-on-surface"
            >
              <Play className="w-4 h-4 mr-2" />
              <Trans>Test Sound</Trans>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-on-surface flex items-center gap-2">
              <Music className="w-4 h-4 text-tertiary" />
              <Trans>Background Music</Trans>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Volume2 className="w-4 h-4 text-on-surface-variant" />
              <Slider
                value={musicVolume}
                onValueChange={setMusicVolume}
                min={0}
                max={100}
                step={1}
                className="flex-1"
              />
              <span className="text-sm text-on-surface-variant font-mono w-12 text-right">{musicVolume[0]}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-on-surface"><Trans>Haptics</Trans></CardTitle>
          </CardHeader>
          <CardContent>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-on-surface-variant"><Trans>Enable haptic feedback</Trans></span>
              <button
                type="button"
                onClick={() => setHapticsEnabled(!hapticsEnabled)}
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-tertiary focus:ring-offset-2
                  ${hapticsEnabled ? 'bg-tertiary' : 'bg-white/20'}
                `}
              >
                <span
                  className={`
                    inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                    ${hapticsEnabled ? 'translate-x-6' : 'translate-x-1'}
                  `}
                />
              </button>
            </label>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
