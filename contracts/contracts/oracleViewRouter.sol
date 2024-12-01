// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IRouterGateway {
    function iSend(
        uint256 version,
        uint256 routeAmount,
        string memory routeRecipient,
        string memory destChainId,
        bytes memory requestMetadata,
        bytes memory requestPacket
    ) external payable returns (uint256);
}

interface IOracleView {
    function submitAnalysis(string calldata videoId, string calldata metadata, uint256 score) external;
    function getAnalysis(string calldata videoId) external view returns (string memory metadata, uint256 score, bool exists);
}

contract OracleViewRouter {
    // Events
    event AnalysisSynced(string videoId, string destChainId);
    event AnalysisReceived(string videoId, string metadata, uint256 score, string srcChainId);

    // State variables
    address public owner;
    IRouterGateway public gateway;
    IOracleView public oracleView;
    mapping(uint256 => string) public requestToVideoId;

    // Chain IDs
    string public constant SEPOLIA_CHAIN = "11155111";
    string public constant BASE_CHAIN = "84531";

    constructor(address _gateway, address _oracleView) {
        owner = msg.sender;
        gateway = IRouterGateway(_gateway);
        oracleView = IOracleView(_oracleView);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // Function to sync analysis to other chain
    function syncAnalysis(string calldata videoId) external {
        // Get analysis from local chain
        (string memory metadata, uint256 score, bool exists) = oracleView.getAnalysis(videoId);
        require(exists, "Analysis not found");

        // Determine destination chain
        string memory destChainId = block.chainid == 84531 ? SEPOLIA_CHAIN : BASE_CHAIN;

        // Prepare cross-chain packet
        bytes memory packet = abi.encode(videoId, metadata, score);
        bytes memory requestPacket = abi.encode(address(this), packet);

        // Prepare metadata for Router Protocol
        bytes memory requestMetadata = getRequestMetadata(
            300000, // destGasLimit
            0,      // destGasPrice (0 for automatic)
            300000, // ackGasLimit
            0,      // ackGasPrice (0 for automatic)
            0,      // relayerFees (0 for minimum)
            1,      // ackType (1 for success acknowledgment)
            false,  // isReadCall
            ""      // asmAddress (empty for no ASM)
        );

        // Send cross-chain request
        uint256 requestId = gateway.iSend{ value: msg.value }(
            1, // version
            0, // routeAmount
            "", // routeRecipient
            destChainId,
            requestMetadata,
            requestPacket
        );

        requestToVideoId[requestId] = videoId;
        emit AnalysisSynced(videoId, destChainId);
    }

    // Router Protocol callback function
    function iReceive(
        string memory requestSender,
        bytes memory packet,
        string memory srcChainId
    ) external returns (bytes memory) {
        require(msg.sender == address(gateway), "Only gateway can call");

        // Decode the received packet
        (string memory videoId, string memory metadata, uint256 score) = abi.decode(
            packet,
            (string, string, uint256)
        );

        // Submit to local oracle contract
        oracleView.submitAnalysis(videoId, metadata, score);

        emit AnalysisReceived(videoId, metadata, score, srcChainId);
        return "";
    }

    // Helper function to create Router Protocol metadata
    function getRequestMetadata(
        uint64 destGasLimit,
        uint64 destGasPrice,
        uint64 ackGasLimit,
        uint64 ackGasPrice,
        uint128 relayerFees,
        uint8 ackType,
        bool isReadCall,
        string memory asmAddress
    ) public pure returns (bytes memory) {
        return abi.encodePacked(
            destGasLimit,
            destGasPrice,
            ackGasLimit,
            ackGasPrice,
            relayerFees,
            ackType,
            isReadCall,
            asmAddress
        );
    }

    // Optional acknowledgment handler
    function iAck(
        uint256 requestIdentifier,
        bool execFlag,
        bytes memory execData
    ) external {
        string memory videoId = requestToVideoId[requestIdentifier];
        if (execFlag) {
            // Clean up after successful sync
            delete requestToVideoId[requestIdentifier];
        }
    }

    // Admin functions
    function setGateway(address _gateway) external onlyOwner {
        gateway = IRouterGateway(_gateway);
    }

    function setOracleView(address _oracleView) external onlyOwner {
        oracleView = IOracleView(_oracleView);
    }

    // Function to recover any stuck tokens/ETH
    function recover(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            payable(owner).transfer(amount);
        } else {
            (bool success, ) = token.call(
                abi.encodeWithSignature("transfer(address,uint256)", owner, amount)
            );
            require(success, "Transfer failed");
        }
    }

    // To receive ETH for cross-chain fees
    receive() external payable {}
} 