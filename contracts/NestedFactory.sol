//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.3;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./NestedAsset.sol";
import "./NestedReserve.sol";
import "./interfaces/IWETH.sol";
import "./interfaces/IFeeSplitter.sol";

// import "hardhat/console.sol";

contract NestedFactory is ReentrancyGuard {
    using SafeERC20 for IERC20;
    event NestedCreated(uint256 indexed tokenId, address indexed owner);

    IWETH public immutable weth;
    IFeeSplitter public feeTo;
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

    /*
    Data required for swapping a token
    */
    struct TokenOrder {
        address token;
        bytes callData;
    }

    mapping(uint256 => mapping(address => Holding)) public assetHoldings;
    mapping(uint256 => address[]) public assetTokens;

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
    constructor(
        address payable _feeToSetter,
        IFeeSplitter _feeTo,
        IWETH _weth
    ) {
        feeToSetter = _feeToSetter;
        feeTo = _feeTo;
        weth = _weth;
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
    Receive function 
    */
    receive() external payable {}

    /*
   Sets the address receiving the fees
   @param feeTo The address of the receiver
   */
    function setFeeTo(IFeeSplitter _feeTo) external addressExists(address(_feeTo)) {
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
        address[] memory tokens = assetTokens[_tokenId];
        uint256 tokensCount = tokens.length;
        Holding[] memory holdings = new Holding[](tokensCount);

        for (uint256 i = 0; i < tokensCount; i++) {
            Holding memory holding = assetHoldings[_tokenId][tokens[i]];
            holdings[i] = holding;
        }
        return holdings;
    }

    /*
    Purchase tokens and store them in a reserve for the user.
    @param _tokenId [uint] the id of the Nested NFT
    @param _sellToken [IERC20] token used to make swaps
    @param _swapTarget [address] the address of the contract that will swap tokens
    @param _tokenOrders [<TokenOrder>] orders for token swaps
    @param _maxAllowance [<uint256>] maximum allowance needed to perform a swap
    */
    function exchangeAndStoreTokens(
        uint256 _tokenId,
        IERC20 _sellToken,
        address payable _swapTarget,
        TokenOrder[] calldata _tokenOrders
    ) internal {
        uint256 buyCount = _tokenOrders.length;

        for (uint256 i = 0; i < buyCount; i++) {
            uint256 balanceBeforePurchase = IERC20(_tokenOrders[i].token).balanceOf(address(this));
            fillQuote(_sellToken, _swapTarget, _tokenOrders[i].callData);
            uint256 amountBought = IERC20(_tokenOrders[i].token).balanceOf(address(this)) - balanceBeforePurchase;

            assetHoldings[_tokenId][_tokenOrders[i].token] = Holding({
                token: _tokenOrders[i].token,
                amount: amountBought,
                reserve: address(reserve)
            });
            assetTokens[_tokenId].push(_tokenOrders[i].token);

            IERC20(_tokenOrders[i].token).safeTransfer(address(reserve), amountBought);
        }
    }

    /*
    Purchase tokens and store them in a reserve for the user.
    @param _originalTokenId [uint] the id of the NFT replicated, 0 if not replicating
    @param _metadataURI The metadata URI string
    @param _sellToken [IERC20] token used to make swaps
    @param _sellTokenAmount [uint] amount of sell tokens to exchange
    @param _swapTarget [address] the address of the contract that will swap tokens
    @param _tokenOrders [<TokenOrder>] orders for token swaps
    */
    function create(
        uint256 _originalTokenId,
        string memory _metadataURI,
        IERC20 _sellToken,
        uint256 _sellTokenAmount,
        address payable _swapTarget,
        TokenOrder[] calldata _tokenOrders
    ) external payable nonReentrant {
        require(_tokenOrders.length > 0, "BUY_ARG_MISSING");

        uint256 fees = _sellTokenAmount / 100;
        uint256 sellAmountWithFees = _sellTokenAmount + fees;

        uint256 tokenId = nestedAsset.mint(msg.sender, _metadataURI, _originalTokenId);

        // pays with ETH
        if (address(_sellToken) == 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE) {
            require(msg.value >= sellAmountWithFees, "INSUFFICIENT_AMOUNT_IN");
            weth.deposit{ value: msg.value }();
            _sellToken = IERC20(address(weth));
        } else {
            // pays with an ERC20
            _sellToken.safeTransferFrom(msg.sender, address(this), sellAmountWithFees);
        }
        uint256 balanceBeforePurchase = IERC20(_sellToken).balanceOf(address(this));
        exchangeAndStoreTokens(tokenId, _sellToken, _swapTarget, _tokenOrders);
        uint256 amountSpent = balanceBeforePurchase - IERC20(_sellToken).balanceOf(address(this));
        require(amountSpent <= _sellTokenAmount, "OVERSPENT_ERROR");
        transferFee(_sellTokenAmount - amountSpent + fees, _sellToken, tokenId);
    }

    /*
    Perform a swap between two tokens
    @param _sellToken [IERC20] token to exchange
    @param _swapTarget [address] the address of the contract that swaps tokens
    @param _swapCallData [bytes] call data provided by 0x to fill the quote
    */
    function fillQuote(
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

    /*
    burn NFT and return tokens to the user.
    @param _tokenId uint256 NFT token Id
    */
    function destroy(uint256 _tokenId) external onlyOwner(_tokenId) {
        address[] memory tokens = assetTokens[_tokenId];

        // get assets list for this NFT and send back all ERC20 to user
        for (uint256 i = 0; i < tokens.length; i++) {
            Holding memory holding = assetHoldings[_tokenId][tokens[i]];
            NestedReserve(holding.reserve).transfer(msg.sender, holding.token, holding.amount);
            delete assetHoldings[_tokenId][tokens[i]];
        }

        // burn token
        delete assetTokens[_tokenId];
        nestedAsset.burn(msg.sender, _tokenId);
    }

    /*
    Burn NFT and sell all tokens for a specific ERC20
    @param  _tokenId uint256 NFT token Id
    @param _buyToken [IERC20] token used to make swaps
    @param _swapTarget [address] the address of the contract that will swap tokens
    @param _tokenOrders [<TokenOrder>] orders for token swaps
    */
    function _destroyForERC20(
        uint256 _tokenId,
        IERC20 _buyToken,
        address payable _swapTarget,
        TokenOrder[] calldata _tokenOrders
    ) internal onlyOwner(_tokenId) returns (uint256) {
        address[] memory tokens = assetTokens[_tokenId];
        uint256 tokenLength = tokens.length;

        require(tokenLength == _tokenOrders.length, "MISSING_SELL_ARGS");

        uint256 buyTokenInitialBalance = _buyToken.balanceOf(address(this));

        // first transfer holdings from reserve to factory
        for (uint256 i = 0; i < tokenLength; i++) {
            Holding memory holding = assetHoldings[_tokenId][tokens[i]];
            NestedReserve(holding.reserve).transfer(address(this), holding.token, holding.amount);
            fillQuote(IERC20(_tokenOrders[i].token), _swapTarget, _tokenOrders[i].callData);
            delete assetHoldings[_tokenId][tokens[i]];
        }

        // send swapped ERC20 to user minus fees
        uint256 amountBought = _buyToken.balanceOf(address(this)) - buyTokenInitialBalance;
        uint256 amountFees = amountBought / 100;
        amountBought = amountBought - amountFees;

        transferFee(amountFees, _buyToken, _tokenId);

        delete assetTokens[_tokenId];
        nestedAsset.burn(msg.sender, _tokenId);

        return amountBought;
    }

    /*
    Burn NFT and Sell all tokens for a specific ERC20 then send it back to the user
    @param  _tokenId uint256 NFT token Id
    @param _buyToken [IERC20] token used to make swaps
    @param _swapTarget [address] the address of the contract that will swap tokens
    @param _tokenOrders [<TokenOrder>] orders for token swaps
    */
    function destroyForERC20(
        uint256 _tokenId,
        IERC20 _buyToken,
        address payable _swapTarget,
        TokenOrder[] calldata _tokenOrders
    ) external onlyOwner(_tokenId) {
        uint256 amountBought = _destroyForERC20(_tokenId, _buyToken, _swapTarget, _tokenOrders);
        require(IERC20(_buyToken).transfer(msg.sender, amountBought), "TOKEN_TRANSFER_ERROR");
    }

    /*
    Burn NFT and Sell all tokens for WETH, unwrap it and then send ETH back to the user
    @param  _tokenId uint256 NFT token Id
    @param _swapTarget [address] the address of the contract that will swap tokens
    @param _tokenOrders [<TokenOrder>] orders for token swaps
    */
    function destroyForETH(
        uint256 _tokenId,
        address payable _swapTarget,
        TokenOrder[] calldata _tokenOrders
    ) external payable onlyOwner(_tokenId) {
        // no need to check for reeentrancy because destroyForERC20 checks it
        uint256 amountBought = _destroyForERC20(_tokenId, IERC20(address(weth)), _swapTarget, _tokenOrders);
        IWETH(weth).withdraw(amountBought);

        (bool success, ) = msg.sender.call{ value: amountBought }("");
        require(success, "ETH_TRANSFER_ERROR");
    }

    /**
    @dev send a fee to the FeeSplitter
    @param _amount [uint256] to send
    @param _token [IERC20] token to send
    @param _tokenId [uint256] user portfolio ID used to find a potential royalties recipient
    **
    */
    function transferFee(
        uint256 _amount,
        IERC20 _token,
        uint256 _tokenId
    ) internal {
        address originalOwner = nestedAsset.originalOwner(_tokenId);
        _token.safeIncreaseAllowance(address(feeTo), _amount);
        feeTo.sendFeesToken(originalOwner, _amount, _token);
    }
}
