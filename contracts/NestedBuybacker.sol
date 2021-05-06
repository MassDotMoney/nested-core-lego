//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.3;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "contracts/interfaces/INestedToken.sol";
import "contracts/interfaces/IFeeSplitter.sol";

// import "hardhat/console.sol";

/**
 * Token and ETH sent to this contract are used to purchase NST.
 * some of it is burned, the rest is sent to the Nested reserve contract
 * (community reserve, not user assets reserve)
 */
contract NestedBuybacker is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    INestedToken public immutable NST;
    address public nstReserve;
    IFeeSplitter public feeSplitter;

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
        address _feeSplitter,
        uint256 _burnPercentage
    ) {
        require(burnPercentage <= 1000, "NestedBuybacker: BURN_PART_TOO_HIGH");
        NST = INestedToken(_NST);
        feeSplitter = IFeeSplitter(_feeSplitter);
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
     * @dev update the fee splitter address
     * @param _feeSplitter [address] fee splitter contract address
     */
    function setFeeSplitter(IFeeSplitter _feeSplitter) public onlyOwner {
        feeSplitter = _feeSplitter;
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
        IERC20 _sellToken
    ) external nonReentrant {
        if (feeSplitter.getAmountDue(address(this), _sellToken) > 0) claimFees(_sellToken);

        uint256 balance = _sellToken.balanceOf(address(this));
        _sellToken.approve(_swapTarget, balance);
        _swapTokens(_sellToken, _swapTarget, _swapCallData);
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

    /**
     * @dev claim awarded fees from the FeeSplitter contract
     * @param _token [IERC20] token address for the fees
     */
    function claimFees(IERC20 _token) public {
        feeSplitter.releaseToken(_token);
    }

    /*
    Purchase a token
    @param _sellToken [address] token used to make swaps
    @param _swapTarget [address] the address of the contract that will swap tokens
    @param _swapCallData [bytes] call data provided by 0x to fill the quote
    */
    function _swapTokens(
        IERC20 _sellToken,
        address payable _swapTarget,
        bytes calldata _swapCallData
    ) internal {
        if (_sellToken.allowance(address(this), _swapTarget) < type(uint256).max) {
            _sellToken.approve(_swapTarget, type(uint256).max);
        }

        // solhint-disable-next-line avoid-low-level-calls
        (bool success, ) = _swapTarget.call(_swapCallData);
        require(success, "SWAP_CALL_FAILED");
    }

    function _burnNST(uint256 _amount) private {
        NST.burn(_amount);
    }
}
