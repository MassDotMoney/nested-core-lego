// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.11;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./abstracts/OwnableProxyDelegation.sol";
import "./abstracts/MixinOperatorResolver.sol";
import "./libraries/ExchangeHelpers.sol";
import "./interfaces/external/IWETH.sol";
import "./interfaces/INestedFactory.sol";
import "./FeeSplitter.sol";
import "./NestedReserve.sol";
import "./NestedAsset.sol";
import "./NestedRecords.sol";

/// @title Creates, updates and destroys NestedAssets (portfolios).
/// @notice Responsible for the business logic of the protocol and interaction with operators
contract NestedFactory is INestedFactory, ReentrancyGuard, OwnableProxyDelegation, MixinOperatorResolver {
    using SafeERC20 for IERC20;

    /* ----------------------------- VARIABLES ----------------------------- */

    address private constant ETH = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    /// @dev Supported operators by the factory contract
    bytes32[] private operators;

    /// @dev Current feeSplitter contract/address
    FeeSplitter public feeSplitter;

    /// @dev Current reserve contract/address
    NestedReserve public immutable reserve;

    /// @dev Current nested asset (ERC721) contract/address
    NestedAsset public immutable nestedAsset;

    /// @dev Wrapped Ether contract/address
    /// Note: Will be WMATIC, WAVAX, WBNB,... Depending on the chain.
    IWETH public immutable weth;

    /// @dev Current records contract/address
    NestedRecords public immutable nestedRecords;

    /* ---------------------------- CONSTRUCTOR ---------------------------- */

    constructor(
        NestedAsset _nestedAsset,
        NestedRecords _nestedRecords,
        NestedReserve _reserve,
        FeeSplitter _feeSplitter,
        IWETH _weth,
        address _operatorResolver
    ) MixinOperatorResolver(_operatorResolver) {
        require(
            address(_nestedAsset) != address(0) &&
                address(_nestedRecords) != address(0) &&
                address(_reserve) != address(0) &&
                address(_feeSplitter) != address(0) &&
                address(_weth) != address(0) &&
                _operatorResolver != address(0),
            "NF: INVALID_ADDRESS"
        );
        nestedAsset = _nestedAsset;
        nestedRecords = _nestedRecords;
        reserve = _reserve;
        feeSplitter = _feeSplitter;
        weth = _weth;
    }

    /// @dev Receive function
    receive() external payable {}

    /* ------------------------------ MODIFIERS ---------------------------- */

    /// @dev Reverts the transaction if the caller is not the token owner
    /// @param _nftId The NFT Id
    modifier onlyTokenOwner(uint256 _nftId) {
        require(nestedAsset.ownerOf(_nftId) == _msgSender(), "NF: CALLER_NOT_OWNER");
        _;
    }

    /// @dev Reverts the transaction if the nft is locked (hold by design).
    /// The block.timestamp must be greater than NFT record lock timestamp
    /// @param _nftId The NFT Id
    modifier isUnlocked(uint256 _nftId) {
        require(block.timestamp > nestedRecords.getLockTimestamp(_nftId), "NF: LOCKED_NFT");
        _;
    }

    /* ------------------------------- VIEWS ------------------------------- */

    /// @notice Get the required operators
    function resolverOperatorsRequired() public view override returns (bytes32[] memory) {
        return operators;
    }

    /* -------------------------- OWNER FUNCTIONS -------------------------- */

    /// @inheritdoc INestedFactory
    function addOperator(bytes32 operator) external override onlyOwner {
        require(operator != bytes32(""), "NF: INVALID_OPERATOR_NAME");
        bytes32[] memory operatorsCache = operators;
        for (uint256 i = 0; i < operatorsCache.length; i++) {
            require(operatorsCache[i] != operator, "NF: EXISTENT_OPERATOR");
        }
        operators.push(operator);
        emit OperatorAdded(operator);
    }

    /// @inheritdoc INestedFactory
    function removeOperator(bytes32 operator) external override onlyOwner {
        uint256 operatorsLength = operators.length;
        for (uint256 i = 0; i < operatorsLength; i++) {
            if (operators[i] == operator) {
                operators[i] = operators[operatorsLength - 1];
                operators.pop();
                emit OperatorRemoved(operator);
                return;
            }
        }
        revert("NF: NON_EXISTENT_OPERATOR");
    }

    /// @inheritdoc INestedFactory
    function setFeeSplitter(FeeSplitter _feeSplitter) external override onlyOwner {
        require(address(_feeSplitter) != address(0), "NF: INVALID_FEE_SPLITTER_ADDRESS");
        feeSplitter = _feeSplitter;
        emit FeeSplitterUpdated(address(_feeSplitter));
    }

    /// @inheritdoc INestedFactory
    function unlockTokens(IERC20 _token) external override onlyOwner {
        uint256 amount = _token.balanceOf(address(this));
        _token.safeTransfer(owner(), amount);
        emit TokensUnlocked(address(_token), amount);
    }

    /* -------------------------- USERS FUNCTIONS -------------------------- */

    /// @inheritdoc INestedFactory
    function create(uint256 _originalTokenId, BatchedInputOrders[] calldata _batchedOrders)
        external
        payable
        override
        nonReentrant
    {
        uint256 batchedOrdersLength = _batchedOrders.length;
        require(batchedOrdersLength != 0, "NF: INVALID_MULTI_ORDERS");

        _checkMsgValue(_batchedOrders);
        uint256 nftId = nestedAsset.mint(_msgSender(), _originalTokenId);

        for (uint256 i = 0; i < batchedOrdersLength; i++) {
            (uint256 fees, IERC20 tokenSold) = _submitInOrders(nftId, _batchedOrders[i], false);
            _transferFeeWithRoyalty(fees, tokenSold, nftId);
        }

        emit NftCreated(nftId, _originalTokenId);
    }

    /// @inheritdoc INestedFactory
    function processInputOrders(uint256 _nftId, BatchedInputOrders[] calldata _batchedOrders)
        external
        payable
        override
        nonReentrant
        onlyTokenOwner(_nftId)
        isUnlocked(_nftId)
    {
        _checkMsgValue(_batchedOrders);
        _processInputOrders(_nftId, _batchedOrders);
        emit NftUpdated(_nftId);
    }

    /// @inheritdoc INestedFactory
    function processOutputOrders(uint256 _nftId, BatchedOutputOrders[] calldata _batchedOrders)
        external
        override
        nonReentrant
        onlyTokenOwner(_nftId)
        isUnlocked(_nftId)
    {
        _processOutputOrders(_nftId, _batchedOrders);
        emit NftUpdated(_nftId);
    }

    /// @inheritdoc INestedFactory
    function processInputAndOutputOrders(
        uint256 _nftId,
        BatchedInputOrders[] calldata _batchedInputOrders,
        BatchedOutputOrders[] calldata _batchedOutputOrders
    ) external payable override nonReentrant onlyTokenOwner(_nftId) isUnlocked(_nftId) {
        _checkMsgValue(_batchedInputOrders);
        _processInputOrders(_nftId, _batchedInputOrders);
        _processOutputOrders(_nftId, _batchedOutputOrders);
        emit NftUpdated(_nftId);
    }

    /// @inheritdoc INestedFactory
    function destroy(
        uint256 _nftId,
        IERC20 _buyToken,
        Order[] calldata _orders
    ) external override nonReentrant onlyTokenOwner(_nftId) isUnlocked(_nftId) {
        address[] memory tokens = nestedRecords.getAssetTokens(_nftId);
        uint256 tokensLength = tokens.length;
        require(_orders.length != 0, "NF: INVALID_ORDERS");
        require(tokensLength == _orders.length, "NF: INPUTS_LENGTH_MUST_MATCH");
        require(nestedRecords.getAssetReserve(_nftId) == address(reserve), "NF: RESERVE_MISMATCH");

        uint256 buyTokenInitialBalance = _buyToken.balanceOf(address(this));

        for (uint256 i = 0; i < tokensLength; i++) {
            uint256 amount = nestedRecords.getAssetHolding(_nftId, tokens[i]);
            reserve.withdraw(IERC20(tokens[i]), amount);

            _safeSubmitOrder(tokens[i], address(_buyToken), amount, _nftId, _orders[i]);
            nestedRecords.freeHolding(_nftId, tokens[i]);
        }

        // Amount calculation to send fees and tokens
        uint256 amountBought = _buyToken.balanceOf(address(this)) - buyTokenInitialBalance;
        uint256 amountFees = amountBought / 100; // 1% Fee
        amountBought -= amountFees;

        _transferFeeWithRoyalty(amountFees, _buyToken, _nftId);
        _safeTransferAndUnwrap(_buyToken, amountBought, _msgSender());

        // Burn NFT
        nestedRecords.removeNFT(_nftId);
        nestedAsset.burn(_msgSender(), _nftId);
    }

    /// @inheritdoc INestedFactory
    function withdraw(uint256 _nftId, uint256 _tokenIndex)
        external
        override
        nonReentrant
        onlyTokenOwner(_nftId)
        isUnlocked(_nftId)
    {
        uint256 assetTokensLength = nestedRecords.getAssetTokensLength(_nftId);
        require(assetTokensLength > _tokenIndex, "NF: INVALID_TOKEN_INDEX");
        // Use destroy instead if NFT has a single holding
        require(assetTokensLength > 1, "NF: UNALLOWED_EMPTY_PORTFOLIO");
        require(nestedRecords.getAssetReserve(_nftId) == address(reserve), "NF: RESERVE_MISMATCH");

        address token = nestedRecords.getAssetTokens(_nftId)[_tokenIndex];

        uint256 amount = nestedRecords.getAssetHolding(_nftId, token);
        reserve.withdraw(IERC20(token), amount);
        _safeTransferWithFees(IERC20(token), amount, _msgSender(), _nftId);

        nestedRecords.deleteAsset(_nftId, _tokenIndex);
        emit NftUpdated(_nftId);
    }

    /// @inheritdoc INestedFactory
    function updateLockTimestamp(uint256 _nftId, uint256 _timestamp) external override onlyTokenOwner(_nftId) {
        nestedRecords.updateLockTimestamp(_nftId, _timestamp);
    }

    /* ------------------------- PRIVATE FUNCTIONS ------------------------- */

    /// @dev Internal logic extraction of processInputOrders()
    /// @param _nftId The id of the NFT to update
    /// @param _batchedOrders The order to execute
    function _processInputOrders(uint256 _nftId, BatchedInputOrders[] calldata _batchedOrders) private {
        uint256 batchedOrdersLength = _batchedOrders.length;
        require(batchedOrdersLength != 0, "NF: INVALID_MULTI_ORDERS");
        require(nestedRecords.getAssetReserve(_nftId) == address(reserve), "NF: RESERVE_MISMATCH");

        for (uint256 i = 0; i < batchedOrdersLength; i++) {
            (uint256 fees, IERC20 tokenSold) = _submitInOrders(
                _nftId,
                _batchedOrders[i],
                _batchedOrders[i].fromReserve
            );
            _transferFeeWithRoyalty(fees, tokenSold, _nftId);
        }
    }

    /// @dev Internal logic extraction of processOutputOrders()
    /// @param _nftId The id of the NFT to update
    /// @param _batchedOrders The order to execute
    function _processOutputOrders(uint256 _nftId, BatchedOutputOrders[] calldata _batchedOrders) private {
        uint256 batchedOrdersLength = _batchedOrders.length;
        require(batchedOrdersLength != 0, "NF: INVALID_MULTI_ORDERS");
        require(nestedRecords.getAssetReserve(_nftId) == address(reserve), "NF: RESERVE_MISMATCH");

        for (uint256 i = 0; i < batchedOrdersLength; i++) {
            (uint256 feesAmount, uint256 amountBought) = _submitOutOrders(
                _nftId,
                _batchedOrders[i],
                _batchedOrders[i].toReserve
            );
            _transferFeeWithRoyalty(feesAmount, _batchedOrders[i].outputToken, _nftId);
            if (!_batchedOrders[i].toReserve) {
                _safeTransferAndUnwrap(_batchedOrders[i].outputToken, amountBought - feesAmount, _msgSender());
            }
        }
    }

    /// @dev For every orders, call the operator with the calldata
    /// to submit orders (where the input is one asset).
    /// @param _nftId The id of the NFT impacted by the orders
    /// @param _batchedOrders The order to process
    /// @param _fromReserve True if the input tokens are from the reserve (portfolio)
    /// @return feesAmount The total amount of fees on the input
    /// @return tokenSold The ERC20 token sold (in case of ETH to WETH)
    function _submitInOrders(
        uint256 _nftId,
        BatchedInputOrders calldata _batchedOrders,
        bool _fromReserve
    ) private returns (uint256 feesAmount, IERC20 tokenSold) {
        uint256 batchLength = _batchedOrders.orders.length;
        require(batchLength != 0, "NF: INVALID_ORDERS");
        uint256 _inputTokenAmount;
        (tokenSold, _inputTokenAmount) = _transferInputTokens(
            _nftId,
            _batchedOrders.inputToken,
            _batchedOrders.amount,
            _fromReserve
        );

        uint256 amountSpent;
        for (uint256 i = 0; i < batchLength; i++) {
            amountSpent += _submitOrder(
                address(tokenSold),
                _batchedOrders.orders[i].token,
                _nftId,
                _batchedOrders.orders[i],
                true // always to the reserve
            );
        }
        feesAmount = amountSpent / 100; // 1% Fee
        require(amountSpent <= _inputTokenAmount - feesAmount, "NF: OVERSPENT");

        uint256 underSpentAmount = _inputTokenAmount - feesAmount - amountSpent;
        if (underSpentAmount != 0) {
            tokenSold.safeTransfer(_fromReserve ? address(reserve) : _msgSender(), underSpentAmount);
        }

        // If input is from the reserve, update the records
        if (_fromReserve) {
            _decreaseHoldingAmount(_nftId, address(tokenSold), _inputTokenAmount - underSpentAmount);
        }
    }

    /// @dev For every orders, call the operator with the calldata
    /// to submit sell orders (where the output is one asset).
    /// @param _nftId The id of the NFT impacted by the orders
    /// @param _batchedOrders The order to process
    /// @param _toReserve True if the output is store in the reserve/records (portfolio), false if not.
    /// @return feesAmount The total amount of fees on the output
    /// @return amountBought The total amount bought
    function _submitOutOrders(
        uint256 _nftId,
        BatchedOutputOrders calldata _batchedOrders,
        bool _toReserve
    ) private returns (uint256 feesAmount, uint256 amountBought) {
        uint256 batchLength = _batchedOrders.orders.length;
        require(batchLength != 0, "NF: INVALID_ORDERS");
        require(_batchedOrders.amounts.length == batchLength, "NF: INPUTS_LENGTH_MUST_MATCH");
        amountBought = _batchedOrders.outputToken.balanceOf(address(this));

        IERC20 _inputToken;
        uint256 _inputTokenAmount;
        for (uint256 i = 0; i < _batchedOrders.orders.length; i++) {
            (_inputToken, _inputTokenAmount) = _transferInputTokens(
                _nftId,
                IERC20(_batchedOrders.orders[i].token),
                _batchedOrders.amounts[i],
                true
            );

            // Submit order and update holding of spent token
            uint256 amountSpent = _submitOrder(
                address(_inputToken),
                address(_batchedOrders.outputToken),
                _nftId,
                _batchedOrders.orders[i],
                false
            );
            require(amountSpent <= _inputTokenAmount, "NF: OVERSPENT");

            uint256 underSpentAmount = _inputTokenAmount - amountSpent;
            if (underSpentAmount != 0) {
                _inputToken.safeTransfer(address(reserve), underSpentAmount);
            }

            _decreaseHoldingAmount(_nftId, address(_inputToken), _inputTokenAmount - underSpentAmount);
        }

        amountBought = _batchedOrders.outputToken.balanceOf(address(this)) - amountBought;
        feesAmount = amountBought / 100; // 1% Fee

        if (_toReserve) {
            _transferToReserveAndStore(_batchedOrders.outputToken, amountBought - feesAmount, _nftId);
        }
    }

    /// @dev Call the operator to submit the order and add the output
    /// assets to the reserve (if needed).
    /// @param _inputToken Token used to make the orders
    /// @param _outputToken Expected output token
    /// @param _nftId The nftId
    /// @param _order The order calldata
    /// @param _toReserve True if the output is store in the reserve/records, false if not.
    function _submitOrder(
        address _inputToken,
        address _outputToken,
        uint256 _nftId,
        Order calldata _order,
        bool _toReserve
    ) private returns (uint256 amountSpent) {
        (bool success, uint256[] memory amounts) = callOperator(_order, _inputToken, _outputToken);
        require(success, "NF: OPERATOR_CALL_FAILED");

        if (_toReserve) {
            _transferToReserveAndStore(IERC20(_outputToken), amounts[0], _nftId);
        }
        amountSpent = amounts[1];
    }

    /// @dev Call the operator to submit the order but dont stop if the call to the operator fail.
    ///      It will send the input token back to the msg.sender.
    /// Note : The _toReserve Boolean has been removed (compare to _submitOrder) since it was
    ///        useless for the only use case (destroy).
    /// @param _inputToken Token used to make the orders
    /// @param _outputToken Expected output token
    /// @param _amountToSpend The input amount available (to spend)
    /// @param _nftId The nftId
    /// @param _order The order calldata
    function _safeSubmitOrder(
        address _inputToken,
        address _outputToken,
        uint256 _amountToSpend,
        uint256 _nftId,
        Order calldata _order
    ) private {
        (bool success, uint256[] memory amounts) = callOperator(_order, _inputToken, _outputToken);
        if (success) {
            require(amounts[1] <= _amountToSpend, "NestedFactory::_safeSubmitOrder: Overspent");
            if (_amountToSpend > amounts[1]) {
                IERC20(_inputToken).safeTransfer(_msgSender(), _amountToSpend - amounts[1]);
            }
        } else {
            _safeTransferWithFees(IERC20(_inputToken), _amountToSpend, _msgSender(), _nftId);
        }
    }

    /// @dev Transfer tokens to the reserve, and compute the amount received to store
    /// in the records. We need to know the amount received in case of deflationary tokens.
    /// @param _token The token to transfer (IERC20)
    /// @param _amount The amount to send to the reserve
    /// @param _nftId The Token ID to store the assets
    function _transferToReserveAndStore(
        IERC20 _token,
        uint256 _amount,
        uint256 _nftId
    ) private {
        address reserveAddr = address(reserve);
        uint256 balanceReserveBefore = _token.balanceOf(reserveAddr);

        // Send output to reserve
        _token.safeTransfer(reserveAddr, _amount);

        uint256 balanceReserveAfter = _token.balanceOf(reserveAddr);

        nestedRecords.store(_nftId, address(_token), balanceReserveAfter - balanceReserveBefore, reserveAddr);
    }

    /// @dev Choose between ERC20 (safeTransfer) and ETH (deposit), to transfer from the Reserve
    ///      or the user wallet, to the factory.
    /// @param _nftId The NFT id
    /// @param _inputToken The token to receive
    /// @param _inputTokenAmount Amount to transfer
    /// @param _fromReserve True to transfer from the reserve
    /// @return Token transfered (in case of ETH)
    ///         The real amount received after the transfer to the factory
    function _transferInputTokens(
        uint256 _nftId,
        IERC20 _inputToken,
        uint256 _inputTokenAmount,
        bool _fromReserve
    ) private returns (IERC20, uint256) {
        if (address(_inputToken) == ETH) {
            require(address(this).balance >= _inputTokenAmount, "NF: INVALID_AMOUNT_IN");
            weth.deposit{ value: _inputTokenAmount }();
            return (IERC20(address(weth)), _inputTokenAmount);
        }

        uint256 balanceBefore = _inputToken.balanceOf(address(this));
        if (_fromReserve) {
            require(
                nestedRecords.getAssetHolding(_nftId, address(_inputToken)) >= _inputTokenAmount,
                "NF: INSUFFICIENT_AMOUNT_IN"
            );
            // Get input from reserve
            reserve.withdraw(IERC20(_inputToken), _inputTokenAmount);
        } else {
            _inputToken.safeTransferFrom(_msgSender(), address(this), _inputTokenAmount);
        }
        return (_inputToken, _inputToken.balanceOf(address(this)) - balanceBefore);
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

    /// @dev Decrease the amount of a NFT holding
    /// @param _nftId The NFT id
    /// @param _inputToken The token holding
    /// @param _amount The amount to subtract from the actual holding amount
    function _decreaseHoldingAmount(
        uint256 _nftId,
        address _inputToken,
        uint256 _amount
    ) private {
        nestedRecords.updateHoldingAmount(
            _nftId,
            _inputToken,
            nestedRecords.getAssetHolding(_nftId, _inputToken) - _amount
        );
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
            require(success, "NF: ETH_TRANSFER_ERROR");
        } else {
            _token.safeTransfer(_dest, _amount);
        }
    }

    /// @dev Transfer from factory and collect fees
    /// @param _token The token to transfer
    /// @param _amount The amount (with fees) to transfer
    /// @param _dest The address receiving the funds
    function _safeTransferWithFees(
        IERC20 _token,
        uint256 _amount,
        address _dest,
        uint256 _nftId
    ) private {
        uint256 feeAmount = _amount / 100; // 1% Fee
        _transferFeeWithRoyalty(feeAmount, _token, _nftId);
        _token.safeTransfer(_dest, _amount - feeAmount);
    }

    /// @dev Verify that msg.value is equal to the amount needed (in the orders)
    /// @param _batchedOrders The batched input orders
    function _checkMsgValue(BatchedInputOrders[] calldata _batchedOrders) private {
        uint256 ethNeeded;
        for (uint256 i = 0; i < _batchedOrders.length; i++) {
            if (address(_batchedOrders[i].inputToken) == ETH) {
                ethNeeded += _batchedOrders[i].amount;
            }
        }
        require(msg.value == ethNeeded, "NF: WRONG_MSG_VALUE");
    }
}
