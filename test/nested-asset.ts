import { Contract, ContractFactory } from "@ethersproject/contracts"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { expect } from "chai"
import { ethers } from "hardhat"

describe("NestedAsset", () => {
    let NestedAsset: ContractFactory, asset: Contract
    let factory: SignerWithAddress,
        otherFactory: SignerWithAddress,
        alice: SignerWithAddress,
        bob: SignerWithAddress,
        feeToSetter: SignerWithAddress,
        feeTo: SignerWithAddress
    const metadataUri = "ipfs://bafybeiam5u4xc5527tv6ghlwamd6azfthmcuoa6uwnbbvqbtsyne4p7khq/metadata.json"

    before(async () => {
        NestedAsset = await ethers.getContractFactory("NestedAsset")

        const signers = await ethers.getSigners()
        // All transaction will be sent from the factory unless explicity specified
        factory = signers[0]
        alice = signers[1]
        bob = signers[2]
        otherFactory = signers[3]
        feeToSetter = signers[4]
        feeTo = signers[5]
    })

    beforeEach(async () => {
        asset = await NestedAsset.deploy()
        await asset.setFactory(factory.address)
        await asset.deployed()
    })

    describe("#mint", () => {
        describe("when creating NFTs from scratch", async () => {
            it("should create ERC-721 tokens with relevant tokenIds", async () => {
                await asset.mint(alice.address, metadataUri, 0)
                await asset.mint(alice.address, metadataUri, 0)
                await asset.mint(bob.address, metadataUri, 0)
                expect(await asset.balanceOf(alice.address)).to.equal("2")
                expect(await asset.balanceOf(bob.address)).to.equal("1")
                expect(await asset.tokenOfOwnerByIndex(alice.address, 0)).to.equal("1")
                expect(await asset.tokenOfOwnerByIndex(alice.address, 1)).to.equal("2")
                expect(await asset.tokenOfOwnerByIndex(bob.address, 0)).to.equal("3")
            })
        })

        describe("when replicating NFTs", async () => {
            it("should create ERC-721s and store the original asset used for replication", async () => {
                await asset.mint(alice.address, metadataUri, 0)
                await asset.mint(alice.address, metadataUri, 1)
                await asset.mint(bob.address, metadataUri, 2)
                expect(await asset.originalAsset(1)).to.equal(0)
                expect(await asset.originalAsset(2)).to.equal(1)
                expect(await asset.originalAsset(3)).to.equal(1)
            })
        })

        it("should revert if the caller is not the factory", async () => {
            // Alice tries to mint a token for herself and bypass the factory
            await expect(asset.connect(alice).mint(alice.address, metadataUri, 0)).to.be.revertedWith(
                "NestedAsset: FORBIDDEN",
            )
        })
    })

    describe("#tokenURI", () => {
        it("should display NFT metadata", async () => {
            await asset.mint(alice.address, metadataUri, 0)
            const tokenId = await asset.tokenOfOwnerByIndex(alice.address, 0)
            expect(await asset.tokenURI(tokenId)).to.equal(metadataUri)
        })

        it("reverts if the token does not exist", async () => {
            await expect(asset.tokenURI(1)).to.be.revertedWith("URI query for nonexistent token")
        })
    })

    describe("#burn", () => {
        it("should burn the user's ERC-721 token", async () => {
            await asset.mint(alice.address, 0, 0)
            expect(await asset.balanceOf(alice.address)).to.equal("1")
            await asset.burn(alice.address, 1)
            expect(await asset.balanceOf(alice.address)).to.equal("0")
            expect(await asset.lastOwnerBeforeBurn(1)).to.eq(alice.address)
        })

        it("should delete", async () => {
            await asset.mint(alice.address, 0, 0)
            expect(await asset.balanceOf(alice.address)).to.equal("1")
            await asset.burn(alice.address, 1)
            expect(await asset.balanceOf(alice.address)).to.equal("0")
            expect(await asset.lastOwnerBeforeBurn(1)).to.eq(alice.address)
        })

        it("should revert when burning non existing token", async () => {
            await expect(asset.burn(alice.address, 1)).to.be.revertedWith(
                "ERC721: owner query for nonexistent token",
            )
        })

        it("should revert if the caller is not the factory", async () => {
            // Alice tries to burn the token herself and bypass the factory
            await expect(asset.connect(alice).burn(alice.address, 1)).to.be.revertedWith("NestedAsset: FORBIDDEN")
        })

        it("should revert when burning someone else's token", async () => {
            await asset.mint(bob.address, metadataUri, 0)

            // Alice asked to burn Bob's token
            await expect(asset.burn(alice.address, 1)).to.be.revertedWith("NestedAsset: FORBIDDEN")
        })
    })

    describe("#originalOwner", () => {
        beforeEach(async () => {
            await asset.mint(alice.address, metadataUri, 0)
            await asset.mint(bob.address, metadataUri, 1)
        })

        it("returns the owner address of the original asset", async () => {
            expect(await asset.originalOwner(1)).to.eq("0x0000000000000000000000000000000000000000")
            expect(await asset.originalOwner(2)).to.eq(alice.address)
        })

        it("returns the owner address of the original burnt asset", async () => {
            await asset.burn(alice.address, 1)
            expect(await asset.originalOwner(2)).to.eq(alice.address)
        })
    })

    describe("#setFactory", () => {
        it("sets the new factory", async () => {
            await asset.setFactory(otherFactory.address)
            expect(await asset.supportedFactories(otherFactory.address)).to.equal(true)
        })

        it("reverts if unauthorized", async () => {
            await expect(asset.connect(alice).setFactory(otherFactory.address)).to.be.revertedWith(
                "Ownable: caller is not the owner",
            )
            expect(await asset.supportedFactories(otherFactory.address)).to.equal(false)
        })

        it("reverts if the address is invalid", async () => {
            await expect(asset.setFactory("0x0000000000000000000000000000000000000000")).to.be.revertedWith(
                "NestedAsset: INVALID_ADDRESS",
            )
            expect(await asset.supportedFactories(otherFactory.address)).to.equal(false)
        })
    })
})
