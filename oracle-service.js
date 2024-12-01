const ethers = require('ethers');
const axios = require('axios');
require('dotenv').config();

// Import ABI from the abi file
const CONTRACT_ABI = require('./abi/abi.js');

// Network configurations - Use environment variables
const NETWORKS = {
    sepolia: {
        name: 'Sepolia',
        rpc: process.env.SEPOLIA_RPC_URL,
        contractAddress: process.env.SEPOLIA_CONTRACT_ADDRESS,
        chainId: 11155111
    },
    baseSepolia: {
        name: 'Base Sepolia',
        rpc: process.env.BASE_RPC_URL,
        contractAddress: process.env.BASE_CONTRACT_ADDRESS,
        chainId: 84531
    }
};

class OracleService {
    constructor() {
        this.networks = {};
        this.setupNetworks();
    }

    setupNetworks() {
        for (const [networkName, networkConfig] of Object.entries(NETWORKS)) {
            try {
                const provider = new ethers.providers.JsonRpcProvider(networkConfig.rpc);
                const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
                const contract = new ethers.Contract(
                    networkConfig.contractAddress,
                    CONTRACT_ABI,
                    wallet
                );

                this.networks[networkName] = {
                    provider,
                    wallet,
                    contract,
                    config: networkConfig
                };

                // Verify provider connection
                provider.getNetwork().then(() => {
                    console.log(`✅ Connected to ${networkName} at ${networkConfig.contractAddress}`);
                    this.attachEventListeners(networkName);
                }).catch(error => {
                    console.error(`❌ Failed to connect to ${networkName}:`, error);
                });

            } catch (error) {
                console.error(`❌ Failed to setup ${networkName}:`, error);
            }
        }
    }

    attachEventListeners(networkName) {
        const network = this.networks[networkName];
        if (!network) return;

        try {
            // Remove any existing listeners
            network.contract.removeAllListeners();

            // Listen for AnalysisRequested events - Updated to match contract events
            network.contract.on("AnalysisRequested", async (videoId, timestamp, event) => {
                console.log(`\n🎥 New analysis request on ${networkName}:`);
                console.log(`Video ID: ${videoId}`);
                console.log(`Timestamp: ${timestamp}`);
                console.log(`TX Hash: ${event.transactionHash}`);

                try {
                    // Process the videoId directly as it's already a string in the contract
                    console.log('Processing Video ID:', videoId);
                    
                    // Validate YouTube video ID format
                    if (!this.isValidYouTubeId(videoId)) {
                        throw new Error(`Invalid YouTube video ID format: ${videoId}`);
                    }

                    await this.processAnalysisRequest(videoId, networkName);
                } catch (error) {
                    console.error(`Failed to process request on ${networkName}:`, error);
                }
            });

            // Listen for AnalysisReceived events - Updated to match contract events
            network.contract.on("AnalysisReceived", (videoId, metadata, score, event) => {
                console.log(`\n📊 Analysis completed on ${networkName}:`);
                console.log(`Video ID: ${videoId}`);
                console.log(`Metadata: ${metadata}`);
                console.log(`Score: ${score.toString()}`);
                console.log(`TX Hash: ${event.transactionHash}`);
            });

            console.log(`✅ Event listeners attached for ${networkName}`);
        } catch (error) {
            console.error(`❌ Failed to attach event listeners for ${networkName}:`, error);
        }
    }

    // Add helper method to validate YouTube ID
    isValidYouTubeId(videoId) {
        // YouTube IDs are 11 characters long and contain alphanumeric chars, underscores, and hyphens
        const youtubeIdRegex = /^[a-zA-Z0-9_-]{11}$/;
        return youtubeIdRegex.test(videoId);
    }

    async processAnalysisRequest(videoId, networkName) {
        const network = this.networks[networkName];
        if (!network) {
            console.error(`Network ${networkName} not configured`);
            return;
        }

        try {
            console.log(`\n🎥 Processing analysis for video ${videoId} on ${networkName}`);
            
            // Validate the video ID before making the API call
            if (!this.isValidYouTubeId(videoId)) {
                throw new Error(`Invalid YouTube video ID format: ${videoId}`);
            }

            // Call our API
            const response = await axios.post('http://localhost:3000/analyze-video', {
                videoId: videoId
            });

            if (!response.data.success) {
                throw new Error(response.data.error || 'API request failed');
            }

            // Parse the response
            const [metadata, scoreStr] = response.data.data.split('|');
            const score = parseInt(scoreStr);

            console.log(`📊 Analysis results:`, {
                videoId,
                metadata,
                score,
                network: networkName
            });

            // Submit to blockchain
            const tx = await network.contract.submitAnalysis(videoId, metadata, score, {
                gasLimit: 500000
            });
            
            console.log(`⏳ Waiting for transaction confirmation...`);
            const receipt = await tx.wait();
            
            console.log(`✅ Analysis submitted on ${networkName}. Hash: ${receipt.transactionHash}`);
            return receipt;
        } catch (error) {
            console.error(`❌ Error processing analysis on ${networkName}:`, error);
            throw error;
        }
    }

    async startListening() {
        console.log('🚀 Starting Oracle Service on multiple networks...');
    }
}

// Create and start the service
const service = new OracleService();
service.startListening().catch(console.error);

module.exports = service; 