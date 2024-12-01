import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import Web3Modal from 'web3modal';
import './App.css';
import { Paper, Typography } from '@mui/material';
import metamaskLogo from './assets/metamask.svg';
import youtubeLogo from './assets/youtube.svg';
import blockchainIcon from './assets/blockchain.svg';
import analysisIcon from './assets/analysis.svg';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Add the Base logo URL as a constant
const BASE_LOGO_URL = "https://avatars.githubusercontent.com/u/108554348?v=4";

// Network configurations - Only include what's needed for UI
const NETWORKS = {
  sepolia: {
    name: 'Sepolia',
    chainId: 11155111,
    contractAddress: "0x0f1Ff3ac959035b73b8fcC7a0e6C899f4351313f",
    icon: "⭐",
    isBase: false
  },
  baseSepolia: {
    name: 'Base Sepolia',
    chainId: 84531,
    contractAddress: "0x6D4CBc827a1EE7D8A6b19e89E08432879C617A61",
    icon: "🔵",
    isBase: true,
    logo: BASE_LOGO_URL
  }
};

// Contract ABI
const CONTRACT_ABI = [
  "function requestAnalysis(string calldata videoId) external",
  "function submitAnalysis(string calldata videoId, string calldata metadata, uint256 score) external",
  "function getAnalysis(string calldata videoId) external view returns (string memory metadata, uint256 score, bool exists)",
  "function setOracleAddress(address _oracle) external",
  "event AnalysisRequested(string videoId, uint256 timestamp)",
  "event AnalysisReceived(string videoId, string metadata, uint256 score)"
];

// Helper functions
const getViralityLevel = (score) => {
  if (score >= 80) return "🔥 VIRAL SENSATION!";
  if (score >= 60) return "⚡ TRENDING UP!";
  if (score >= 40) return "📈 GAINING TRACTION";
  if (score >= 20) return "💫 BUILDING MOMENTUM";
  return "🌱 STARTING OUT";
};

const extractVideoId = (input) => {
  const urlRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = input.match(urlRegex);
  if (match) return match[1];
  if (input.length === 11) return input;
  return null;
};

// VideoPreview Component
const VideoPreview = ({ videoId }) => {
  if (!videoId) return null;
  
  return (
    <div className="video-preview">
      <iframe
        width="100%"
        height="315"
        src={`https://www.youtube.com/embed/${videoId}`}
        title="YouTube video preview"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      ></iframe>
    </div>
  );
};

// ScoreDisplay Component
const ScoreDisplay = ({ score, metadata }) => {
  const viralityLevel = getViralityLevel(score);
  const topics = metadata.split(',').map(t => t.trim());

  return (
    <div className="score-dashboard">
      <Paper className="score-card">
        <div className="score-container">
          <div className="flame-effect"></div>
          <Typography variant="h1" className="score-value">
            {score}
          </Typography>
          <Typography variant="h3" className="virality-label">
            {viralityLevel}
          </Typography>
          <div className="topics-container">
            {topics.map((topic, index) => (
              <span key={index} className="topic-tag">
                {topic}
              </span>
            ))}
          </div>
        </div>
      </Paper>
    </div>
  );
};

function App() {
  const [videoId, setVideoId] = useState('');
  const [searchVideoId, setSearchVideoId] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [previewVideoId, setPreviewVideoId] = useState(null);
  const [searchPreviewId, setSearchPreviewId] = useState(null);
  const [selectedNetwork, setSelectedNetwork] = useState('sepolia');
  const [chainId, setChainId] = useState(null);
  const [multiChainResults, setMultiChainResults] = useState({});

  // Initialize Web3Modal
  const web3Modal = new Web3Modal({
    cacheProvider: true,
  });

  // Add toast configurations
  const notify = {
    success: (msg) => toast.success(msg, {
      position: "top-right",
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
      theme: "dark",
      style: {
        background: '#1a1a1a',
        border: '1px solid #4CAF50',
        borderRadius: '10px',
        boxShadow: '0 4px 12px rgba(0, 255, 0, 0.1)'
      }
    }),
    error: (msg) => toast.error(msg, {
      position: "top-right",
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
      theme: "dark",
      style: {
        background: '#1a1a1a',
        border: '1px solid #ff3333',
        borderRadius: '10px',
        boxShadow: '0 4px 12px rgba(255, 51, 51, 0.1)'
      }
    }),
    info: (msg) => toast.info(msg, {
      position: "top-right",
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
      theme: "dark",
      style: {
        background: '#1a1a1a',
        border: '1px solid #3498db',
        borderRadius: '10px',
        boxShadow: '0 4px 12px rgba(52, 152, 219, 0.1)'
      }
    })
  };

  // Connect wallet function
  const connectWallet = async () => {
    try {
      const instance = await web3Modal.connect();
      const provider = new ethers.providers.Web3Provider(instance);
      const signer = provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();
      
      console.log("Connected to network:", network);
      setAccount(address);
      setChainId(network.chainId);

      // Get network name from provider
      const networkName = await provider.getNetwork().then(net => net.name);
      console.log("Network name:", networkName);

      // Initialize contract based on network
      if (networkName === "Base Sepolia") {
        const baseContract = new ethers.Contract(
          "0x6D4CBc827a1EE7D8A6b19e89E08432879C617A61",
          CONTRACT_ABI,
          signer
        );
        setContract(baseContract);
      } else {
        const sepoliaContract = new ethers.Contract(
          "0x0f1Ff3ac959035b73b8fcC7a0e6C899f4351313f",
          CONTRACT_ABI,
          signer
        );
        setContract(sepoliaContract);
      }

      // Listen for network changes
      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });

      // Listen for account changes
      window.ethereum.on('accountsChanged', () => {
        window.location.reload();
      });

    } catch (error) {
      console.error("Error connecting wallet:", error);
      notify.error("Error connecting wallet: " + error.message);
    }
  };

  const handleRequestAnalysis = async (e) => {
    e.preventDefault();
    if (!previewVideoId) {
      notify.error("Please enter a valid YouTube URL or ID");
      return;
    }

    if (!contract) {
      notify.error("Please connect your wallet and select a network");
      return;
    }
    
    try {
      console.log("Requesting analysis for:", previewVideoId);
      
      try {
        const existingAnalysis = await contract.getAnalysis(previewVideoId);
        if (existingAnalysis.exists) {
          notify.info("Analysis already exists for this video!");
          return;
        }
      } catch (error) {
        console.log("No existing analysis found, proceeding with request");
      }

      notify.info("Sending transaction...");
      const tx = await contract.requestAnalysis(previewVideoId);
      console.log("Transaction sent:", tx.hash);
      
      notify.info("Waiting for confirmation...");
      const receipt = await tx.wait();
      console.log("Transaction confirmed:", receipt);
      
      notify.success("Analysis requested successfully! Please wait for the oracle to process it.");
      setVideoId('');
      setPreviewVideoId(null);
    } catch (error) {
      console.error('Error requesting analysis:', error);
      notify.error("Error requesting analysis: " + (error.reason || error.message));
    }
  };

  const handleGetAnalysis = async (e) => {
    e.preventDefault();
    if (!searchPreviewId) {
      notify.error("Please enter a valid YouTube URL or ID");
      return;
    }

    if (!contract) {
      notify.error("Please connect your wallet and select a network");
      return;
    }
    
    try {
      notify.info("Fetching analysis...");
      console.log("Getting analysis for:", searchPreviewId);
      
      const result = await contract.getAnalysis(searchPreviewId);
      console.log("Analysis result:", result);

      if (!result.exists) {
        notify.info("No analysis found for this video. Please request an analysis first.");
        return;
      }

      setAnalysisResult({
        metadata: result.metadata,
        score: result.score.toNumber(),
        exists: result.exists,
        network: selectedNetwork
      });
      notify.success("Analysis retrieved successfully!");
    } catch (error) {
      console.error('Error getting analysis:', error);
      if (error.message.includes("revert")) {
        notify.info("No analysis found for this video. Please request an analysis first.");
      } else {
        notify.error("Error getting analysis: " + (error.reason || error.message));
      }
      setAnalysisResult(null);
    }
  };

  const handleVideoInputChange = (e, isSearch = false) => {
    const input = e.target.value;
    if (isSearch) {
      setSearchVideoId(input);
      const extractedId = extractVideoId(input);
      setSearchPreviewId(extractedId);
    } else {
      setVideoId(input);
      const extractedId = extractVideoId(input);
      setPreviewVideoId(extractedId);
    }
  };

  return (
    <div className="App">
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
      
      <header className="App-header">
        <div className="header-container">
          {/* Left side: Logo and Title */}
          <div className="logo-container">
            <div className="logo-symbol"></div>
            <h1 className="logo">Oracle View</h1>
          </div>

          {/* Right side: Base Badge and Wallet */}
          <div className="header-right">
            <div className="powered-by-base">
              <img src={BASE_LOGO_URL} alt="Base" className="base-logo" />
              <div className="base-text">
                <span className="powered-by">POWERED BY</span>
                <span className="base-name">BASE</span>
              </div>
            </div>
            
            <div className="wallet-section">
              {account ? (
                <div className="account-info">
                  <img src={metamaskLogo} alt="MetaMask" className="wallet-icon" />
                  <p>Connected: {account.slice(0, 6)}...{account.slice(-4)}</p>
                </div>
              ) : (
                <button onClick={connectWallet} className="connect-button">
                  <img src={metamaskLogo} alt="MetaMask" className="wallet-icon" />
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="info-cards">
          <div className="info-card">
            <img src={youtubeLogo} alt="YouTube" className="info-icon" />
            <h3>YouTube Analysis</h3>
            <p>Analyze any YouTube video for viral potential</p>
          </div>
          <div className="info-card">
            <img src={blockchainIcon} alt="Blockchain" className="info-icon" />
            <h3>Blockchain Oracle</h3>
            <p>Decentralized and transparent analysis</p>
          </div>
          <div className="info-card">
            <img src={analysisIcon} alt="Analysis" className="info-icon" />
            <h3>AI Powered</h3>
            <p>Advanced machine learning algorithms</p>
          </div>
        </div>
        
        {/* Request Analysis Form with Rich Content */}
        <div className="analysis-section">
          <div className="section-header">
            <img src={youtubeLogo} alt="YouTube" className="section-icon" />
            <h2>Check Video Virality</h2>
          </div>
          <form onSubmit={handleRequestAnalysis}>
            <div className="input-wrapper">
              <i className="url-icon">🔗</i>
              <input
                type="text"
                value={videoId}
                onChange={(e) => handleVideoInputChange(e, false)}
                placeholder="Enter YouTube Video URL or ID"
                required
              />
            </div>
            {previewVideoId && <VideoPreview videoId={previewVideoId} />}
            <button 
              type="submit" 
              disabled={!account || !contract}
            >
              <span className="button-icon">🔍</span>
              {!account 
                ? "Connect Wallet First" 
                : !contract
                  ? "Switch to Supported Network"
                  : !previewVideoId 
                    ? "Enter Valid Video URL" 
                    : "Analyze Video"
              }
            </button>
          </form>
        </div>

        {/* Get Analysis Form with Rich Content */}
        <div className="analysis-section">
          <div className="section-header">
            <img src={analysisIcon} alt="Analysis" className="section-icon" />
            <h2>Get Analysis Results</h2>
          </div>
          <form onSubmit={handleGetAnalysis}>
            <div className="input-wrapper">
              <i className="url-icon">🔗</i>
              <input
                type="text"
                value={searchVideoId}
                onChange={(e) => handleVideoInputChange(e, true)}
                placeholder="Enter YouTube Video URL or ID"
                required
              />
            </div>
            {searchPreviewId && <VideoPreview videoId={searchPreviewId} />}
            <button 
              type="submit" 
              disabled={!account}
            >
              <span className="button-icon">📊</span>
              {!account 
                ? "Connect Wallet First" 
                : !searchPreviewId 
                  ? "Enter Valid Video URL" 
                  : "Get Analysis Results"
              }
            </button>

            {/* Display results with network indicator */}
            {analysisResult && (
              <div className={`analysis-result ${analysisResult.network === 'baseSepolia' ? 'base-chain' : ''}`}>
                {analysisResult.network === 'baseSepolia' && (
                  <div className="base-indicator">
                    <img src={BASE_LOGO_URL} alt="Base Chain" className="base-result-logo" />
                    <span>Analyzed on Base Chain</span>
                  </div>
                )}
                <ScoreDisplay 
                  score={analysisResult.score} 
                  metadata={analysisResult.metadata}
                />
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <footer className="app-footer">
          <div className="footer-content">
            <div className="footer-section">
              <h4>Powered By</h4>
              <div className="tech-stack">
                <img src={metamaskLogo} alt="MetaMask" className="tech-icon" />
                <img src={BASE_LOGO_URL} alt="Base" className="tech-icon base-icon" />
                <img src={blockchainIcon} alt="Blockchain" className="tech-icon" />
              </div>
            </div>
            <div className="footer-section">
              <h4>About Oracle View</h4>
              <p>Decentralized YouTube content analysis platform on Base</p>
            </div>
          </div>
        </footer>
      </header>
    </div>
  );
}

export default App;
