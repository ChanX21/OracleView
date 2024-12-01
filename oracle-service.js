const ethers = require('ethers');
const axios = require('axios');
require('dotenv').config();

// Import ABI from the abi file
const CONTRACT_ABI = require('./abi/abi.js');

// Network configurations
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
                const contract = new ethers.Contract(networkConfig.contractAddress, CONTRACT_ABI, wallet);

                this.networks[networkName] = {
                    provider,
                    wallet,
                    contract,
                    config: networkConfig
                };

                console.log(`✅ Connected to ${networkName}`);
            } catch (error) {
                console.error(`❌ Failed to setup ${networkName}:`, error);
            }
        }
    }

    async processAnalysisRequest(videoId, networkName) {
        const network = this.networks[networkName];
        if (!network) {
            console.error(`Network ${networkName} not configured`);
            return;
        }

        try {
            console.log(`Processing analysis for video ${videoId} on ${networkName}`);
            
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

            console.log(`Submitting analysis to ${networkName}:`, {
                videoId,
                metadata,
                score
            });

            // Submit to blockchain
            const tx = await network.contract.submitAnalysis(videoId, metadata, score);
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

        for (const [networkName, network] of Object.entries(this.networks)) {
            try {
                console.log(`📡 Listening on ${networkName}...`);
                console.log(`Contract address: ${network.config.contractAddress}`);

                // Listen for AnalysisRequested events
                network.contract.on('AnalysisRequested', async (videoId, timestamp, event) => {
                    console.log(`\n🎥 New analysis request on ${networkName}:`);
                    console.log(`Video ID: ${videoId}`);
                    console.log(`Timestamp: ${new Date(timestamp * 1000).toISOString()}`);
                    console.log(`TX Hash: ${event.transactionHash}`);

                    try {
                        await this.processAnalysisRequest(videoId, networkName);
                    } catch (error) {
                        console.error(`Failed to process request on ${networkName}:`, error);
                    }
                });

                // Listen for AnalysisReceived events
                network.contract.on('AnalysisReceived', async (videoId, metadata, score, event) => {
                    console.log(`\n📊 Analysis completed on ${networkName}:`);
                    console.log(`Video ID: ${videoId}`);
                    console.log(`Score: ${score}`);
                    console.log(`TX Hash: ${event.transactionHash}`);
                });

            } catch (error) {
                console.error(`❌ Failed to setup listeners for ${networkName}:`, error);
            }
        }
    }

    // Helper method to get contract instance for a specific network
    getContract(networkName) {
        return this.networks[networkName]?.contract;
    }
}

// Create and start the service
const service = new OracleService();
service.startListening().catch(console.error);

module.exports = service; 