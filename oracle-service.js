const ethers = require('ethers');
const axios = require('axios');
require('dotenv').config();

// Contract ABI - import the compiled contract ABI
const CONTRACT_ABI = require('./artifacts/contracts/YoutubeAnalyzer.sol/YoutubeAnalyzer.json').abi;
const CONTRACT_ADDRESS = 'YOUR_CONTRACT_ADDRESS';

// Initialize provider and wallet
const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

async function processAnalysisRequest(videoId) {
    try {
        // Call our API
        const response = await axios.post('http://localhost:3000/analyze-video', {
            videoId: videoId
        });

        if (!response.data.success) {
            console.error('API Error:', response.data.error);
            return;
        }

        // Parse the response
        const [metadata, scoreStr] = response.data.data.split('|');
        const score = parseInt(scoreStr);

        // Submit to blockchain
        const tx = await contract.submitAnalysis(videoId, metadata, score);
        await tx.wait();

        console.log(`Analysis submitted for video ${videoId}`);
    } catch (error) {
        console.error('Error processing analysis:', error);
    }
}

// Listen for AnalysisRequested events
async function startListening() {
    console.log('Starting to listen for AnalysisRequested events...');

    contract.on('AnalysisRequested', async (videoId, timestamp, event) => {
        console.log(`New analysis request for video: ${videoId}`);
        await processAnalysisRequest(videoId);
    });
}

// Example script to request analysis
async function requestAnalysis(videoId) {
    const tx = await contract.requestAnalysis(videoId);
    await tx.wait();
    console.log(`Analysis requested for video ${videoId}`);
}

// Start the oracle service
startListening().catch(console.error); 