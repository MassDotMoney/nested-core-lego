//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title Stores underlying assets of NestedNFTs.
 * Only the factory can withdraw assets.
 * The factory itself can only trigger a transfer after verification that the user holds funds present in this contract
 */
contract NestedReserve {
    using SafeERC20 for IERC20;

    address public immutable factory;

    constructor(address _factory) {
        factory = _factory;
    }

    /*
    Reverts if the address does not exist
    @param _address [address]
    */
    modifier valid(address _address) {
        require(_address != address(0), "NestedReserve: INVALID_ADDRESS");
        _;
    }

    /*
    Reverts if the caller is not the factory
    */
    modifier onlyFactory {
        require(msg.sender == factory, "NestedReserve: UNAUTHORIZED");
        _;
    }

    /*
    Release funds to a recipient
    @param _recipient [address] the receiver
    @param _token [IERC20] the token to transfer
    @param _amount [uint256] the amount to transfer
    */
    function transfer(
        address _recipient,
        IERC20 _token,
        uint256 _amount
    ) external onlyFactory valid(_recipient) valid(address(_token)) {
        _token.safeTransfer(_recipient, _amount);
    }

    /*
    Release funds to the factory
    @param _token [IERC20] the ERC20 to transfer
    @param _amount [uint256] the amount to transfer
    */
    function withdraw(IERC20 _token, uint256 _amount) external onlyFactory valid(address(_token)) {
        _token.safeTransfer(factory, _amount);
    }

    /**
     * Transfer funds from the factory directly
     * @param _token [IERC20] the ERC20 to transfer
     * @param _amount [uint256] the amount to transfer
     */
    function transferFromFactory(IERC20 _token, uint256 _amount) external onlyFactory {
        _token.safeTransferFrom(factory, address(this), _amount);
    }
}
