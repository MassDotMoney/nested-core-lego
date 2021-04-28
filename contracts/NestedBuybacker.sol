//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.3;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "contracts/interfaces/INestedToken.sol";

// import "hardhat/console.sol";

/**
 * Token and ETH sent to this contract are used to purchase NST.
 * 25% of it is  burned.
 * 75% is sent to the Nested reserve contract
 */
contract NestedBuybacker is Ownable {
    INestedToken public immutable _NST;
    address public _nestedReserve;

    /**
     * @param NST [address] address for the Nested project token
     * @param nestedReserve [address] contract where user assets are stored
     */
    constructor(address NST, address nestedReserve) {
        _NST = INestedToken(NST);
        setNestedReserve(nestedReserve);
    }

    /**
     * @dev update the nested reserve address
     * @param nestedReserve [address] reserve contract address
     */
    function setNestedReserve(address nestedReserve) public onlyOwner {
        _nestedReserve = nestedReserve;
    }

    /**
     * @dev triggers the purchase of NST sent to reserve and burn
     * @param _swapCallData call data provided by 0x to fill quotes
     * @param _swapTarget target contract for the swap (could be Uniswap router for example)
     * @param _sellToken [address] token to sell in order to buy NST
     */
    function triggerForToken(
        bytes calldata _swapCallData,
        address payable _swapTarget,
        address _sellToken
    ) external {
        _swapTokens(_sellToken, _swapTarget, _swapCallData);
        trigger();
    }

    /**
     * @dev pay ETH to this function and trigger the buybacks
     * @param _swapCallData call data provided by 0x to fill quotes
     * @param _swapTarget [address] contract to interact with for the swap
     */
    function triggerForETH(bytes calldata _swapCallData, address payable _swapTarget) external payable {
        swapFromETH(address(this).balance, _swapTarget, _swapCallData);
        trigger();
    }

    /**
     * @dev burns 25% of the bought NST and send the rest to the reserve
     */
    function trigger() internal {
        uint256 balance = _NST.balanceOf(address(this));
        _burnNST(balance / 4); // let's burn 25% of our NST
        balance = _NST.balanceOf(address(this));
        _NST.transfer(_nestedReserve, balance);
    }

    /*
    Purchase a token
    @param _sellToken [address] token used to make swaps
    @param _swapTarget [address] the address of the contract that will swap tokens
    @param _swapCallData [bytes] call data provided by 0x to fill the quote
    */
    function _swapTokens(
        address _sellToken,
        address payable _swapTarget,
        bytes calldata _swapCallData
    ) internal {
        // Note that for some tokens (e.g., USDT, KNC), you must first reset any existing
        // allowance to 0 before being able to update it.
        require(IERC20(_sellToken).approve(_swapTarget, type(uint256).max), "ALLOWANCE_SETTER_ERROR");

        // solhint-disable-next-line avoid-low-level-calls
        (bool success, ) = _swapTarget.call(_swapCallData);
        require(success, "SWAP_CALL_FAILED");
    }

    /*
    Purchase token with ETH
    @param _sellAmount [uint256] token used to make swaps
    @param _swapTarget [address] the address of the contract that will swap tokens
    @param _swapCallData [bytes] call data provided by 0x to fill the quote
    */
    function swapFromETH(
        uint256 _sellAmount,
        address payable _swapTarget,
        bytes calldata _swapCallData
    ) internal {
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, ) = _swapTarget.call{ value: _sellAmount }(_swapCallData);
        require(success, "SWAP_CALL_FAILED");
    }

    function _burnNST(uint256 amount) private {
        _NST.burn(amount);
    }
}
