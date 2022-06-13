// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.14;

import "./TokenTransferProxy.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Mock contract for the AugustusSwapper (Paraswap) using
/// the TokenTransferProxy for approval (dummyRouter equivalent).
contract AugustusSwapper {
    TokenTransferProxy public immutable proxy;

    constructor() {
        proxy = new TokenTransferProxy();
    }

    function dummyswapToken(
        address _inputToken,
        address _outputToken,
        uint256 _amount
    ) external {
        proxy.transferFrom(_inputToken, msg.sender, address(this), _amount);
        IERC20(_outputToken).transfer(msg.sender, _amount);
    }
}
