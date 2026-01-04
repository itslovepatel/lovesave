import { spawn } from 'child_process';
import { logger } from '../utils/logger';
import { VideoFormat, ParsedVideo } from './youtube';

export class FacebookHandler {
    private ytdlpPath: string;

    constructor() {
        this.ytdlpPath = process.env.YTDLP_PATH || 'yt-dlp';
    }

    async parse(url: string, cookies?: string): Promise<ParsedVideo> {
        return new Promise((resolve, reject) => {
            logger.info(`Parsing Facebook URL with yt-dlp: ${url}`);

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
                    logger.error(`Facebook yt-dlp error: ${stderr}`);
                    if (stderr.includes('Private') || stderr.includes('not found')) {
                        reject(new Error('Content not found or is private'));
                        return;
                    }
                    reject(new Error(stderr || 'Failed to parse Facebook content'));
                    return;
                }

                try {
                    const info = JSON.parse(stdout);
                    resolve(this.transformInfo(info));
                } catch (error) {
                    reject(new Error('Failed to parse Facebook response'));
                }
            });

            childProcess.on('error', (err) => {
                logger.error(`Facebook yt-dlp spawn error: ${err.message}`);
                reject(new Error('yt-dlp is not installed or not in PATH'));
            });
        });
    }

    private transformInfo(info: any): ParsedVideo {
        const formats: VideoFormat[] = [];

        // Check if it's a video or image
        const isImage = !info.formats?.some((f: any) => f.vcodec !== 'none');

        if (isImage && info.url) {
            // Image post
            formats.push({
                formatId: 'image',
                quality: 'Original',
                type: 'audio', // Using audio temporarily for image type
                container: 'jpg',
                filesize: info.filesize,
            });
        } else {
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
            contentType: isImage ? 'video' : 'video',
            title: info.title || info.description?.substring(0, 100) || 'Facebook Post',
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
