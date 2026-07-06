export const PlatformAPI = {
  shareContent: async (message: string) => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({ text: message });
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(message);
      console.log('Copied to clipboard:', message);
    } else {
      console.log('Share:', message);
    }
  },
};
