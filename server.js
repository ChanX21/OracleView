const express = require('express');
const axios = require('axios');
const ethers = require('ethers');
require('dotenv').config();

const app = express();
app.use(express.json());

// Network configurations (same as oracle-service.js)
const NETWORKS = {
    sepolia: {
        name: 'Sepolia',
        rpc: process.env.SEPOLIA_RPC_URL,
        contractAddress: process.env.SEPOLIA_CONTRACT_ADDRESS,
        chainId: 11155111
    },
    base: {
        name: 'Base',
        rpc: process.env.BASE_RPC_URL,
        contractAddress: process.env.BASE_CONTRACT_ADDRESS,
        chainId: 84531  // Base Testnet
    }
};

// Initialize providers and contracts
const networkConnections = {};

for (const [networkName, networkConfig] of Object.entries(NETWORKS)) {
    try {
        const provider = new ethers.providers.JsonRpcProvider(networkConfig.rpc);
        const contract = new ethers.Contract(
            networkConfig.contractAddress,
            require('./abi/abi.js'),
            provider
        );

        networkConnections[networkName] = { provider, contract, config: networkConfig };
        console.log(`✅ Connected to ${networkName}`);
    } catch (error) {
        console.error(`❌ Failed to setup ${networkName}:`, error);
    }
}

const videoAnalysis = async (videoId) => {
    try {
        // YouTube API request
        let youtubeResponse;
        try {
            youtubeResponse = await axios.get(
                `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,statistics&key=${process.env.YOUTUBE_API_KEY}`
            );
        } catch (error) {
            if (error.response) {
                throw new Error(`YouTube API error: ${error.response.data.error.message}`);
            }
            throw new Error('Failed to fetch YouTube data');
        }

        if (!youtubeResponse.data.items?.[0]) {
            throw new Error('Video not found or invalid video ID');
        }

        const video = youtubeResponse.data.items[0];
        
        // Safely access nested properties
        const title = video.snippet?.title || '';
        const description = video.snippet?.description || '';
        const likeCount = video.statistics?.likeCount || '0';
        const viewCount = video.statistics?.viewCount || '0';
        const commentCount = video.statistics?.commentCount || '0';

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
        let aiResponse;
        try {
            aiResponse = await axios.post(
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
        } catch (error) {
            if (error.response) {
                throw new Error(`OpenAI API error: ${error.response.data.error.message}`);
            }
            throw new Error('Failed to get AI analysis');
        }

        if (!aiResponse.data?.choices?.[0]?.message?.content) {
            throw new Error('Invalid AI response format');
        }

        const aiAnalysis = aiResponse.data.choices[0].message.content;

        // Parse response with error handling
        const analysis = {
            metadata: "",
            predictions: ""
        };

        try {
            const parts = aiAnalysis.split(';');
            if (parts.length < 2) {
                throw new Error('Invalid AI response format: missing parts');
            }

            for (const part of parts) {
                if (!part) continue;
                const [key, value] = part.split(':');
                if (!key || !value) {
                    throw new Error('Invalid AI response format: malformed key-value pair');
                }
                if (key.trim() === 'M') analysis.metadata = value.trim();
                if (key.trim() === 'P') analysis.predictions = value.trim();
            }

            if (!analysis.metadata || !analysis.predictions) {
                throw new Error('Invalid AI response format: missing required fields');
            }
        } catch (error) {
            throw new Error(`Failed to parse AI response: ${error.message}`);
        }

        return {
            success: true,
            data: `${analysis.metadata}|${analysis.predictions}`
        };

    } catch (error) {
        console.error('Error in videoAnalysis:', error);
        return {
            success: false,
            error: error.message || 'An unexpected error occurred'
        };
    }
};

// Add new endpoint to get analysis from all chains
app.get('/analysis/:videoId/all-chains', async (req, res) => {
    try {
        const { videoId } = req.params;
        const results = {};

        for (const [networkName, connection] of Object.entries(networkConnections)) {
            try {
                const analysis = await connection.contract.getAnalysis(videoId);
                results[networkName] = {
                    metadata: analysis.metadata,
                    score: analysis.score.toNumber(),
                    exists: analysis.exists,
                    chainId: connection.config.chainId
                };
            } catch (error) {
                console.error(`Error fetching from ${networkName}:`, error);
                results[networkName] = { 
                    error: 'Failed to fetch analysis',
                    exists: false 
                };
            }
        }

        res.json({
            success: true,
            data: results
        });
    } catch (error) {
        console.error('Error in cross-chain analysis:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch cross-chain analysis'
        });
    }
});

// Add endpoint to get analysis from specific chain
app.get('/analysis/:videoId/:network', async (req, res) => {
    try {
        const { videoId, network } = req.params;
        
        if (!networkConnections[network]) {
            return res.status(400).json({
                success: false,
                error: `Network ${network} not supported`
            });
        }

        const contract = networkConnections[network].contract;
        const analysis = await contract.getAnalysis(videoId);

        res.json({
            success: true,
            data: {
                metadata: analysis.metadata,
                score: analysis.score.toNumber(),
                exists: analysis.exists,
                chainId: networkConnections[network].config.chainId
            }
        });
    } catch (error) {
        console.error('Error fetching analysis:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch analysis'
        });
    }
});

// API endpoint with additional error handling
app.post('/analyze-video', async (req, res) => {
    try {
        const { videoId } = req.body;
        
        if (!videoId) {
            return res.status(400).json({
                success: false,
                error: 'Video ID is required'
            });
        }

        if (typeof videoId !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Video ID must be a string'
            });
        }

        const result = await videoAnalysis(videoId);
        if (result.success) {
            res.json(result);
        } else {
            res.status(500).json(result);
        }
    } catch (error) {
        console.error('Error in /analyze-video endpoint:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log('Supported networks:', Object.keys(networkConnections).join(', '));
}); 