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

    Shareholder[] private shareholders;

    // fake ETH address used to treat tokens and ETH the same way
    address private constant ETH_ADDR = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    // registers shares and amount release for a specific token or ETH
    struct TokenRecords {
        uint256 totalShares;
        uint256 totalReleased;
        mapping(address => uint256) shares;
        mapping(address => uint256) released;
    }
    mapping(address => TokenRecords) private tokenRecords;

    uint256 private royaltiesWeight;
    uint256 private totalWeights;

    /**
     * @param _accounts [address[]] inital shareholders addresses that can receive income
     * @param _weights [uint256[]] initial weights for these shareholders. Weight determines share allocation
     * @param _royaltiesWeight [uint256] royalties part weights when applicable
     */
    constructor(
        address[] memory _accounts,
        uint256[] memory _weights,
        uint256 _royaltiesWeight
    ) {
        setShareholders(_accounts, _weights);
        setRoyaltiesWeight(_royaltiesWeight);
    }

    receive() external payable {
        revert("Call sendFees() instead");
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
     * @dev Getter for the total amount of Ether already released.
     * @return the total amount release to shareholders
     */
    function getRoyaltiesWeight() public view returns (uint256) {
        return royaltiesWeight;
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
     * @dev Sends an ETH fee to this contract. Allocates shares to shareholders and royalties target
     * corresponding to their weights
     * @param _royaltiesTarget [address] account that can claim some of the fees
     */
    function sendFees(address _royaltiesTarget) external payable {
        sendFeesToken(_royaltiesTarget, msg.value, ETH_ADDR);
    }

    /**
     * @dev Sends a fee to this contract for splitting, as an ERC20 token
     * @param _amount [uint256] amount of token as fee to be claimed by this contract
     * @param _royaltiesTarget [address] an account that can claim some royalties
     * @param _token [address] currency for the fee as an ERC20 token
     */
    function sendFeesToken(
        address _royaltiesTarget,
        uint256 _amount,
        address _token
    ) public {
        if (_token != ETH_ADDR) IERC20(_token).transferFrom(msg.sender, address(this), _amount);

        uint256 tradeTotalWeights = totalWeights;

        if (_royaltiesTarget != address(0)) {
            _addShares(_royaltiesTarget, _computeShareCount(_amount, royaltiesWeight, totalWeights), _token);
        } else {
            // no need to count the weight for the royalties recipient if there's no recipient
            tradeTotalWeights -= royaltiesWeight;
        }

        for (uint256 i = 0; i < shareholders.length; i++) {
            _addShares(
                shareholders[i].account,
                _computeShareCount(_amount, shareholders[i].weight, tradeTotalWeights),
                _token
            );
        }
        emit PaymentReceived(msg.sender, _token, _amount);
    }

    function _computeShareCount(
        uint256 _amount,
        uint256 _weight,
        uint256 _totalWeights
    ) private pure returns (uint256) {
        return (_amount * _weight) / _totalWeights;
    }

    /**
     * @dev Triggers a transfer to `account` of the amount of Ether they are owed, according to
     * their percentage of the total shares and their previous withdrawals.
     * @param _account [address] account to send the amount due to
     */
    function release(address payable _account) external {
        TokenRecords storage _tokenRecords = tokenRecords[ETH_ADDR];
        uint256 payment = getAmountDue(_account, ETH_ADDR);

        _tokenRecords.released[_account] = _tokenRecords.released[_account] + payment;
        _tokenRecords.totalReleased = _tokenRecords.totalReleased + payment;

        require(payment != 0, "PaymentSplitter: NO_PAYMENT_DUE");
        Address.sendValue(_account, payment);
        emit PaymentReleased(_account, ETH_ADDR, payment);
    }

    /**
     * @dev Triggers a transfer to `account` of the amount of Ether they are owed, according to
     * their percentage of the total shares and their previous withdrawals.
     * @param _account [address] account to send the amount due to
     * @param _token [address] payment token address
     */
    function releaseToken(address _account, address _token) external {
        TokenRecords storage _tokenRecords = tokenRecords[_token];
        uint256 payment = getAmountDue(_account, _token);

        _tokenRecords.released[_account] = _tokenRecords.released[_account] + payment;
        _tokenRecords.totalReleased = _tokenRecords.totalReleased + payment;

        require(payment != 0, "PaymentSplitter: NO_PAYMENT_DUE");
        IERC20(_token).transfer(_account, payment);
        emit PaymentReleased(_account, _token, payment);
    }

    /**
     * @dev Returns the amount due to an account. Call releaseToken to withdraw the amount.
     * @param _account [address] account address to check the amount due for
     * @param _token [address] ERC20 payment token address (or ETH_ADDR)
     * @return the total amount due for the requested currency
     */
    function getAmountDue(address _account, address _token) public view returns (uint256) {
        TokenRecords storage _tokenRecords = tokenRecords[_token];
        uint256 totalReceived = _tokenRecords.totalReleased;
        if (_token == ETH_ADDR) totalReceived += address(this).balance;
        else totalReceived += IERC20(_token).balanceOf(address(this));
        uint256 payment =
            (totalReceived * _tokenRecords.shares[_account]) /
                _tokenRecords.totalShares -
                _tokenRecords.released[_account];
        return payment;
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
     * @param _weights [address[]] weight for each shareholder. Determines part of the payment allocated to them
     */
    function setShareholders(address[] memory _accounts, uint256[] memory _weights) public onlyOwner {
        delete shareholders;
        require(_accounts.length > 0 && _accounts.length == _weights.length, "PaymentSplitter: ARRAY_LENGTHS_ERR");

        for (uint256 i = 0; i < _accounts.length; i++) {
            _addShareholder(_accounts[i], _weights[i]);
        }
    }

    function _addShareholder(address _account, uint256 _weight) private {
        require(_weight > 0, "PaymentSplitter: ZERO_WEIGHT");
        shareholders.push(Shareholder(_account, _weight));
        totalWeights += _weight;
    }

    /**
     * @dev sets the weight assigned to the royalties part for the fee
     * @param _weight [uint256] the new royalties weight
     */
    function setRoyaltiesWeight(uint256 _weight) public onlyOwner {
        royaltiesWeight = _weight;
        totalWeights += _weight;
    }
}
