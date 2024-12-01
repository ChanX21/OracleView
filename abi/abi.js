module.exports = [
	"function requestAnalysis(string calldata videoId) external",
	"function submitAnalysis(string calldata videoId, string calldata metadata, uint256 score) external",
	"function getAnalysis(string calldata videoId) external view returns (string memory metadata, uint256 score, bool exists)",
	"function setOracleAddress(address _oracle) external",
	"event AnalysisRequested(string videoId, uint256 timestamp)",
	"event AnalysisReceived(string videoId, string metadata, uint256 score)"
];