// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

/**
 * @title Receives fees collected by the NestedFactory, and splits the income among
 * shareholders (the NFT owners, Nested treasury and a NST buybacker contract).
 */
contract PaymentSplitter is ReentrancyGuard, Ownable {
    event PaymentReleased(address to, address token, uint256 amount);
    event PaymentReceived(address from, address token, uint256 amount);

    struct Shareholder {
        address account;
        uint256 weight;
    }

    Shareholder[] private _shareholders;

    // fake ETH address used to treat tokens and ETH the same way
    address private constant ETH_ADDR = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    // registers shares and amount release for a specific token or ETH
    struct TokenRecords {
        uint256 _totalShares;
        uint256 _totalReleased;
        mapping(address => uint256) _shares;
        mapping(address => uint256) _released;
    }
    mapping(address => TokenRecords) private _tokenRecords;

    uint256 private _royaltiesWeight;
    uint256 private _totalWeights;

    /**
     * @param accounts [address[]] inital shareholders addresses that can receive income
     * @param weights [uint256[]] initial weights for these shareholders. Weight determines share allocation
     * @param royaltiesWeight_ [uint256] royalties part weights when applicable
     */
    constructor(
        address[] memory accounts,
        uint256[] memory weights,
        uint256 royaltiesWeight_
    ) {
        setShareholders(accounts, weights);
        setRoyaltiesWeight(royaltiesWeight_);
    }

    receive() external payable {
        revert("Call sendFees() instead");
    }

    /**
     * @dev Getter for the total shares held by shareholders.
     * @param token [address] payment token address, use ETH_ADDR for ETH
     * @return the total shares count
     */
    function totalShares(address token) public view returns (uint256) {
        return _tokenRecords[token]._totalShares;
    }

    /**
     * @dev Getter for the total amount of token already released.
     * @param token [address] payment token address, use ETH_ADDR for ETH
     * @return the total amount release to shareholders
     */
    function totalReleased(address token) public view returns (uint256) {
        return _tokenRecords[token]._totalReleased;
    }

    /**
     * @dev Getter for the total amount of Ether already released.
     * @return the total amount release to shareholders
     */
    function royaltiesWeight() public view returns (uint256) {
        return _royaltiesWeight;
    }

    /**
     * @dev Getter for the amount of shares held by an account.
     * @param account [address] account the shares belong to
     * @param token [address] payment token address, use ETH_ADDR for ETH
     * @return the shares owned by the account
     */
    function shares(address account, address token) public view returns (uint256) {
        return _tokenRecords[token]._shares[account];
    }

    /**
     * @dev Getter for the amount of Ether already released to a shareholders.
     * @param account [address] the target account for this request
     * @param token [address] payment token address, use ETH_ADDR for ETH
     * @return the amount already released to this account
     */
    function released(address account, address token) public view returns (uint256) {
        return _tokenRecords[token]._released[account];
    }

    /**
     * @dev Sends an ETH fee to this contract. Allocates shares to shareholders and royalties target
     * corresponding to their weights
     * @param royaltiesTarget [address] account that can claim some of the fees
     */
    function sendFees(address royaltiesTarget) external payable {
        sendFeesToken(royaltiesTarget, msg.value, ETH_ADDR);
    }

    /**
     * @dev Sends a fee to this contract for splitting, as an ERC20 token
     * @param amount [uint256] amount of token as fee to be claimed by this contract
     * @param royaltiesTarget [address] an account that can claim some royalties
     * @param token [address] currency for the fee as an ERC20 token
     */
    function sendFeesToken(
        address royaltiesTarget,
        uint256 amount,
        address token
    ) public {
        if (token != ETH_ADDR) IERC20(token).transferFrom(msg.sender, address(this), amount);

        uint256 tradeTotalWeights = _totalWeights;

        if (royaltiesTarget != address(0)) {
            _addShares(royaltiesTarget, _computeShareCount(amount, _royaltiesWeight, _totalWeights), token);
        } else {
            // no need to count the weight for the royalties recipient if there's no recipient
            tradeTotalWeights -= _royaltiesWeight;
        }

        for (uint256 i = 0; i < _shareholders.length; i++) {
            _addShares(
                _shareholders[i].account,
                _computeShareCount(amount, _shareholders[i].weight, tradeTotalWeights),
                token
            );
        }
        emit PaymentReceived(msg.sender, token, amount);
    }

    function _computeShareCount(
        uint256 amount,
        uint256 weight,
        uint256 totalWeights
    ) private pure returns (uint256) {
        return (amount * weight) / totalWeights;
    }

    /**
     * @dev Triggers a transfer to `account` of the amount of Ether they are owed, according to
     * their percentage of the total shares and their previous withdrawals.
     * @param account [address] account to send the amount due to
     */
    function release(address payable account) external {
        TokenRecords storage tokenRecords = _tokenRecords[ETH_ADDR];
        uint256 payment = getAmountDue(account, ETH_ADDR);

        tokenRecords._released[account] = tokenRecords._released[account] + payment;
        tokenRecords._totalReleased = tokenRecords._totalReleased + payment;

        require(payment != 0, "PaymentSplitter: NO_PAYMENT_DUE");
        Address.sendValue(account, payment);
        emit PaymentReleased(account, ETH_ADDR, payment);
    }

    /**
     * @dev Triggers a transfer to `account` of the amount of Ether they are owed, according to
     * their percentage of the total shares and their previous withdrawals.
     * @param account [address] account to send the amount due to
     * @param token [address] payment token address
     */
    function releaseToken(address account, address token) external {
        TokenRecords storage tokenRecords = _tokenRecords[token];
        uint256 payment = getAmountDue(account, token);

        tokenRecords._released[account] = tokenRecords._released[account] + payment;
        tokenRecords._totalReleased = tokenRecords._totalReleased + payment;

        require(payment != 0, "PaymentSplitter: NO_PAYMENT_DUE");
        IERC20(token).transfer(account, payment);
        emit PaymentReleased(account, token, payment);
    }

    /**
     * @dev Returns the amount due to an account. Call releaseToken to withdraw the amount.
     * @param account [address] account address to check the amount due for
     * @param token [address] ERC20 payment token address (or ETH_ADDR)
     * @return the total amount due for the requested currency
     */
    function getAmountDue(address account, address token) public view returns (uint256) {
        TokenRecords storage tokenRecords = _tokenRecords[token];
        uint256 totalReceived = tokenRecords._totalReleased;
        if (token == ETH_ADDR) totalReceived += address(this).balance;
        else totalReceived += IERC20(token).balanceOf(address(this));
        uint256 payment =
            (totalReceived * tokenRecords._shares[account]) /
                tokenRecords._totalShares -
                tokenRecords._released[account];
        return payment;
    }

    function _addShares(
        address account,
        uint256 shares_,
        address token
    ) private {
        TokenRecords storage tokenRecords = _tokenRecords[token];
        tokenRecords._shares[account] += shares_;
        tokenRecords._totalShares = tokenRecords._totalShares + shares_;
    }

    /**
     * @dev sets a new list of shareholders
     * @param accounts [address[]] shareholders accounts list
     * @param weights [address[]] weight for each shareholder. Determines part of the payment allocated to them
     */
    function setShareholders(address[] memory accounts, uint256[] memory weights) public onlyOwner {
        delete _shareholders;
        require(accounts.length > 0 && accounts.length == weights.length, "PaymentSplitter: ARRAY_LENGTHS_ERR");

        for (uint256 i = 0; i < accounts.length; i++) {
            _addShareholder(accounts[i], weights[i]);
        }
    }

    function _addShareholder(address account, uint256 weight) private {
        require(weight > 0, "PaymentSplitter: ZERO_WEIGHT");
        _shareholders.push(Shareholder(account, weight));
        _totalWeights += weight;
    }

    /**
     * @dev sets the weight assigned to the royalties part for the fee
     * @param weight [uint256] the new royalties weight
     */
    function setRoyaltiesWeight(uint256 weight) public onlyOwner {
        _royaltiesWeight = weight;
        _totalWeights += weight;
    }
}
