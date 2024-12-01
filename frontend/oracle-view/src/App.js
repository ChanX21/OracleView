import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import Web3Modal from 'web3modal';
import './App.css';
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, 
  ResponsiveContainer, RadarChart, Radar, PolarGrid, 
  PolarAngleAxis, PolarRadiusAxis 
} from 'recharts';
import { Paper, Grid, Typography, Chip, Box } from '@mui/material';

// You'll need to import your contract ABI and address
const CONTRACT_ADDRESS = "0x62cdDA352b47D60B46fdf510BCBC1bd430DCb691";
const CONTRACT_ABI = [
  "function requestAnalysis(string calldata videoId) external",
  "function getAnalysis(string calldata videoId) external view returns (string memory metadata, uint256 score, bool exists)"
];

// Add this helper function after your imports
const getViralityLevel = (score) => {
  if (score >= 80) return "Viral Sensation! 🔥";
  if (score >= 60) return "Trending Up! 📈";
  if (score >= 40) return "Gaining Traction 📊";
  if (score >= 20) return "Building Momentum 🌱";
  return "Starting Out 🌟";
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

  // Add this function to parse metadata into categories
  const parseMetadata = (metadata) => {
    const categories = metadata.split(',').map(item => item.trim());
    return categories.map(category => ({
      name: category,
      value: Math.floor(Math.random() * 100) // In a real app, these values would come from your oracle
    }));
  };

  // Update the score card section in your ResultsDisplay component
  const ScoreCard = ({ score }) => {
    const viralityLevel = getViralityLevel(score);
    const dots = 5;
    const activeDots = Math.ceil((score / 100) * dots);

    return (
      <Paper className="score-card">
        <div className="score-container">
          <Typography variant="h3" className="score-value">
            {score}/100
          </Typography>
          <Typography variant="h6" className="virality-label">
            {viralityLevel}
          </Typography>
          <div className="virality-indicator">
            {[...Array(dots)].map((_, i) => (
              <div
                key={i}
                className={`indicator-dot ${i < activeDots ? 'active' : ''}`}
              />
            ))}
          </div>
        </div>
        <svg className="flame-icon" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <radialGradient id="flame-gradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.8)" />
              <stop offset="100%" stopColor="rgba(255,69,0,0)" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="45" fill="url(#flame-gradient)">
            <animate
              attributeName="r"
              values="45;47;45"
              dur="2s"
              repeatCount="indefinite"
            />
          </circle>
        </svg>
      </Paper>
    );
  };

  // Modify the results display section
  const ResultsDisplay = ({ analysisResult }) => {
    if (!analysisResult) return null;

    const categories = parseMetadata(analysisResult.metadata);
    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

    return (
      <div className="results-dashboard">
        <Typography variant="h4" gutterBottom>
          Analysis Results
        </Typography>
        
        <Grid container spacing={3}>
          {/* Overall Score Card */}
          <Grid item xs={12}>
            <ScoreCard score={analysisResult.score} />
          </Grid>

          {/* Keywords/Categories */}
          <Grid item xs={12}>
            <Paper className="keywords-section">
              <Typography variant="h6" gutterBottom>
                Key Topics
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {categories.map((category, index) => (
                  <Chip
                    key={index}
                    label={category.name}
                    color="primary"
                    variant="outlined"
                  />
                ))}
              </Box>
            </Paper>
          </Grid>

          {/* Pie Chart */}
          <Grid item xs={12} md={6}>
            <Paper className="chart-container">
              <Typography variant="h6" className="chart-title">Topic Distribution</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categories}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({name, value}) => `${name}: ${value}`}
                  >
                    {categories.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#282c34', border: 'none' }} />
                </PieChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          {/* Radar Chart */}
          <Grid item xs={12} md={6}>
            <Paper className="chart-container">
              <Typography variant="h6" className="chart-title">Content Analysis</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={categories}>
                  <PolarGrid stroke="#666" />
                  <PolarAngleAxis dataKey="name" tick={{ fill: '#333', fontSize: 12 }} />
                  <PolarRadiusAxis tick={{ fill: '#333' }} />
                  <Radar
                    name="Topics"
                    dataKey="value"
                    stroke="#8884d8"
                    fill="#8884d8"
                    fillOpacity={0.6}
                  />
                  <Tooltip contentStyle={{ backgroundColor: '#282c34', border: 'none' }} />
                </RadarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          {/* Bar Chart */}
          <Grid item xs={12}>
            <Paper className="chart-container">
              <Typography variant="h6" className="chart-title">Topic Strength</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={categories}>
                  <XAxis dataKey="name" tick={{ fill: '#333' }} />
                  <YAxis tick={{ fill: '#333' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#282c34', border: 'none' }} />
                  <Bar dataKey="value" fill="#8884d8">
                    {categories.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        </Grid>
      </div>
    );
  };

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
          {analysisResult && <ResultsDisplay analysisResult={analysisResult} />}
        </div>
      </header>
    </div>
  );
}

export default App;
