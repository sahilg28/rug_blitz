// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ============================================
// PYTH ENTROPY INTERFACES (from @pythnetwork/entropy-sdk-solidity)
// ============================================

interface IEntropyConsumer {
    function entropyCallback(
        uint64 sequenceNumber,
        address provider,
        bytes32 randomNumber
    ) external;
}

interface IEntropyV2 {
    function requestV2() external payable returns (uint64 sequenceNumber);
    function getFeeV2() external view returns (uint256 fee);
    function getDefaultProvider() external view returns (address provider);
}

// ============================================
// CUSTOM ERRORS
// ============================================

error NotOwner(address caller);
error GameAlreadyActive(address player);
error InvalidDoors(uint8 doors);
error BetBelowMinimum(uint256 minBet);
error BetTooHigh(uint256 maxBet);
error NoActiveGame(address player);
error InvalidDoorIndex(uint8 index);
error NothingToCashOut();
error InsufficientHouseBalance(uint256 required, uint256 available);
error TransferFailed();
error WithdrawTooMuch(uint256 amount, uint256 houseBalance);
error NoHouseLiquidity();
error HouseUnderfunded(uint256 houseBalance, uint256 requiredBalance);
error HouseRiskTooHigh(uint256 maxPayout, uint256 availableBankroll);
error MaxLevelReached(uint8 level);
error ReentrancyGuard();
error ActiveGamesRunning(uint256 activeGames);
error GameAwaitingRandomness(address player);
error OnlyEntropy();
error InvalidSequenceNumber();
error InsufficientEntropyFee(uint256 required, uint256 provided);

// ============================================
// DATA STRUCTURES
// ============================================

struct Game {
    address player;
    uint256 betAmount;
    uint8 currentLevel;
    uint8 doorsPerLevel;
    uint256 multiplier;
    uint8 pendingDoorIndex;
    bool isActive;
    bool awaitingRandomness;
    uint64 pendingSequenceNumber;
    uint256 timestamp;
}

struct LeaderboardEntry {
    address player;
    uint256 highestMultiplier;
    uint32 totalGames;
    uint256 totalWinnings;
}

// ============================================
// MAIN CONTRACT
// ============================================

contract RugBlitzPyth is IEntropyConsumer {
    // ============ CONSTANTS ============
    uint256 public constant HOUSE_EDGE_PERCENT = 5;
    uint8 public constant MAX_LEVELS = 15;
    uint256 public constant MIN_BET = 0.01 ether; // 0.01 MON for testnet
    uint256 public constant ENTROPY_FEE = 0.00011 ether; // Fixed fee for Monad testnet
    
    uint256 public constant MAX_MULTIPLIER_3_DOORS = 437893890380859375000;
    uint256 public constant MAX_MULTIPLIER_4_DOORS = 74830913880757607150;
    uint256 public constant MAX_MULTIPLIER_5_DOORS = 28421709430404007432;

    // ============ STATE ============
    address public owner;
    uint256 public houseBalance;
    bool private locked;
    uint256 public activeGames;
    
    IEntropyV2 public entropy;
    
    mapping(address => Game) private games;
    mapping(address => LeaderboardEntry) private leaderboard;
    mapping(uint64 => address) private sequenceToPlayer;

    // ============ EVENTS ============
    event BetPlaced(address indexed player, uint256 amount, uint8 difficulty);
    event DoorSelected(address indexed player, uint8 level, bool survived, uint256 newMultiplier);
    event RandomnessRequested(address indexed player, uint64 sequenceNumber, uint8 doorIndex);
    event Rugged(address indexed player, uint8 level);
    event CashOut(address indexed player, uint256 payout);
    event MaxLevelAchieved(address indexed player, uint8 level);
    event HouseDeposit(address indexed from, uint256 amount);
    event HouseWithdraw(address indexed to, uint256 amount);

    // ============ CONSTRUCTOR ============
    constructor(address entropyAddress) {
        owner = msg.sender;
        entropy = IEntropyV2(entropyAddress);
    }

    receive() external payable {
        houseBalance += msg.value;
        emit HouseDeposit(msg.sender, msg.value);
    }

    // ============ MODIFIERS ============
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner(msg.sender);
        _;
    }

    modifier nonReentrant() {
        if (locked) revert ReentrancyGuard();
        locked = true;
        _;
        locked = false;
    }

    // ============ HELPER FUNCTIONS ============
    function _maxMultiplierForDoors(uint8 doors) internal pure returns (uint256) {
        if (doors == 3) return MAX_MULTIPLIER_3_DOORS;
        if (doors == 4) return MAX_MULTIPLIER_4_DOORS;
        if (doors == 5) return MAX_MULTIPLIER_5_DOORS;
        revert InvalidDoors(doors);
    }

    function _calculateRowMultiplier(uint8 doors) internal pure returns (uint256) {
        require(doors > 1, "Doors too low");
        return (uint256(doors) * 1e18) / (uint256(doors) - 1);
    }

    function _updateMultiplier(uint256 currentMultiplier, uint256 rowMultiplier) internal pure returns (uint256) {
        return (currentMultiplier * rowMultiplier) / 1e18;
    }

    function _calculatePayout(uint256 betAmount, uint256 multiplier) internal pure returns (uint256) {
        return (betAmount * multiplier * (100 - HOUSE_EDGE_PERCENT)) / (100 * 1e18);
    }

    // ============ GAME FUNCTIONS ============
    
    /// @notice Place a bet and start a new game
    /// @param doors Number of doors (3, 4, or 5)
    function placeBet(uint8 doors) external payable {
        Game storage game = games[msg.sender];

        if (game.isActive) revert GameAlreadyActive(msg.sender);
        if (doors < 3 || doors > 5) revert InvalidDoors(doors);
        if (houseBalance == 0) revert NoHouseLiquidity();

        uint256 maxBet = getMaxBet();
        if (maxBet < MIN_BET) revert HouseUnderfunded(houseBalance, MIN_BET * 10);
        if (msg.value < MIN_BET) revert BetBelowMinimum(MIN_BET);
        if (msg.value > maxBet) revert BetTooHigh(maxBet);

        // Worst-case payout check
        uint256 maxMultiplier = _maxMultiplierForDoors(doors);
        uint256 availableBankroll = houseBalance + msg.value;
        uint256 worstCasePayout = _calculatePayout(msg.value, maxMultiplier);
        if (worstCasePayout > availableBankroll) {
            revert HouseRiskTooHigh(worstCasePayout, availableBankroll);
        }

        // Initialize game
        game.player = msg.sender;
        game.betAmount = msg.value;
        game.currentLevel = 0;
        game.doorsPerLevel = doors;
        game.multiplier = 1e18;
        game.isActive = true;
        game.awaitingRandomness = false;
        game.pendingSequenceNumber = 0;
        game.pendingDoorIndex = 0;
        game.timestamp = block.timestamp;

        activeGames += 1;
        houseBalance += msg.value;

        emit BetPlaced(msg.sender, msg.value, doors);
    }

    /// @notice Select a door - requests randomness from Pyth Entropy
    /// @param doorIndex The door to select (0-indexed)
    function selectDoor(uint8 doorIndex) external payable {
        Game storage game = games[msg.sender];

        if (!game.isActive) revert NoActiveGame(msg.sender);
        if (game.awaitingRandomness) revert GameAwaitingRandomness(msg.sender);
        if (doorIndex >= game.doorsPerLevel) revert InvalidDoorIndex(doorIndex);
        if (game.currentLevel >= MAX_LEVELS) revert MaxLevelReached(game.currentLevel);

        // Use fixed entropy fee (Pyth V2 not fully deployed on Monad testnet)
        uint256 fee = ENTROPY_FEE;
        if (msg.value < fee) revert InsufficientEntropyFee(fee, msg.value);

        // Request randomness from Pyth
        uint64 sequenceNumber = entropy.requestV2{value: fee}();

        // Store pending state
        game.awaitingRandomness = true;
        game.pendingSequenceNumber = sequenceNumber;
        game.pendingDoorIndex = doorIndex;
        sequenceToPlayer[sequenceNumber] = msg.sender;

        // Refund excess ETH
        if (msg.value > fee) {
            (bool success, ) = payable(msg.sender).call{value: msg.value - fee}("");
            if (!success) revert TransferFailed();
        }

        emit RandomnessRequested(msg.sender, sequenceNumber, doorIndex);
    }

    /// @notice Callback from Pyth Entropy with the random number
    function entropyCallback(
        uint64 sequenceNumber,
        address /* provider */,
        bytes32 randomNumber
    ) external override {
        // Verify caller is the entropy contract
        if (msg.sender != address(entropy)) revert OnlyEntropy();

        address player = sequenceToPlayer[sequenceNumber];
        if (player == address(0)) revert InvalidSequenceNumber();

        Game storage game = games[player];
        
        // Clear the mapping
        delete sequenceToPlayer[sequenceNumber];

        // Verify game state
        if (!game.isActive || !game.awaitingRandomness) {
            // Game was cancelled or already processed, just return
            return;
        }

        game.awaitingRandomness = false;
        game.pendingSequenceNumber = 0;

        uint8 doorIndex = game.pendingDoorIndex;
        uint8 level = game.currentLevel;

        // Calculate rug door using Pyth's random number
        uint8 rugDoor = uint8(uint256(randomNumber) % game.doorsPerLevel);

        if (doorIndex == rugDoor) {
            // Player got rugged
            game.isActive = false;
            if (activeGames > 0) {
                activeGames -= 1;
            }
            emit Rugged(player, level);
            return;
        }

        // Player survived - advance level
        uint8 newLevel = level + 1;
        game.currentLevel = newLevel;

        uint256 rowMultiplier = _calculateRowMultiplier(game.doorsPerLevel);
        uint256 newMultiplier = _updateMultiplier(game.multiplier, rowMultiplier);
        game.multiplier = newMultiplier;

        if (newLevel == MAX_LEVELS) {
            emit MaxLevelAchieved(player, newLevel);
        }

        emit DoorSelected(player, newLevel, true, newMultiplier);
    }

    /// @notice Cash out current winnings
    function cashOut() external nonReentrant {
        Game storage game = games[msg.sender];

        if (!game.isActive) revert NoActiveGame(msg.sender);
        if (game.awaitingRandomness) revert GameAwaitingRandomness(msg.sender);
        if (game.currentLevel == 0) revert NothingToCashOut();

        uint256 payout = _calculatePayout(game.betAmount, game.multiplier);
        if (payout > houseBalance) revert InsufficientHouseBalance(payout, houseBalance);

        game.isActive = false;
        if (activeGames > 0) {
            activeGames -= 1;
        }

        houseBalance -= payout;

        (bool success, ) = payable(msg.sender).call{value: payout}("");
        if (!success) revert TransferFailed();

        // Update leaderboard
        LeaderboardEntry storage entry = leaderboard[msg.sender];
        if (entry.player == address(0)) {
            entry.player = msg.sender;
        }
        if (game.multiplier > entry.highestMultiplier) {
            entry.highestMultiplier = game.multiplier;
        }
        entry.totalGames += 1;
        entry.totalWinnings += payout;

        emit CashOut(msg.sender, payout);
    }

    // ============ VIEW FUNCTIONS ============

    function getGame(address player) external view returns (Game memory) {
        return games[player];
    }

    function getCurrentPayout(address player) external view returns (uint256) {
        Game memory game = games[player];
        if (!game.isActive || game.currentLevel == 0) {
            return 0;
        }
        return _calculatePayout(game.betAmount, game.multiplier);
    }

    function getMaxBet() public view returns (uint256) {
        return houseBalance / 10;
    }

    function getLeaderboardEntry(address player) external view returns (LeaderboardEntry memory) {
        return leaderboard[player];
    }

    function getEntropyFee() external pure returns (uint256) {
        return ENTROPY_FEE;
    }

    /// @notice Required by IEntropyConsumer - returns entropy contract address
    function getEntropy() external view returns (address) {
        return address(entropy);
    }

    // ============ OWNER FUNCTIONS ============

    function depositHouse() external payable onlyOwner {
        require(msg.value > 0, "No value");
        houseBalance += msg.value;
        emit HouseDeposit(msg.sender, msg.value);
    }

    function withdrawHouse(uint256 amount) external onlyOwner {
        if (activeGames > 0) revert ActiveGamesRunning(activeGames);
        if (amount > houseBalance) revert WithdrawTooMuch(amount, houseBalance);

        houseBalance -= amount;
        (bool success, ) = payable(owner).call{value: amount}("");
        if (!success) revert TransferFailed();

        emit HouseWithdraw(owner, amount);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        owner = newOwner;
    }
}
