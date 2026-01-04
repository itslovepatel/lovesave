import { Router, Request, Response } from 'express';
import { spawn } from 'child_process';
import axios from 'axios';
import { logger } from '../utils/logger';

export const streamRouter = Router();

// Get direct URL - for images, use web scraping fallback
async function getDirectUrl(videoUrl: string, formatId: string): Promise<string> {
    // For image format, try to scrape the image URL
    if (formatId === 'image') {
        return await getImageUrl(videoUrl);
    }

    // For video formats, use yt-dlp
    return await getVideoUrl(videoUrl, formatId);
}

// Get image URL using web scraping
async function getImageUrl(pageUrl: string): Promise<string> {
    logger.info(`Getting image URL from: ${pageUrl}`);

    try {
        // Fetch the page HTML
        const response = await axios.get(pageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            },
            timeout: 15000,
        });

        const html = response.data;
        let imageUrl: string | null = null;

        // Look for og:image meta tag (works for most platforms)
        const ogImageMatch = html.match(/<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i)
            || html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:image["']/i);

        if (ogImageMatch) {
            imageUrl = ogImageMatch[1];
        }

        // Try twitter:image as fallback
        if (!imageUrl) {
            const twitterImageMatch = html.match(/<meta\s+(?:property|name)=["']twitter:image(?::src)?["']\s+content=["']([^"']+)["']/i);
            if (twitterImageMatch) {
                imageUrl = twitterImageMatch[1];
            }
        }

        // Clean up URL (remove HTML entities)
        if (imageUrl) {
            imageUrl = imageUrl
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&#[x0-9]+;/g, '');

            logger.info(`Found image URL: ${imageUrl.substring(0, 80)}...`);
            return imageUrl;
        }

        throw new Error('No image URL found in page');
    } catch (error: any) {
        logger.error(`Image scraping error: ${error.message}`);
        throw new Error('Could not extract image URL');
    }
}

// Get video URL using yt-dlp
function getVideoUrl(videoUrl: string, formatId: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const ytdlpPath = process.env.YTDLP_PATH || 'yt-dlp';

        const formatSelector = formatId && formatId !== 'best'
            ? `${formatId}/best[ext=mp4]/best`
            : 'best[ext=mp4]/best';

        const args = [
            '--get-url',
            '-f', formatSelector,
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            '--no-playlist',
            videoUrl,
        ];

        logger.info(`Getting video URL: yt-dlp -f ${formatSelector} ${videoUrl}`);

        const childProcess = spawn(ytdlpPath, args);
        let stdout = '';
        let stderr = '';

        childProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        childProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        childProcess.on('close', (code) => {
            if (code === 0 && stdout.trim()) {
                const urls = stdout.trim().split('\n');
                const directUrl = urls[0];
                logger.info(`Got video URL: ${directUrl.substring(0, 80)}...`);
                resolve(directUrl);
            } else {
                logger.error(`yt-dlp error (code ${code}): ${stderr}`);
                reject(new Error(stderr || 'Failed to get video URL'));
            }
        });

        childProcess.on('error', (err) => {
            logger.error(`yt-dlp spawn error: ${err.message}`);
            reject(new Error('yt-dlp is not installed'));
        });
    });
}

// Main stream endpoint - redirects to direct URL
streamRouter.get('/:streamId', async (req: Request, res: Response) => {
    try {
        const { streamId } = req.params;
        const { formatId, videoUrl } = req.query;

        if (!videoUrl || typeof videoUrl !== 'string') {
            logger.error('Missing videoUrl parameter');
            return res.status(400).json({
                success: false,
                error: { code: 'MISSING_URL', message: 'Video URL is required' },
            });
        }

        logger.info(`Stream request: ${streamId}, format: ${formatId || 'best'}`);

        const directUrl = await getDirectUrl(videoUrl, formatId as string || 'best');

        logger.info(`Redirecting to direct URL`);
        res.redirect(directUrl);

    } catch (error: any) {
        logger.error('Stream error:', error.message);
        res.status(500).json({
            success: false,
            error: { code: 'STREAM_ERROR', message: error.message || 'Failed to get URL' },
        });
    }
});

// Get URL as JSON (for mobile app)
streamRouter.get('/url/:streamId', async (req: Request, res: Response) => {
    try {
        const { streamId } = req.params;
        const { formatId, videoUrl } = req.query;

        if (!videoUrl || typeof videoUrl !== 'string') {
            return res.status(400).json({
                success: false,
                error: { code: 'MISSING_URL', message: 'Video URL is required' },
            });
        }

        logger.info(`URL request: ${streamId}, format: ${formatId || 'best'}`);

        const directUrl = await getDirectUrl(videoUrl, formatId as string || 'best');

        res.json({ success: true, url: directUrl });

    } catch (error: any) {
        logger.error('URL error:', error.message);
        res.status(500).json({
            success: false,
            error: { code: 'STREAM_ERROR', message: error.message || 'Failed to get URL' },
        });
    }
});
