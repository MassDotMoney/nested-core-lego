const { expect } = require("chai");

describe("NestedToken", () => {
  before(async () => {
    this.NestedToken = await ethers.getContractFactory("NestedToken");

    this.signers = await ethers.getSigners();
    // All transaction will be sent from the factory unless explicity specified
    this.factory = this.signers[0];
    this.alice = this.signers[1];
    this.bob = this.signers[2];
  });

  beforeEach(async () => {
    this.token = await this.NestedToken.deploy();
    await this.token.deployed();
  });

  describe("#mint", () => {
    it("should create ERC-20 and mint tokens to owner account", async () => {
      expect(await this.token.balanceOf(this.factory.address)).to.equal("150000000000000000000000000");
    });

    it("should transfer token to alice account", async () => {
        await this.token.transfer(this.alice.address, 500);
        expect(await this.token.balanceOf(this.alice.address)).to.equal(500);
      });

  });

});