//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "@openzeppelin/contracts/utils/Context.sol";

/// @notice Ownable contract for operators using Diamond Storage
abstract contract OwnableOperator is Context {
    /// @notice the OwnableOperator data
    /// @param owner The owner operator address
    struct OwnableOperatorData {
        address owner;
    }

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /// @dev Initializes the contract setting the deployer as the initial owner.
    constructor() {
        address msgSender = _msgSender();
        ownerStorage().owner = msgSender;
        emit OwnershipTransferred(address(0), msgSender);
    }

    /// @dev Returns the address of the current owner.
    function owner() public view virtual returns (address) {
        return ownerStorage().owner;
    }

    /// @dev Throws if called by any account other than the owner.
    modifier onlyOwner() {
        require(owner() == _msgSender(), "OwnableOperator: caller is not the owner");
        _;
    }

    /// @dev Leaves the contract without owner. It will not be possible to call
    /// `onlyOwner` functions anymore. Can only be called by the current owner.
    ///
    /// NOTE: Renouncing ownership will leave the contract without an owner,
    /// thereby removing any functionality that is only available to the owner.
    function renounceOwnership() public virtual onlyOwner {
        emit OwnershipTransferred(ownerStorage().owner, address(0));
        ownerStorage().owner = address(0);
    }

    ///
    /// @dev Transfers ownership of the contract to a new account (`newOwner`).
    /// Can only be called by the current owner.
    ///
    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(newOwner != address(0), "OwnableOperator: new owner is the zero address");
        emit OwnershipTransferred(ownerStorage().owner, newOwner);
        ownerStorage().owner = newOwner;
    }

    /// @dev Retrieve the OwnableOperatorData struct to get the owner (at a specific location)
    ///
    /// NOTE : This function must be overrided in subclasses (operators). If not, the data location
    /// will be the one by default and will create conflicts. There is a default position because the
    /// variable is of storage pointer type and can be returned without prior assignment.
    /// @return data The OwnableOperatorData struct with the current owner address.
    function ownerStorage() internal pure virtual returns (OwnableOperatorData storage data) {
        bytes32 position = keccak256("nested.operator.owner");
        assembly {
            data.slot := position
        }
    }
}
