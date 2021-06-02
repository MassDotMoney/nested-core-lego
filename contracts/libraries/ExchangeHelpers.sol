//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "hardhat/console.sol";

/**
 * Helpers for swapping tokens
 */
library ExchangeHelpers {
    using SafeERC20 for IERC20;

    /*
    Perform a swap between two tokens
    @param _sellToken [IERC20] token to exchange
    @param _swapTarget [address] the address of the contract that swaps tokens
    @param _swapCallData [bytes] call data provided by 0x to fill the quote
    */
    function fillQuote(
        IERC20 _sellToken,
        address _swapTarget,
        bytes calldata _swapCallData
    ) internal returns (bool) {
        setMaxAllowance(_sellToken, _swapTarget);
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, ) = _swapTarget.call(_swapCallData);
        return success;
    }

    /**
     * @dev sets the allowance for a token to the maximum if it is not already at max
     * @param _token [IERC20] the token to use for the allowance setting
     * @param _spender [address] spender to allow
     */
    function setMaxAllowance(IERC20 _token, address _spender) internal {
        if (_token.allowance(address(this), _spender) != type(uint256).max) {
            _token.approve(_spender, type(uint256).max);
        }
    }

    function _getRevertMsg(bytes memory _returnData) internal pure returns (string memory) {
        // If the _res length is less than 68, then the transaction failed silently (without a revert message)
        if (_returnData.length < 68) return "Transaction reverted silently";

        assembly {
            // Slice the sighash.
            _returnData := add(_returnData, 0x04)
        }
        return abi.decode(_returnData, (string)); // All that remains is the revert string
    }
}
