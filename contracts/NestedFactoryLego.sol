// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/INestedFactoryLego.sol";
import "./interfaces/IOperatorSelector.sol";
import "./NestedAsset.sol";
import "./interfaces/IWETH.sol";
import "./MixinOperatorResolver.sol";
import "./NestedReserve.sol";
import "./interfaces/MinimalSmartChef.sol";

/// @title Creates, updates and destroys NestedAssets.
/// @notice Responsible for the business logic of the protocol and interaction with operators
contract NestedFactoryLego is INestedFactoryLego, ReentrancyGuard, Ownable, MixinOperatorResolver {
    address private constant ETH = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    using SafeERC20 for IERC20;

    uint256 public vipDiscount;
    uint256 public vipMinAmount;
    NestedReserve public reserve;
    MinimalSmartChef public smartChef;
    NestedAsset public immutable nestedAsset;
    IWETH public immutable weth;

    bytes32[] private operators;

    constructor(
        NestedAsset _nestedAsset,
        IWETH _weth,
        address _operatorResolver,
        uint256 _vipDiscount,
        uint256 _vipMinAmount
    ) MixinOperatorResolver(_operatorResolver) {
        nestedAsset = _nestedAsset;
        weth = _weth;
        vipDiscount = _vipDiscount;
        vipMinAmount = _vipMinAmount;
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

    /// @dev Update the SmartChef contract address
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
        uint256 spentAmount = _commitOrders(nftId, _sellToken, _sellTokenAmount, _orders);

        // TODO
    }

    /// @dev For every orders, call the operator with the calldata
    /// to commit to order. Add the output assets to the reserve.
    /// @param _nftId The id of the NFT impacted by the orders
    /// @param _sellToken Token used to make the orders
    /// @param _sellTokenAmount Amount of sell tokens to use
    /// @param _orders Orders calldata
    /// @return spentAmount The total amount spent (to apply fees)
    function _commitOrders(
        uint256 _nftId,
        IERC20 _sellToken,
        uint256 _sellTokenAmount,
        Order[] calldata _orders
    ) private returns (uint256 spentAmount) {
        uint256 fees = _calculateFees(msg.sender, _sellTokenAmount);
        uint256 sellAmountWithFees = _sellTokenAmount + fees;

        // Choose between ERC20 (safeTransfer) and ETH (deposit)
        if (address(_sellToken) == ETH) {
            require(msg.value >= sellAmountWithFees, "NestedFactory::_commitOrders: Insufficient amount in");
            weth.deposit{ value: msg.value }();
            _sellToken = IERC20(address(weth));
        } else {
            _sellToken.safeTransferFrom(msg.sender, address(this), sellAmountWithFees);
        }

        uint256 balanceBeforePurchase = _sellToken.balanceOf(address(this));
        for (uint256 i = 0; i < _orders.length; i++) {
            address operator = requireAndGetAddress(_orders[i].operator);

            // The operator address needs to be the first parameter of the operator delegatecall.
            // We assume that the calldata given by the user are only the params, without the signature.
            // Parameters are concatenated and padded to 32 bytes.
            // We are concatenating the selector + operator address + given params
            bytes4 selector = IOperatorSelector(operator).getCommitSelector();
            bytes memory safeCalldata = bytes.concat(selector, abi.encodePacked(operator), _orders[i].callData);

            (bool success, bytes memory data) = operator.delegatecall(safeCalldata);
            require(success, "NestedFactory::_commitOrders: Operator call failed");

            // Get amounts from operator call
            uint256[] memory amounts = abi.decode(data, (uint256[]));
            IERC20(_orders[i].outputToken).safeTransfer(address(reserve), amounts[0]);

            // TODO Store position
        }
        uint256 amountSpent = balanceBeforePurchase - _sellToken.balanceOf(address(this));
        assert(amountSpent <= _sellTokenAmount); // overspent

        spentAmount = _sellTokenAmount - amountSpent + fees;
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
}
