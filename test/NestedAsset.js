const { expect } = require("chai")
const { ethers } = require("hardhat")
const { deployNestedLibrary } = require("./helpers")

describe("NestedAsset", () => {
    before(async () => {
        this.NestedAsset = await ethers.getContractFactory("NestedAsset")

        this.signers = await ethers.getSigners()
        // All transaction will be sent from the factory unless explicity specified
        this.factory = this.signers[0]
        this.alice = this.signers[1]
        this.bob = this.signers[2]
        this.weth = this.signers[3]
        this.otherFactory = this.signers[4]

        this.metadataUri = "ipfs://bafybeiam5u4xc5527tv6ghlwamd6azfthmcuoa6uwnbbvqbtsyne4p7khq/metadata.json"
    })

    beforeEach(async () => {
        this.asset = await this.NestedAsset.deploy()
        await this.asset.setFactory(this.factory.address)
        await this.asset.deployed()
    })

    describe("#mint", () => {
        describe("when creating NFTs from scratch", async () => {
            it("should create ERC-721 tokens with relevant tokenIds", async () => {
                await this.asset.mint(this.alice.address, this.metadataUri, 0)
                await this.asset.mint(this.alice.address, this.metadataUri, 0)
                await this.asset.mint(this.bob.address, this.metadataUri, 0)
                expect(await this.asset.balanceOf(this.alice.address)).to.equal("2")
                expect(await this.asset.balanceOf(this.bob.address)).to.equal("1")
                expect(await this.asset.tokenOfOwnerByIndex(this.alice.address, 0)).to.equal("1")
                expect(await this.asset.tokenOfOwnerByIndex(this.alice.address, 1)).to.equal("2")
                expect(await this.asset.tokenOfOwnerByIndex(this.bob.address, 0)).to.equal("3")
            })
        })

        describe("when replicating NFTs", async () => {
            it("should create ERC-721s and store the original asset used for replication", async () => {
                await this.asset.mint(this.alice.address, this.metadataUri, 0)
                await this.asset.mint(this.alice.address, this.metadataUri, 1)
                await this.asset.mint(this.bob.address, this.metadataUri, 2)
                expect(await this.asset.originalAsset(1)).to.equal(0)
                expect(await this.asset.originalAsset(2)).to.equal(1)
                expect(await this.asset.originalAsset(3)).to.equal(1)
            })
        })

        it("should revert if the caller is not the factory", async () => {
            // Alice tries to mint a token for herself and bypass the factory
            await expect(
                this.asset.connect(this.alice).mint(this.alice.address, this.metadataUri, 0),
            ).to.be.revertedWith("NestedAsset: FORBIDDEN")
        })
    })

    describe("#tokenURI", () => {
        it("should display NFT metadata", async () => {
            await this.asset.mint(this.alice.address, this.metadataUri, 0)
            const tokenId = await this.asset.tokenOfOwnerByIndex(this.alice.address, 0)
            expect(await this.asset.tokenURI(tokenId)).to.equal(this.metadataUri)
        })

        it("reverts if the token does not exist", async () => {
            await expect(this.asset.tokenURI(1)).to.be.revertedWith("URI query for nonexistent token")
        })
    })

    describe("#burn", () => {
        it("should burn the user's ERC-721 token", async () => {
            await this.asset.mint(this.alice.address, 0, 0)
            expect(await this.asset.balanceOf(this.alice.address)).to.equal("1")
            await this.asset.burn(this.alice.address, 1)
            expect(await this.asset.balanceOf(this.alice.address)).to.equal("0")
            expect(await this.asset.lastOwnerBeforeBurn(1)).to.eq(this.alice.address)
        })

        it("should delete", async () => {
            await this.asset.mint(this.alice.address, 0, 0)
            expect(await this.asset.balanceOf(this.alice.address)).to.equal("1")
            await this.asset.burn(this.alice.address, 1)
            expect(await this.asset.balanceOf(this.alice.address)).to.equal("0")
            expect(await this.asset.lastOwnerBeforeBurn(1)).to.eq(this.alice.address)
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
            await this.asset.mint(this.bob.address, this.metadataUri, 0)

            // Alice asked to burn Bob's token
            await expect(this.asset.burn(this.alice.address, 1)).to.be.revertedWith("revert NestedAsset: FORBIDDEN")
        })
    })

    describe("#originalOwner", () => {
        beforeEach(async () => {
            await this.asset.mint(this.alice.address, this.metadataUri, 0)
            await this.asset.mint(this.bob.address, this.metadataUri, 1)
        })

        it("returns the owner address of the original asset", async () => {
            expect(await this.asset.originalOwner(1)).to.eq("0x0000000000000000000000000000000000000000")
            expect(await this.asset.originalOwner(2)).to.eq(this.alice.address)
        })

        it("returns the owner address of the original burnt asset", async () => {
            await this.asset.burn(this.alice.address, 1)
            expect(await this.asset.originalOwner(2)).to.eq(this.alice.address)
        })
    })

    describe("#setFactory", () => {
        it("sets the new factory", async () => {
            await this.asset.setFactory(this.otherFactory.address)
            expect(await this.asset.factory()).to.equal(this.otherFactory.address)
        })

        it("reverts if unauthorized", async () => {
            await expect(this.asset.connect(this.alice).setFactory(this.otherFactory.address)).to.be.revertedWith(
                "Ownable: caller is not the owner",
            )
        })

        it("reverts if the address is invalid", async () => {
            await expect(this.asset.setFactory("0x0000000000000000000000000000000000000000")).to.be.revertedWith(
                "NestedAsset: INVALID_ADDRESS",
            )
        })
    })
})
