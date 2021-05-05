// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Receives fees collected by the NestedFactory, and splits the income among
 * shareholders (the NFT owners, Nested treasury and a NST buybacker contract).
 */
interface IFeeSplitter {
    event PaymentReleased(address to, address token, uint256 amount);
    event PaymentReceived(address from, address token, uint256 amount);

    /**
     * @dev Getter for the total shares held by shareholders.
     * @param _token [address] payment token address, use ETH_ADDR for ETH
     * @return the total shares count
     */
    function totalShares(address _token) external view returns (uint256);

    /**
     * @dev Getter for the total amount of token already released.
     * @param _token [address] payment token address, use ETH_ADDR for ETH
     * @return the total amount release to shareholders
     */
    function totalReleased(address _token) external view returns (uint256);

    /**
     * @dev Getter for the total amount of Ether already released.
     * @return the total amount release to shareholders
     */
    function getRoyaltiesWeight() external view returns (uint256);

    /**
     * @dev Getter for the amount of shares held by an account.
     * @param _account [address] account the shares belong to
     * @param _token [address] payment token address, use ETH_ADDR for ETH
     * @return the shares owned by the account
     */
    function shares(address _account, address _token) external view returns (uint256);

    /**
     * @dev Getter for the amount of Ether already released to a shareholders.
     * @param _account [address] the target account for this request
     * @param _token [address] payment token address, use ETH_ADDR for ETH
     * @return the amount already released to this account
     */
    function released(address _account, address _token) external view returns (uint256);

    /**
     * @dev Sends a fee to this contract for splitting, as an ERC20 token
     * @param _amount [uint256] amount of token as fee to be claimed by this contract
     * @param _royaltiesTarget [address] the account that can claim royalties
     * @param _token [IERC20] currency for the fee as an ERC20 token
     */
    function sendFeesToken(
        address _royaltiesTarget,
        uint256 _amount,
        IERC20 _token
    ) external;

    /**
     * @dev Triggers a transfer to `account` of the amount of Ether they are owed, according to
     * the amount of shares they own and their previous withdrawals.
     * @param _account [address] account to send the amount due to
     * @param _token [address] payment token address
     */
    function releaseToken(address _account, address _token) external;

    /**
     * @dev Returns the amount due to an account. Call releaseToken to withdraw the amount.
     * @param _account [address] account address to check the amount due for
     * @param _token [address] ERC20 payment token address (or ETH_ADDR)
     * @return the total amount due for the requested currency
     */
    function getAmountDue(address _account, address _token) external view returns (uint256);

    /**
     * @dev sets a new list of shareholders
     * @param _accounts [address[]] shareholders accounts list
     * @param _weights [uint256[]] weight for each shareholder. Determines part of the payment allocated to them
     */
    function setShareholders(address[] memory _accounts, uint256[] memory _weights) external;

    /**
     * @dev updates weight for a shareholder
     * @param _accountIndex [uint256] account to change the weight of
     * @param _weight [uint256] _weight
     */
    function updateShareholder(uint256 _accountIndex, uint256 _weight) external;

    /**
     * @dev finds a shareholder and return its index
     * @param _account [address] account to find
     * @return the shareholder index in the storage array
     */
    function findShareholder(address _account) external view returns (uint256);

    /**
     * @dev sets the weight assigned to the royalties part for the fee
     * @param _weight [uint256] the new royalties weight
     */
    function setRoyaltiesWeight(uint256 _weight) external;
}
