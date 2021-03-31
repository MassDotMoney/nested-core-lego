//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "hardhat/console.sol";
import "./NestedAsset.sol";
import "./NestedReserve.sol";

// A partial WETH interfaec.
interface WETH is IERC20 {
    function deposit() external payable;
    //function balanceOf() external return(bool);
}

contract NestedFactory {
    event NestedCreated(uint256 indexed tokenId, address indexed owner);

    address public feeTo;
    address public feeToSetter;
    address public reserve;

    NestedAsset public immutable nestedAsset;

    /*
    Represents custody from Nested over an asset

    Feel free to suggest a better name
    */
    struct Holding {
        address token;
        uint256 amount;
        address reserve;
        // uint256 lockedUntil; // For v1.1 hodl feature
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

    function depositETH(address weth) external payable {
        //WETH(weth).balanceOf[msg.sender] += msg.value;
        WETH(weth).deposit{ value: msg.value }();
        WETH(weth).transfer(msg.sender, msg.value);
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

    // return the list of erc721 tokens for an address
    function tokensOf(address account) public view virtual returns (uint256[] memory) {
        return usersTokenIds[account];
    }

    // return the content of a NFT token by ID
    function tokenHoldings(uint256 tokenId) public view virtual returns (Holding[] memory) {
        return usersHoldings[tokenId];
    }

    /*
    Purchase and collect tokens for the user.
    Take custody of user's tokens against fees and issue an NFT in return.
    @param _sellToken [address] token used to make swaps
    @param _sellAmount [uint] value of sell tokens to exchange
    @param _tokensToBuy [<address>] the list of tokens to purchase
    @param _swapCallData [<bytes>] the list of call data provided by 0x to fill quotes
    @param _swapTarget [address] the address of the contract that will swap tokens
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
        require(ERC20(_sellToken).allowance(msg.sender, address(this)) > _sellAmount, "USER_FUND_ALLOWANCE_ERROR");
        require(ERC20(_sellToken).transferFrom(msg.sender, address(this), _sellAmount), "USER_FUND_TRANSFER_ERROR");

        uint256 initialSellTokenBalance = ERC20(_sellToken).balanceOf(address(this));

        uint256 buyFees = (_sellAmount * 15) / 1000;
        uint256 availableAmount = _sellAmount - buyFees;

        require(ERC20(_sellToken).transferFrom(msg.sender, feeTo, buyFees) == true, "FEE_TRANSFER_ERROR");

        uint256 tokenId = nestedAsset.mint(msg.sender);
        usersTokenIds[msg.sender].push(tokenId);

        for (uint256 i = 0; i < buyCount; i++) {
            uint256 initialBalance = ERC20(_tokensToBuy[i]).balanceOf(address(this));

            swapTokens(_sellToken, _tokensToBuy[i], _swapTarget, _swapCallData[i]);
            uint256 amountBought = ERC20(_tokensToBuy[i]).balanceOf(address(this)) - initialBalance;

            usersHoldings[tokenId].push(Holding({ token: _tokensToBuy[i], amount: amountBought, reserve: reserve }));

            require(ERC20(_tokensToBuy[i]).transfer(reserve, amountBought) == true, "TOKEN_TRANSFER_ERROR");
        }

        //require(ERC20(_sellToken).balanceOf(address(this)) - initialSellTokenBalance < availableAmount, "EXCHANGE_ERROR");
    }

    /*

    TO THINK ABOUT:
    
    A) Call stack is too deep. 
    We could get rid of some parameters by splitting the execution in 2 transactions
    That would result in a poorer UX


    TO DO:

    1) get estimate of required funds for the transaction to get through.
     Revert early if user can't afford the operation
     Hints: NDX uses chainlink to compute short term average cost of tokens
        I think Uniswap Oracle would be cheaper here if we want to do this on chain. To verify.
        If we wangt to do it offchain, pass w anormalized value of ETH, provided by the front by 0x

    2) test if we can get rid of require wrappers for transfer, do reverts bubble up and revert the whole tx?

    3) make adjustements to allow the user to pay with ETH passed in msg.value

    4) modify swapTokens function, it should refund the amount of unspent ETH
         instead of using the current balance value

    5) Emit events. TBD which are necessary.

    6) refund unspent tokens of _sellToken

    7) IMPORTANT: Optimise gas

    8) allow to specify amount of slippage in total amount of exchanged assets
        add default to 1%

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
        address _buyToken,
        address payable _swapTarget,
        bytes calldata _swapCallData
    ) internal {
        // Track our balance of the buyToken to determine how much we've bought.
        // uint256 buyTokenInitialBalance = ERC20(_buyToken).balanceOf(address(this));

        // Note that for some tokens (e.g., USDT, KNC), you must first reset any existing
        // allowance to 0 before being able to update it.
        require(ERC20(_sellToken).approve(_swapTarget, uint256(-1)), "ALLOWANCE_SETTER_ERROR");

        (bool success, ) = _swapTarget.call{ value: msg.value }(_swapCallData);
        require(success, "SWAP_CALL_FAILED");

        // Refund any unspent protocol fees to the sender.
        msg.sender.transfer(address(this).balance);

        // Here is how to compute amount bought for events if needed
        // uint256 amountBought = ERC20(_buyToken).balanceOf(address(this)) - buyTokenInitialBalance;
    }
}
