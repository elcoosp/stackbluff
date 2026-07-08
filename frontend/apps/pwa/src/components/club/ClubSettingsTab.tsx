import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@stackbluff/shared/api/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, Image, Palette, Hash, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { uploadFile } from '@/lib/uploadFile';
import type { ClubDetails } from '@/types/club';

const VALID_COLORS = [
  "#1a6b42", "#2d7a5a", "#3d8b6b", "#4a9c7a",
  "#5aad8a", "#0f4c3a", "#1e5945", "#2a6650",
];

const CHIP_PRESETS = [
  { id: 'classic', name: 'Classic Red & Blue' },
  { id: 'gold', name: 'Gold & Black' },
  { id: 'emerald', name: 'Emerald Green' },
  { id: 'royal', name: 'Royal Purple' },
  { id: 'neon', name: 'Neon Blue' },
];

interface ClubSettingsTabProps {
  club: ClubDetails;
}

export function ClubSettingsTab({ club }: ClubSettingsTabProps) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const hasClubPro = user?.club_pro_expires_at
    ? new Date(user.club_pro_expires_at) > new Date()
    : false;

  const [formData, setFormData] = useState({
    name: club.name || '',
    telegram_group_id: club.telegram_group_id || '',
    logo_url: club.logo_url || '',
    banner_url: club.pro_settings?.banner_url || '',
    chip_preset: club.pro_settings?.chip_preset || 'classic',
    felt_colour: club.pro_settings?.felt_colour || '#1a6b42',
  });

  const [logoPreview, setLogoPreview] = useState<string | null>(club.logo_url || null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(
    club.pro_settings?.banner_url || null
  );
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiClient(`/clubs/${club.id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club', club.id] });
      toast.success('Club settings updated successfully');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update club settings');
    },
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Logo must be less than 5MB');
      return;
    }

    setIsUploadingLogo(true);
    try {
      const url = await uploadFile(file);
      setLogoPreview(url);
      setFormData((prev) => ({ ...prev, logo_url: url }));
      toast.success('Logo uploaded');
    } catch (err) {
      toast.error('Failed to upload logo');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Banner must be less than 10MB');
      return;
    }

    setIsUploadingBanner(true);
    try {
      const url = await uploadFile(file);
      setBannerPreview(url);
      setFormData((prev) => ({ ...prev, banner_url: url }));
      toast.success('Banner uploaded');
    } catch (err) {
      toast.error('Failed to upload banner');
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Club name is required');
      return;
    }

    const payload: any = {
      name: formData.name.trim(),
      telegram_group_id: formData.telegram_group_id.trim() || null,
      logo_url: formData.logo_url || null,
    };

    if (hasClubPro) {
      payload.pro_settings = {
        banner_url: formData.banner_url || null,
        chip_preset: formData.chip_preset,
        felt_colour: formData.felt_colour,
      };
    }

    updateMutation.mutate(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-on-surface border-b border-white/10 pb-2">
          Basic Information
        </h3>

        <div className="space-y-2">
          <Label htmlFor="club-name" className="font-label-caps text-[10px] text-on-surface-variant tracking-wider uppercase">
            Club Name *
          </Label>
          <Input
            id="club-name"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Enter club name"
            className="bg-surface-container-high border-outline-variant/50 text-on-surface"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="telegram-group" className="font-label-caps text-[10px] text-on-surface-variant tracking-wider uppercase">
            Telegram Group ID
          </Label>
          <Input
            id="telegram-group"
            value={formData.telegram_group_id}
            onChange={(e) => setFormData((prev) => ({ ...prev, telegram_group_id: e.target.value }))}
            placeholder="e.g., -1001234567890"
            className="bg-surface-container-high border-outline-variant/50 text-on-surface"
          />
          <p className="text-[10px] text-on-surface-variant/50">
            Link your club to a Telegram group for notifications.
          </p>
        </div>
      </div>

      {/* Logo Upload */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-on-surface border-b border-white/10 pb-2">
          Branding
        </h3>

        <div className="flex items-start gap-4">
          {logoPreview ? (
            <img
              src={logoPreview}
              alt="Logo preview"
              className="w-20 h-20 rounded-lg object-cover border border-white/10"
            />
          ) : (
            <div className="w-20 h-20 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/40 text-2xl">
              <Image />
            </div>
          )}
          <div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
            />
            <Button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              disabled={isUploadingLogo}
              variant="outline"
              className="border-white/10 text-on-surface-variant hover:bg-white/5"
            >
              {isUploadingLogo ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              Upload Logo
            </Button>
            <p className="text-[10px] text-on-surface-variant/50 mt-1">
              Recommended: 200x200px, max 5MB
            </p>
          </div>
        </div>
      </div>

      {/* Pro Features (gated) */}
      {hasClubPro && (
        <div className="space-y-4 border border-white/10 rounded-lg p-4 bg-white/5">
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-yellow-400" />
            <h3 className="text-lg font-semibold text-on-surface">Club Pro Customization</h3>
          </div>

          {/* Banner Upload */}
          <div className="space-y-2">
            <Label className="font-label-caps text-[10px] text-on-surface-variant tracking-wider uppercase">
              Banner Image
            </Label>
            <div className="space-y-2">
              {bannerPreview ? (
                <img
                  src={bannerPreview}
                  alt="Banner preview"
                  className="w-full h-32 rounded-lg object-cover border border-white/10"
                />
              ) : (
                <div className="w-full h-32 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/40">
                  No banner
                </div>
              )}
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                onChange={handleBannerUpload}
                className="hidden"
              />
              <Button
                type="button"
                onClick={() => bannerInputRef.current?.click()}
                disabled={isUploadingBanner}
                variant="outline"
                className="border-white/10 text-on-surface-variant hover:bg-white/5"
              >
                {isUploadingBanner ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Upload Banner
              </Button>
              <p className="text-[10px] text-on-surface-variant/50">
                Recommended: 1200x300px, max 10MB
              </p>
            </div>
          </div>

          {/* Chip Preset */}
          <div className="space-y-2">
            <Label className="font-label-caps text-[10px] text-on-surface-variant tracking-wider uppercase">
              Chip Design Preset
            </Label>
            <select
              value={formData.chip_preset}
              onChange={(e) => setFormData((prev) => ({ ...prev, chip_preset: e.target.value }))}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-tertiary"
            >
              {CHIP_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id} className="bg-surface">
                  {preset.name}
                </option>
              ))}
            </select>
          </div>

          {/* Felt Color */}
          <div className="space-y-2">
            <Label className="font-label-caps text-[10px] text-on-surface-variant tracking-wider uppercase">
              Felt Color
            </Label>
            <div className="flex flex-wrap gap-2">
              {VALID_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, felt_colour: color }))}
                  className={cn(
                    "w-8 h-8 rounded-lg border-2 transition-all",
                    formData.felt_colour === color
                      ? "border-tertiary ring-2 ring-tertiary/50"
                      : "border-white/10 hover:border-white/30"
                  )}
                  style={{ backgroundColor: color }}
                  aria-label={`Select ${color}`}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Palette className="w-4 h-4 text-on-surface-variant/50" />
              <Input
                type="text"
                value={formData.felt_colour}
                onChange={(e) => setFormData((prev) => ({ ...prev, felt_colour: e.target.value }))}
                className="w-32 bg-surface-container-high border-outline-variant/50 text-on-surface font-mono text-sm"
                placeholder="#1a6b42"
              />
            </div>
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t border-white/10">
        <Button
          type="submit"
          disabled={updateMutation.isPending}
          className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium"
        >
          {updateMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
    </form>
  );
}
