import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { apiClient } from '@stackbluff/shared/api/client';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, Loader2, Upload, X } from 'lucide-react';
import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { uploadFile } from '@/lib/uploadFile';
import { cn } from '@/lib/utils';

const AVATAR_STORAGE_KEY = 'stackbluff-avatar-url';

interface AvatarUploadProps {
  className?: string;
  onAvatarUpdated?: (url: string) => void;
}

export function AvatarUpload({ className, onAvatarUpdated }: AvatarUploadProps) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  // Load avatar from localStorage, fallback to null
  const [preview, setPreview] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(AVATAR_STORAGE_KEY) || null;
    }
    return null;
  });
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Save to localStorage whenever preview changes
  useEffect(() => {
    if (preview) {
      localStorage.setItem(AVATAR_STORAGE_KEY, preview);
    } else {
      localStorage.removeItem(AVATAR_STORAGE_KEY);
    }
  }, [preview]);

  // Update user avatar mutation (optional)
  const updateAvatarMutation = useMutation({
    mutationFn: async (avatarUrl: string) => {
      // Try to update the user profile if endpoint exists
      try {
        return await apiClient<{ user: any }>('/user/me', {
          method: 'PATCH',
          body: JSON.stringify({ avatar_url: avatarUrl }),
        });
      } catch {
        // If endpoint doesn't exist, we still store locally
        return null;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-me'] });
      toast.success(t`Avatar updated successfully!`);
      if (onAvatarUpdated && preview) onAvatarUpdated(preview);
    },
    onError: () => {
      // Silently fail; we still have local storage
    },
  });

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error(t`Please upload an image file`);
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t`Image must be less than 2MB`);
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setPreview(dataUrl);
    };
    reader.readAsDataURL(file);

    // Upload
    setIsUploading(true);
    try {
      const url = await uploadFile(file);
      setPreview(url);
      // Try to save to profile (best effort)
      updateAvatarMutation.mutate(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t`Upload failed`);
      // Revert preview
      setPreview(localStorage.getItem(AVATAR_STORAGE_KEY) || null);
    } finally {
      setIsUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = () => {
    if (confirm(t`Remove your avatar?`)) {
      setPreview(null);
      // Try to update profile (best effort)
      updateAvatarMutation.mutate('');
    }
  };

  const displayName = user?.username || 'Player';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className={cn('flex items-center gap-4', className)}>
      <div className="relative">
        <Avatar className="w-20 h-20 border-2 border-tertiary/30">
          <AvatarImage src={preview || undefined} />
          <AvatarFallback className="bg-surface-container text-2xl text-on-surface">
            {initial}
          </AvatarFallback>
        </Avatar>
        <label
          htmlFor="avatar-upload"
          className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-tertiary text-on-tertiary cursor-pointer hover:bg-tertiary-fixed transition-colors shadow-lg"
        >
          <Camera className="w-3.5 h-3.5" />
        </label>
        <input
          id="avatar-upload"
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          disabled={isUploading || updateAvatarMutation.isPending}
        />
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-sm text-on-surface">
          <Trans>Profile Picture</Trans>
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || updateAvatarMutation.isPending}
            className="border-white/10 text-on-surface-variant hover:text-on-surface"
          >
            {isUploading || updateAvatarMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5 mr-1" />
            )}
            <Trans>Upload</Trans>
          </Button>
          {preview && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={isUploading || updateAvatarMutation.isPending}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <X className="w-3.5 h-3.5 mr-1" />
              <Trans>Remove</Trans>
            </Button>
          )}
        </div>
        <p className="text-[10px] text-on-surface-variant/50">
          <Trans>JPEG, PNG, GIF. Max 2MB.</Trans>
        </p>
      </div>
    </div>
  );
}
