import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import Web3Modal from 'web3modal';
import './App.css';
import { Paper, Typography } from '@mui/material';
import metamaskLogo from './assets/metamask.svg';
import youtubeLogo from './assets/youtube.svg';
import blockchainIcon from './assets/blockchain.svg';
import analysisIcon from './assets/analysis.svg';

// You'll need to import your contract ABI and address
const CONTRACT_ADDRESS = "0x62cdDA352b47D60B46fdf510BCBC1bd430DCb691";
const CONTRACT_ABI = [
  "function requestAnalysis(string calldata videoId) external",
  "function getAnalysis(string calldata videoId) external view returns (string memory metadata, uint256 score, bool exists)"
];

// Add this helper function after your imports
const getViralityLevel = (score) => {
  if (score >= 80) return "🔥 VIRAL SENSATION!";
  if (score >= 60) return "⚡ TRENDING UP!";
  if (score >= 40) return "📈 GAINING TRACTION";
  if (score >= 20) return "💫 BUILDING MOMENTUM";
  return "🌱 STARTING OUT";
};

// Add this helper function to extract video ID
const extractVideoId = (input) => {
  // Handle full YouTube URLs
  const urlRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = input.match(urlRegex);
  
  // If it's a URL, return the extracted ID
  if (match) return match[1];
  
  // If it's already an ID (11 characters), return it
  if (input.length === 11) return input;
  
  return null;
};

function App() {
  const [videoId, setVideoId] = useState('');
  const [searchVideoId, setSearchVideoId] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [previewVideoId, setPreviewVideoId] = useState(null);
  const [searchPreviewId, setSearchPreviewId] = useState(null);

  // Initialize Web3Modal
  const web3Modal = new Web3Modal({
    network: "sepolia", // or your network
    cacheProvider: true,
  });

  // Connect wallet function
  const connectWallet = async () => {
    try {
      const instance = await web3Modal.connect();
      const provider = new ethers.providers.Web3Provider(instance);
      const signer = provider.getSigner();
      const address = await signer.getAddress();
      setAccount(address);

      // Initialize contract
      const youtubeAnalyzer = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        signer
      );
      setContract(youtubeAnalyzer);
    } catch (error) {
      console.error("Error connecting wallet:", error);
    }
  };

  const handleRequestAnalysis = async (e) => {
    e.preventDefault();
    if (!contract) {
      alert("Please connect your wallet first!");
      return;
    }

    try {
      if (!previewVideoId) {
        alert("Please enter a valid YouTube URL or video ID");
        return;
      }
      
      const tx = await contract.requestAnalysis(previewVideoId);
      await tx.wait();
      alert("Analysis requested successfully!");
      setVideoId('');
      setPreviewVideoId(null);
    } catch (error) {
      console.error('Error requesting analysis:', error);
      alert("Error requesting analysis. Check console for details.");
    }
  };

  const handleGetAnalysis = async (e) => {
    e.preventDefault();
    if (!contract) {
      alert("Please connect your wallet first!");
      return;
    }

    try {
      if (!searchPreviewId) {
        alert("Please enter a valid YouTube URL or video ID");
        return;
      }
      
      const result = await contract.getAnalysis(searchPreviewId);
      setAnalysisResult({
        metadata: result[0],
        score: result[1].toNumber(),
        exists: result[2]
      });
    } catch (error) {
      console.error('Error getting analysis:', error);
      alert("Error getting analysis. Check console for details.");
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

  // Auto-connect if previously connected
  useEffect(() => {
    if (web3Modal.cachedProvider) {
      connectWallet();
    }
  }, []);

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

  return (
    <div className="App">
      <header className="App-header">
        <div className="logo-container">
          <div className="logo-symbol"></div>
          <h1 className="logo">Oracle View</h1>
        </div>
        
        {/* Rich Wallet Connection Section */}
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
            <button type="submit" disabled={!account || !previewVideoId}>
              <span className="button-icon">🔍</span>
              Analyze Video
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
            <button type="submit" disabled={!account || !searchPreviewId}>
              <span className="button-icon">📊</span>
              Get Results
            </button>
          </form>

          {/* Results Display */}
          {analysisResult && (
            <ScoreDisplay 
              score={analysisResult.score} 
              metadata={analysisResult.metadata}
            />
          )}
        </div>

        {/* Footer */}
        <footer className="app-footer">
          <div className="footer-content">
            <div className="footer-section">
              <h4>Powered By</h4>
              <div className="tech-stack">
                <img src={metamaskLogo} alt="MetaMask" className="tech-icon" />
                <img src={blockchainIcon} alt="Blockchain" className="tech-icon" />
              </div>
            </div>
            <div className="footer-section">
              <h4>About Oracle View</h4>
              <p>Decentralized YouTube content analysis platform</p>
            </div>
          </div>
        </footer>
      </header>
    </div>
  );
}

export default App;
