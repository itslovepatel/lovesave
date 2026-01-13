import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { parseRouter } from './routes/parse';
import { streamRouter } from './routes/stream';
import { batchRouter } from './routes/batch';
import { healthRouter } from './routes/health';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());

// CORS configuration - allow localhost for development and Vercel for production
const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || [];
const devOrigins = [
    'http://localhost:5000',
    'http://localhost:3000',
    'http://127.0.0.1:5000',
    'http://127.0.0.1:3000',
    'https://unisave-web.vercel.app',
    'https://unisave-gsbpbdyff-love-patels-projects-96030d05.vercel.app'
];
const allOrigins = [...new Set([...allowedOrigins, ...devOrigins])];

app.use(cors({
    origin: allOrigins.length > 0 ? allOrigins : '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '30'),
    message: {
        success: false,
        error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests, please try again later',
        },
    },
});
app.use('/api', limiter);

// Request logging
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
    });
    next();
});

// Routes
app.use('/api/parse', parseRouter);
app.use('/api/stream', streamRouter);
app.use('/api/batch', batchRouter);
app.use('/api/health', healthRouter);

// Error handler
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: 'Endpoint not found',
        },
    });
});

// Start server
app.listen(PORT, () => {
    logger.info(`UniSave Server running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
