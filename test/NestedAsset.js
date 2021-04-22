const { expect } = require("chai")

describe("NestedAsset", () => {
    before(async () => {
        this.NestedAsset = await ethers.getContractFactory("NestedAsset")

        this.signers = await ethers.getSigners()
        // All transaction will be sent from the factory unless explicity specified
        this.factory = this.signers[0]
        this.alice = this.signers[1]
        this.bob = this.signers[2]

        this.metadataUri = "ipfs://bafybeiam5u4xc5527tv6ghlwamd6azfthmcuoa6uwnbbvqbtsyne4p7khq/metadata.json"
    })

    beforeEach(async () => {
        this.asset = await this.NestedAsset.deploy()
        await this.asset.deployed()
    })

    describe("#mint", () => {
        it("should create ERC-721 tokens with relevant tokenIds", async () => {
            await this.asset.mint(this.alice.address, this.metadataUri)
            await this.asset.mint(this.alice.address, this.metadataUri)
            await this.asset.mint(this.bob.address, this.metadataUri)
            expect(await this.asset.balanceOf(this.alice.address)).to.equal("2")
            expect(await this.asset.balanceOf(this.bob.address)).to.equal("1")
            expect(await this.asset.tokenOfOwnerByIndex(this.alice.address, 0)).to.equal("1")
            expect(await this.asset.tokenOfOwnerByIndex(this.alice.address, 1)).to.equal("2")
            expect(await this.asset.tokenOfOwnerByIndex(this.bob.address, 0)).to.equal("3")
        })

        it("should revert if the caller is not the factory", async () => {
            // Alice tries to mint a token for herself and bypass the factory
            await expect(this.asset.connect(this.alice).mint(this.alice.address, this.metadataUri)).to.be.revertedWith(
                "NestedAsset: FORBIDDEN",
            )
        })
    })

    describe("#tokenURI", () => {
        it("reverts if token id is invalid", async () => {
            await expect(this.asset.tokenURI(999)).to.be.revertedWith("URI query for nonexistent token")
        })

        it("should display NFT metadata", async () => {
            await this.asset.mint(this.alice.address, this.metadataUri)
            let nft = await this.asset.tokenOfOwnerByIndex(this.alice.address, 0)
            expect(await this.asset.tokenURI(nft)).to.equal(this.metadataUri)
        })
    })

    describe("#burn", () => {
        it("should burn the user's ERC-721 token", async () => {
            await this.asset.mint(this.alice.address, this.metadataUri)
            expect(await this.asset.balanceOf(this.alice.address)).to.equal("1")
            await this.asset.burn(this.alice.address, 1)
            expect(await this.asset.balanceOf(this.alice.address)).to.equal("0")
            await expect(this.asset.ownerOf(1)).to.be.revertedWith("revert ERC721: owner query for nonexistent token")
        })

        it("should revert when burning non existing token", async () => {
            await expect(this.asset.burn(this.alice.address, 1)).to.be.revertedWith(
                "revert ERC721: owner query for nonexistent token",
            )
        })

        it("should revert if the caller is not the factory", async () => {
            // Alice tries to burn the token herself and bypass the factory
            await expect(this.asset.connect(this.alice).burn(this.alice.address, 1)).to.be.revertedWith(
                "NestedAsset: FORBIDDEN",
            )
        })

        it("should revert when burning someone else's token", async () => {
            await this.asset.mint(this.bob.address, this.metadataUri)

            // Alice asked to burn Bob's token
            await expect(this.asset.burn(this.alice.address, 1)).to.be.revertedWith("revert NestedAsset: FORBIDDEN")
        })
    })

    describe("#setFactory", () => {
        before(async () => {
            this.NestedFactory = await ethers.getContractFactory("NestedFactory")

            this.otherFactory = await this.NestedFactory.deploy(this.alice.address)
            await this.otherFactory.deployed()
        })
        it("sets the new factory", async () => {
            await this.asset.setFactory(this.otherFactory.address)
            expect(await this.asset.factory()).to.equal(this.otherFactory.address)
        })

        // TODO reverts if caller isn't factory
        // it("reverts if unauthorized", async() => {
        //     await expect(this.asset.setFactory(this.otherFactory.address)).to.be.revertedWith(
        //         "revert NestedAsset: FORBIDDEN",
        //     )
        // })
    })
})
