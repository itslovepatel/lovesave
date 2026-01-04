import { Router, Request, Response } from 'express';
import os from 'os';

export const healthRouter = Router();

// Health check endpoint
healthRouter.get('/', (req: Request, res: Response) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(os.totalmem() / 1024 / 1024),
        },
        version: process.env.npm_package_version || '1.0.0',
    });
});

// Detailed health check
healthRouter.get('/detailed', async (req: Request, res: Response) => {
    const checks: Record<string, { status: string; latency?: number; error?: string }> = {};

    // Check yt-dlp availability
    try {
        const { exec } = await import('child_process');
        const start = Date.now();
        await new Promise<void>((resolve, reject) => {
            exec('yt-dlp --version', (error, stdout) => {
                if (error) reject(error);
                else resolve();
            });
        });
        checks['yt-dlp'] = { status: 'ok', latency: Date.now() - start };
    } catch (error: any) {
        checks['yt-dlp'] = { status: 'error', error: 'yt-dlp not available' };
    }

    // Overall status
    const allOk = Object.values(checks).every(c => c.status === 'ok');

    res.status(allOk ? 200 : 503).json({
        status: allOk ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        checks,
    });
});
