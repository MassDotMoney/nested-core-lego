//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./libraries/NestedStructs.sol";
import "./NestedAsset.sol";
import "./NestedReserve.sol";
import "./NestedRecords.sol";
import "./interfaces/IWETH.sol";
import "./FeeSplitter.sol";
import "./libraries/ExchangeHelpers.sol";

/**
 * @title Creates, updates and destroys NestedAssets.
 * It is responsible for the business logic of the protocol and interaction with other contracts.
 */
contract NestedFactory is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    event NftCreated(uint256 indexed nftId, uint256 originalNftId);
    event NftBurned(uint256 indexed nftId);
    event FailsafeWithdraw(uint256 indexed nftId, address indexed token);
    event ReserveRegistered(address indexed reserve);
    event VipDiscountChanged(uint256 vipDiscount, uint256 vipMinAmount);
    event SmartChefChanged(address nextSmartChef);

    event NftUpdated(uint256 indexed nftId);

    IWETH public immutable weth;
    uint256 public vipDiscount;
    uint256 public vipMinAmount;
    MinimalSmartChef public smartChef;

    FeeSplitter public feeTo;
    NestedReserve public reserve;
    NestedAsset public immutable nestedAsset;
    NestedRecords public immutable nestedRecords;

    mapping(address => bool) public supportedReserves;

    /*
    Reverts if the address does not exist
    @param _address [address]
    */
    modifier addressExists(address _address) {
        require(_address != address(0), "INVALID_ADDRESS");
        _;
    }

    /*
    Reverts if the address is not a reserve
    @param _reserve [address]
    */
    modifier isNestedReserve(address _reserve) {
        require(supportedReserves[_reserve], "NOT_A_RESERVE");
        _;
    }

    /*
    @param _asset [NestedReserve]
    @param _feeTo [FeeSplitter] the address or contract that receives fees
    @param _weth [IWETH] The wrapped ether contract
    @param _vipDiscount [uint256] discount percentage for VIP users (times 1000)
    @param _vipMinAmount [uint256] minimum staked amount for users to unlock VIP tier
    */
    constructor(
        NestedAsset _asset,
        NestedRecords _records,
        FeeSplitter _feeTo,
        IWETH _weth,
        uint256 _vipDiscount,
        uint256 _vipMinAmount
    ) {
        feeTo = _feeTo;
        weth = _weth;
        nestedAsset = _asset;
        nestedRecords = _records;
        vipDiscount = _vipDiscount;
        vipMinAmount = _vipMinAmount;
    }

    /*
    Reverts the transaction if the caller is not the token owner
    @param _nftId uint256 the NFT Id
    */
    modifier onlyTokenOwner(uint256 _nftId) {
        require(nestedAsset.ownerOf(_nftId) == msg.sender, "NOT_TOKEN_OWNER");
        _;
    }

    /*
    Receive function
    */
    receive() external payable {}

    /**
    @dev Adds a reserve to the supported reserves mapping
    @param _reserve [address] the address for the reserve to register
    */
    function registerReserve(address _reserve) external onlyOwner {
        supportedReserves[_reserve] = true;
        emit ReserveRegistered(_reserve);
    }

    /*
   Sets the address receiving the fees
   @param _feeTo The address of the receiver
   */
    function setFeeTo(FeeSplitter _feeTo) external addressExists(address(_feeTo)) onlyOwner {
        feeTo = _feeTo;
    }

    /*
    Sets the reserve where the funds are stored
    @param _reserve the address of the new reserve
    */
    function setReserve(NestedReserve _reserve) external onlyOwner addressExists(address(_reserve)) {
        require(address(reserve) == address(0), "RESERVE_IMMUTABLE");
        reserve = _reserve;
    }

    /**
     * @dev set the VIP discount and min staked amount to be a VIP
     * @param _vipDiscount [uint256] the fee discount to apply to a VIP user
     * @param _vipMinAmount [uint256] min amount that needs to be staked to be a VIP
     */
    function setVipDiscount(uint256 _vipDiscount, uint256 _vipMinAmount) external onlyOwner {
        require(_vipDiscount < 1000, "DISCOUNT_TOO_HIGH");
        (vipDiscount, vipMinAmount) = (_vipDiscount, _vipMinAmount);
        emit VipDiscountChanged(vipDiscount, vipMinAmount);
    }

    /**
     * @dev set the SmartChef contract address
     * @param _nextSmartChef [address] new SmartChef address
     */
    function setSmartChef(address _nextSmartChef) external onlyOwner {
        require(_nextSmartChef != address(0), "INVALID_SMARTCHEF_ADDRESS");
        smartChef = MinimalSmartChef(_nextSmartChef);
        emit SmartChefChanged(_nextSmartChef);
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
    @params _nftId [uint256] the id of the NestedAsset
    @return [<Holding>]
    */
    function tokenHoldings(uint256 _nftId) public view virtual returns (NestedStructs.Holding[] memory) {
        address[] memory tokens = nestedRecords.getAssetTokens(_nftId);
        uint256 tokensCount = tokens.length;
        NestedStructs.Holding[] memory holdings = new NestedStructs.Holding[](tokensCount);

        for (uint256 i = 0; i < tokensCount; i++) {
            NestedStructs.Holding memory holding = nestedRecords.getAssetHolding(_nftId, tokens[i]);
            holdings[i] = holding;
        }
        return holdings;
    }

    /*
    Purchase tokens and store them in a reserve for the user.
    @param _nftId [uint] the id of the Nested NFT
    @param _sellToken [IERC20] token used to make swaps
    @param _swapTarget [address] the address of the contract that will swap tokens
    @param _tokenOrders [<TokenOrder>] orders for token swaps
    @param _maxAllowance [<uint256>] maximum allowance needed to perform a swap
    */
    function exchangeAndStoreTokens(
        uint256 _nftId,
        IERC20 _sellToken,
        address payable _swapTarget,
        NestedStructs.TokenOrder[] calldata _tokenOrders
    ) internal {
        uint256 buyCount = _tokenOrders.length;

        for (uint256 i = 0; i < buyCount; i++) {
            uint256 amountBought = 0;
            uint256 balanceBeforePurchase = IERC20(_tokenOrders[i].token).balanceOf(address(this));

            /* If token being exchanged is the sell token, the callData sent by the caller
             ** will be used on the reserve to call the transferFromFactory, taking the funds
             ** directly instead of swapping
             */
            if (_tokenOrders[i].token == address(_sellToken)) {
                ExchangeHelpers.setMaxAllowance(_sellToken, address(reserve));
                (bool success, ) = address(reserve).call(_tokenOrders[i].callData);
                require(success, "RESERVE_CALL_FAILED");

                amountBought = balanceBeforePurchase - IERC20(_tokenOrders[i].token).balanceOf(address(this));
                require(amountBought > 0, "NOTHING_DEPOSITED");
            } else {
                require(_swapTargetValid(_swapTarget), "INVALID_SWAP_TARGET");

                bool success = ExchangeHelpers.fillQuote(_sellToken, _swapTarget, _tokenOrders[i].callData);
                require(success, "SWAP_CALL_FAILED");
                amountBought = IERC20(_tokenOrders[i].token).balanceOf(address(this)) - balanceBeforePurchase;
                require(amountBought > 0, "NOTHING_BOUGHT");
                IERC20(_tokenOrders[i].token).safeTransfer(address(reserve), amountBought);
            }
            nestedRecords.store(_nftId, _tokenOrders[i].token, amountBought, address(reserve));
        }
    }

    /*
    Purchase tokens and store them in a reserve for the user.
    @param _originalTokenId [uint] the id of the NFT replicated, 0 if not replicating
    @param _sellToken [IERC20] token used to make swaps
    @param _sellTokenAmount [uint] amount of sell tokens to exchange
    @param _swapTarget [address] the address of the contract that will swap tokens
    @param _tokenOrders [<TokenOrder>] orders for token swaps
    */
    function create(
        uint256 _originalTokenId,
        IERC20 _sellToken,
        uint256 _sellTokenAmount,
        address payable _swapTarget,
        NestedStructs.TokenOrder[] calldata _tokenOrders
    ) external payable nonReentrant {
        uint256 nftId = nestedAsset.mint(msg.sender, _originalTokenId);
        uint256 fees = _addTokens(nftId, _sellToken, _sellTokenAmount, _swapTarget, _tokenOrders);

        if (address(_sellToken) == 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE) {
            _sellToken = IERC20(address(weth));
        }
        transferFeeWithRoyalty(fees, _sellToken, nftId);
        emit NftCreated(nftId, _originalTokenId);
    }

    /*
    Purchase more tokens and update NFT.
    @param _nftId [uint] the id of the NFT to update
    @param _sellToken [IERC20] token used to make swaps
    @param _sellTokenAmount [uint] amount of sell tokens to exchange
    @param _swapTarget [address] the address of the contract that will swap tokens
    @param _tokenOrders [<TokenOrder>] orders for token swaps
    */
    function addTokens(
        uint256 _nftId,
        IERC20 _sellToken,
        uint256 _sellTokenAmount,
        address payable _swapTarget,
        NestedStructs.TokenOrder[] calldata _tokenOrders
    ) external payable nonReentrant onlyTokenOwner(_nftId) {
        uint256 fees = _addTokens(_nftId, _sellToken, _sellTokenAmount, _swapTarget, _tokenOrders);

        if (address(_sellToken) == 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE) {
            _sellToken = IERC20(address(weth));
        }
        transferFee(fees, _sellToken);
        emit NftUpdated(_nftId);
    }

    function _addTokens(
        uint256 _nftId,
        IERC20 _sellToken,
        uint256 _sellTokenAmount,
        address payable _swapTarget,
        NestedStructs.TokenOrder[] calldata _tokenOrders
    ) internal returns (uint256) {
        require(_tokenOrders.length > 0, "BUY_ARG_MISSING");

        uint256 fees = _calculateFees(msg.sender, _sellTokenAmount);
        uint256 sellAmountWithFees = _sellTokenAmount + fees;

        // pays with ETH
        if (address(_sellToken) == 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE) {
            require(msg.value >= sellAmountWithFees, "INSUFFICIENT_AMOUNT_IN");
            weth.deposit{ value: msg.value }();
            _sellToken = IERC20(address(weth));
        } else {
            // pays with an ERC20
            _sellToken.safeTransferFrom(msg.sender, address(this), sellAmountWithFees);
        }

        uint256 balanceBeforePurchase = _sellToken.balanceOf(address(this));
        exchangeAndStoreTokens(_nftId, _sellToken, _swapTarget, _tokenOrders);
        uint256 amountSpent = balanceBeforePurchase - _sellToken.balanceOf(address(this));
        require(amountSpent <= _sellTokenAmount, "OVERSPENT_ERROR");

        return _sellTokenAmount - amountSpent + fees;
    }


    /*
    Swap an existing token from the NFT for one or more tokens.
    @param _nftId [uint] the id of the NFT to update
    @param _sellToken [IERC20] token used to make swaps
    @param _sellTokenAmount [uint] amount of sell tokens to exchange
    @param _swapTarget [address] the address of the contract that will swap tokens
    @param _tokenOrders [<TokenOrder>] orders for token swaps
    */
    function swapTokenForTokens(
        uint256 _nftId,
        IERC20 _sellToken,
        uint256 _sellTokenAmount,
        address payable _swapTarget,
        NestedStructs.TokenOrder[] calldata _tokenOrders
    ) external payable nonReentrant onlyTokenOwner(_nftId) {
        require(_tokenOrders.length > 0, "BUY_ARG_MISSING");

        // check if sell token exist in nft and amount is enough
        NestedStructs.Holding memory holding = nestedRecords.getAssetHolding(_nftId, address(_sellToken));
        require(holding.amount >= _sellTokenAmount, "INSUFFICIENT_AMOUNT");

        // transfer from reserve to factory
        NestedReserve(reserve).transfer(address(this), IERC20(holding.token), _sellTokenAmount);

        uint256 fees = _calculateFees(msg.sender, _sellTokenAmount);
        uint256 balanceBeforePurchase = _sellToken.balanceOf(address(this));
        exchangeAndStoreTokens(_nftId, _sellToken, _swapTarget, _tokenOrders);
        uint256 amountSpent = balanceBeforePurchase - _sellToken.balanceOf(address(this));
        require(amountSpent <= _sellTokenAmount - fees, "OVERSPENT_ERROR");

        _updateHolding(_nftId, address(_sellToken), holding.amount - _sellTokenAmount);
        transferFee(_sellTokenAmount - amountSpent, _sellToken);
        emit NftUpdated(_nftId);
    }

    /**
    Swap one or more existing tokens from the NFT for one token.
    @param _nftId [uint] the id of the NFT to update
    @param _buyToken [address] the output token
    @param _sellTokensAmount [<uint>] amount of sell tokens to exchange
    @param _swapTarget [address] the address of the contract that will swap tokens
    @param _tokenOrders [<TokenOrder>] orders for token swaps
    @return [uint256] amount bought during the swaps
    */
    function _swapTokensForToken(
        uint256 _nftId,
        IERC20 _buyToken,
        uint256[] memory _sellTokensAmount,
        address payable _swapTarget,
        NestedStructs.TokenOrder[] calldata _tokenOrders
    ) internal returns (uint256){
        require(_tokenOrders.length > 0, "BUY_ARG_MISSING");
        require(_tokenOrders.length == _sellTokensAmount.length, "SELL_AMOUNT_MISSING");

        uint256 buyTokenInitialBalance = _buyToken.balanceOf(address(this));

        for (uint256 i = 0; i < _tokenOrders.length; i++) {
            // check if sell token exists in nft and amount is enough
            NestedStructs.Holding memory holding = nestedRecords.getAssetHolding(_nftId, _tokenOrders[i].token);
            require(holding.amount >= _sellTokensAmount[i], "INSUFFICIENT_AMOUNT");

            // transfer from reserve to factory
            reserve.withdraw(IERC20(holding.token), _sellTokensAmount[i]);

            if (_tokenOrders[i].token != address(_buyToken)) {
                require(_swapTargetValid(_swapTarget), "INVALID_SWAP_TARGET");
                IERC20 sellToken = IERC20(_tokenOrders[i].token);
                bool success = ExchangeHelpers.fillQuote(sellToken, _swapTarget, _tokenOrders[i].callData);
                require(success, "SWAP_CALL_FAILED");
            }

            uint256 nextAmount = holding.amount - _sellTokensAmount[i];
            _updateHolding(_nftId, _tokenOrders[i].token, nextAmount);
        }

        uint256 amountBought = _buyToken.balanceOf(address(this)) - buyTokenInitialBalance;
        uint256 amountFees = _calculateFees(msg.sender, amountBought);
        transferFeeWithRoyalty(amountFees, _buyToken, _nftId);

       return amountBought - amountFees;
    }

    /**
    Swap one or more existing tokens from the NFT for one token.
    @param _nftId [uint] the id of the NFT to update
    @param _buyToken [address] the output token
    @param _sellTokensAmount [<uint>] amount of sell tokens to exchange
    @param _swapTarget [address] the address of the contract that will swap tokens
    @param _tokenOrders [<TokenOrder>] orders for token swaps
    */
    function sellTokensToNft(
        uint256 _nftId,
        IERC20 _buyToken,
        uint256[] memory _sellTokensAmount,
        address payable _swapTarget,
        NestedStructs.TokenOrder[] calldata _tokenOrders
    ) external payable nonReentrant onlyTokenOwner(_nftId) {
        uint256 amountBought = _swapTokensForToken(_nftId, _buyToken, _sellTokensAmount, _swapTarget, _tokenOrders);

        nestedRecords.store(_nftId, address(_buyToken), amountBought, address(reserve));
        IERC20(_buyToken).safeTransfer(address(reserve), amountBought);

        emit NftUpdated(_nftId);
    }

    /**
    Liquidate one or more holdings and transfer the sale amount to the user
    @param _nftId [uint] the id of the NFT to update
    @param _buyToken [IERCO] token received in the swaps
    @param _sellTokensAmount [<uint>] amount of sell tokens to exchange
    @param _swapTarget [address] the address of the contract that will swap tokens
    @param _tokenOrders [<TokenOrder>] orders for token swaps
    */
    function sellTokensToWallet(
        uint256 _nftId,
        IERC20 _buyToken,
        uint256[] memory _sellTokensAmount,
        address payable _swapTarget,
        NestedStructs.TokenOrder[] calldata _tokenOrders
    ) external payable nonReentrant onlyTokenOwner(_nftId) {
        uint256 amountBought = _swapTokensForToken(_nftId, _buyToken, _sellTokensAmount, _swapTarget, _tokenOrders);

        // if buy token is WETH, unwrap it instead of transferring it to the sender
        if (address(_buyToken) == address(weth)) _unwrapWethAndTransfer(amountBought);
        else _buyToken.safeTransfer(msg.sender, amountBought);

        emit NftUpdated(_nftId);
    }

    /*
    Send a holding content back to the owner without exchanging it. Does not update NestedRecords
    Fee is collected without paying roylaties.
    The token has to be transfered from reserve to factory first.
    @param _nftId [uint256] NFT token ID
    @param _holding [Holding] holding to withdraw
    */
    function _transferToWallet(uint256 _nftId, NestedStructs.Holding memory _holding) internal onlyTokenOwner(_nftId) {
        IERC20 token = IERC20(_holding.token);
        uint256 feeAmount = _calculateFees(msg.sender, _holding.amount);

        transferFee(feeAmount, token);
        token.safeTransfer(msg.sender, _holding.amount - feeAmount);

        emit FailsafeWithdraw(_nftId, address(token));
    }

    /*
    Withdraw a token from the reserve and transfer it to the owner without exchanging it
    @param _nftId [uint256] NFT token ID
    @param _tokenIndex [uint256] index in array of tokens for this NFT and holding.
    @param _token [IERC20] token address for the holding. Used to make sure previous index param is valid
    */
    function withdraw(
        uint256 _nftId,
        uint256 _tokenIndex,
        IERC20 _token
    ) external nonReentrant onlyTokenOwner(_nftId) {
        require(
            nestedRecords.getAssetTokensLength(_nftId) > _tokenIndex &&
                nestedRecords.getAssetTokens(_nftId)[_tokenIndex] == address(_token),
            "INVALID_TOKEN_INDEX"
        );
        uint256 assetTokensLength = nestedRecords.getAssetTokensLength(_nftId);
        // use destroy instead if NFT has a single holding
        require(assetTokensLength > 1, "ERR_EMPTY_NFT");

        NestedStructs.Holding memory holding = nestedRecords.getAssetHolding(_nftId, address(_token));
        reserve.withdraw(IERC20(holding.token), holding.amount);
        _transferToWallet(_nftId, holding);

        nestedRecords.deleteAsset(_nftId, _tokenIndex);
        emit NftUpdated(_nftId);
    }

    /*
    Burn NFT and sell all tokens for a specific ERC20
    @param  _nftId uint256 NFT token Id
    @param _buyToken [IERC20] token used to make swaps
    @param _swapTarget [address] the address of the contract that will swap tokens
    @param _tokenOrders [<TokenOrder>] orders for token swaps
    */
    function _destroyForERC20(
        uint256 _nftId,
        IERC20 _buyToken,
        address payable _swapTarget,
        NestedStructs.TokenOrder[] calldata _tokenOrders
    ) internal nonReentrant onlyTokenOwner(_nftId) returns (uint256) {
        address[] memory tokens = nestedRecords.getAssetTokens(_nftId);
        uint256 tokenLength = tokens.length;

        require(tokenLength == _tokenOrders.length, "MISSING_SELL_ARGS");
        require(nestedRecords.getAssetReserve(_nftId) == address(reserve), "ASSETS_IN_DIFFERENT_RESERVE");

        uint256 buyTokenInitialBalance = _buyToken.balanceOf(address(this));

        // first transfer holdings from reserve to factory
        for (uint256 i = 0; i < tokenLength; i++) {
            NestedStructs.Holding memory holding = nestedRecords.getAssetHolding(_nftId, tokens[i]);
            reserve.withdraw(IERC20(holding.token), holding.amount);

            bool success = false;
            if (holding.token != address(_buyToken)) {
                require(_swapTargetValid(_swapTarget), "INVALID_SWAP_TARGET");

                success = ExchangeHelpers.fillQuote(
                    IERC20(_tokenOrders[i].token),
                    _swapTarget,
                    _tokenOrders[i].callData
                );
            }
            if (!success) _transferToWallet(_nftId, holding);
            nestedRecords.freeHolding(_nftId, tokens[i]);
        }

        // send swapped ERC20 to user minus fees
        uint256 amountBought = _buyToken.balanceOf(address(this)) - buyTokenInitialBalance;
        uint256 amountFees = _calculateFees(msg.sender, amountBought);
        amountBought = amountBought - amountFees;

        transferFeeWithRoyalty(amountFees, _buyToken, _nftId);

        nestedRecords.removeNFT(_nftId);
        nestedAsset.burn(msg.sender, _nftId);
        emit NftBurned(_nftId);

        return amountBought;
    }

    /*
    Burn NFT and Sell all tokens for a specific ERC20 then send it back to the user
    @param  _nftId uint256 NFT token Id
    @param _buyToken [IERC20] token used to make swaps
    @param _swapTarget [address] the address of the contract that will swap tokens
    @param _tokenOrders [<TokenOrder>] orders for token swaps
    */
    function destroyForERC20(
        uint256 _nftId,
        IERC20 _buyToken,
        address payable _swapTarget,
        NestedStructs.TokenOrder[] calldata _tokenOrders
    ) external onlyTokenOwner(_nftId) {
        uint256 amountBought = _destroyForERC20(_nftId, _buyToken, _swapTarget, _tokenOrders);
        _buyToken.safeTransfer(msg.sender, amountBought);
    }

    /*
    Burn NFT and sell all tokens for WETH, unwrap it and then send ETH to the user
    @param  _nftId uint256 NFT token Id
    @param _swapTarget [address] the address of the contract that will swap tokens
    @param _tokenOrders [<TokenOrder>] orders for token swaps
    */
    function destroyForETH(
        uint256 _nftId,
        address payable _swapTarget,
        NestedStructs.TokenOrder[] calldata _tokenOrders
    ) external payable onlyTokenOwner(_nftId) {
        // no need to check for reeentrancy because destroyForERC20 checks it
        uint256 amountBought = _destroyForERC20(_nftId, IERC20(address(weth)), _swapTarget, _tokenOrders);
        IWETH(weth).withdraw(amountBought);

        (bool success, ) = msg.sender.call{ value: amountBought }("");
        require(success, "ETH_TRANSFER_ERROR");
    }

    /**
    @dev send a fee to the FeeSplitter, royalties will be paid to the owner of the original asset
    @param _amount [uint256] to send
    @param _token [IERC20] token to send
    @param _nftId [uint256] user portfolio ID used to find a potential royalties recipient
    */
    function transferFeeWithRoyalty(
        uint256 _amount,
        IERC20 _token,
        uint256 _nftId
    ) internal {
        address originalOwner = nestedAsset.originalOwner(_nftId);
        ExchangeHelpers.setMaxAllowance(_token, address(feeTo));
        if (originalOwner != address(0)) feeTo.sendFeesWithRoyalties(originalOwner, _token, _amount);
        else feeTo.sendFees(_token, _amount);
    }

    /**
    @dev send a fee to the FeeSplitter
    @param _amount [uint256] to send
    @param _token [IERC20] token to send
    */
    function transferFee(uint256 _amount, IERC20 _token) internal {
        ExchangeHelpers.setMaxAllowance(_token, address(feeTo));
        feeTo.sendFees(_token, _amount);
    }

    /**
     * @dev unwrap ether and transfer it to sender
     * @param _amount [uint256] amount to unwrap
     */
    function _unwrapWethAndTransfer(uint256 _amount) internal {
        IWETH(weth).withdraw(_amount);
        (bool success, ) = msg.sender.call{ value: _amount }("");
        require(success, "ETH_TRANSFER_ERROR");
    }

    /**
     * @dev update the amount for a holding in NestedRecords, and deletes it if amount is 0
     * @param _nftId [uint256] NFT ID to update
     * @param _token [address] holding's token address
     * @param _amount [uint256] new holding amount
     */
    function _updateHolding(
        uint256 _nftId,
        address _token,
        uint256 _amount
    ) internal {
        nestedRecords.updateHoldingAmount(_nftId, _token, _amount);
        if (_amount == 0) {
            uint256 tokenIndex = 0;
            address[] memory tokens = nestedRecords.getAssetTokens(_nftId);
            while (tokenIndex < tokens.length) {
                if (tokens[tokenIndex] == _token) break;
                tokenIndex++;
            }
            nestedRecords.deleteAsset(_nftId, tokenIndex);
        }
    }

    /**
     * @dev Checks if a user is a VIP. User needs to have at least vipMinAmount of NST staked
     * @param _account [address] user address
     * @return a boolean indicating if user is VIP
     */
    function _isVIP(address _account) internal view returns (bool) {
        if (address(smartChef) == address(0)) return false;
        uint256 stakedNst = smartChef.userInfo(_account).amount;
        return stakedNst >= vipMinAmount;
    }

    /**
     * @dev calculates the discount for a VIP user
     * @param _user [address] user to check the VIP status of
     * @param _amount [address] amount to calculate the discount on
     * @return [uint256] the discount amount
     */
    function _calculateDiscount(address _user, uint256 _amount) private view returns (uint256) {
        // give a discount to VIP users
        if (_isVIP(_user)) return (_amount * vipDiscount) / 1000;
        return 0;
    }

    function _calculateFees(address _user, uint256 _amount) private view returns (uint256) {
        uint256 baseFee = _amount / 100;
        uint256 feeWithDiscount = baseFee - _calculateDiscount(_user, baseFee);
        return feeWithDiscount;
    }

    /**
     * Checks if the swap target is one of the contracts nested factory has privilege on
     * @param _swapTarget address for the contract that will be called
     * @return [bool] is the swap target valid
     */
    function _swapTargetValid(address _swapTarget) private view returns (bool) {
        return
            _swapTarget != address(feeTo) &&
            _swapTarget != address(nestedAsset) &&
            _swapTarget != address(nestedRecords) &&
            _swapTarget != address(reserve) &&
            !supportedReserves[_swapTarget];
    }
}
