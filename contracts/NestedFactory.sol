//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.3;

import "hardhat/console.sol";
import "./NestedAsset.sol";
import "./NestedReserve.sol";
import "./interfaces/IWETH.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract NestedFactory is ReentrancyGuard {
    event NestedCreated(uint256 indexed tokenId, address indexed owner);

    address public immutable weth;
    address payable public feeTo;
    address public feeToSetter;
    NestedReserve public reserve;

    NestedAsset public immutable nestedAsset;

    /*
    Info about assets stored in reserves
    */
    struct Holding {
        address token;
        uint256 amount;
        address reserve;
    }

    mapping(uint256 => Holding[]) public usersHoldings;

    /*
    Reverts if the address does not exist
    @param _address [address]
    */
    modifier addressExists(address _address) {
        require(_address != address(0), "NestedFactory: INVALID_ADDRESS");
        _;
    }

    /*
    @param _feeToSetter [address] The address which will be allowed to choose where the fees go
    */
    constructor(address payable _feeToSetter) {
        feeToSetter = _feeToSetter;
        feeTo = _feeToSetter;
        weth = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
        nestedAsset = new NestedAsset();
        // TODO: do this outside of constructor. Think about reserve architecture
        reserve = new NestedReserve();
    }

    /*
    Reverts the transaction if the caller is not the factory
    @param tokenId uint256 the NFT Id
    */
    modifier onlyOwner(uint256 tokenId) {
        require(nestedAsset.ownerOf(tokenId) == msg.sender, "NestedFactory: Only Owner");
        _;
    }

    /*
    Fallback function 
    */
    fallback() external payable {}

    /*
   Sets the address receiving the fees
   @param feeTo The address of the receiver
   */
    function setFeeTo(address payable _feeTo) external addressExists(_feeTo) {
        require(msg.sender == feeToSetter, "NestedFactory: FORBIDDEN");
        feeTo = _feeTo;
    }

    /*
    Sets the address that can redirect the fees to a new receiver
    @param _feeToSetter The address that decides where the fees go
    */
    function setFeeToSetter(address payable _feeToSetter) external addressExists(_feeToSetter) {
        require(msg.sender == feeToSetter, "NestedFactory: FORBIDDEN");
        feeToSetter = _feeToSetter;
    }

    /*
    Returns the list of NestedAsset ids owned by an address
    @params account [address] address
    @return [<uint256>]
    */
    function tokensOf(address _address) public view virtual returns (uint256[] memory) {
        uint256 tokensCount = nestedAsset.balanceOf(_address);
        uint256[] memory tokenIds = new uint256[](tokensCount);

        for (uint256 i = 0; i < tokensCount; i++) {
            tokenIds[i] = nestedAsset.tokenOfOwnerByIndex(_address, i);
        }
        return tokenIds;
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
    Purchase and collect tokens for the user.
    Take custody of user's tokens against fees and issue an NFT in return.
    @param _metadataURI The metadata URI string
    @param _sellToken [address] token used to make swaps
    @param _sellAmount [uint] value of sell tokens to exchange
    @param _swapTarget [address] the address of the contract that will swap tokens
    @param _tokensToBuy [<address>] the list of tokens to purchase
    @param _swapCallData [<bytes>] the list of call data provided by 0x to fill quotes
    */
    function create(
        string memory _metadataURI,
        address _sellToken,
        uint256 _sellAmount,
        address payable _swapTarget,
        address[] calldata _tokensToBuy,
        bytes[] calldata _swapCallData
    ) external payable nonReentrant {
        uint256 buyCount = _tokensToBuy.length;
        require(buyCount > 0, "BUY_ARG_MISSING");
        require(buyCount == _swapCallData.length, "BUY_ARG_ERROR");

        uint256 fees = _sellAmount / 100;
        uint256 sellAmountWithFees = _sellAmount + fees;
        require(IERC20(_sellToken).allowance(msg.sender, address(this)) >= sellAmountWithFees, "ALLOWANCE_ERROR");
        require(IERC20(_sellToken).balanceOf(msg.sender) >= sellAmountWithFees, "INSUFFICIENT_FUNDS");

        IERC20(_sellToken).transferFrom(msg.sender, address(this), sellAmountWithFees);

        uint256 sellTokenBalanceBeforePurchase = IERC20(_sellToken).balanceOf(address(this));

        uint256 tokenId = nestedAsset.mint(msg.sender, _metadataURI);

        for (uint256 i = 0; i < buyCount; i++) {
            swapTokens(_sellToken, _swapTarget, _swapCallData[i]);
            uint256 amountBought = IERC20(_tokensToBuy[i]).balanceOf(address(this));

            usersHoldings[tokenId].push(
                Holding({ token: _tokensToBuy[i], amount: amountBought, reserve: address(reserve) })
            );
            require(IERC20(_tokensToBuy[i]).transfer(address(reserve), amountBought), "TOKEN_TRANSFER_ERROR");
        }

        uint256 remainingSellToken =
            sellAmountWithFees - (sellTokenBalanceBeforePurchase - IERC20(_sellToken).balanceOf(address(this)));
        require(remainingSellToken >= fees, "INSUFFICIENT_FUNDS");
        require(IERC20(_sellToken).transferFrom(address(this), feeTo, remainingSellToken), "FEE_TRANSFER_ERROR");
    }

    /*
    Purchase and collect tokens for the user with ETH.
    Take custody of user's tokens against fees and issue an NFT in return.
    @param _metadataURI The metadata URI string
    @param _sellAmounts [<uint>] values of ETH to exchange for each _tokensToBuy
    @param _swapTarget [address] the address of the contract that will swap tokens
    @param _tokensToBuy [<address>] the list of tokens to purchase
    @param _swapCallData [<bytes>] the list of call data provided by 0x to fill quotes
    */
    function createFromETH(
        string memory _metadataURI,
        uint256[] calldata _sellAmounts,
        address payable _swapTarget,
        address[] calldata _tokensToBuy,
        bytes[] calldata _swapCallData
    ) external payable nonReentrant {
        uint256 buyCount = _tokensToBuy.length;
        require(buyCount > 0, "BUY_ARG_MISSING");
        require(buyCount == _swapCallData.length, "BUY_ARG_ERROR");
        require(buyCount == _sellAmounts.length, "SELL_AMOUNT_ERROR");

        uint256 amountToSell = 0;
        for (uint256 i = 0; i < _sellAmounts.length; i++) {
            amountToSell += _sellAmounts[i];
        }
        uint256 fees = amountToSell / 100;
        require(msg.value >= amountToSell + fees, "INSUFFICIENT_FUNDS");

        uint256 tokenId = nestedAsset.mint(msg.sender, _metadataURI);

        // we wrap ETH first
        IWETH(weth).deposit{ value: msg.value }();
        uint256 wethBalanceBeforePurchase = IERC20(weth).balanceOf(address(this));

        for (uint256 i = 0; i < buyCount; i++) {
            swapTokens(weth, _swapTarget, _swapCallData[i]);
            uint256 amountBought = IERC20(_tokensToBuy[i]).balanceOf(address(this));

            usersHoldings[tokenId].push(
                Holding({ token: _tokensToBuy[i], amount: amountBought, reserve: address(reserve) })
            );
            require(IERC20(_tokensToBuy[i]).transfer(address(reserve), amountBought), "TOKEN_TRANSFER_ERROR");
        }

        uint256 remainingWETH = msg.value - (wethBalanceBeforePurchase - IERC20(weth).balanceOf(address(this)));
        require(remainingWETH >= fees, "INSUFFICIENT_FUNDS");

        require(IERC20(weth).transfer(feeTo, remainingWETH), "FEE_TRANSFER_ERROR");
    }

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
        require(IERC20(_sellToken).approve(_swapTarget, type(uint256).max), "ALLOWANCE_SETTER_ERROR");

        // solhint-disable-next-line avoid-low-level-calls
        (bool success, ) = _swapTarget.call(_swapCallData);
        require(success, "SWAP_CALL_FAILED");
    }

    /*
    burn NFT and return tokens to the user.
    @param _tokenId uint256 NFT token Id
    */
    function destroy(uint256 _tokenId) external onlyOwner(_tokenId) {
        // get Holdings for this token
        Holding[] memory holdings = usersHoldings[_tokenId];

        // send back all ERC20 to user
        for (uint256 i = 0; i < holdings.length; i++) {
            NestedReserve(holdings[i].reserve).transfer(msg.sender, holdings[i].token, holdings[i].amount);
            // TODO take fees
        }

        // burn token
        delete usersHoldings[_tokenId];
        nestedAsset.burn(msg.sender, _tokenId);
    }

    /*
    Burn NFT and Sell all tokens for a specific ERC20 then send it back to the user
    @param  _tokenId uint256 NFT token Id
    @param _buyToken [address] token used to make swaps
    @param _swapTarget [address] the address of the contract that will swap tokens
    @param _tokensToSell [<address>] the list of tokens to sell
    @param _swapCallData [<bytes>] the list of call data provided by 0x to fill quotes
    */
    function destroyForERC20(
        uint256 _tokenId,
        address _buyToken,
        address payable _swapTarget,
        address[] calldata _tokensToSell,
        bytes[] calldata _swapCallData
    ) external onlyOwner(_tokenId) nonReentrant {
        // get Holdings for this token
        Holding[] memory holdings = usersHoldings[_tokenId];

        require(holdings.length == _tokensToSell.length, "MISSING_SELL_ARGS");

        // first transfer holdings from reserve to factory
        for (uint256 i = 0; i < holdings.length; i++) {
            NestedReserve(holdings[i].reserve).transfer(address(this), holdings[i].token, holdings[i].amount);
        }

        uint256 buyTokenInitialBalance = IERC20(_buyToken).balanceOf(address(this));

        // swap tokens
        for (uint256 i = 0; i < _tokensToSell.length; i++) {
            swapTokens(_tokensToSell[i], _swapTarget, _swapCallData[i]);
        }

        // send swapped ERC20 to user minus fees
        uint256 amountBought = IERC20(_buyToken).balanceOf(address(this)) - buyTokenInitialBalance;
        uint256 amountFees = amountBought / 100;
        amountBought = amountBought - amountFees;
        require(IERC20(_buyToken).transfer(feeTo, amountFees), "FEES_TRANSFER_ERROR");
        require(IERC20(_buyToken).transfer(msg.sender, amountBought), "TOKEN_TRANSFER_ERROR");

        delete usersHoldings[_tokenId];
        nestedAsset.burn(msg.sender, _tokenId);
    }

    /*
    Burn NFT and Sell all tokens for WETH, unwrap it and then send ETH back to the user
    @param  _tokenId uint256 NFT token Id
    @param _swapTarget [address] the address of the contract that will swap tokens
    @param _tokensToSell [<address>] the list of tokens to sell
    @param _swapCallData [<bytes>] the list of call data provided by 0x to fill quotes
    */
    function destroyForETH(
        uint256 _tokenId,
        address payable _swapTarget,
        address[] calldata _tokensToSell,
        bytes[] calldata _swapCallData
    ) external payable onlyOwner(_tokenId) nonReentrant {
        // get Holdings for this token
        Holding[] memory holdings = usersHoldings[_tokenId];
        require(holdings.length == _tokensToSell.length, "MISSING_SELL_ARGS");

        // first transfer holdings from reserve to factory
        for (uint256 i = 0; i < holdings.length; i++) {
            NestedReserve(holdings[i].reserve).transfer(address(this), holdings[i].token, holdings[i].amount);
        }

        uint256 buyTokenInitialBalance = IERC20(weth).balanceOf(address(this));

        // swap tokens
        for (uint256 i = 0; i < _tokensToSell.length; i++) {
            swapTokens(_tokensToSell[i], _swapTarget, _swapCallData[i]);
        }

        // send to user minus fees
        uint256 amountBought = IERC20(weth).balanceOf(address(this)) - buyTokenInitialBalance;
        uint256 amountFees = amountBought / 100;
        amountBought = amountBought - amountFees;
        require(IERC20(weth).transfer(feeTo, amountFees), "FEES_TRANSFER_ERROR");
        IWETH(weth).withdraw(amountBought); // NOT WORKING

        (bool success, ) = msg.sender.call{ value: amountBought }("");
        require(success, "ETH_TRANSFER_ERROR");

        delete usersHoldings[_tokenId];
        nestedAsset.burn(msg.sender, _tokenId);
    }
}
