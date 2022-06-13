// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.14;

import "./IStakingVault.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title StakeDAO strategy interface
/// @dev In the deployed code of StakeDAO, the token() function
///      allows to retrieve the LP token to stake.
///      Note : In the StakeDAO repository, this function has
///      been replaced by want().
interface IStakeDaoStrategy is IStakingVault {
    function token() external view returns (IERC20);
}
