const { expect } = require("chai");

describe("NestedFactory", () => {
  before(async () => {
    this.NestedFactory = await ethers.getContractFactory("NestedFactory");

    this.signers = await ethers.getSigners();
    // All transaction will be sent from Alice unless explicity specified
    this.alice = this.signers[0];
    this.bob = this.signers[1];
    this.feeToSetter = this.signers[2];
  });

  beforeEach(async () => {
    this.factory = await this.NestedFactory.deploy(this.feeToSetter.address);
    await this.factory.deployed();
  });

  describe("#setFeeToSetter", () => {
    it("should set feeToSetter", async () => {
      await this.factory
        .connect(this.feeToSetter)
        .setFeeToSetter(this.bob.address);
      expect(await this.factory.feeToSetter()).to.equal(this.bob.address);
    });

    it("should revert if not authorized", async () => {
      await expect(
        this.factory.connect(this.alice).setFeeToSetter(this.bob.address)
      ).to.be.revertedWith("NestedFactory: FORBIDDEN");
    });
  });

  describe("#setFeeTo", () => {
    it("should set feeTo", async () => {
      await this.factory.connect(this.feeToSetter).setFeeTo(this.bob.address);
      expect(await this.factory.feeTo()).to.equal(this.bob.address);
    });

    it("should revert if not authorized", async () => {
      await expect(
        this.factory.connect(this.alice).setFeeTo(this.bob.address)
      ).to.be.revertedWith("NestedFactory: FORBIDDEN");
    });
  });
});
