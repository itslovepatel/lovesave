import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function errorHandler(
    error: Error,
    req: Request,
    res: Response,
    next: NextFunction
) {
    logger.error('Unhandled error:', {
        message: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method,
    });

    // Don't leak error details in production
    const isDev = process.env.NODE_ENV === 'development';

    res.status(500).json({
        success: false,
        error: {
            code: 'SERVER_ERROR',
            message: isDev ? error.message : 'An unexpected error occurred',
            ...(isDev && { stack: error.stack }),
        },
    });
}
