//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.3;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "contracts/interfaces/INestedToken.sol";

// import "hardhat/console.sol";

/**
 * Token and ETH sent to this contract are used to purchase NST.
 * some of it is burned, the rest is sent to the Nested reserve contract
 * (community reserve, not user assets reserve)
 */
contract NestedBuybacker is Ownable, ReentrancyGuard {
    INestedToken public immutable NST;
    address public nstReserve;

    // part of the bought tokens to be burned
    uint256 public burnPercentage;

    /**
     * @param _NST [address] address for the Nested project token
     * @param _nstReserve [address] contract where user assets are stored
     * @param _burnPercentage [uint] burn part 100% = 1000
     */
    constructor(
        address _NST,
        address _nstReserve,
        uint256 _burnPercentage
    ) {
        require(burnPercentage <= 1000, "NestedBuybacker: BURN_PART_TOO_HIGH");
        NST = INestedToken(_NST);
        setNestedReserve(_nstReserve);
        burnPercentage = _burnPercentage;
    }

    /**
     * @dev update the nested reserve address
     * @param _nstReserve [address] reserve contract address
     */
    function setNestedReserve(address _nstReserve) public onlyOwner {
        nstReserve = _nstReserve;
    }

    /**
     * @dev update parts deciding what amount is sent to reserve or burned
     * @param _burnPercentage [uint] burn part
     */
    function setBurnPart(uint256 _burnPercentage) public onlyOwner {
        burnPercentage = _burnPercentage;
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
    ) external nonReentrant {
        _swapTokens(_sellToken, _swapTarget, _swapCallData);
        trigger();
    }

    /**
     * @dev pay ETH to this function and trigger the buybacks
     * @param _swapCallData call data provided by 0x to fill quotes
     * @param _swapTarget [address] contract to interact with for the swap
     */
    function triggerForETH(bytes calldata _swapCallData, address payable _swapTarget) external payable nonReentrant {
        swapFromETH(address(this).balance, _swapTarget, _swapCallData);
        trigger();
    }

    /**
     * @dev burns part of the bought NST and send the rest to the reserve
     */
    function trigger() internal {
        uint256 balance = NST.balanceOf(address(this));
        uint256 toBurn = (balance * burnPercentage) / 1000;
        uint256 toSendToReserve = balance - toBurn;
        _burnNST(toBurn);
        NST.transfer(nstReserve, toSendToReserve);
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

    function _burnNST(uint256 _amount) private {
        NST.burn(_amount);
    }
}
