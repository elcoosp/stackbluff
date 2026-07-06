export const PlatformAPI = {
    shareContent: async (data: { title?: string; text?: string; url?: string }) => {
        if (navigator.share) { await navigator.share(data); }
        else { console.log('Share fallback:', data.text); }
    }
};
