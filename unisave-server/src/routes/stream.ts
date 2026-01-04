import { Router, Request, Response } from 'express';
import { spawn, exec } from 'child_process';
import axios from 'axios';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export const streamRouter = Router();

// Get direct URL - for images, use web scraping fallback
async function getDirectUrl(videoUrl: string, formatId: string): Promise<string> {
    // For image format, try to scrape the image URL
    if (formatId === 'image') {
        return await getImageUrl(videoUrl);
    }

    // For merged formats like bestvideo+bestaudio, download and serve
    if (formatId.includes('+')) {
        return await downloadMergedVideo(videoUrl, formatId);
    }

    // For single formats, use yt-dlp --get-url
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

// Download merged video (video+audio) and return file path
async function downloadMergedVideo(videoUrl: string, formatId: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const ytdlpPath = process.env.YTDLP_PATH || 'yt-dlp';
        const tmpDir = os.tmpdir();
        const outputFile = path.join(tmpDir, `lovesave_${Date.now()}.mp4`);

        // Use 'best' format which has both audio and video in one stream
        // This is more reliable than merging for streaming
        const args = [
            '-f', 'best[ext=mp4]/best',
            '-o', outputFile,
            '--user-agent', 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36',
            '--no-playlist',
            '--no-warnings',
            videoUrl,
        ];

        logger.info(`Downloading merged video: ${videoUrl}`);

        const childProcess = spawn(ytdlpPath, args);
        let stderr = '';

        childProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        childProcess.on('close', (code) => {
            if (code === 0 && fs.existsSync(outputFile)) {
                logger.info(`Downloaded to: ${outputFile}`);
                resolve(outputFile);
            } else {
                logger.error(`Download error: ${stderr}`);
                reject(new Error(stderr || 'Failed to download video'));
            }
        });

        childProcess.on('error', (err) => {
            reject(new Error('yt-dlp is not installed'));
        });
    });
}

// Get video URL using yt-dlp (for single streams)
function getVideoUrl(videoUrl: string, formatId: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const ytdlpPath = process.env.YTDLP_PATH || 'yt-dlp';

        // Use 'best' which gives a single URL with video+audio combined
        // This is crucial for Instagram reels which have audio
        const formatSelector = formatId === 'best' || !formatId
            ? 'best[ext=mp4]/best'
            : formatId;

        const args = [
            '--get-url',
            '-f', formatSelector,
            '--user-agent', 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36',
            '--no-playlist',
            '--extractor-args', 'youtube:player_client=android',
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

// Main stream endpoint - redirects to direct URL or serves file
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

        const result = await getDirectUrl(videoUrl, formatId as string || 'best');

        // If it's a file path (downloaded merged video), serve the file
        if (result.startsWith('/') || result.includes('lovesave_')) {
            logger.info(`Serving downloaded file: ${result}`);
            res.download(result, 'video.mp4', (err) => {
                // Clean up temp file after download
                if (!err) {
                    fs.unlink(result, () => { });
                }
            });
        } else {
            // It's a URL, redirect
            logger.info(`Redirecting to direct URL`);
            res.redirect(result);
        }

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

        // For URL endpoint, always use single-stream format to avoid issues
        const directUrl = await getVideoUrl(videoUrl, 'best');

        res.json({ success: true, url: directUrl });

    } catch (error: any) {
        logger.error('URL error:', error.message);
        res.status(500).json({
            success: false,
            error: { code: 'STREAM_ERROR', message: error.message || 'Failed to get URL' },
        });
    }
});
