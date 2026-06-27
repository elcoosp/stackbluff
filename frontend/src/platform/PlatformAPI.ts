export interface ShareContent {
    title: string;
    text: string;
    url: string;
}

export const PlatformAPI = {
    async shareContent(content: ShareContent): Promise<void> {
        if (navigator.share) {
            await navigator.share(content);
        } else {
            await navigator.clipboard.writeText(`${content.text} ${content.url}`);
            alert("Link copied to clipboard!");
        }
    },
};
