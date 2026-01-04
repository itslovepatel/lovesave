import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { detectPlatform, Platform } from '../utils/platformDetector';
import { YouTubeHandler } from '../handlers/youtube';
import { InstagramHandler } from '../handlers/instagram';
import { TikTokHandler } from '../handlers/tiktok';
import { FacebookHandler } from '../handlers/facebook';
import { RedditHandler } from '../handlers/reddit';
import { logger } from '../utils/logger';

export const parseRouter = Router();

// Request validation schema
const ParseRequestSchema = z.object({
    url: z.string().url('Invalid URL format'),
    cookies: z.string().optional(),
});

// Handler map
const handlers: Partial<Record<Platform, any>> = {
    youtube: new YouTubeHandler(),
    instagram: new InstagramHandler(),
    tiktok: new TikTokHandler(),
    facebook: new FacebookHandler(),
    reddit: new RedditHandler(),
};

parseRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Validate request
        const validation = ParseRequestSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_REQUEST',
                    message: 'Invalid request body',
                    details: validation.error.errors.map(e => e.message).join(', '),
                },
            });
        }

        const { url, cookies } = validation.data;

        // Detect platform
        const platform = detectPlatform(url);
        if (!platform) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'UNSUPPORTED_URL',
                    message: 'This URL is not from a supported platform',
                },
            });
        }

        logger.info(`Parsing ${platform} URL: ${url}`);

        // Get handler
        const handler = handlers[platform];
        if (!handler) {
            return res.status(501).json({
                success: false,
                error: {
                    code: 'PLATFORM_NOT_IMPLEMENTED',
                    message: `${platform} support is coming soon`,
                },
            });
        }

        // Parse content
        const content = await handler.parse(url, cookies);

        // Generate unique ID for this parse session
        const sessionId = uuidv4();

        res.json({
            success: true,
            data: {
                id: sessionId,
                platform,
                url, // Include original URL for stream endpoint
                ...content,
            },
        });

    } catch (error: any) {
        logger.error('Parse error:', error);

        // Handle specific error types
        if (error.message?.includes('DRM') || error.message?.includes('protected')) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'DRM_PROTECTED',
                    message: 'This content is DRM protected and cannot be downloaded',
                },
            });
        }

        if (error.message?.includes('not found') || error.message?.includes('private')) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'CONTENT_NOT_FOUND',
                    message: 'Content not found or is private',
                },
            });
        }

        next(error);
    }
});
