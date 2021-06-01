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

// import "hardhat/console.sol";

/**
 * @title Creates, updates and destroys NestedAssets.
 * It is responsible for the business logic of the protocol and interaction with other contracts.
 */
contract NestedFactory is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    event NftCreated(uint256 indexed nftId, uint256 originalNftId);
    event FailsafeWithdraw(uint256 indexed nftId, address indexed token);
    event ReserveRegistered(address indexed reserve);
    event AssetsMigrated(uint256 indexed nftId, address to);
    event NftUpdated(uint256 indexed nftId);

    IWETH public immutable weth;
    FeeSplitter public feeTo;
    address public feeToSetter;

    NestedReserve public reserve;
    NestedAsset public immutable nestedAsset;
    NestedRecords public immutable nestedRecords;

    mapping(address => bool) public supportedReserves;

    /*
    Reverts if the address does not exist
    @param _address [address]
    */
    modifier addressExists(address _address) {
        require(_address != address(0), "NestedFactory: INVALID_ADDRESS");
        _;
    }

    /*
    Reverts if the address is not a reserve
    @param _reserve [address]
    */
    modifier isNestedReserve(address _reserve) {
        require(supportedReserves[_reserve], "NestedFactory: NOT_A_RESERVE");
        _;
    }

    /*
    @param _asset [NestedReserve]
    @param _feeToSetter [address] The address which will be allowed to choose where the fees go
    @param _feeTo [FeeSplitter] the address or contract that receives fees
    @param _weth [IWETH] The wrapped ether contract
    */
    constructor(
        NestedAsset _asset,
        NestedRecords _records,
        address _feeToSetter,
        FeeSplitter _feeTo,
        IWETH _weth
    ) {
        feeToSetter = _feeToSetter;
        feeTo = _feeTo;
        weth = _weth;
        nestedAsset = _asset;
        nestedRecords = _records;
    }

    /*
    Reverts the transaction if the caller is not the token owner
    @param _nftId uint256 the NFT Id
    */
    modifier onlyTokenOwner(uint256 _nftId) {
        require(nestedAsset.ownerOf(_nftId) == msg.sender, "NestedFactory: NOT_TOKEN_OWNER");
        _;
    }

    /*
    Receive function 
    */
    receive() external payable {}

    /**
    Moves all the assets for an NFT to a new reserve
    @param _nftId [uint256] the ID for the NFT to migrate
    @param _nextReserve [address] the new reserve address
    */
    function migrateAssets(uint256 _nftId, address _nextReserve)
        external
        onlyTokenOwner(_nftId)
        addressExists(_nextReserve)
        isNestedReserve(_nextReserve)
    {
        address[] memory tokens = nestedRecords.getAssetTokens(_nftId);
        address currentReserve = nestedRecords.getAssetReserve(_nftId);
        require(currentReserve == address(reserve), "NestedFactory: ASSETS_NOT_IN_RESERVE");

        for (uint256 i = 0; i < tokens.length; i++) {
            NestedStructs.Holding memory holding = nestedRecords.getAssetHolding(_nftId, tokens[i]);
            reserve.transfer(_nextReserve, IERC20(holding.token), holding.amount);
        }
        nestedRecords.setReserve(_nftId, _nextReserve);
        emit AssetsMigrated(_nftId, _nextReserve);
    }

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
   @param feeTo The address of the receiver
   */
    function setFeeTo(FeeSplitter _feeTo) external addressExists(address(_feeTo)) {
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
    Sets the reserve where the funds are stored
    @param _reserve the address of the new factory
    */
    function setReserve(NestedReserve _reserve) external addressExists(address(_reserve)) {
        require(address(reserve) == address(0), "NestedFactory: FACTORY_IMMUTABLE");
        reserve = _reserve;
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
                require(success, "NestedFactory: RESERVE_CALL_FAILED");
                amountBought = balanceBeforePurchase - IERC20(_tokenOrders[i].token).balanceOf(address(this));
            } else {
                bool success = ExchangeHelpers.fillQuote(_sellToken, _swapTarget, _tokenOrders[i].callData);
                require(success, "NestedFactory: SWAP_CALL_FAILED");
                amountBought = IERC20(_tokenOrders[i].token).balanceOf(address(this)) - balanceBeforePurchase;
                IERC20(_tokenOrders[i].token).safeTransfer(address(reserve), amountBought);
            }
            nestedRecords.store(_nftId, _tokenOrders[i].token, amountBought, address(reserve));
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
        NestedStructs.TokenOrder[] calldata _tokenOrders
    ) external payable nonReentrant {
        uint256 nftId = nestedAsset.mint(msg.sender, _metadataURI, _originalTokenId);
        uint256 fees = _addTokens(nftId, _sellToken, _sellTokenAmount, _swapTarget, _tokenOrders);

        if (address(_sellToken) == 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE) {
            _sellToken = IERC20(address(weth));
        }
        transferFeeWithRoyalty(fees, _sellToken, nftId, msg.sender);
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

        uint256 fees = _sellTokenAmount / 100;
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
    Swap an existing asset from the NFT to another one.
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

        // we transfer from reserve to factory
        NestedReserve(reserve).transfer(address(this), IERC20(holding.token), _sellTokenAmount);

        uint256 fees = _sellTokenAmount / 100;
        uint256 balanceBeforePurchase = _sellToken.balanceOf(address(this));
        exchangeAndStoreTokens(_nftId, _sellToken, _swapTarget, _tokenOrders);
        uint256 amountSpent = balanceBeforePurchase - _sellToken.balanceOf(address(this));
        require(amountSpent <= _sellTokenAmount - fees, "OVERSPENT_ERROR");

        nestedRecords.updateHoldingAmount(_nftId, address(_sellToken), holding.amount - _sellTokenAmount);
        transferFee(_sellTokenAmount - amountSpent, _sellToken);
        emit NftUpdated(_nftId);
    }

    /**
    Liquidiate one or more holdings and transfer the sale amount to the User. Fee is collected without paying roylaties.
    @param _nftId [uint] the id of the NFT to update
    @param _sellTokens [<IERC20>] tokens used to make swaps
    @param _sellTokensAmount [<uint>] amount of sell tokens to exchange
    @param _swapTarget [address] the address of the contract that will swap tokens
    @param _tokenOrders [<TokenOrder>] orders for token swaps
    */
    function sellTokensToWallet(
        uint256 _nftId,
        IERC20 _buyToken,
        IERC20[] memory _sellTokens,
        uint256[] memory _sellTokensAmount,
        address payable _swapTarget,
        NestedStructs.TokenOrder[] calldata _tokenOrders
    ) external payable nonReentrant onlyTokenOwner(_nftId) {
        require(_tokenOrders.length > 0, "BUY_ARG_MISSING");
        require(_tokenOrders.length == _sellTokensAmount.length, "SELL_AMOUNT_MISSING");

        uint256 buyTokenInitialBalance = _buyToken.balanceOf(address(this));

        for (uint256 i = 0; i < _sellTokens.length; i++) {
            // check if sell token exist in nft and amount is enough
            NestedStructs.Holding memory holding = nestedRecords.getAssetHolding(_nftId, address(_sellTokens[i]));
            require(holding.amount >= _sellTokensAmount[i], "INSUFFICIENT_AMOUNT");

            // we transfer from reserve to factory
            reserve.withdraw(IERC20(holding.token), _sellTokensAmount[i]);

            if (_sellTokens[i] != _buyToken) {
                bool success = ExchangeHelpers.fillQuote(_sellTokens[i], _swapTarget, _tokenOrders[i].callData);
                require(success, "SWAP_CALL_FAILED");
            }

            nestedRecords.updateHoldingAmount(_nftId, address(_sellTokens[i]), holding.amount - _sellTokensAmount[i]);
        }

        uint256 amountBought = _buyToken.balanceOf(address(this)) - buyTokenInitialBalance;
        uint256 amountFees = amountBought / 100;
        amountBought = amountBought - amountFees;

        // if buy token is WETH, unwrap it instead of transferring it to the sender
        if (address(_buyToken) == address(weth)) _unwrapWeth(amountBought);
        else require(_buyToken.transfer(msg.sender, amountBought), "TOKEN_TRANSFER_ERROR");

        transferFee(amountFees, _buyToken);
        emit NftUpdated(_nftId);
    }

    /*
    send a holding content back to the owner without exchanging it. Does not update NestedRecords
    _token has to be transfered from reserve to factory first.
    @param _nftId [uint256] NFT token ID
    @param _holding [Holding] holding to withdraw
    */
    function _transferToWallet(uint256 _nftId, NestedStructs.Holding memory _holding) internal onlyTokenOwner(_nftId) {
        uint256 assetTokensLength = nestedRecords.getAssetTokensLength(_nftId);

        require(assetTokensLength > 1, "ERR_EMPTY_NFT");

        IERC20 token = IERC20(_holding.token);
        uint256 feeAmount = _holding.amount / 100;

        transferFee(feeAmount, token);
        token.transfer(msg.sender, _holding.amount - feeAmount);

        emit FailsafeWithdraw(_nftId, address(token));
    }

    /*
    send a holding content back to the owner without exchanging it
    @param _nftId [uint256] NFT token ID
    @param _tokenIndex [uint256] index in array of tokens for this NFT and holding.
    @param _token [IERC20] token address for the holding. Used to make sure previous index param is valid
    */
    function withdraw(
        uint256 _nftId,
        uint256 _tokenIndex,
        IERC20 _token
    ) external onlyTokenOwner(_nftId) {
        require(
            nestedRecords.getAssetTokensLength(_nftId) > _tokenIndex &&
                nestedRecords.getAssetTokens(_nftId)[_tokenIndex] == address(_token),
            "INVALID_TOKEN_INDEX"
        );

        NestedStructs.Holding memory holding = nestedRecords.getAssetHolding(_nftId, address(_token));
        reserve.withdraw(IERC20(holding.token), holding.amount);
        _transferToWallet(_nftId, holding);

        nestedRecords.deleteAsset(_nftId, _tokenIndex);
        emit NftUpdated(_nftId);
    }

    /*
    Burn NFT and Sell all tokens for a specific ERC20
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
        require(
            nestedRecords.getAssetReserve(_nftId) == address(reserve),
            "NestedFactory: ASSETS_IN_DIFFERENT_RESERVE"
        );

        uint256 buyTokenInitialBalance = _buyToken.balanceOf(address(this));

        // first transfer holdings from reserve to factory
        for (uint256 i = 0; i < tokenLength; i++) {
            NestedStructs.Holding memory holding = nestedRecords.getAssetHolding(_nftId, tokens[i]);
            reserve.withdraw(IERC20(holding.token), holding.amount);

            bool success = false;
            if (holding.token != address(_buyToken))
                success = ExchangeHelpers.fillQuote(
                    IERC20(_tokenOrders[i].token),
                    _swapTarget,
                    _tokenOrders[i].callData
                );
            if (!success) _transferToWallet(_nftId, holding);
            nestedRecords.freeHolding(_nftId, tokens[i]);
        }

        // send swapped ERC20 to user minus fees
        uint256 amountBought = _buyToken.balanceOf(address(this)) - buyTokenInitialBalance;
        uint256 amountFees = amountBought / 100;
        amountBought = amountBought - amountFees;

        transferFeeWithRoyalty(amountFees, _buyToken, _nftId, msg.sender);

        nestedRecords.removeNFT(_nftId);
        nestedAsset.burn(msg.sender, _nftId);

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
        require(_buyToken.transfer(msg.sender, amountBought), "TOKEN_TRANSFER_ERROR");
    }

    /*
    Burn NFT and Sell all tokens for WETH, unwrap it and then send ETH back to the user
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
    @param _nftOwner [address] user owning the NFT
    */
    function transferFeeWithRoyalty(
        uint256 _amount,
        IERC20 _token,
        uint256 _nftId,
        address _nftOwner
    ) internal {
        address originalOwner = nestedAsset.originalOwner(_nftId);
        ExchangeHelpers.setMaxAllowance(_token, address(feeTo));
        if (originalOwner != address(0)) feeTo.sendFeesWithRoyalties(_nftOwner, originalOwner, _token, _amount);
        else feeTo.sendFees(_nftOwner, _token, _amount);
    }

    /**
    @dev send a fee to the FeeSplitter
    @param _amount [uint256] to send
    @param _token [IERC20] token to send
    */
    function transferFee(uint256 _amount, IERC20 _token) internal {
        ExchangeHelpers.setMaxAllowance(_token, address(feeTo));
        feeTo.sendFees(msg.sender, _token, _amount);
    }

    /**
     * @dev unwrap ether and transfer it to sender
     * @param _amount [uint256] amount to unwrap
     */
    function _unwrapWeth(uint256 _amount) internal {
        IWETH(weth).withdraw(_amount);
        (bool success, ) = msg.sender.call{ value: _amount }("");
        require(success, "ETH_TRANSFER_ERROR");
    }
}
