import { ethers } from "hardhat";

async function main() {
  // Pyth Entropy address on Monad Testnet
  // Check https://docs.pyth.network/entropy/chainlist for latest
  const ENTROPY_ADDRESS = "0x4374e5a8b9C22271E9EB878A2AA31DE97DF15DAF";

  console.log("Deploying RugBlitz to Monad Testnet...");
  console.log("Using Pyth Entropy at:", ENTROPY_ADDRESS);

  const RugBlitz = await ethers.getContractFactory("RugBlitz");
  const rugBlitz = await RugBlitz.deploy(ENTROPY_ADDRESS);

  await rugBlitz.waitForDeployment();

  const address = await rugBlitz.getAddress();
  console.log("\n✅ RugBlitz deployed to:", address);
  console.log("\n📝 Next steps:");
  console.log("1. Update NEXT_PUBLIC_CONTRACT_ADDRESS in .env.local");
  console.log("2. Update CONTRACT_ADDRESSES.doorRunner in src/config/chains.ts");
  console.log("3. Fund the house by sending MON to the contract");
  console.log("\n🔗 View on Monad Explorer:");
  console.log(`https://testnet.monadscan.com/address/${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
