// Platform detection from URLs

export type Platform =
    | 'youtube'
    | 'instagram'
    | 'tiktok'
    | 'facebook'
    | 'reddit'
    | 'soundcloud'
    | 'spotify';

const PLATFORM_PATTERNS: Record<Platform, RegExp> = {
    youtube: /(?:youtube\.com|youtu\.be)/i,
    instagram: /instagram\.com/i,
    tiktok: /tiktok\.com|vm\.tiktok\.com/i,
    facebook: /facebook\.com|fb\.watch|fb\.com/i,
    reddit: /reddit\.com|redd\.it/i,
    soundcloud: /soundcloud\.com/i,
    spotify: /(?:open\.)?spotify\.com/i,
};

export function detectPlatform(url: string): Platform | null {
    for (const [platform, regex] of Object.entries(PLATFORM_PATTERNS)) {
        if (regex.test(url)) {
            return platform as Platform;
        }
    }
    return null;
}

export function isSupportedUrl(url: string): boolean {
    return detectPlatform(url) !== null;
}
