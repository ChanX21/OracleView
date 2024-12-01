const axios = require('axios');

async function analyzeVideo(videoId) {
    try {
        const response = await axios.post('http://localhost:3000/analyze-video', {
            videoId: videoId
        });
        console.log('Analysis:', response.data);
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

// Example usage
analyzeVideo('tJ85t5wi5qc'); 