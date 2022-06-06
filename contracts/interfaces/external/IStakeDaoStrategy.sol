// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title StakeDAO strategy interface
/// @dev In the deployed code of StakeDAO, it is the token() function
///      that allows to retrieve the LP token to stake, but in the StakeDAO
///      Github repository, this function has been replaced by want().
interface IStakeDaoStrategy {
    function token() external view returns (IERC20);

    function deposit(uint256 _amount) external;

    function withdraw(uint256 _shares) external;
}
