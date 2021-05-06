//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.3;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

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
    ) internal {
        setMaxAllowance(_sellToken, _swapTarget);
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, ) = _swapTarget.call(_swapCallData);
        require(success, "SWAP_CALL_FAILED");
    }

    /**
     * @dev sets the allowance for a token to the maximum if it is not already at max
     * @param _token [IERC20] the token to use for the allowance setting
     * @param _spender [address] spender to allow
     */
    function setMaxAllowance(IERC20 _token, address _spender) internal {
        if (_token.allowance(msg.sender, _spender) == type(uint256).max) {
            return;
        }
        _token.approve(_spender, type(uint256).max);
    }
}
