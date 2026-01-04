import { spawn } from 'child_process';
import { logger } from '../utils/logger';

export interface VideoFormat {
    formatId: string;
    quality: string;
    type: 'video' | 'audio' | 'image';
    container: string;
    codec?: string;
    filesize?: number;
    fps?: number;
    sampleRate?: number;
}

export interface ParsedVideo {
    contentType: 'video' | 'audio' | 'playlist';
    title: string;
    description?: string;
    thumbnail: string;
    duration?: number;
    author?: {
        name: string;
        url?: string;
    };
    formats: VideoFormat[];
}

export class YouTubeHandler {
    private ytdlpPath: string;
    private userAgents: string[];

    constructor() {
        this.ytdlpPath = process.env.YTDLP_PATH || 'yt-dlp';
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
        ];
    }

    private getRandomUserAgent(): string {
        return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
    }

    async parse(url: string, cookies?: string): Promise<ParsedVideo> {
        return new Promise((resolve, reject) => {
            const args = [
                '--dump-json',
                '--no-playlist',
                '--user-agent', this.getRandomUserAgent(),
                '--no-check-certificates',
                url,
            ];

            if (cookies) {
                args.push('--cookies', cookies);
            }

            logger.debug(`Running yt-dlp with args: ${args.join(' ')}`);

            const process = spawn(this.ytdlpPath, args);
            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                if (code !== 0) {
                    logger.error(`yt-dlp error: ${stderr}`);

                    if (stderr.includes('Sign in to confirm your age') || stderr.includes('requires authentication')) {
                        reject(new Error('Content is age-restricted or requires login'));
                        return;
                    }
                    if (stderr.includes('Video unavailable') || stderr.includes('Private video')) {
                        reject(new Error('Content not found or is private'));
                        return;
                    }
                    if (stderr.includes('DRM') || stderr.includes('protected')) {
                        reject(new Error('Content is DRM protected'));
                        return;
                    }

                    reject(new Error(stderr || 'Failed to parse video'));
                    return;
                }

                try {
                    const info = JSON.parse(stdout);
                    resolve(this.transformInfo(info));
                } catch (error) {
                    reject(new Error('Failed to parse yt-dlp output'));
                }
            });

            process.on('error', (error) => {
                logger.error(`yt-dlp spawn error: ${error.message}`);
                reject(new Error('yt-dlp is not installed or not in PATH'));
            });
        });
    }

    private transformInfo(info: any): ParsedVideo {
        // Filter and sort formats
        const formats: VideoFormat[] = [];

        // Video formats
        const videoFormats = (info.formats || [])
            .filter((f: any) => f.vcodec !== 'none' && f.height && f.ext === 'mp4')
            .sort((a: any, b: any) => (b.height || 0) - (a.height || 0));

        // Deduplicate by resolution
        const seenResolutions = new Set<number>();
        for (const f of videoFormats) {
            if (!seenResolutions.has(f.height)) {
                seenResolutions.add(f.height);
                formats.push({
                    formatId: f.format_id,
                    quality: `${f.height}p`,
                    type: 'video',
                    container: f.ext || 'mp4',
                    codec: f.vcodec?.split('.')[0],
                    filesize: f.filesize || f.filesize_approx,
                    fps: f.fps,
                });
            }
        }

        // Audio formats
        const audioFormats = (info.formats || [])
            .filter((f: any) => f.vcodec === 'none' && f.acodec !== 'none')
            .sort((a: any, b: any) => (b.abr || 0) - (a.abr || 0));

        const seenBitrates = new Set<number>();
        for (const f of audioFormats) {
            const bitrate = Math.round(f.abr || 128);
            if (!seenBitrates.has(bitrate) && [128, 192, 256, 320].includes(bitrate)) {
                seenBitrates.add(bitrate);
                formats.push({
                    formatId: f.format_id,
                    quality: `${bitrate}kbps`,
                    type: 'audio',
                    container: f.ext === 'webm' ? 'mp3' : f.ext || 'm4a',
                    codec: f.acodec?.split('.')[0],
                    filesize: f.filesize || f.filesize_approx,
                    sampleRate: f.asr,
                });
            }
        }

        // Add best audio if no standard bitrates found
        if (!formats.some(f => f.type === 'audio') && audioFormats.length > 0) {
            const best = audioFormats[0];
            formats.push({
                formatId: best.format_id,
                quality: `${Math.round(best.abr || 128)}kbps`,
                type: 'audio',
                container: 'mp3',
                codec: best.acodec?.split('.')[0],
                filesize: best.filesize || best.filesize_approx,
            });
        }

        return {
            contentType: 'video',
            title: info.title || 'Untitled',
            description: info.description,
            thumbnail: info.thumbnail || info.thumbnails?.[0]?.url,
            duration: info.duration,
            author: info.uploader ? {
                name: info.uploader,
                url: info.uploader_url,
            } : undefined,
            formats,
        };
    }

    async parsePlaylist(url: string, limit: number = 50, offset: number = 0): Promise<any> {
        return new Promise((resolve, reject) => {
            const args = [
                '--flat-playlist',
                '--dump-json',
                '--playlist-start', String(offset + 1),
                '--playlist-end', String(offset + limit),
                '--user-agent', this.getRandomUserAgent(),
                url,
            ];

            logger.debug(`Parsing playlist: ${url}`);

            const process = spawn(this.ytdlpPath, args);
            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                if (code !== 0 && !stdout) {
                    reject(new Error(stderr || 'Failed to parse playlist'));
                    return;
                }

                try {
                    const lines = stdout.trim().split('\n').filter(Boolean);
                    const items = lines.map(line => {
                        const item = JSON.parse(line);
                        return {
                            id: item.id,
                            title: item.title,
                            thumbnail: item.thumbnails?.[0]?.url,
                            duration: item.duration,
                            url: `https://youtube.com/watch?v=${item.id}`,
                        };
                    });

                    resolve({
                        playlist: {
                            id: 'playlist',
                            title: 'YouTube Playlist',
                            totalCount: items.length,
                        },
                        items,
                        hasMore: items.length === limit,
                        nextOffset: offset + limit,
                    });
                } catch (error) {
                    reject(new Error('Failed to parse playlist output'));
                }
            });
        });
    }

    async getStreamUrl(url: string, formatId: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const args = [
                '--get-url',
                '-f', formatId,
                '--user-agent', this.getRandomUserAgent(),
                url,
            ];

            const process = spawn(this.ytdlpPath, args);
            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                if (code === 0 && stdout.trim()) {
                    resolve(stdout.trim());
                } else {
                    reject(new Error(stderr || 'Failed to get stream URL'));
                }
            });
        });
    }
}
