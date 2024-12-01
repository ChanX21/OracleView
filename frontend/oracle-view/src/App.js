import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import Web3Modal from 'web3modal';
import './App.css';

// You'll need to import your contract ABI and address
const CONTRACT_ADDRESS = "0x62cdDA352b47D60B46fdf510BCBC1bd430DCb691";
const CONTRACT_ABI = [
  "function requestAnalysis(string calldata videoId) external",
  "function getAnalysis(string calldata videoId) external view returns (string memory metadata, uint256 score, bool exists)"
];

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

  return (
    <div className="App">
      <header className="App-header">
        <h1>YouTube Video Analyzer</h1>
        
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
          <h2>Request New Analysis</h2>
          <form onSubmit={handleRequestAnalysis}>
            <input
              type="text"
              value={videoId}
              onChange={(e) => setVideoId(e.target.value)}
              placeholder="Enter YouTube Video ID"
              required
            />
            <button type="submit" disabled={!account}>
              Request Analysis
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
              Get Analysis
            </button>
          </form>

          {/* Results Display */}
          {analysisResult && (
            <div className="results">
              <h3>Analysis Results</h3>
              <div className="result-item">
                <strong>Metadata:</strong> 
                <p>{analysisResult.metadata}</p>
              </div>
              <div className="result-item">
                <strong>Score:</strong> 
                <p>{analysisResult.score}</p>
              </div>
              <div className="result-item">
                <strong>Exists:</strong> 
                <p>{analysisResult.exists.toString()}</p>
              </div>
            </div>
          )}
        </div>
      </header>
    </div>
  );
}

export default App;
