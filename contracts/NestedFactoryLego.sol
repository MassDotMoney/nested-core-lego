// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/INestedFactoryLego.sol";
import "./interfaces/IOperatorSelector.sol";
import "./libraries/ExchangeHelpers.sol";
import "./NestedAsset.sol";
import "./interfaces/IWETH.sol";
import "./MixinOperatorResolver.sol";
import "./NestedReserve.sol";
import "./interfaces/MinimalSmartChef.sol";
import "./NestedRecords.sol";
import "./FeeSplitter.sol";

/// @title Creates, updates and destroys NestedAssets.
/// @notice Responsible for the business logic of the protocol and interaction with operators
contract NestedFactoryLego is INestedFactoryLego, ReentrancyGuard, Ownable, MixinOperatorResolver {
    using SafeERC20 for IERC20;
    address private constant ETH = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    uint256 public vipDiscount;
    uint256 public vipMinAmount;

    /// @dev Yield farming contract
    MinimalSmartChef public smartChef;

    /// @dev Current feeSplitter contract/address
    FeeSplitter public feeSplitter;

    /// @dev Current reserve contract/address
    NestedReserve public reserve;

    NestedAsset public immutable nestedAsset;
    IWETH public immutable weth;
    NestedRecords public immutable nestedRecords;

    bytes32[] private operators;

    constructor(
        NestedAsset _nestedAsset,
        NestedRecords _nestedRecords,
        IWETH _weth,
        address _operatorResolver,
        uint256 _vipDiscount,
        uint256 _vipMinAmount
    ) MixinOperatorResolver(_operatorResolver) {
        nestedAsset = _nestedAsset;
        nestedRecords = _nestedRecords;
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

    /// @notice Add an operator (name) for building cache
    /// @param operator The operator name to add
    function addOperator(bytes32 operator) external onlyOwner {
        operators.push(operator);
    }

    /// @notice Update the SmartChef contract address
    /// @param _smartChef New SmartChef address
    function updateSmartChef(address _smartChef) external onlyOwner {
        require(_smartChef != address(0), "NestedFactory::updateSmartChef: Invalid smartchef address");
        smartChef = MinimalSmartChef(_smartChef);
        emit SmartChefUpdated(_smartChef);
    }

    /// @notice Sets the reserve where the funds are stored
    /// @param _reserve the address of the new reserve
    function setReserve(NestedReserve _reserve) external onlyOwner {
        require(address(reserve) == address(0), "NestedFactory::setReserve: Reserve is immutable");
        reserve = _reserve;
    }

    /// @notice Update the VIP discount and min staked amount to be a VIP
    /// @param _vipDiscount [uint256] the fee discount to apply to a VIP user
    /// @param _vipMinAmount [uint256] min amount that needs to be staked to be a VIP
    function updateVipDiscount(uint256 _vipDiscount, uint256 _vipMinAmount) external onlyOwner {
        require(_vipDiscount < 1000, "NestedFactory::updateVipDiscount: Discount too high");
        (vipDiscount, vipMinAmount) = (_vipDiscount, _vipMinAmount);
        emit VipDiscountUpdated(vipDiscount, vipMinAmount);
    }

    /// @notice Create a portfolio and store the underlying assets
    /// @param _originalTokenId The id of the NFT replicated, 0 if not replicating
    /// @param _sellToken Token used to make the orders
    /// @param _sellTokenAmount Amount of sell tokens to use
    /// @param _orders Orders calldata
    function create(
        uint256 _originalTokenId,
        IERC20 _sellToken,
        uint256 _sellTokenAmount,
        Order[] calldata _orders
    ) external payable nonReentrant {
        require(_orders.length > 0, "NestedFactory::create: Missing orders");

        uint256 nftId = nestedAsset.mint(msg.sender, _originalTokenId);
        (uint256 fees, IERC20 tokenSold) = _commitOrders(nftId, _sellToken, _sellTokenAmount, _orders);

        transferFeeWithRoyalty(fees, tokenSold, nftId);
        emit NftCreated(nftId, _originalTokenId);
    }

    /// Commit new orders and update the NFT
    /// @param _nftId The id of the NFT to update
    /// @param _sellToken Token used to make the orders
    /// @param _sellTokenAmount Amount of sell tokens to use
    /// @param _orders Orders calldata
    function addTokens(
        uint256 _nftId,
        IERC20 _sellToken,
        uint256 _sellTokenAmount,
        Order[] calldata _orders
    ) external payable nonReentrant onlyTokenOwner(_nftId) {
        require(_orders.length > 0, "NestedFactory::addTokens: Missing orders");

        (uint256 fees, IERC20 tokenSold) = _commitOrders(_nftId, _sellToken, _sellTokenAmount, _orders);
        transferFee(fees, tokenSold);
        emit NftUpdated(_nftId);
    }

    /// Exchange an existing position from the NFT for one or more positions.
    /// @param _nftId The id of the NFT to update
    /// @param _sellToken Token used to make the orders
    /// @param _sellTokenAmount Amount of sell tokens to use
    /// @param _orders Orders calldata
    function swapTokenForTokens(
        uint256 _nftId,
        IERC20 _sellToken,
        uint256 _sellTokenAmount,
        Order[] calldata _orders
    ) external payable nonReentrant onlyTokenOwner(_nftId) {
        require(_orders.length > 0, "NestedFactory::swapTokenForTokens: Missing orders");

        // Check if sell token exist in nft and amount is enough
        NestedStructs.Holding memory holding = nestedRecords.getAssetHolding(_nftId, address(_sellToken));
        require(holding.amount >= _sellTokenAmount, "NestedFactory::swapTokenForTokens: Insufficient amount");

        // Transfer from Reserve to Factory
        NestedReserve(reserve).transfer(address(this), IERC20(holding.token), _sellTokenAmount);

        (uint256 fees, IERC20 tokenSold) = _commitOrders(_nftId, _sellToken, _sellTokenAmount, _orders);
        transferFee(fees, tokenSold);

        // Update used token records
        nestedRecords.updateHoldingAmount(_nftId, address(_sellToken), holding.amount - _sellTokenAmount);

        emit NftUpdated(_nftId);
    }

    /// @dev For every orders, call the operator with the calldata
    /// to commit to order.
    /// @param _nftId The id of the NFT impacted by the orders
    /// @param _sellToken Token used to make the orders
    /// @param _sellTokenAmount Amount of sell tokens to use
    /// @param _orders Orders calldata
    /// @return feesAmount The total amount of fees
    /// @return tokenSold The ERC20 token sold (in case of ETH to WETH)
    function _commitOrders(
        uint256 _nftId,
        IERC20 _sellToken,
        uint256 _sellTokenAmount,
        Order[] calldata _orders
    ) internal returns (uint256 feesAmount, IERC20 tokenSold) {
        uint256 fees = _calculateFees(msg.sender, _sellTokenAmount);

        // Choose between ERC20 (safeTransfer) and ETH (deposit)
        if (address(_sellToken) == ETH) {
            require(msg.value >= _sellTokenAmount, "NestedFactory::_commitOrders: Insufficient amount in");
            weth.deposit{ value: msg.value }();
            _sellToken = IERC20(address(weth));
        } else {
            _sellToken.safeTransferFrom(msg.sender, address(this), _sellTokenAmount);
        }

        uint256 balanceBeforePurchase = _sellToken.balanceOf(address(this));
        for (uint256 i = 0; i < _orders.length; i++) {
            _commitOrder(_nftId, _orders[i]);
        }
        uint256 amountSpent = balanceBeforePurchase - _sellToken.balanceOf(address(this));
        assert(amountSpent <= _sellTokenAmount - fees); // overspent

        feesAmount = _sellTokenAmount - amountSpent;
        tokenSold = _sellToken;
    }

    /// @dev Call the operator to commit the order and add the output
    /// assets to the reserve.
    /// @param _nftId The nftId
    /// @param _order The order calldata
    function _commitOrder(uint256 _nftId, Order calldata _order) internal {
        address operator = requireAndGetAddress(_order.operator);

        // The operator address needs to be the first parameter of the operator delegatecall.
        // We assume that the calldata given by the user are only the params, without the signature.
        // Parameters are concatenated and padded to 32 bytes.
        // We are concatenating the selector + operator address + given params
        bytes4 selector = IOperatorSelector(operator).getCommitSelector();
        bytes memory safeCalldata = bytes.concat(selector, abi.encodePacked(operator), _order.callData);

        (bool success, bytes memory data) = operator.delegatecall(safeCalldata);
        require(success, "NestedFactory::_commitOrders: Operator call failed");

        // Get amounts from operator call
        uint256[] memory amounts = abi.decode(data, (uint256[]));
        IERC20(_order.outputToken).safeTransfer(address(reserve), amounts[0]);

        // Store position
        nestedRecords.store(_nftId, _order.operator, _order.outputToken, amounts[0], address(reserve));
    }

    /// @dev Send a fee to the FeeSplitter, royalties will be paid to the owner of the original asset
    /// @param _amount Amount to send
    /// @param _token Token to send
    /// @param _nftId User portfolio ID used to find a potential royalties recipient
    function transferFeeWithRoyalty(
        uint256 _amount,
        IERC20 _token,
        uint256 _nftId
    ) internal {
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
    function transferFee(uint256 _amount, IERC20 _token) internal {
        ExchangeHelpers.setMaxAllowance(_token, address(feeSplitter));
        feeSplitter.sendFees(_token, _amount);
    }

    /// @dev Calculate the fees for a specific user and amount
    /// @param _user The user address
    /// @param _amount The amount
    /// @return The fees amount
    function _calculateFees(address _user, uint256 _amount) internal view returns (uint256) {
        uint256 baseFee = _amount / 100;
        uint256 feeWithDiscount = baseFee - _calculateDiscount(_user, baseFee);
        return feeWithDiscount;
    }

    /// @dev Calculates the discount for a VIP user
    /// @param _user User to check the VIP status of
    /// @param _amount Amount to calculate the discount on
    /// @return The discount amount
    function _calculateDiscount(address _user, uint256 _amount) internal view returns (uint256) {
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
    function _isVIP(address _account) internal view returns (bool) {
        if (address(smartChef) == address(0)) {
            return false;
        }
        uint256 stakedNst = smartChef.userInfo(_account).amount;
        return stakedNst >= vipMinAmount;
    }
}
