// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.11;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./interfaces/external/INestedToken.sol";
import "./FeeSplitter.sol";
import "./libraries/ExchangeHelpers.sol";

/// @title Token sent to this contract are used to purchase NST.
/// @dev Some of it is burned, the rest is sent to a pool that will redistribute
///      to the NST ecosystem and community.
contract NestedBuybacker is Ownable {
    using SafeERC20 for INestedToken;

    /// @dev Emitted when the reserve address is updated
    /// @param newReserve The new reserve address
    event ReserveUpdated(address newReserve);

    /// @dev Emitted when the fee splitter address is updated
    /// @param newFeeSplitter The new FeeSplitter address
    event FeeSplitterUpdated(FeeSplitter newFeeSplitter);

    /// @dev Emitted when the burn percentage is updated
    /// @param newBurnPart The new burn percentage amount
    event BurnPartUpdated(uint256 newBurnPart);

    /// @dev Emitted when the buy back is executed
    /// @param forToken sellToken used for the buy back
    event BuybackTriggered(IERC20 forToken);

    /// @dev The Nested project token
    INestedToken public immutable NST;

    /// @dev Current address where user assets are stored
    address public nstReserve;

    /// @dev Current fee splitter address
    FeeSplitter public feeSplitter;

    /// @dev Part of the bought tokens to be burned (100% = 1000)
    uint256 public burnPercentage;

    receive() external payable {}

    constructor(
        address _NST,
        address _nstReserve,
        address payable _feeSplitter,
        uint256 _burnPercentage
    ) {
        require(_burnPercentage <= 1000, "NB: INVALID_BURN_PART");
        require(_NST != address(0) && _nstReserve != address(0) && _feeSplitter != address(0), "NB: INVALID_ADDRESS");
        burnPercentage = _burnPercentage;
        NST = INestedToken(_NST);
        feeSplitter = FeeSplitter(_feeSplitter);
        nstReserve = _nstReserve;
    }

    /// @notice Update the nested reserve address
    /// @param _nstReserve New reserve contract address
    function setNestedReserve(address _nstReserve) external onlyOwner {
        require(_nstReserve != address(0), "NB: INVALID_ADDRESS");
        nstReserve = _nstReserve;
        emit ReserveUpdated(nstReserve);
    }

    /// @notice Update the fee splitter address
    /// @param _feeSplitter The new fee splitter contract address
    function setFeeSplitter(FeeSplitter _feeSplitter) external onlyOwner {
        require(address(_feeSplitter) != address(0), "NB: INVALID_ADDRESS");
        feeSplitter = _feeSplitter;
        emit FeeSplitterUpdated(feeSplitter);
    }

    /// @notice Update parts deciding what amount is sent to reserve or burned
    /// @param _burnPercentage The new burn percentage
    function setBurnPart(uint256 _burnPercentage) external onlyOwner {
        require(_burnPercentage <= 1000, "NB: INVALID_BURN_PART");
        burnPercentage = _burnPercentage;
        emit BurnPartUpdated(burnPercentage);
    }

    /// @notice Triggers the purchase of NST sent to reserve and burn
    /// @param _swapCallData Call data provided by 0x to fill quotes
    /// @param _swapTarget Target contract for the swap (could be Uniswap router for example)
    /// @param _sellToken Token to sell in order to buy NST
    function triggerForToken(
        bytes calldata _swapCallData,
        address payable _swapTarget,
        IERC20 _sellToken
    ) external onlyOwner {
        if (feeSplitter.getAmountDue(address(this), _sellToken) != 0) {
            IERC20[] memory tokens = new IERC20[](1);
            tokens[0] = _sellToken;
            feeSplitter.releaseTokensNoETH(tokens);
        }

        require(ExchangeHelpers.fillQuote(_sellToken, _swapTarget, _swapCallData), "NB : FAILED_SWAP");
        trigger();
        emit BuybackTriggered(_sellToken);
    }

    /// @dev burns part of the bought NST and send the rest to the reserve
    function trigger() internal {
        uint256 balance = NST.balanceOf(address(this));
        uint256 toBurn = (balance * burnPercentage) / 1000;
        uint256 toSendToReserve = balance - toBurn;
        NST.burn(toBurn);
        NST.safeTransfer(nstReserve, toSendToReserve);
    }
}
