const ethers = require('ethers');
const axios = require('axios');
require('dotenv').config();

// Import ABI from the abi file
const CONTRACT_ABI = require('./abi/abi.js');
const CONTRACT_ADDRESS = '0x62cdDA352b47D60B46fdf510BCBC1bd430DCb691';

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

        console.log('Submitting to blockchain:', {
            videoId,
            metadata,
            score
        });

        // Submit to blockchain
        const tx = await contract.submitAnalysis(videoId, metadata, score);
        const receipt = await tx.wait();
        
        console.log(`Analysis submitted for video ${videoId}. Transaction hash: ${receipt.transactionHash}`);
    } catch (error) {
        console.error('Error processing analysis:', error);
    }
}

// Listen for AnalysisRequested events
async function startListening() {
    console.log('Starting to listen for AnalysisRequested events...');
    console.log('Contract address:', CONTRACT_ADDRESS);
    console.log('Oracle address:', await contract.oracleAddress());

    contract.on('AnalysisRequested', async (videoId, timestamp, event) => {
        console.log(`New analysis request received:`);
        console.log(`- Video ID: ${videoId}`);
        console.log(`- Timestamp: ${new Date(timestamp * 1000).toISOString()}`);
        console.log(`- Transaction Hash: ${event.transactionHash}`);
        await processAnalysisRequest(videoId);
    });

    // Also listen for AnalysisReceived events
    contract.on('AnalysisReceived', async (videoId, metadata, score, event) => {
        console.log(`Analysis received on chain:`);
        console.log(`- Video ID: ${videoId}`);
        console.log(`- Metadata: ${metadata}`);
        console.log(`- Score: ${score}`);
        console.log(`- Transaction Hash: ${event.transactionHash}`);
    });
}

// Example script to request analysis
async function requestAnalysis(videoId) {
    try {
        const tx = await contract.requestAnalysis(videoId);
        const receipt = await tx.wait();
        console.log(`Analysis requested for video ${videoId}`);
        console.log(`Transaction hash: ${receipt.transactionHash}`);
    } catch (error) {
        console.error('Error requesting analysis:', error);
    }
}

// Start the oracle service
console.log('Starting Oracle Service...');
startListening().catch(console.error);

// Export for testing purposes
module.exports = {
    requestAnalysis,
    processAnalysisRequest
}; 