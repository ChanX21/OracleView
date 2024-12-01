// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

contract YoutubeAnalyzer is Ownable {
    // Events
    event AnalysisRequested(string videoId, uint256 timestamp);
    event AnalysisReceived(string videoId, string metadata, uint256 score);

    // Structs
    struct TopicScore {
        string topic;
        uint256 relevance;
    }

    struct Analysis {
        string[] topics;
        uint256[] scores;
        uint256 overallScore;
        bool exists;
    }

    // State variables
    mapping(string => Analysis) public analyses;
    address public oracleAddress;

    // Constructor
    constructor() Ownable(msg.sender) {
        oracleAddress = msg.sender;
    }

    // Modifiers
    modifier onlyOracle() {
        require(msg.sender == oracleAddress, "Only oracle can call this");
        _;
    }

    // Functions
    function setOracleAddress(address _oracle) external onlyOwner {
        oracleAddress = _oracle;
    }

    function requestAnalysis(string calldata videoId) external {
        require(bytes(videoId).length > 0, "Video ID cannot be empty");
        emit AnalysisRequested(videoId, block.timestamp);
    }

    function submitAnalysis(
        string calldata videoId,
        string calldata metadata,
        uint256 score
    ) external onlyOracle {
        require(bytes(videoId).length > 0, "Video ID cannot be empty");
        require(score <= 100, "Score must be between 0 and 100");

        analyses[videoId] = Analysis({
            topics: metadata.split(','),
            scores: metadata.split(',').map(item => uint256(item.trim())),
            overallScore: score,
            exists: true
        });

        emit AnalysisReceived(videoId, metadata, score);
    }

    function getAnalysis(string calldata videoId) 
        external 
        view 
        returns (string[] memory topics, uint256[] memory scores, uint256 overallScore, bool exists) 
    {
        Analysis memory analysis = analyses[videoId];
        return (analysis.topics, analysis.scores, analysis.overallScore, analysis.exists);
    }
} 