const express = require('express');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
require('dotenv').config();

const app = express();

// Security middleware
app.use(helmet());
app.use(express.json({ limit: '10kb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use(limiter);

// Custom error handling
class APIError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

// Async handler wrapper
const catchAsync = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

const videoAnalysis = async (videoId) => {
    try {
        // Input validation
        if (!videoId || typeof videoId !== 'string') {
            throw new APIError('Invalid video ID format', 400);
        }

        // YouTube API request with timeout and retry logic
        const youtubeResponse = await axios.get(
            `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,statistics&key=${process.env.YOUTUBE_API_KEY}`,
            {
                timeout: 5000,
                retry: 3,
                retryDelay: 1000
            }
        ).catch(error => {
            if (error.response?.status === 404) {
                throw new APIError('Video not found', 404);
            }
            if (error.response?.status === 403) {
                throw new APIError('YouTube API quota exceeded', 429);
            }
            throw new APIError('YouTube API error: ' + error.message, 500);
        });

        if (!youtubeResponse.data.items?.[0]) {
            throw new APIError('Video not found', 404);
        }

        const video = youtubeResponse.data.items[0];
        const {
            snippet: { title, description },
            statistics: { likeCount, viewCount, commentCount }
        } = video;

        // Validate required data
        if (!title || !description) {
            throw new APIError('Invalid video data received', 500);
        }

        const shortDescription = description.slice(0, 100);

        // Enhanced prompt with error checking
        const contentForAnalysis = `
            Title: ${title}
            Description: ${shortDescription}
            Likes: ${likeCount || 0}
            viewCount: ${viewCount || 0}
            commentCount: ${commentCount || 0}

            Analyze and respond EXACTLY in this format:
            M:key1,key2,key3,key4,key5,key6,key7,key8,key9,key10;P:SCORE`;

        // OpenAI Analysis
        const aiResponse = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an AI Youtube Video Data analyzer. Based on the title, description, likes, comments, and views, provide 10 key metadata words and a performance prediction score (0-100, where 0 is least viral and 100 is most viral). Use single words only.'
                    },
                    {
                        role: 'user',
                        content: contentForAnalysis
                    }
                ],
                temperature: 0.7,
                max_tokens: 50
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        ).catch(error => {
            throw new APIError('OpenAI Analysis API error: ' + error.message, 500);
        });

        if (!aiResponse.data?.choices?.[0]?.message?.content) {
            throw new APIError('Invalid AI response format', 500);
        }

        const aiAnalysis = aiResponse.data.choices[0].message.content;
        const analysis = { metadata: "", predictions: "" };

        // Parse response with validation
        const parts = aiAnalysis.split(';');
        for (const part of parts) {
            if (!part) continue;
            const [key, value] = part.split(':');
            if (!key || !value) continue;
            
            if (key.trim() === 'M') analysis.metadata = value.trim();
            if (key.trim() === 'P') {
                const score = parseInt(value.trim());
                if (isNaN(score) || score < 0 || score > 100) {
                    throw new APIError('Invalid score format from AI', 500);
                }
                analysis.predictions = value.trim();
            }
        }

        if (!analysis.metadata || !analysis.predictions) {
            throw new APIError('Invalid analysis format', 500);
        }

        return {
            success: true,
            data: `${analysis.metadata}|${analysis.predictions}`,
            metadata: {
                title,
                viewCount,
                likeCount,
                commentCount
            }
        };

    } catch (error) {
        if (error instanceof APIError) {
            throw error;
        }
        throw new APIError(error.message || 'Internal server error', 500);
    }
};

// API endpoint with error handling
app.post('/analyze-video', catchAsync(async (req, res) => {
    const { videoId } = req.body;
    
    if (!videoId) {
        throw new APIError('Video ID is required', 400);
    }

    const result = await videoAnalysis(videoId);
    res.json(result);
}));

// Global error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        timestamp: new Date().toISOString()
    });

    res.status(err.statusCode || 500).json({
        success: false,
        error: err.message,
        status: err.status || 'error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        console.log('Process terminated');
    });
});

const server = app.listen(process.env.PORT || 3000, () => {
    console.log(`Server running on port ${process.env.PORT || 3000}`);
});

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION! Shutting down...');
    console.error(err);
    server.close(() => {
        process.exit(1);
    });
});

module.exports = app; 