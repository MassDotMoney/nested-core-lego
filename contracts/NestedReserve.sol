//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.3;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract NestedReserve{
    using SafeERC20 for IERC20;

    address public factory;

    constructor() {
        factory = msg.sender;
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
    @param _token [address] the ERC20 to transfer
    @param _amount [uint256] the amount to transfer
    */
    function transfer(
        address _recipient,
        address _token,
        uint256 _amount
    ) external onlyFactory valid(_recipient) valid(_token) {
        IERC20(_token).safeTransfer(_recipient, _amount);
    }

    /*
    Release funds to the factory
    @param _token [address] the ERC20 to transfer
    @param _amount [uint256] the amount to transfer
    */
    function withdraw(
        address _token,
        uint256 _amount
    ) external onlyFactory valid(_token){
        IERC20(_token).safeTransfer(factory, _amount);
    }
}
