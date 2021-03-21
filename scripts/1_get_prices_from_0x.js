async function main() {
// Get a quote to sell 1 ETH to buy DAI
const response = await fetch(
  'https://api.0x.org/swap/v1/quote?sellToken=ETH&buyToken=DAI&sellAmount=1000000000000000000'
);

const quote = await response.json();
// Send to ethereum with your favorite Web3 Library
ethers.sendTransaction(quote, (err, txId) => {
  console.log('Success!', txId);
});

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
