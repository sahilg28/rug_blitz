import { defineChain } from 'viem'
import { http, createConfig } from 'wagmi'

// Monad Testnet - Complete config for Privy compatibility
export const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  network: 'monad-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'MON',
    symbol: 'MON',
  },
  rpcUrls: {
    default: { 
      http: [
        'https://testnet-rpc.monad.xyz',
      ],
    },
    public: { 
      http: [
        'https://testnet-rpc.monad.xyz',
      ],
    },
  },
  blockExplorers: {
    default: { 
      name: 'Monad Testnet Explorer', 
      url: 'https://testnet.monadscan.com',
    },
  },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
    },
  },
  testnet: true,
})


export const wagmiConfig = createConfig({
  chains: [monadTestnet],
  transports: {
    [monadTestnet.id]: http('https://testnet-rpc.monad.xyz', {
      retryCount: 3,
      retryDelay: 1000,
      timeout: 30000,
    }),
  },
})

export const CONTRACT_ADDRESSES = {
  // RugBlitz contract on Monad Testnet — update after deployment
  doorRunner: "0xf7508502e21A4D0256A0362ccF6733a122940f0d",
} as const;
