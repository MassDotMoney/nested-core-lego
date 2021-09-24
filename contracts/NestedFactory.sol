// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./libraries/ExchangeHelpers.sol";
import "./interfaces/external/IWETH.sol";
import "./interfaces/external/MinimalSmartChef.sol";
import "./interfaces/INestedFactory.sol";
import "./interfaces/IOperatorSelector.sol";
import "./FeeSplitter.sol";
import "./MixinOperatorResolver.sol";
import "./NestedReserve.sol";
import "./NestedAsset.sol";
import "./NestedRecords.sol";

/// @title Creates, updates and destroys NestedAssets.
/// @notice Responsible for the business logic of the protocol and interaction with operators
contract NestedFactory is INestedFactory, ReentrancyGuard, Ownable, MixinOperatorResolver {
    using SafeERC20 for IERC20;
    address private constant ETH = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    /// @dev Amount of the fee discount (for VIP users)
    uint256 public vipDiscount;

    /// @dev Minimum of Nested Token staked to be a VIP user
    uint256 public vipMinAmount;

    /// @dev Supported operators by the factory contract
    bytes32[] private operators;

    /// @dev Yield farming contract
    MinimalSmartChef public smartChef;

    /// @dev Current feeSplitter contract/address
    FeeSplitter public feeSplitter;

    /// @dev Current reserve contract/address
    NestedReserve public reserve;

    NestedAsset public immutable nestedAsset;
    IWETH public immutable weth;
    NestedRecords public immutable nestedRecords;

    constructor(
        NestedAsset _nestedAsset,
        NestedRecords _nestedRecords,
        FeeSplitter _feeSplitter,
        IWETH _weth,
        address _operatorResolver,
        uint256 _vipDiscount,
        uint256 _vipMinAmount
    ) MixinOperatorResolver(_operatorResolver) {
        nestedAsset = _nestedAsset;
        nestedRecords = _nestedRecords;
        feeSplitter = _feeSplitter;
        weth = _weth;
        vipDiscount = _vipDiscount;
        vipMinAmount = _vipMinAmount;
    }

    /// @dev Reverts the transaction if the caller is not the token owner
    /// @param _nftId uint256 the NFT Id
    modifier onlyTokenOwner(uint256 _nftId) {
        require(nestedAsset.ownerOf(_nftId) == msg.sender, "NestedFactory: Not the token owner");
        _;
    }

    /// @dev Receive function
    receive() external payable {}

    /// @notice Get the required operator addresses
    function resolverAddressesRequired() public view override returns (bytes32[] memory addresses) {
        return operators;
    }

    /// @inheritdoc INestedFactory
    function addOperator(bytes32 operator) external override onlyOwner {
        operators.push(operator);
    }

    /// @inheritdoc INestedFactory
    function updateSmartChef(address _smartChef) external override onlyOwner {
        require(_smartChef != address(0), "NestedFactory::updateSmartChef: Invalid smartchef address");
        smartChef = MinimalSmartChef(_smartChef);
        emit SmartChefUpdated(_smartChef);
    }

    /// @inheritdoc INestedFactory
    function setReserve(NestedReserve _reserve) external override onlyOwner {
        require(address(reserve) == address(0), "NestedFactory::setReserve: Reserve is immutable");
        reserve = _reserve;
    }

    /// @inheritdoc INestedFactory
    function setFeeSplitter(FeeSplitter _feeSplitter) external override onlyOwner {
        require(address(_feeSplitter) != address(0), "NestedFactory::setFeeSplitter: Invalid feeSplitter address");
        feeSplitter = _feeSplitter;
    }

    /// @inheritdoc INestedFactory
    function updateVipDiscount(uint256 _vipDiscount, uint256 _vipMinAmount) external override onlyOwner {
        require(_vipDiscount < 1000, "NestedFactory::updateVipDiscount: Discount too high");
        (vipDiscount, vipMinAmount) = (_vipDiscount, _vipMinAmount);
        emit VipDiscountUpdated(vipDiscount, vipMinAmount);
    }

    /// @inheritdoc INestedFactory
    function create(
        uint256 _originalTokenId,
        IERC20 _sellToken,
        uint256 _sellTokenAmount,
        Order[] calldata _orders
    ) external payable override nonReentrant {
        require(_orders.length > 0, "NestedFactory::create: Missing orders");

        uint256 nftId = nestedAsset.mint(msg.sender, _originalTokenId);
        (uint256 fees, IERC20 tokenSold) = _submitInOrders(nftId, _sellToken, _sellTokenAmount, _orders, true, false);

        _transferFeeWithRoyalty(fees, tokenSold, nftId);
        emit NftCreated(nftId, _originalTokenId);
    }

    /// @inheritdoc INestedFactory
    function addTokens(
        uint256 _nftId,
        IERC20 _sellToken,
        uint256 _sellTokenAmount,
        Order[] calldata _orders
    ) external payable override nonReentrant onlyTokenOwner(_nftId) {
        require(_orders.length > 0, "NestedFactory::addTokens: Missing orders");

        (uint256 fees, IERC20 tokenSold) = _submitInOrders(_nftId, _sellToken, _sellTokenAmount, _orders, true, false);
        _transferFee(fees, tokenSold);
        emit NftUpdated(_nftId);
    }

    /// @inheritdoc INestedFactory
    function swapTokenForTokens(
        uint256 _nftId,
        IERC20 _sellToken,
        uint256 _sellTokenAmount,
        Order[] calldata _orders
    ) external payable override nonReentrant onlyTokenOwner(_nftId) {
        require(_orders.length > 0, "NestedFactory::swapTokenForTokens: Missing orders");
        require(
            nestedRecords.getAssetReserve(_nftId) == address(reserve),
            "NestedFactory::swapTokenForTokens: Assets in different reserve"
        );

        (uint256 fees, IERC20 tokenSold) = _submitInOrders(_nftId, _sellToken, _sellTokenAmount, _orders, true, true);
        _transferFee(fees, tokenSold);

        emit NftUpdated(_nftId);
    }

    /// @inheritdoc INestedFactory
    function sellTokensToNft(
        uint256 _nftId,
        IERC20 _buyToken,
        uint256[] memory _sellTokensAmount,
        Order[] calldata _orders
    ) external payable override nonReentrant onlyTokenOwner(_nftId) {
        require(_orders.length > 0, "NestedFactory::sellTokensToNft: Missing orders");
        require(_sellTokensAmount.length == _orders.length, "NestedFactory::sellTokensToNft: Input lengths must match");
        require(
            nestedRecords.getAssetReserve(_nftId) == address(reserve),
            "NestedFactory::sellTokensToNft: Assets in different reserve"
        );

        (uint256 feesAmount, ) = _submitOutOrders(_nftId, _buyToken, _sellTokensAmount, _orders, true, true);
        _transferFeeWithRoyalty(feesAmount, _buyToken, _nftId);

        emit NftUpdated(_nftId);
    }

    /// @inheritdoc INestedFactory
    function sellTokensToWallet(
        uint256 _nftId,
        IERC20 _buyToken,
        uint256[] memory _sellTokensAmount,
        Order[] calldata _orders
    ) external payable override nonReentrant onlyTokenOwner(_nftId) {
        require(_orders.length > 0, "NestedFactory::sellTokensToWallet: Missing orders");
        require(
            _sellTokensAmount.length == _orders.length,
            "NestedFactory::sellTokensToWallet: Input lengths must match"
        );

        (uint256 feesAmount, uint256 amountBought) =
            _submitOutOrders(_nftId, _buyToken, _sellTokensAmount, _orders, false, true);
        _safeTransferAndUnwrap(_buyToken, amountBought, msg.sender);

        emit NftUpdated(_nftId);
    }

    /// @inheritdoc INestedFactory
    function destroy(
        uint256 _nftId,
        IERC20 _buyToken,
        Order[] calldata _orders
    ) external override nonReentrant onlyTokenOwner(_nftId) {
        address[] memory tokens = nestedRecords.getAssetTokens(_nftId);
        require(_orders.length > 0, "NestedFactory::sellTokensToWallet: Missing orders");
        require(tokens.length == _orders.length, "NestedFactory::sellTokensToWallet: Missing sell args");
        require(
            nestedRecords.getAssetReserve(_nftId) == address(reserve),
            "NestedFactory::sellTokensToWallet: Assets in different reserve"
        );

        uint256 buyTokenInitialBalance = _buyToken.balanceOf(address(this));

        for (uint256 i = 0; i < tokens.length; i++) {
            NestedStructs.Holding memory holding = nestedRecords.getAssetHolding(_nftId, tokens[i]);
            reserve.withdraw(IERC20(holding.token), holding.amount);

            _submitOrder(IERC20(tokens[i]), address(_buyToken), _nftId, _orders[i], false);

            nestedRecords.freeHolding(_nftId, tokens[i]);
        }

        // Amount calculation to send fees and tokens
        uint256 amountBought = _buyToken.balanceOf(address(this)) - buyTokenInitialBalance;
        uint256 amountFees = _calculateFees(msg.sender, amountBought);
        amountBought = amountBought - amountFees;

        _transferFeeWithRoyalty(amountFees, _buyToken, _nftId);
        _safeTransferAndUnwrap(_buyToken, amountBought, msg.sender);

        // Burn NFT
        nestedRecords.removeNFT(_nftId);
        nestedAsset.burn(msg.sender, _nftId);
        emit NftBurned(_nftId);
    }

    /// @inheritdoc INestedFactory
    function withdraw(
        uint256 _nftId,
        uint256 _tokenIndex,
        IERC20 _token
    ) external override nonReentrant onlyTokenOwner(_nftId) {
        uint256 assetTokensLength = nestedRecords.getAssetTokensLength(_nftId);
        require(
            assetTokensLength > _tokenIndex && nestedRecords.getAssetTokens(_nftId)[_tokenIndex] == address(_token),
            "NestedFactory::withdraw: Invalid token index"
        );
        // Use destroy instead if NFT has a single holding
        require(assetTokensLength > 1, "NestedFactory::withdraw: Can't withdraw the last asset");

        NestedStructs.Holding memory holding = nestedRecords.getAssetHolding(_nftId, address(_token));
        reserve.withdraw(IERC20(holding.token), holding.amount);
        _safeTransferWithFees(IERC20(holding.token), holding.amount, msg.sender);

        nestedRecords.deleteAsset(_nftId, _tokenIndex);

        emit NftUpdated(_nftId);
    }

    /// @dev For every orders, call the operator with the calldata
    /// to submit buy orders (where the input is one asset).
    /// @param _nftId The id of the NFT impacted by the orders
    /// @param _inputToken Token used to make the orders
    /// @param _inputTokenAmount Amount of input tokens to use
    /// @param _orders Orders calldata
    /// @param _reserved True if the output is store in the reserve/records, false if not.
    /// @param _fromReserve True if the input tokens are from the reserve
    /// @return feesAmount The total amount of fees
    /// @return tokenSold The ERC20 token sold (in case of ETH to WETH)
    function _submitInOrders(
        uint256 _nftId,
        IERC20 _inputToken,
        uint256 _inputTokenAmount,
        Order[] calldata _orders,
        bool _reserved,
        bool _fromReserve
    ) private returns (uint256 feesAmount, IERC20 tokenSold) {
        _inputToken = _transferInputTokens(_nftId, _inputToken, _inputTokenAmount, _fromReserve);

        uint256 amountSpent;
        for (uint256 i = 0; i < _orders.length; i++) {
            amountSpent += _submitOrder(_inputToken, _orders[i].token, _nftId, _orders[i], _reserved);
        }
        uint256 fees = _calculateFees(msg.sender, _inputTokenAmount);
        assert(amountSpent <= _inputTokenAmount - fees); // overspent

        // If input is from the reserve, update the records
        if (_fromReserve) {
            _decreaseHoldingAmount(_nftId, address(_inputToken), _inputTokenAmount);
        }

        feesAmount = _inputTokenAmount - amountSpent;
        tokenSold = _inputToken;
    }

    /// @dev For every orders, call the operator with the calldata
    /// to submit sell orders (where the output is one asset).
    /// @param _nftId The id of the NFT impacted by the orders
    /// @param _outputToken Token received for every orders
    /// @param _inputTokenAmounts Amounts of tokens to use (respectively with Orders)
    /// @param _orders Orders calldata
    /// @param _reserved True if the output is store in the reserve/records, false if not.
    /// @param _fromReserve True if the input tokens are from the reserve
    /// @return feesAmount The total amount of fees
    /// @return amountBought The total amount bought
    function _submitOutOrders(
        uint256 _nftId,
        IERC20 _outputToken,
        uint256[] memory _inputTokenAmounts,
        Order[] calldata _orders,
        bool _reserved,
        bool _fromReserve
    ) private returns (uint256 feesAmount, uint256 amountBought) {
        uint256 _outputTokenInitialBalance = _outputToken.balanceOf(address(this));

        for (uint256 i = 0; i < _orders.length; i++) {
            IERC20 _inputToken =
                _transferInputTokens(_nftId, IERC20(_orders[i].token), _inputTokenAmounts[i], _fromReserve);

            // Submit order and update holding of spent token
            uint256 amountSpent = _submitOrder(_inputToken, address(_outputToken), _nftId, _orders[i], _reserved);

            if (_fromReserve) {
                _decreaseHoldingAmount(_nftId, address(_inputToken), amountSpent);
            }
        }

        amountBought = _outputToken.balanceOf(address(this)) - _outputTokenInitialBalance;
        feesAmount = _calculateFees(msg.sender, amountBought);
    }

    /// @dev Call the operator to submit the order (commit/revert) and add the output
    /// assets to the reserve (if needed).
    /// @param _inputToken Token used to make the orders
    /// @param _outputToken Expected output token
    /// @param _nftId The nftId
    /// @param _order The order calldata
    /// @param _reserved True if the output is store in the reserve/records, false if not.
    function _submitOrder(
        IERC20 _inputToken,
        address _outputToken,
        uint256 _nftId,
        Order calldata _order,
        bool _reserved
    ) private returns (uint256 amountSpent) {
        address operator = requireAndGetAddress(_order.operator);
        uint256 balanceBeforePurchase = _inputToken.balanceOf(address(this));

        // The operator address needs to be the first parameter of the operator delegatecall.
        // We assume that the calldata given by the user are only the params, without the signature.
        // Parameters are concatenated and padded to 32 bytes.
        // We are concatenating the selector + operator address + given params
        bytes4 selector;
        if (_order.commit) {
            selector = IOperatorSelector(operator).getCommitSelector();
        } else {
            selector = IOperatorSelector(operator).getRevertSelector();
        }

        bytes memory safeCalldata = bytes.concat(selector, abi.encodePacked(operator), _order.callData);

        (bool success, bytes memory data) = operator.delegatecall(safeCalldata);
        require(success, "NestedFactory::_submitOrder: Operator call failed");

        // Get amounts and tokens from operator call
        (uint256[] memory amounts, address[] memory tokens) = abi.decode(data, (uint256[], address[]));
        require(tokens[0] == _outputToken, "NestedFactory::_submitOrder: Wrong output token in calldata");

        if (_reserved) {
            // Send output to reserve
            IERC20(_outputToken).safeTransfer(address(reserve), amounts[0]);

            // Store position
            nestedRecords.store(_nftId, _outputToken, amounts[0], address(reserve));
        }
        amountSpent = balanceBeforePurchase - _inputToken.balanceOf(address(this));
    }

    /// @dev Choose between ERC20 (safeTransfer) and ETH (deposit), to transfer from the Reserve
    ///      or the user wallet, to the factory.
    /// @param _nftId The NFT id
    /// @param _inputToken The token to receive
    /// @param _inputTokenAmount Amount to transfer
    /// @param _fromReserve True to transfer from the reserve
    /// @return tokenUsed Token transfered (in case of ETH)
    function _transferInputTokens(
        uint256 _nftId,
        IERC20 _inputToken,
        uint256 _inputTokenAmount,
        bool _fromReserve
    ) private returns (IERC20 tokenUsed) {
        if (_fromReserve) {
            NestedStructs.Holding memory holding = nestedRecords.getAssetHolding(_nftId, address(_inputToken));
            require(holding.amount >= _inputTokenAmount, "NestedFactory:_transferInputTokens: Insufficient amount");

            // Get input from reserve
            reserve.withdraw(IERC20(holding.token), _inputTokenAmount);
        } else if (address(_inputToken) == ETH) {
            require(msg.value >= _inputTokenAmount, "NestedFactory::_transferInputTokens: Insufficient amount in");
            weth.deposit{ value: msg.value }();
            _inputToken = IERC20(address(weth));
        } else {
            _inputToken.safeTransferFrom(msg.sender, address(this), _inputTokenAmount);
        }
        tokenUsed = _inputToken;
    }

    /// @dev Send a fee to the FeeSplitter, royalties will be paid to the owner of the original asset
    /// @param _amount Amount to send
    /// @param _token Token to send
    /// @param _nftId User portfolio ID used to find a potential royalties recipient
    function _transferFeeWithRoyalty(
        uint256 _amount,
        IERC20 _token,
        uint256 _nftId
    ) private {
        address originalOwner = nestedAsset.originalOwner(_nftId);
        ExchangeHelpers.setMaxAllowance(_token, address(feeSplitter));
        if (originalOwner != address(0)) {
            feeSplitter.sendFeesWithRoyalties(originalOwner, _token, _amount);
        } else {
            feeSplitter.sendFees(_token, _amount);
        }
    }

    /// @dev Send a fee to the FeeSplitter
    /// @param _amount Amount to send
    /// @param _token Token to send
    function _transferFee(uint256 _amount, IERC20 _token) private {
        ExchangeHelpers.setMaxAllowance(_token, address(feeSplitter));
        feeSplitter.sendFees(_token, _amount);
    }

    /// @dev Calculate the fees for a specific user and amount
    /// @param _user The user address
    /// @param _amount The amount
    /// @return The fees amount
    function _calculateFees(address _user, uint256 _amount) private view returns (uint256) {
        uint256 baseFee = _amount / 100;
        uint256 feeWithDiscount = baseFee - _calculateDiscount(_user, baseFee);
        return feeWithDiscount;
    }

    /// @dev Calculates the discount for a VIP user
    /// @param _user User to check the VIP status of
    /// @param _amount Amount to calculate the discount on
    /// @return The discount amount
    function _calculateDiscount(address _user, uint256 _amount) private view returns (uint256) {
        // give a discount to VIP users
        if (_isVIP(_user)) {
            return (_amount * vipDiscount) / 1000;
        } else {
            return 0;
        }
    }

    /// @dev Checks if a user is a VIP.
    /// User needs to have at least vipMinAmount of NST staked
    /// @param _account User address
    /// @return Boolean indicating if user is VIP
    function _isVIP(address _account) private view returns (bool) {
        if (address(smartChef) == address(0)) {
            return false;
        }
        uint256 stakedNst = smartChef.userInfo(_account).amount;
        return stakedNst >= vipMinAmount;
    }

    /// @dev Decrease the amount of a NFT holding
    /// @param _nftId The NFT id
    /// @param _inputToken The token holding
    /// @param _amount The amount to subtract from the actual holding amount
    function _decreaseHoldingAmount(
        uint256 _nftId,
        address _inputToken,
        uint256 _amount
    ) private {
        NestedStructs.Holding memory holding = nestedRecords.getAssetHolding(_nftId, _inputToken);
        nestedRecords.updateHoldingAmount(_nftId, _inputToken, holding.amount - _amount);
    }

    /// @dev Transfer a token amount from the factory to the recipient.
    ///      The token is unwrapped if WETH.
    /// @param _token The token to transfer
    /// @param _amount The amount to transfer
    /// @param _dest The address receiving the funds
    function _safeTransferAndUnwrap(
        IERC20 _token,
        uint256 _amount,
        address _dest
    ) private {
        // if buy token is WETH, unwrap it instead of transferring it to the sender
        if (address(_token) == address(weth)) {
            IWETH(weth).withdraw(_amount);
            (bool success, ) = _dest.call{ value: _amount }("");
            require(success, "ETH_TRANSFER_ERROR");
        } else {
            _token.safeTransfer(_dest, _amount);
        }
    }

    /// @dev Transfer from factory and collect fees (without royalties)
    /// @param _token The token to transfer
    /// @param _amount The amount (with fees) to transfer
    /// @param _dest The address receiving the funds
    function _safeTransferWithFees(
        IERC20 _token,
        uint256 _amount,
        address _dest
    ) private {
        uint256 feeAmount = _calculateFees(_dest, _amount);
        _transferFee(feeAmount, _token);
        _token.safeTransfer(_dest, _amount - feeAmount);
    }
}
