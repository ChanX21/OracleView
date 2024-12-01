// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IYoutubeAnalyzer {
    function requestAnalysis(string calldata videoId) external;
    function getAnalysis(string calldata videoId) external view returns (string memory metadata, uint256 score, bool exists);
}

contract OracleViewCaller {
    // State variables
    IYoutubeAnalyzer public oracle;
    mapping(address => string[]) public userRequests;
    mapping(string => uint256) public requestTimestamps;
    
    // Events
    event AnalysisRequested(address indexed user, string videoId, uint256 timestamp);
    event ResultsReceived(address indexed user, string videoId, uint256 score);
    
    // Custom errors
    error InvalidOracleAddress();
    error EmptyVideoId();
    error RequestTooFrequent();
    error NoAnalysisExists();

    // Constants
    uint256 public constant COOLDOWN_PERIOD = 5 minutes;
    uint256 public constant MAX_USER_REQUESTS = 10;

    constructor(address _oracleAddress) {
        if (_oracleAddress == address(0)) revert InvalidOracleAddress();
        oracle = IYoutubeAnalyzer(_oracleAddress);
    }

    function requestVideoAnalysis(string calldata videoId) external {
        if (bytes(videoId).length == 0) revert EmptyVideoId();
        
        // Check cooldown period
        if (block.timestamp - requestTimestamps[videoId] < COOLDOWN_PERIOD) {
            revert RequestTooFrequent();
        }

        // Request analysis from oracle
        oracle.requestAnalysis(videoId);
        
        // Update user's request history
        string[] storage requests = userRequests[msg.sender];
        if (requests.length >= MAX_USER_REQUESTS) {
            // Remove oldest request
            for (uint i = 0; i < requests.length - 1; i++) {
                requests[i] = requests[i + 1];
            }
            requests.pop();
        }
        requests.push(videoId);
        
        // Update timestamp
        requestTimestamps[videoId] = block.timestamp;
        
        emit AnalysisRequested(msg.sender, videoId, block.timestamp);
    }

    function getVideoAnalysis(string calldata videoId) external view returns (
        string memory metadata,
        uint256 score,
        bool exists
    ) {
        return oracle.getAnalysis(videoId);
    }

    function getUserRequests(address user) external view returns (string[] memory) {
        return userRequests[user];
    }

    function checkAnalysisStatus(string calldata videoId) external view returns (
        bool exists,
        bool cooldownPassed
    ) {
        (,, exists) = oracle.getAnalysis(videoId);
        cooldownPassed = block.timestamp - requestTimestamps[videoId] >= COOLDOWN_PERIOD;
        return (exists, cooldownPassed);
    }

    function getTimeUntilNextRequest(string calldata videoId) external view returns (uint256) {
        uint256 lastRequest = requestTimestamps[videoId];
        if (lastRequest == 0 || block.timestamp - lastRequest >= COOLDOWN_PERIOD) {
            return 0;
        }
        return COOLDOWN_PERIOD - (block.timestamp - lastRequest);
    }
} 