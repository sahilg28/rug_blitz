// Simple deployment script using ethers.js directly
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function main() {
  console.log('\n🚀 Deploying RugBlitz to Monad Testnet...\n');

  // Setup provider and wallet
  const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_PRIMARY);
  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  
  console.log('Deployer address:', wallet.address);
  
  // Check balance
  const balance = await provider.getBalance(wallet.address);
  console.log('Balance:', ethers.formatEther(balance), 'MON\n');

  // Read contract source
  const contractPath = path.join(__dirname, '../contracts/RugBlitzMin.sol');
  const source = fs.readFileSync(contractPath, 'utf8');

  // Compile contract (using solc)
  console.log('Compiling contract...');
  const solc = require('solc');
  
  const input = {
    language: 'Solidity',
    sources: {
      'RugBlitzMin.sol': { content: source }
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode']
        }
      }
    }
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  
  if (output.errors) {
    const errors = output.errors.filter(e => e.severity === 'error');
    if (errors.length > 0) {
      console.error('Compilation errors:');
      errors.forEach(err => console.error(err.formattedMessage));
      process.exit(1);
    }
  }

  const contract = output.contracts['RugBlitzMin.sol']['RugBlitz'];
  const abi = contract.abi;
  const bytecode = contract.evm.bytecode.object;

  console.log('✅ Contract compiled successfully\n');

  // Save ABI to frontend
  const abiPath = path.join(__dirname, '../src/lib/contract/abi.json');
  fs.writeFileSync(abiPath, JSON.stringify(abi, null, 2));
  console.log('✅ ABI saved to src/lib/contract/abi.json\n');

  // Deploy
  console.log('Deploying contract...');
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const deployTx = await factory.deploy();
  
  console.log('Transaction hash:', deployTx.hash);
  console.log('Waiting for confirmation...\n');

  const deployedContract = await deployTx.wait();
  const contractAddress = deployedContract.contractAddress;

  console.log('✅ Contract deployed successfully!\n');
  console.log('📋 Contract Address:', contractAddress);
  console.log('🔍 Explorer:', `https://testnet.monadscan.com/address/${contractAddress}`);
  
  console.log('\n📝 Next steps:');
  console.log('1. Update .env.local:');
  console.log(`   NEXT_PUBLIC_CONTRACT_ADDRESS=${contractAddress}`);
  console.log('\n2. Update src/config/chains.ts:');
  console.log(`   doorRunner: "${contractAddress}"`);
  console.log('\n3. Fund house balance:');
  console.log(`   Send MON to: ${contractAddress}`);
  console.log('\n4. Test the game!\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Deployment failed:', error);
    process.exit(1);
  });
