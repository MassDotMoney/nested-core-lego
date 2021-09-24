// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/external/IWETH.sol";
import "./interfaces/external/MinimalSmartChef.sol";

/**
 * @title Receives fees collected by the NestedFactory, and splits the income among
 * shareholders (the NFT owners, Nested treasury and a NST buybacker contract).
 */
contract FeeSplitter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    event PaymentReleased(address to, address token, uint256 amount);
    event PaymentReceived(address from, address token, uint256 amount);

    struct Shareholder {
        address account;
        uint256 weight;
    }

    // registers shares and amount release for a specific token or ETH
    struct TokenRecords {
        uint256 totalShares;
        uint256 totalReleased;
        mapping(address => uint256) shares;
        mapping(address => uint256) released;
    }

    Shareholder[] private shareholders;

    mapping(address => TokenRecords) private tokenRecords;

    uint256 public royaltiesWeight;
    uint256 public totalWeights;

    address public immutable weth;

    /**
     * @param _accounts [address[]] inital shareholders addresses that can receive income
     * @param _weights [uint256[]] initial weights for these shareholders. Weight determines share allocation
     * @param _royaltiesWeight [uint256] royalties part weights when applicable
     */
    constructor(
        address[] memory _accounts,
        uint256[] memory _weights,
        uint256 _royaltiesWeight,
        address _weth
    ) {
        setShareholders(_accounts, _weights);
        setRoyaltiesWeight(_royaltiesWeight);
        weth = _weth;
    }

    // receive ether after a WETH withdraw call
    receive() external payable {
        require(msg.sender == weth, "FeeSplitter: ETH_SENDER_NOT_WETH");
    }

    /**
     * @dev Getter for the total shares held by shareholders.
     * @param _token [address] payment token address, use ETH_ADDR for ETH
     * @return the total shares count
     */
    function totalShares(address _token) public view returns (uint256) {
        return tokenRecords[_token].totalShares;
    }

    /**
     * @dev Getter for the total amount of token already released.
     * @param _token [address] payment token address, use ETH_ADDR for ETH
     * @return the total amount release to shareholders
     */
    function totalReleased(address _token) public view returns (uint256) {
        return tokenRecords[_token].totalReleased;
    }

    /**
     * @dev Getter for the amount of shares held by an account.
     * @param _account [address] account the shares belong to
     * @param _token [address] payment token address, use ETH_ADDR for ETH
     * @return the shares owned by the account
     */
    function shares(address _account, address _token) public view returns (uint256) {
        return tokenRecords[_token].shares[_account];
    }

    /**
     * @dev Getter for the amount of Ether already released to a shareholders.
     * @param _account [address] the target account for this request
     * @param _token [address] payment token address, use ETH_ADDR for ETH
     * @return the amount already released to this account
     */
    function released(address _account, address _token) public view returns (uint256) {
        return tokenRecords[_token].released[_account];
    }

    /**
     * @dev Sends a fee to this contract for splitting, as an ERC20 token. No royalties are expected.
     * @param _amount [uint256] amount of token as fee to be claimed by this contract
     * @param _token [IERC20] currency for the fee as an ERC20 token
     */
    function sendFees(IERC20 _token, uint256 _amount) public nonReentrant {
        uint256 weights = totalWeights - royaltiesWeight;
        _sendFees(_token, _amount, weights);
    }

    /**
     * @dev Sends a fee to this contract for splitting, as an ERC20 token
     * @param _amount [uint256] amount of token as fee to be claimed by this contract
     * @param _royaltiesTarget [address] the account that can claim royalties
     * @param _token [IERC20] currency for the fee as an ERC20 token
     */
    function sendFeesWithRoyalties(
        address _royaltiesTarget,
        IERC20 _token,
        uint256 _amount
    ) public nonReentrant {
        require(_royaltiesTarget != address(0), "FeeSplitter: INVALID_ROYALTIES_TARGET_ADDRESS");

        _sendFees(_token, _amount, totalWeights);
        _addShares(_royaltiesTarget, _computeShareCount(_amount, royaltiesWeight, totalWeights), address(_token));
    }

    /**
     * @dev transfers a fee to this contract, private function used by similar public ones
     * @param _token [IERC20] currency for the fee
     * @param _amount [uint256] amount of token as fee
     * @param _totalWeights [uint256] total weights to determine the share count to allocate
     */
    function _sendFees(
        IERC20 _token,
        uint256 _amount,
        uint256 _totalWeights
    ) private {
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);

        for (uint256 i = 0; i < shareholders.length; i++) {
            _addShares(
                shareholders[i].account,
                _computeShareCount(_amount, shareholders[i].weight, _totalWeights),
                address(_token)
            );
        }
        emit PaymentReceived(msg.sender, address(_token), _amount);
    }

    function _computeShareCount(
        uint256 _amount,
        uint256 _weight,
        uint256 _totalWeights
    ) private pure returns (uint256) {
        return (_amount * _weight) / _totalWeights;
    }

    /**
     * @dev Triggers a transfer to `msg.sender` of the amount of token they are owed, according to
     * the amount of shares they own and their previous withdrawals.
     * @param _token [address] payment token address
     */
    function releaseToken(IERC20 _token) public nonReentrant {
        uint256 amount = _releaseToken(msg.sender, _token);
        _token.safeTransfer(msg.sender, amount);
        emit PaymentReleased(msg.sender, address(_token), amount);
    }

    /**
     * @dev call releaseToken() for multiple tokens
     * @param _tokens [IERC20[]] ERC20 tokens to release
     */
    function releaseTokens(IERC20[] memory _tokens) external {
        for (uint256 i = 0; i < _tokens.length; i++) {
            releaseToken(_tokens[i]);
        }
    }

    /**
     * @dev Triggers a transfer to `msg.sender` of the amount of Ether they are owed, according to
     * the amount of shares they own and their previous withdrawals.
     */
    function releaseETH() external nonReentrant {
        uint256 amount = _releaseToken(msg.sender, IERC20(weth));
        IWETH(weth).withdraw(amount);
        (bool success, ) = msg.sender.call{ value: amount }("");
        require(success, "FeeSplitter: ETH_TRANFER_ERROR");
        emit PaymentReleased(msg.sender, 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE, amount);
    }

    function _releaseToken(address _account, IERC20 _token) private returns (uint256) {
        TokenRecords storage _tokenRecords = tokenRecords[address(_token)];
        uint256 amountToRelease = getAmountDue(_account, _token);
        require(amountToRelease != 0, "FeeSplitter: NO_PAYMENT_DUE");

        _tokenRecords.released[_account] = _tokenRecords.released[_account] + amountToRelease;
        _tokenRecords.totalReleased = _tokenRecords.totalReleased + amountToRelease;

        return amountToRelease;
    }

    /**
     * @dev Returns the amount due to an account. Call releaseToken to withdraw the amount.
     * @param _account [address] account address to check the amount due for
     * @param _token [address] ERC20 payment token address (or ETH_ADDR)
     * @return the total amount due for the requested currency
     */
    function getAmountDue(address _account, IERC20 _token) public view returns (uint256) {
        TokenRecords storage _tokenRecords = tokenRecords[address(_token)];
        uint256 totalReceived = _tokenRecords.totalReleased;
        if (_tokenRecords.totalShares == 0) return 0;
        else totalReceived += _token.balanceOf(address(this));
        uint256 amountDue =
            (totalReceived * _tokenRecords.shares[_account]) /
                _tokenRecords.totalShares -
                _tokenRecords.released[_account];
        return amountDue;
    }

    function _addShares(
        address _account,
        uint256 _shares,
        address _token
    ) private {
        TokenRecords storage _tokenRecords = tokenRecords[_token];
        _tokenRecords.shares[_account] += _shares;
        _tokenRecords.totalShares = _tokenRecords.totalShares + _shares;
    }

    /**
     * @dev sets a new list of shareholders
     * @param _accounts [address[]] shareholders accounts list
     * @param _weights [uint256[]] weight for each shareholder. Determines part of the payment allocated to them
     */
    function setShareholders(address[] memory _accounts, uint256[] memory _weights) public onlyOwner {
        delete shareholders;
        require(_accounts.length > 0 && _accounts.length == _weights.length, "FeeSplitter: ARRAY_LENGTHS_ERR");
        totalWeights = royaltiesWeight;

        for (uint256 i = 0; i < _accounts.length; i++) {
            _addShareholder(_accounts[i], _weights[i]);
        }
    }

    /**
     * @dev updates weight for a shareholder
     * @param _accountIndex [uint256] account to change the weight of
     * @param _weight [uint256] _weight
     */
    function updateShareholder(uint256 _accountIndex, uint256 _weight) external onlyOwner {
        uint256 _totalWeights = totalWeights;
        _totalWeights -= shareholders[_accountIndex].weight;
        shareholders[_accountIndex].weight = _weight;
        _totalWeights += _weight;
        require(_totalWeights > 0, "FeeSplitter: TOTAL_WEIGHTS_ZERO");
        totalWeights = _totalWeights;
    }

    /**
     * @dev finds a shareholder and return its index
     * @param _account [address] account to find
     * @return the shareholder index in the storage array
     */
    function findShareholder(address _account) external view returns (uint256) {
        for (uint256 i = 0; i < shareholders.length; i++) {
            if (shareholders[i].account == _account) return i;
        }
        revert("FeeSplitter: NOT_FOUND");
    }

    function _addShareholder(address _account, uint256 _weight) private {
        require(_weight > 0, "FeeSplitter: ZERO_WEIGHT");
        shareholders.push(Shareholder(_account, _weight));
        totalWeights += _weight;
    }

    /**
     * @dev sets the weight assigned to the royalties part for the fee
     * @param _weight [uint256] the new royalties weight
     */
    function setRoyaltiesWeight(uint256 _weight) public onlyOwner {
        totalWeights -= royaltiesWeight;
        royaltiesWeight = _weight;
        totalWeights += _weight;
    }
}
