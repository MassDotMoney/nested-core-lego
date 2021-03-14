//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721Burnable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract NestedProduct is ERC721, ERC721Burnable, Ownable  {
  event NestedCreated(address indexed adress, address indexed owner); // TODO: add number of underlying assets

  Counters.Counter private _tokenIds;
  address public factory;

  // TODO: add address mapping to track locked tokens OR contract adress where they are locked

  constructor() ERC721("NestedProduct", "NP") public {
    factory = msg.sender;
  }

  function mint() public returns (uint256) { // TODO verify if the factory should send the creator's adress
    _tokenIds.increment();

    uint256 newNestedId = _tokenIds.current();
    _mint(msg.sender, newNestedId);

    console.log("Minting an NFT: ", address(this));
    console.log("Owner is: ", owner());
    console.log("TokenId is: ", newNestedId);
    emit NestedCreated(address(this), owner());

    return newNestedId;
  }

  /* function destroy() public onlyOwner {
    // _release();
    _burn(address(this));
  } */

   /* function _lock() {
    console.log("Minting a Nested NFT: ");
  }

  function _release() public onlyOwner() {

  } */
}
