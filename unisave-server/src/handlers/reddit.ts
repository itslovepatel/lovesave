import { spawn } from 'child_process';
import { logger } from '../utils/logger';
import { VideoFormat, ParsedVideo } from './youtube';

export class RedditHandler {
    private ytdlpPath: string;

    constructor() {
        this.ytdlpPath = process.env.YTDLP_PATH || 'yt-dlp';
    }

    async parse(url: string, cookies?: string): Promise<ParsedVideo> {
        return new Promise((resolve, reject) => {
            logger.info(`Parsing Reddit URL with yt-dlp: ${url}`);

            const args = [
                '--dump-json',
                '--no-playlist',
                '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                '--no-check-certificates',
                url,
            ];

            if (cookies) {
                args.push('--cookies', cookies);
            }

            const childProcess = spawn(this.ytdlpPath, args);
            let stdout = '';
            let stderr = '';

            childProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            childProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            childProcess.on('close', (code) => {
                if (code !== 0) {
                    logger.error(`Reddit yt-dlp error: ${stderr}`);
                    if (stderr.includes('not found')) {
                        reject(new Error('Content not found'));
                        return;
                    }
                    reject(new Error(stderr || 'Failed to parse Reddit content'));
                    return;
                }

                try {
                    const info = JSON.parse(stdout);
                    resolve(this.transformInfo(info));
                } catch (error) {
                    reject(new Error('Failed to parse Reddit response'));
                }
            });

            childProcess.on('error', (err) => {
                logger.error(`Reddit yt-dlp spawn error: ${err.message}`);
                reject(new Error('yt-dlp is not installed or not in PATH'));
            });
        });
    }

    private transformInfo(info: any): ParsedVideo {
        const formats: VideoFormat[] = [];

        // Video formats
        const videoFormats = (info.formats || [])
            .filter((f: any) => f.vcodec !== 'none')
            .sort((a: any, b: any) => (b.height || 0) - (a.height || 0));

        const seenResolutions = new Set<number>();
        for (const f of videoFormats) {
            if (f.height && !seenResolutions.has(f.height)) {
                seenResolutions.add(f.height);
                formats.push({
                    formatId: f.format_id,
                    quality: `${f.height}p`,
                    type: 'video',
                    container: f.ext || 'mp4',
                    codec: f.vcodec?.split('.')[0],
                    filesize: f.filesize || f.filesize_approx,
                });
            }
        }

        // If no video, might be an image
        if (formats.length === 0 && info.url) {
            formats.push({
                formatId: 'best',
                quality: 'Original',
                type: 'video',
                container: info.ext || 'mp4',
            });
        }

        if (formats.length === 0) {
            formats.push({
                formatId: 'best',
                quality: 'Best',
                type: 'video',
                container: 'mp4',
            });
        }

        return {
            contentType: 'video',
            title: info.title || 'Reddit Post',
            description: info.description,
            thumbnail: info.thumbnail,
            duration: info.duration ? Math.round(info.duration) : undefined,
            author: info.uploader ? {
                name: info.uploader,
                url: info.uploader_url,
            } : undefined,
            formats,
        };
    }
}
