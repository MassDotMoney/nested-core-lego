//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title StakeDAO strategy interface
/// @dev token() and want() functions do the same things
///      TODO: chose one of these two function to use int the
///            Nested protocol
interface IStakeDaoStrategy {
    // In the BSC smart contract, you can get the LP token address by calling token()
    function token() external view returns (IERC20);

    // In the StakeDAO GitHub, token() dosen't exist, you can find want() instead
    function want() external view returns (IERC20);

    function deposit(uint256 _amount) external;

    function withdraw(uint256 _shares) external;
}
