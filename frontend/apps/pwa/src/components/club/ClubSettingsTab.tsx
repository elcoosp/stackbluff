import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@stackbluff/shared/api/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Loader2, Upload, Image as ImageIcon, Palette, Crown, Save, Info, Settings } from 'lucide-react';
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

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
  },
};

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
    <motion.form
      onSubmit={handleSubmit}
      className="space-y-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Basic Information */}
      <motion.div variants={itemVariants} className="space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-tertiary/10 flex items-center justify-center border border-tertiary/20">
            <Settings className="w-5 h-5 text-tertiary" />
          </div>
          <div>
            <span className="text-xs font-data-mono uppercase tracking-widest text-tertiary">Configuration</span>
            <h3 className="font-headline-md text-base text-on-surface">Basic Information</h3>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="club-name" className="text-xs font-data-mono uppercase tracking-widest text-on-surface-variant">
            Club Name *
          </Label>
          <Input
            id="club-name"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Enter club name"
            className="h-12 bg-white/5 border-white/10 rounded-xl px-4 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-tertiary/50 transition-all"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="telegram-group" className="text-xs font-data-mono uppercase tracking-widest text-on-surface-variant">
            Telegram Group ID
          </Label>
          <Input
            id="telegram-group"
            value={formData.telegram_group_id}
            onChange={(e) => setFormData((prev) => ({ ...prev, telegram_group_id: e.target.value }))}
            placeholder="e.g., -1001234567890"
            className="h-12 bg-white/5 border-white/10 rounded-xl px-4 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-tertiary/50 transition-all"
          />
          <p className="text-xs text-on-surface-variant/60 flex items-center gap-1.5 mt-1">
            <Info className="w-3 h-3" /> Link your club to a Telegram group for notifications.
          </p>
        </div>
      </motion.div>

      {/* Branding */}
      <motion.div variants={itemVariants} className="space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
            <ImageIcon className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <span className="text-xs font-data-mono uppercase tracking-widest text-blue-400">Assets</span>
            <h3 className="font-headline-md text-base text-on-surface">Branding</h3>
          </div>
        </div>

        <div className="flex items-start gap-4 p-4 bg-white/5 border border-white/10 rounded-xl">
          {logoPreview ? (
            <img
              src={logoPreview}
              alt="Logo preview"
              className="w-20 h-20 rounded-xl object-cover border border-white/10"
            />
          ) : (
            <div className="w-20 h-20 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-on-surface-variant/50">
              <ImageIcon className="w-6 h-6" />
            </div>
          )}
          <div className="flex-1">
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
              className="border-outline-variant text-on-surface hover:border-tertiary hover:text-tertiary hover:bg-tertiary/10 font-label-caps text-xs uppercase tracking-wider rounded-xl"
            >
              {isUploadingLogo ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              Upload Logo
            </Button>
            <p className="text-xs text-on-surface-variant/60 mt-2">
              Recommended: 200x200px, max 5MB
            </p>
          </div>
        </div>
      </motion.div>

      {/* Pro Features */}
      {hasClubPro && (
        <motion.div variants={itemVariants} className="space-y-5 p-6 border border-yellow-500/20 rounded-2xl bg-gradient-to-br from-yellow-500/10 to-orange-500/5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center border border-yellow-500/30">
              <Crown className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <span className="text-xs font-data-mono uppercase tracking-widest text-yellow-400">Premium</span>
              <h3 className="font-headline-md text-base text-on-surface">Club Pro Customization</h3>
            </div>
          </div>

          {/* Banner Upload */}
          <div className="space-y-2">
            <Label className="text-xs font-data-mono uppercase tracking-widest text-on-surface-variant">
              Banner Image
            </Label>
            <div className="space-y-3">
              {bannerPreview ? (
                <img
                  src={bannerPreview}
                  alt="Banner preview"
                  className="w-full h-32 rounded-xl object-cover border border-white/10"
                />
              ) : (
                <div className="w-full h-32 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-on-surface-variant/50">
                  No banner uploaded
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
                className="border-outline-variant text-on-surface hover:border-tertiary hover:text-tertiary hover:bg-tertiary/10 font-label-caps text-xs uppercase tracking-wider rounded-xl"
              >
                {isUploadingBanner ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Upload Banner
              </Button>
              <p className="text-xs text-on-surface-variant/60">
                Recommended: 1200x300px, max 10MB
              </p>
            </div>
          </div>

          {/* Chip Preset */}
          <div className="space-y-2">
            <Label className="text-xs font-data-mono uppercase tracking-widest text-on-surface-variant">
              Chip Design Preset
            </Label>
            <select
              value={formData.chip_preset}
              onChange={(e) => setFormData((prev) => ({ ...prev, chip_preset: e.target.value }))}
              className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-on-surface focus:outline-none focus:ring-2 focus:ring-tertiary/50 transition-all"
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
            <Label className="text-xs font-data-mono uppercase tracking-widest text-on-surface-variant">
              Felt Color
            </Label>
            <div className="flex flex-wrap gap-2">
              {VALID_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, felt_colour: color }))}
                  className={cn(
                    "w-10 h-10 rounded-xl border-2 transition-all",
                    formData.felt_colour === color
                      ? "border-tertiary ring-2 ring-tertiary/50 scale-105"
                      : "border-white/10 hover:border-white/30"
                  )}
                  style={{ backgroundColor: color }}
                  aria-label={`Select ${color}`}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Palette className="w-4 h-4 text-on-surface-variant/50" />
              <Input
                type="text"
                value={formData.felt_colour}
                onChange={(e) => setFormData((prev) => ({ ...prev, felt_colour: e.target.value }))}
                className="h-10 w-40 bg-white/5 border-white/10 rounded-xl px-4 text-on-surface font-data-mono text-sm focus:outline-none focus:ring-2 focus:ring-tertiary/50 transition-all"
                placeholder="#1a6b42"
              />
            </div>
          </div>
        </motion.div>
      )}

      {/* Save Button */}
      <motion.div variants={itemVariants} className="flex justify-end pt-4 border-t border-white/10">
        <Button
          type="submit"
          disabled={updateMutation.isPending}
          className="flex items-center gap-2 px-6 py-3 bg-tertiary text-on-tertiary font-label-caps text-xs hover:bg-tertiary-fixed uppercase tracking-wider shadow-lg shadow-emerald-500/10 rounded-xl disabled:opacity-40"
        >
          {updateMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving Changes...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Changes
            </>
          )}
        </Button>
      </motion.div>
    </motion.form>
  );
}
