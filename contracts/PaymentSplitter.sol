// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";

contract PaymentSplitter is ReentrancyGuard {
    event PayeeAdded(address account, uint256 shares);
    event PaymentReleased(address to, uint256 amount);
    event PaymentReceived(address from, uint256 amount);

    uint256 private _totalShares;
    uint256 private _totalReleased;

    mapping(address => uint256) private _shares;
    mapping(address => uint256) private _released;
    mapping(address => uint256) private _balances;
    address[] private _payees;
    uint256 public pendingRoyalties = 0;

    constructor(address[] memory initialPayees, uint256[] memory initialShares) {
        require(initialPayees.length == initialShares.length, "PaymentSplitter: ARRAY_LENGTHS_MISMATCH");

        for (uint256 i = 0; i < initialPayees.length; i++) {
            _shares[initialPayees[i]] = initialShares[i];
            _payees.push(initialPayees[i]);
            _totalShares += initialShares[i];
        }
    }

    receive() external payable {
        revert("Call sendFees() instead");
    }

    /**
     * @dev Getter for the total shares held by payees.
     */
    function totalShares() public view returns (uint256) {
        return _totalShares;
    }

    /**
     * @dev Getter for the total amount of Ether already released.
     */
    function totalReleased() public view returns (uint256) {
        return _totalReleased;
    }

    /**
     * @dev Getter for the amount of shares held by an account.
     */
    function shares(address account) public view returns (uint256) {
        return _shares[account];
    }

    /**
     * @dev Getter for the amount of Ether already released to a payee.
     */
    function released(address account) public view returns (uint256) {
        return _released[account];
    }

    /**
     * @dev Getter for the address of the payee number `index`.
     */
    function payee(uint256 index) public view returns (address) {
        return _payees[index];
    }

    /**
    Sends a fee to this contract for splitting, as an ERC20 token
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
    Sends an ETH fee to this contract
    */
    function sendFees(address royaltiesTarget) external payable {
        if (royaltiesTarget != address(0)) {
            // 20% fee for NFT owner
            assignRoyalties(msg.value / 5, royaltiesTarget);
        }
        emit PaymentReceived(msg.sender, msg.value);
    }

    /**
    Assigns royalties to the NFT owner
    */
    function assignRoyalties(uint256 fee, address royaltiesTarget) private returns (uint256) {
        _balances[royaltiesTarget] += fee;
        pendingRoyalties += fee;
        return fee;
    }

    /**
    As a royalties receipient, claim all pending ETH collected from fees
    */
    function claim() external nonReentrant {
        Address.sendValue(payable(msg.sender), _balances[msg.sender]);
        pendingRoyalties -= _balances[msg.sender];
        _balances[msg.sender] = 0;
    }

    /**
     * @dev Triggers a transfer to `account` of the amount of Ether they are owed, according to their percentage of the
     * total shares and their previous withdrawals.
     */
    function release(address payable account) external {
        uint256 totalReceived = address(this).balance + _totalReleased;
        uint256 payment = ((totalReceived - pendingRoyalties) * _shares[account]) / _totalShares - _released[account];
        require(payment != 0, "PaymentSplitter: ACCOUNT_NOT_DUE_PAYMENT");

        _released[account] = _released[account] + payment;
        _totalReleased = _totalReleased + payment;

        Address.sendValue(account, payment);
        emit PaymentReleased(account, payment);
    }

    /**
     * @dev Add a new payee to the contract.
     * @param account The address of the payee to add.
     * @param shares_ The number of shares owned by the payee.
     */
    function _addPayee(address account, uint256 shares_) private {
        require(account != address(0), "PaymentSplitter: account is the zero address");
        require(shares_ > 0, "PaymentSplitter: shares are 0");
        require(_shares[account] == 0, "PaymentSplitter: account already has shares");

        _payees.push(account);
        _shares[account] = shares_;
        _totalShares = _totalShares + shares_;
        emit PayeeAdded(account, shares_);
    }
}
