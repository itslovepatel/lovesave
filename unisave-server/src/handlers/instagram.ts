import { spawn } from 'child_process';
import axios from 'axios';
import { logger } from '../utils/logger';
import { VideoFormat, ParsedVideo } from './youtube';

export class InstagramHandler {
    private ytdlpPath: string;
    private userAgents: string[];

    constructor() {
        this.ytdlpPath = process.env.YTDLP_PATH || 'yt-dlp';
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        ];
    }

    private getRandomUserAgent(): string {
        return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
    }

    async parse(url: string, cookies?: string): Promise<ParsedVideo> {
        logger.info(`Parsing Instagram URL: ${url}`);

        // First try yt-dlp for videos/reels
        try {
            const result = await this.parseWithYtdlp(url, cookies);
            return result;
        } catch (ytdlpError: any) {
            logger.info(`yt-dlp failed: ${ytdlpError.message}, trying web scraping...`);

            // Fallback to web scraping for images
            try {
                const imageResult = await this.scrapeInstagramImage(url);
                return imageResult;
            } catch (scrapeError: any) {
                logger.error(`Scraping also failed: ${scrapeError.message}`);
                throw new Error(ytdlpError.message || 'Failed to parse Instagram content');
            }
        }
    }

    private parseWithYtdlp(url: string, cookies?: string): Promise<ParsedVideo> {
        return new Promise((resolve, reject) => {
            const args = [
                '--dump-json',
                '--no-playlist',
                '--user-agent', this.getRandomUserAgent(),
                '--no-check-certificates',
                '--ignore-errors',
                '--no-warnings',
                '--extractor-args', 'instagram:app_version=275.0.0.27.98',
                url,
            ];

            if (cookies) {
                args.push('--cookies', cookies);
            }

            logger.info(`Running yt-dlp for Instagram: ${url}`);

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
                    logger.error(`Instagram yt-dlp failed (code ${code}): ${stderr.substring(0, 500)}`);

                    if (stderr.includes('Login required') || stderr.includes('login')) {
                        reject(new Error('Login required to access this content'));
                        return;
                    }
                    if (stderr.includes('Private') || stderr.includes('not found')) {
                        reject(new Error('Content not found or is private'));
                        return;
                    }
                    reject(new Error(stderr || 'Failed to parse with yt-dlp'));
                    return;
                }

                try {
                    const info = JSON.parse(stdout);
                    resolve(this.transformInfo(info));
                } catch (error) {
                    reject(new Error('Failed to parse yt-dlp JSON'));
                }
            });

            childProcess.on('error', (err) => {
                reject(new Error('yt-dlp spawn error: ' + err.message));
            });
        });
    }

    // Web scraping approach for Instagram images
    private async scrapeInstagramImage(url: string): Promise<ParsedVideo> {
        logger.info(`Scraping Instagram page: ${url}`);

        try {
            // Fetch the page
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': this.getRandomUserAgent(),
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                },
                timeout: 15000,
            });

            const html = response.data;

            // Try to find image URL in meta tags
            let imageUrl: string | null = null;
            let title = 'Instagram Post';

            // Look for og:image meta tag
            const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
            if (ogImageMatch) {
                imageUrl = ogImageMatch[1];
            }

            // Look for og:title
            const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
            if (ogTitleMatch) {
                title = ogTitleMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
            }

            // Also try to find in JSON-LD
            const jsonLdMatch = html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/);
            if (jsonLdMatch) {
                try {
                    const jsonLd = JSON.parse(jsonLdMatch[1]);
                    if (jsonLd.image && !imageUrl) {
                        imageUrl = Array.isArray(jsonLd.image) ? jsonLd.image[0] : jsonLd.image;
                    }
                    if (jsonLd.name && title === 'Instagram Post') {
                        title = jsonLd.name;
                    }
                } catch (e) {
                    // Ignore JSON parse errors
                }
            }

            // Try to find high-res image in _sharedData
            const sharedDataMatch = html.match(/window\._sharedData\s*=\s*(\{.+?\});<\/script>/);
            if (sharedDataMatch) {
                try {
                    const sharedData = JSON.parse(sharedDataMatch[1]);
                    const postPage = sharedData?.entry_data?.PostPage?.[0];
                    const media = postPage?.graphql?.shortcode_media;
                    if (media) {
                        if (media.display_url) {
                            imageUrl = media.display_url;
                        }
                        if (media.edge_media_to_caption?.edges?.[0]?.node?.text) {
                            title = media.edge_media_to_caption.edges[0].node.text.substring(0, 100);
                        }
                    }
                } catch (e) {
                    // Ignore parse errors
                }
            }

            if (!imageUrl) {
                throw new Error('Could not find image URL in page');
            }

            logger.info(`Found Instagram image: ${imageUrl.substring(0, 80)}...`);

            return {
                contentType: 'video', // Using video as placeholder
                title: title || 'Instagram Image',
                thumbnail: imageUrl,
                formats: [{
                    formatId: 'image',
                    quality: 'Original',
                    type: 'image',
                    container: 'jpg',
                }],
            };

        } catch (error: any) {
            logger.error(`Scrape error: ${error.message}`);
            throw new Error('Could not extract image from Instagram');
        }
    }

    private transformInfo(info: any): ParsedVideo {
        const formats: VideoFormat[] = [];

        // Add best combined format (video+audio) as first option
        // Using 'best' which gives a single stream with both audio and video
        formats.push({
            formatId: 'best',
            quality: 'Best (HD with Audio)',
            type: 'video',
            container: 'mp4',
        });

        const videoFormats = (info.formats || [])
            .filter((f: any) => f.vcodec !== 'none' && f.ext === 'mp4')
            .sort((a: any, b: any) => (b.height || 0) - (a.height || 0));

        const seenResolutions = new Set<number>();
        for (const f of videoFormats) {
            if (f.height && !seenResolutions.has(f.height)) {
                seenResolutions.add(f.height);
                // Use format that includes audio if available
                formats.push({
                    formatId: f.acodec !== 'none' ? f.format_id : `${f.format_id}+bestaudio`,
                    quality: `${f.height}p`,
                    type: 'video',
                    container: 'mp4',
                    codec: f.vcodec?.split('.')[0],
                    filesize: f.filesize || f.filesize_approx,
                });
            }
        }

        if (formats.length === 1 && info.thumbnail) {
            formats.push({
                formatId: 'image',
                quality: 'Original',
                type: 'image',
                container: 'jpg',
            });
        }

        // Add audio-only option
        formats.push({
            formatId: 'bestaudio',
            quality: 'Audio Only (MP3)',
            type: 'audio',
            container: 'mp3',
        });

        if (formats.length === 0) {
            formats.push({
                formatId: 'best',
                quality: 'Best',
                type: 'video',
                container: 'mp4',
            });
        }

        const author = info.uploader || info.channel;

        return {
            contentType: 'video',
            title: info.title || info.description?.substring(0, 100) || 'Instagram Post',
            description: info.description,
            thumbnail: info.thumbnail,
            duration: info.duration ? Math.round(info.duration) : undefined,
            author: author ? {
                name: author,
                url: info.uploader_url || info.channel_url,
            } : undefined,
            formats,
        };
    }
}
