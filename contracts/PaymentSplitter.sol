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
    event PaymentReleased(address to, uint256 amount);
    event PaymentReceived(address from, uint256 amount);

    struct Shareholder {
        address account;
        uint256 weight;
    }

    Shareholder[] private _shareholders;

    uint256 private _totalShares;
    uint256 private _totalReleased;
    uint256 private _royaltiesWeight;
    uint256 private _totalWeights;

    mapping(address => uint256) private _shares;
    mapping(address => uint256) private _released;

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
     * @return the total shares count
     */
    function totalShares() public view returns (uint256) {
        return _totalShares;
    }

    /**
     * @dev Getter for the total amount of Ether already released.
     * @return the total amount release to shareholders
     */
    function totalReleased() public view returns (uint256) {
        return _totalReleased;
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
     * @return the shares owned by the account
     */
    function shares(address account) public view returns (uint256) {
        return _shares[account];
    }

    /**
     * @dev Getter for the amount of Ether already released to a shareholders.
     * @param account [address] the target account for this request
     * @return the amount already released to this account
     */
    function released(address account) public view returns (uint256) {
        return _released[account];
    }

    /**
     * @dev Sends a fee to this contract for splitting, as an ERC20 token
     * @param amount [uint256] amount of token as fee to be claimed by this contract
     * @param royaltiesTarget [address] an account that can claim some of the fees
     * @param token [address] currency for the fee as an ERC20 token
     */
    function sendFeeToken(
        uint256 amount,
        address royaltiesTarget,
        address token
    ) external {
        require(false, "PaymentSplitter: NOT_IMPLEMENTED");
        IERC20(token).transferFrom(msg.sender, address(royaltiesTarget), amount);
    }

    /**
     * @dev Sends an ETH fee to this contract. Allocates shares to shareholders and royalties target
     * corresponding to their weights
     * @param royaltiesTarget [address] account that can claim some of the fees
     */
    function sendFees(address royaltiesTarget) external payable {
        uint256 amount = msg.value;
        uint256 totalUsedWeights = _totalWeights;
        if (royaltiesTarget != address(0)) {
            _addShares(royaltiesTarget, _computeShareCount(amount, _royaltiesWeight, _totalWeights));
        } else totalUsedWeights -= _royaltiesWeight;

        for (uint256 i = 0; i < _shareholders.length; i++) {
            _addShares(_shareholders[i].account, _computeShareCount(amount, _shareholders[i].weight, totalUsedWeights));
        }
        emit PaymentReceived(msg.sender, msg.value);
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
        uint256 totalReceived = address(this).balance + _totalReleased;
        uint256 payment = (totalReceived * _shares[account]) / _totalShares - _released[account];
        require(payment != 0, "PaymentSplitter: ACCOUNT_NOT_DUE_PAYMENT");

        _released[account] = _released[account] + payment;
        _totalReleased = _totalReleased + payment;

        Address.sendValue(account, payment);
        emit PaymentReleased(account, payment);
    }

    function _addShares(address account, uint256 shares_) private {
        _shares[account] += shares_;
        _totalShares = _totalShares + shares_;
    }

    /**
     * @dev sets a new list of shareholders describing how to split fees
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
