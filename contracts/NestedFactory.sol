//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "hardhat/console.sol";
import "./NestedAsset.sol";
import "./NestedReserve.sol";

// A partial WETH interface.
interface WETH is IERC20 {
    function deposit() external payable;

    function withdraw(uint256 amount) external;
}

contract NestedFactory {
    event NestedCreated(uint256 indexed tokenId, address indexed owner);

    address public feeTo;
    address public feeToSetter;
    address public reserve;

    NestedAsset public immutable nestedAsset;

    /*
    Represents custody from Nested over an asset
    */
    struct Holding {
        address token;
        uint256 amount;
        address reserve;
    }

    mapping(address => uint256[]) public usersTokenIds;
    mapping(uint256 => Holding[]) public usersHoldings;

    constructor(address _feeToSetter) {
        feeToSetter = _feeToSetter;
        feeTo = _feeToSetter;

        nestedAsset = new NestedAsset();
        // TODO: do this outside of constructor. Think about reserve architecture
        NestedReserve reserveContract = new NestedReserve();
        reserve = address(reserveContract);
    }

    modifier addressExists(address _address) {
        require(_address != address(0), "NestedFactory: invalid address");
        _;
    }

    /*
   Sets the address receiving the fees
   @param feeTo The address of the receiver
   */
    function setFeeTo(address _feeTo) external addressExists(_feeTo) {
        require(msg.sender == feeToSetter, "NestedFactory: FORBIDDEN");
        feeTo = _feeTo;
    }

    /*
    Sets the address that can redirect the fees to a new receiver
    @param _feeToSetter The address that decides where the fees go
    */
    function setFeeToSetter(address _feeToSetter) external addressExists(_feeToSetter) {
        require(msg.sender == feeToSetter, "NestedFactory: FORBIDDEN");
        feeToSetter = _feeToSetter;
    }

    /*
    Returns the list of NestedAsset ids owned by an address
    @params account [address] address
    @return [<uint256>] 
    */
    function tokensOf(address _address) public view virtual returns (uint256[] memory) {
        return usersTokenIds[_address];
    }

    /*
    Returns the holdings associated to a NestedAsset
    @params _tokenId [uint256] the id of the NestedAsset
    @return [<Holding>] 
    */
    function tokenHoldings(uint256 _tokenId) public view virtual returns (Holding[] memory) {
        return usersHoldings[_tokenId];
    }

    /*
    Fallback function
    */
    fallback() external payable {}

    /*
    Purchase and collect tokens for the user.
    Take custody of user's tokens against fees and issue an NFT in return.
    @param _sellToken [address] token used to make swaps
    @param _sellAmount [uint] value of sell tokens to exchange
    @param _swapTarget [address] the address of the contract that will swap tokens
    @param _tokensToBuy [<address>] the list of tokens to purchase
    @param _swapCallData [<bytes>] the list of call data provided by 0x to fill quotes
    */
    function create(
        address _sellToken,
        uint256 _sellAmount,
        address payable _swapTarget,
        address[] calldata _tokensToBuy,
        bytes[] calldata _swapCallData
    ) external payable {
        uint256 buyCount = _tokensToBuy.length;
        require(buyCount > 0, "BUY_ARG_MISSING");
        require(buyCount == _swapCallData.length, "BUY_ARG_ERROR");

        uint256 fees = (_sellAmount * 15) / 1000;

        require(
            ERC20(_sellToken).allowance(msg.sender, address(this)) > _sellAmount + fees,
            "USER_FUND_ALLOWANCE_ERROR"
        );
        uint256 sellTokenBalanceBeforeDeposit = ERC20(_sellToken).balanceOf(address(this));

        require(ERC20(_sellToken).transferFrom(msg.sender, address(this), _sellAmount), "USER_FUND_TRANSFER_ERROR");
        require(ERC20(_sellToken).transferFrom(msg.sender, feeTo, fees) == true, "FEE_TRANSFER_ERROR");

        uint256 sellTokenBalanceBeforePurchase = ERC20(_sellToken).balanceOf(address(this));

        uint256 tokenId = nestedAsset.mint(msg.sender);
        usersTokenIds[msg.sender].push(tokenId);

        for (uint256 i = 0; i < buyCount; i++) {
            uint256 buyTokenInitialBalance = ERC20(_tokensToBuy[i]).balanceOf(address(this));

            swapTokens(_sellToken, _swapTarget, _swapCallData[i]);
            uint256 amountBought = ERC20(_tokensToBuy[i]).balanceOf(address(this)) - buyTokenInitialBalance;

            usersHoldings[tokenId].push(Holding({ token: _tokensToBuy[i], amount: amountBought, reserve: reserve }));

            require(ERC20(_tokensToBuy[i]).transfer(reserve, amountBought) == true, "TOKEN_TRANSFER_ERROR");
        }

        require(
            sellTokenBalanceBeforePurchase - ERC20(_sellToken).balanceOf(address(this)) <= _sellAmount,
            "EXCHANGE_ERROR"
        );

        uint256 remainingBalance = ERC20(_sellToken).balanceOf(address(this)) - sellTokenBalanceBeforeDeposit;
        if (remainingBalance > 0) {
            ERC20(_sellToken).transfer(msg.sender, remainingBalance);
        }
    }

    /*
    Purchase and collect tokens for the user with ETH.
    Take custody of user's tokens against fees and issue an NFT in return.
    @param _sellAmounts [<uint>] values of ETH to exchange for each _tokensToBuy
    @param _swapTarget [address] the address of the contract that will swap tokens
    @param _tokensToBuy [<address>] the list of tokens to purchase
    @param _swapCallData [<bytes>] the list of call data provided by 0x to fill quotes
    */
    function createFromETH(
        uint256[] calldata _sellAmounts,
        address payable _swapTarget,
        address[] calldata _tokensToBuy,
        bytes[] calldata _swapCallData
    ) external payable {
        uint256 buyCount = _tokensToBuy.length;
        require(buyCount > 0, "BUY_ARG_MISSING");
        require(buyCount == _swapCallData.length, "BUY_ARG_ERROR");
        require(buyCount == _sellAmounts.length, "SELL_AMOUNT_ERROR");

        // TODO: sanity check. User sends enough funds for every swaps
        uint256 amountToSell = 0;
        for (uint256 i = 0; i < _sellAmounts.length; i++) {
            amountToSell += _sellAmounts[i];
        }
        require(msg.value >= amountToSell, "INSUFFICIENT_FUNDS_RECEIVED");

        uint256 ethBalanceBeforePurchase = address(this).balance;

        uint256 tokenId = nestedAsset.mint(msg.sender);
        usersTokenIds[msg.sender].push(tokenId);

        uint256 totalSellAmount = 0;

        for (uint256 i = 0; i < buyCount; i++) {
            uint256 buyTokenInitialBalance = ERC20(_tokensToBuy[i]).balanceOf(address(this));

            swapFromETH(_sellAmounts[i], _swapTarget, _swapCallData[i]);
            uint256 amountBought = ERC20(_tokensToBuy[i]).balanceOf(address(this)) - buyTokenInitialBalance;

            usersHoldings[tokenId].push(Holding({ token: _tokensToBuy[i], amount: amountBought, reserve: reserve }));

            require(ERC20(_tokensToBuy[i]).transfer(reserve, amountBought) == true, "TOKEN_TRANSFER_ERROR");
            // TODO: compute sold amount by looking at balance difference, pre and post swap
            totalSellAmount = totalSellAmount + _sellAmounts[i];
        }

        require(ethBalanceBeforePurchase - address(this).balance <= totalSellAmount, "EXCHANGE_ERROR");
        uint256 remainingETH = address(this).balance + msg.value - ethBalanceBeforePurchase;

        if (remainingETH > 0) {
            msg.sender.transfer(remainingETH);
        }
    }

    /*
    TO THINK ABOUT:
    1) [only for create, covered in createFromEth] 
     Get estimate of required funds for the transaction to get through.
     Revert early if user can't afford the operation
     Hints: NDX uses chainlink to compute short term average cost of tokens
        I think Uniswap Oracle would be cheaper here if we want to do this on chain. To verify.
        If we want to do it offchain, pass a normalized value of ETH, provided by the front by 0x

    TO DO:

    5) Emit events. TBD which are necessary.

    7) IMPORTANT: Optimise gas
    */

    /*
    Purchase a token
    @param _sellToken [address] token used to make swaps
    @param _buyToken [address] token to buy
    @param _swapTarget [address] the address of the contract that will swap tokens
    @param _swapCallData [bytes] call data provided by 0x to fill the quote
    */
    function swapTokens(
        address _sellToken,
        address payable _swapTarget,
        bytes calldata _swapCallData
    ) internal {
        // Note that for some tokens (e.g., USDT, KNC), you must first reset any existing
        // allowance to 0 before being able to update it.
        require(ERC20(_sellToken).approve(_swapTarget, uint256(-1)), "ALLOWANCE_SETTER_ERROR");

        (bool success, bytes memory resultData) = _swapTarget.call{ value: msg.value }(_swapCallData);

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
        (bool success, bytes memory resultData) = _swapTarget.call{ value: _sellAmount }(_swapCallData);
        require(success, "SWAP_CALL_FAILED");
    }
}
