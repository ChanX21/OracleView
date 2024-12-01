const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

const videoAnalysis = async (videoId) => {
    try {
        // YouTube API request
        const youtubeResponse = await axios.get(
            `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,statistics&key=${process.env.YOUTUBE_API_KEY}`
        );

        if (!youtubeResponse.data.items?.[0]) {
            throw Error('Video not found');
        }

        const video = youtubeResponse.data.items[0];
        const {
            snippet: { title, description },
            statistics: { likeCount, viewCount, commentCount }
        } = video;

        const shortDescription = description.slice(0, 100);

        // Prepare OpenAI prompt
        const contentForAnalysis = `
            Title: ${title}
            Description: ${shortDescription}
            Likes: ${likeCount}
            viewCount: ${viewCount}
            commentCount: ${commentCount}

            Analyze and respond EXACTLY in this format:
            M:key1,key2,key3,key4,key5,key6,key7,key8,key9,key10;P:SCORE`;

        // OpenAI API request
        const aiResponse = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an AI Youtube Video Data analyzer. Provide 10 key metadata words and 3 performance predictions (score between 0-100. 0 being the least viral and 100 most)based on the title, description, likesCount, CommentCount and viewCount. Use single words only.'
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
                }
            }
        );

        if (!aiResponse.data?.choices?.[0]) {
            throw Error('AI Fetch Error');
        }

        const aiAnalysis = aiResponse.data.choices[0].message.content;

        // Parse response
        const analysis = {
            metadata: "",
            predictions: ""
        };

        const parts = aiAnalysis.split(';');
        for (const part of parts) {
            if (!part) continue;
            const [key, value] = part.split(':');
            if (key.trim() === 'M') analysis.metadata = value.trim();
            if (key.trim() === 'P') analysis.predictions = value.trim();
        }

        return {
            success: true,
            data: `${analysis.metadata}|${analysis.predictions}`
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

// API endpoint
app.post('/analyze-video', async (req, res) => {
    const { videoId } = req.body;
    
    if (!videoId) {
        return res.status(400).json({
            success: false,
            error: 'Video ID is required'
        });
    }

    const result = await videoAnalysis(videoId);
    if (result.success) {
        res.json(result);
    } else {
        res.status(500).json(result);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 