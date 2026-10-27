// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title Panel
 * @notice Paid one-question survey primitive with prefunded budget on BOT Chain.
 * @dev Spec: docs/specs/25-panel.md
 */
contract Panel {
    struct Survey {
        address asker;
        uint128 reward;
        uint32 maxResponses;
        uint32 responses;
        uint64 closesAt;
        uint8 optionCount;
        bool reclaimed;
        string question; // <= 120 bytes
    }

    uint256 public constant MAX_QUESTION = 120;
    uint256 public constant MIN_OPTIONS = 2;
    uint256 public constant MAX_OPTIONS = 6;
    uint256 public constant MAX_OPTION_LEN = 32;
    uint32 public constant MIN_RESPONSES = 1;
    uint32 public constant MAX_RESPONSES = 1000;
    uint64 public constant MIN_DURATION = 1 hours;
    uint64 public constant MAX_DURATION = 90 days;

    mapping(uint256 => Survey) private _surveys;
    mapping(uint256 => string[]) private _options;
    mapping(uint256 => uint32[6]) private _tally;
    mapping(uint256 => mapping(address => uint8)) private _choice; // option + 1; 0 = none
    mapping(address => uint256) public pending;
    uint256 public surveyCount; // ids start at 1

    uint256 private _locked = 1;

    modifier nonReentrant() {
        if (_locked != 1) revert ReentrantCall();
        _locked = 2;
        _;
        _locked = 1;
    }

    event Created(
        uint256 indexed id,
        address indexed asker,
        string question,
        uint128 reward,
        uint32 maxResponses,
        uint64 closesAt
    );
    event Responded(uint256 indexed id, address indexed responder, uint8 option);
    event Reclaimed(uint256 indexed id, uint256 amount);
    event Withdrawn(address indexed account, uint256 amount);

    error BadQuestion();
    error BadOptions();
    error BadReward();
    error BadResponses();
    error BadDuration();
    error WrongFunding(uint256 expected);
    error NoSuchSurvey();
    error Closed();
    error Full();
    error BadOption();
    error AskerCannotRespond();
    error AlreadyResponded();
    error NotAsker();
    error AlreadyReclaimed();
    error NotClosedOrFull();
    error NothingToWithdraw();
    error TransferFailed();
    error ReentrantCall();

    /**
     * @notice Creates a new paid survey.
     * @param question Survey question string (1..120 bytes).
     * @param options Array of 2..6 choices (each 1..32 bytes).
     * @param reward Bounty paid to each respondent.
     * @param maxResponses Maximum number of paid answers (1..1000).
     * @param durationSecs Duration before survey closes (1 hour..90 days).
     * @return id The assigned survey ID.
     */
    function create(
        string calldata question,
        string[] calldata options,
        uint128 reward,
        uint32 maxResponses,
        uint64 durationSecs
    ) external payable returns (uint256 id) {
        if (bytes(question).length == 0 || bytes(question).length > MAX_QUESTION) {
            revert BadQuestion();
        }
        if (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) {
            revert BadOptions();
        }
        for (uint256 i = 0; i < options.length; i++) {
            if (bytes(options[i]).length == 0 || bytes(options[i]).length > MAX_OPTION_LEN) {
                revert BadOptions();
            }
        }
        if (reward == 0) revert BadReward();
        if (maxResponses < MIN_RESPONSES || maxResponses > MAX_RESPONSES) {
            revert BadResponses();
        }
        if (durationSecs < MIN_DURATION || durationSecs > MAX_DURATION) {
            revert BadDuration();
        }

        uint256 expectedFunding = uint256(reward) * uint256(maxResponses);
        if (msg.value != expectedFunding) {
            revert WrongFunding(expectedFunding);
        }

        id = ++surveyCount;
        uint64 closesAt = uint64(block.timestamp) + durationSecs;

        _surveys[id] = Survey({
            asker: msg.sender,
            reward: reward,
            maxResponses: maxResponses,
            responses: 0,
            closesAt: closesAt,
            optionCount: uint8(options.length),
            reclaimed: false,
            question: question
        });

        for (uint256 i = 0; i < options.length; i++) {
            _options[id].push(options[i]);
        }

        emit Created(id, msg.sender, question, reward, maxResponses, closesAt);
    }

    /**
     * @notice Submits an answer to a survey and earns the prefunded reward.
     * @param id The survey ID.
     * @param option 0-indexed choice.
     */
    function respond(uint256 id, uint8 option) external {
        if (id == 0 || id > surveyCount) revert NoSuchSurvey();
        Survey storage s = _surveys[id];

        if (block.timestamp >= s.closesAt) revert Closed();
        if (s.responses >= s.maxResponses) revert Full();
        if (option >= s.optionCount) revert BadOption();
        if (msg.sender == s.asker) revert AskerCannotRespond();
        if (_choice[id][msg.sender] != 0) revert AlreadyResponded();

        _choice[id][msg.sender] = option + 1;
        _tally[id][option] += 1;
        s.responses += 1;
        pending[msg.sender] += s.reward;

        emit Responded(id, msg.sender, option);
    }

    /**
     * @notice Asker reclaims unspent budget once closed or full.
     * @param id The survey ID.
     */
    function reclaim(uint256 id) external {
        if (id == 0 || id > surveyCount) revert NoSuchSurvey();
        Survey storage s = _surveys[id];

        if (msg.sender != s.asker) revert NotAsker();
        if (s.reclaimed) revert AlreadyReclaimed();
        if (block.timestamp < s.closesAt && s.responses < s.maxResponses) {
            revert NotClosedOrFull();
        }

        s.reclaimed = true;
        uint32 unspent = s.maxResponses - s.responses;
        uint256 amount = uint256(s.reward) * uint256(unspent);

        if (amount > 0) {
            pending[s.asker] += amount;
        }

        emit Reclaimed(id, amount);
    }

    /**
     * @notice Pull payment withdrawal for accrued rewards or reclaimed funds.
     */
    function withdraw() external nonReentrant {
        uint256 amount = pending[msg.sender];
        if (amount == 0) revert NothingToWithdraw();

        pending[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit Withdrawn(msg.sender, amount);
    }

    // --- View Functions ---

    function surveyOf(uint256 id) external view returns (Survey memory) {
        if (id == 0 || id > surveyCount) revert NoSuchSurvey();
        return _surveys[id];
    }

    function optionsOf(uint256 id) external view returns (string[] memory) {
        if (id == 0 || id > surveyCount) revert NoSuchSurvey();
        return _options[id];
    }

    function tallyOf(uint256 id) external view returns (uint32[] memory) {
        if (id == 0 || id > surveyCount) revert NoSuchSurvey();
        uint8 count_ = _surveys[id].optionCount;
        uint32[] memory tallies = new uint32[](count_);
        for (uint8 i = 0; i < count_; i++) {
            tallies[i] = _tally[id][i];
        }
        return tallies;
    }

    function choiceOf(uint256 id, address addr) external view returns (bool answered, uint8 option) {
        if (id == 0 || id > surveyCount) revert NoSuchSurvey();
        uint8 c = _choice[id][addr];
        if (c == 0) return (false, 0);
        return (true, c - 1);
    }

    function latest(
        uint256 offset,
        uint256 count_
    ) external view returns (Survey[] memory surveys, uint256[] memory ids) {
        if (count_ > 50) {
            count_ = 50;
        }
        if (offset >= surveyCount) {
            return (new Survey[](0), new uint256[](0));
        }

        uint256 available = surveyCount - offset;
        uint256 n = count_ < available ? count_ : available;

        surveys = new Survey[](n);
        ids = new uint256[](n);

        for (uint256 i = 0; i < n; i++) {
            uint256 id = surveyCount - offset - i;
            ids[i] = id;
            surveys[i] = _surveys[id];
        }
    }
}
