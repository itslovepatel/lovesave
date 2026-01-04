import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { detectPlatform } from '../utils/platformDetector';
import { YouTubeHandler } from '../handlers/youtube';
import { logger } from '../utils/logger';

export const batchRouter = Router();

const BatchRequestSchema = z.object({
    url: z.string().url('Invalid URL format'),
    limit: z.number().min(1).max(100).optional().default(50),
    offset: z.number().min(0).optional().default(0),
});

batchRouter.post('/', async (req: Request, res: Response) => {
    try {
        const validation = BatchRequestSchema.safeParse(req.body);
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

        const { url, limit, offset } = validation.data;
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

        logger.info(`Batch parsing ${platform} URL: ${url}`);

        // Only YouTube supports playlists for now
        if (platform !== 'youtube') {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'BATCH_NOT_SUPPORTED',
                    message: `Batch downloads are not supported for ${platform}`,
                },
            });
        }

        const handler = new YouTubeHandler();
        const playlist = await handler.parsePlaylist(url, limit, offset);

        res.json({
            success: true,
            data: playlist,
        });

    } catch (error: any) {
        logger.error('Batch parse error:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'SERVER_ERROR',
                message: error.message || 'Failed to parse playlist',
            },
        });
    }
});
