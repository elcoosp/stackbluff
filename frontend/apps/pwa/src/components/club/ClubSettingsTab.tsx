import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { useUpdateClubSettings } from '../../hooks/useUpdateClubSettings';
import { uploadFile } from '../../lib/uploadFile';
import { handleApiError } from '../../lib/errorHandler';
import { logger } from '../../lib/logger';
import type { ClubDetails } from '../../types/club';

interface ClubSettingsTabProps {
  club: ClubDetails;
}

const CHIP_PRESETS = [
  { id: 'classic', name: 'Classic Red & Blue' },
  { id: 'gold', name: 'Gold & Black' },
  { id: 'emerald', name: 'Emerald Green' },
  { id: 'royal', name: 'Royal Purple' },
];

export function ClubSettingsTab({ club }: ClubSettingsTabProps) {
  const user = useAuthStore((state) => state.user);

  // Proper Club Pro check using authStore
  const hasClubPro = user?.club_pro_expires_at
    ? new Date(user.club_pro_expires_at) > new Date()
    : false;

  const [formData, setFormData] = useState({
    name: club.name,
    telegram_group_id: club.telegram_group_id || '',
    logo_url: club.logo_url || '',
    banner_url: club.pro_settings?.banner_url || '',
    chip_preset: club.pro_settings?.chip_preset || 'classic',
    felt_colour: club.pro_settings?.felt_colour || '#1a472a',
  });

  const [logoPreview, setLogoPreview] = useState<string | null>(club.logo_url);
  const [bannerPreview, setBannerPreview] = useState<string | null>(
    club.pro_settings?.banner_url || null
  );
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const { mutateAsync: updateSettings, isPending } = useUpdateClubSettings(club.id);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    setIsUploadingLogo(true);
    try {
      const url = await uploadFile(file);
      setFormData({ ...formData, logo_url: url });
      toast.success('Logo uploaded successfully');
    } catch (err) {
      logger.error('Failed to upload logo', err instanceof Error ? err : undefined, { clubId: club.id });
      handleApiError(err, { clubId: club.id, action: 'upload_logo' });
      setLogoPreview(club.logo_url);
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

    const reader = new FileReader();
    reader.onloadend = () => {
      setBannerPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    setIsUploadingBanner(true);
    try {
      const url = await uploadFile(file);
      setFormData({ ...formData, banner_url: url });
      toast.success('Banner uploaded successfully');
    } catch (err) {
      logger.error('Failed to upload banner', err instanceof Error ? err : undefined, { clubId: club.id });
      handleApiError(err, { clubId: club.id, action: 'upload_banner' });
      setBannerPreview(club.pro_settings?.banner_url || null);
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Club name is required');
      return;
    }

    try {
      await updateSettings({
        name: formData.name.trim(),
        telegram_group_id: formData.telegram_group_id.trim() || null,
        logo_url: formData.logo_url || null,
        ...(hasClubPro && {
          pro_settings: {
            banner_url: formData.banner_url || null,
            chip_preset: formData.chip_preset,
            felt_colour: formData.felt_colour,
          },
        }),
      });
      toast.success('Club settings updated successfully');
    } catch (err) {
      logger.error('Failed to update club settings', err instanceof Error ? err : undefined, { clubId: club.id });
      handleApiError(err, { clubId: club.id, action: 'update_settings' });
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">Club Settings</h2>
        <p className="text-white/60 text-sm">Manage your club's appearance and settings</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-white border-b border-white/10 pb-2">
            Basic Information
          </h3>

          <div>
            <label className="block text-white/80 font-medium mb-2">Club Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter club name"
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-white/80 font-medium mb-2">Club Logo</label>
            <div className="flex items-start gap-4">
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Logo preview"
                  className="w-24 h-24 rounded-lg object-cover border border-white/10"
                />
              ) : (
                <div className="w-24 h-24 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/40">
                  No logo
                </div>
              )}
              <div className="flex-grow">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={isUploadingLogo}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white font-medium transition-colors disabled:opacity-50"
                >
                  {isUploadingLogo ? 'Uploading...' : 'Upload Logo'}
                </button>
                <p className="text-white/40 text-sm mt-2">Recommended: 200x200px, max 5MB</p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-white/80 font-medium mb-2">Telegram Group ID</label>
            <input
              type="text"
              value={formData.telegram_group_id}
              onChange={(e) => setFormData({ ...formData, telegram_group_id: e.target.value })}
              placeholder="e.g., -1001234567890"
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-white/40 text-sm mt-1">Link your club to a Telegram group for notifications</p>
          </div>
        </div>

        {hasClubPro && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 border-b border-white/10 pb-2">
              <h3 className="text-lg font-semibold text-white">Club Pro Customization</h3>
              <span className="px-2 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded text-xs font-medium text-white">
                PRO
              </span>
            </div>

            <div>
              <label className="block text-white/80 font-medium mb-2">Banner Image</label>
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
                <button
                  type="button"
                  onClick={() => bannerInputRef.current?.click()}
                  disabled={isUploadingBanner}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white font-medium transition-colors disabled:opacity-50"
                >
                  {isUploadingBanner ? 'Uploading...' : 'Upload Banner'}
                </button>
                <p className="text-white/40 text-sm">Recommended: 1200x300px, max 10MB</p>
              </div>
            </div>

            <div>
              <label className="block text-white/80 font-medium mb-2">Chip Design Preset</label>
              <select
                value={formData.chip_preset}
                onChange={(e) => setFormData({ ...formData, chip_preset: e.target.value })}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {CHIP_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id} className="bg-gray-800">
                    {preset.name}
                  </option>
                ))}
              </select>
              <p className="text-white/40 text-sm mt-1">
                Customize the chip design for your club's tables (applies in Wave 4)
              </p>
            </div>

            <div>
              <label className="block text-white/80 font-medium mb-2">Felt Colour</label>
              <div className="flex items-center gap-4">
                <input
                  type="color"
                  value={formData.felt_colour}
                  onChange={(e) => setFormData({ ...formData, felt_colour: e.target.value })}
                  className="w-16 h-16 rounded-lg border border-white/10 cursor-pointer"
                />
                <div className="flex-grow">
                  <input
                    type="text"
                    value={formData.felt_colour}
                    onChange={(e) => setFormData({ ...formData, felt_colour: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
              <p className="text-white/40 text-sm mt-1">
                Choose the table felt colour for your club's games (applies in Wave 4)
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-6 border-t border-white/10">
          <button
            type="submit"
            disabled={isPending}
            className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg text-white font-medium transition-all shadow-lg disabled:opacity-50"
          >
            {isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
