//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "contracts/interfaces/INestedToken.sol";
import "contracts/FeeSplitter.sol";
import "contracts/libraries/ExchangeHelpers.sol";

/**
 * @title Token sent to this contract are used to purchase NST.
 * Some of it is burned, the rest is sent to a pool that will redistribute
 * to the NST ecosystem and community
 */
contract NestedBuybacker is Ownable {
    using SafeERC20 for IERC20;

    INestedToken public immutable NST;
    address public nstReserve;
    FeeSplitter public feeSplitter;

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
        address payable _feeSplitter,
        uint256 _burnPercentage
    ) {
        require(_burnPercentage <= 1000, "NestedBuybacker: BURN_PART_TOO_HIGH");
        NST = INestedToken(_NST);
        feeSplitter = FeeSplitter(_feeSplitter);
        nstReserve = _nstReserve;
        burnPercentage = _burnPercentage;
    }

    /**
     * @dev update the nested reserve address
     * @param _nstReserve [address] reserve contract address
     */
    function setNestedReserve(address _nstReserve) external onlyOwner {
        nstReserve = _nstReserve;
    }

    /**
     * @dev update the fee splitter address
     * @param _feeSplitter [address] fee splitter contract address
     */
    function setFeeSplitter(FeeSplitter _feeSplitter) public onlyOwner {
        feeSplitter = _feeSplitter;
    }

    /**
     * @dev update parts deciding what amount is sent to reserve or burned
     * @param _burnPercentage [uint] burn part
     */
    function setBurnPart(uint256 _burnPercentage) external onlyOwner {
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
    ) external onlyOwner {
        if (feeSplitter.getAmountDue(address(this), _sellToken) > 0) claimFees(_sellToken);

        uint256 balance = _sellToken.balanceOf(address(this));
        _sellToken.approve(_swapTarget, balance);
        ExchangeHelpers.fillQuote(_sellToken, _swapTarget, _swapCallData);
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

    function _burnNST(uint256 _amount) private {
        NST.burn(_amount);
    }
}
