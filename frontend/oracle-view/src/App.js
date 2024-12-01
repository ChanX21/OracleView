import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import Web3Modal from 'web3modal';
import './App.css';
import { Paper, Typography } from '@mui/material';

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

function App() {
  const [videoId, setVideoId] = useState('');
  const [searchVideoId, setSearchVideoId] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);

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
      const tx = await contract.requestAnalysis(videoId);
      await tx.wait();
      alert("Analysis requested successfully!");
      setVideoId('');
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
      const result = await contract.getAnalysis(searchVideoId);
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

  return (
    <div className="App">
      <header className="App-header">
        <h1>YouTube Virality Oracle</h1>
        
        {/* Wallet Connection */}
        <div className="wallet-section">
          {account ? (
            <div className="account-info">
              <p>Connected: {account.slice(0, 6)}...{account.slice(-4)}</p>
            </div>
          ) : (
            <button onClick={connectWallet}>Connect Wallet</button>
          )}
        </div>
        
        {/* Request Analysis Form */}
        <div className="analysis-section">
          <h2>Check Video Virality</h2>
          <form onSubmit={handleRequestAnalysis}>
            <input
              type="text"
              value={videoId}
              onChange={(e) => setVideoId(e.target.value)}
              placeholder="Enter YouTube Video ID"
              required
            />
            <button type="submit" disabled={!account}>
              Analyze Video
            </button>
          </form>
        </div>

        {/* Get Analysis Form */}
        <div className="analysis-section">
          <h2>Get Analysis Results</h2>
          <form onSubmit={handleGetAnalysis}>
            <input
              type="text"
              value={searchVideoId}
              onChange={(e) => setSearchVideoId(e.target.value)}
              placeholder="Enter Video ID to search"
              required
            />
            <button type="submit" disabled={!account}>
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
      </header>
    </div>
  );
}

export default App;
