"use client";

import React from "react";
import { useAccount, useReadContracts } from "wagmi";
import { useWallets } from "@privy-io/react-auth";
import { useSetActiveWallet } from "@privy-io/wagmi";
import { CONTRACT_ADDRESSES } from "@/config/chains";
import ABI from "@/lib/contract/abi.json";
import { formatEther, encodeFunctionData } from "viem";
import { publicClient } from "@/lib/viem";

const DEBUG_LOGS = process.env.NEXT_PUBLIC_DEBUG_LOGS === "1";

function logDebug(message: string, meta?: Record<string, unknown>) {
  if (!DEBUG_LOGS) return;
  if (meta) {
    console.log(message, meta);
    return;
  }
  console.log(message);
}

function shortHash(hash: string) {
  if (!hash) return "";
  if (hash.length <= 18) return hash;
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

const CONTRACT_ERRORS: Record<string, string> = {
  GameAlreadyActive: "You already have an active game. Cash out or finish it first.",
  HouseRiskTooHigh: "Bet too high for current house balance. Max bet is 0.19 MON.",
  NoHouseLiquidity: "House has no funds. Please try again later.",
  BetBelowMinimum: "Minimum bet is 0.01 MON.",
  BetTooHigh: "Bet exceeds maximum allowed.",
  InvalidDoors: "Invalid difficulty selected.",
  NoActiveGame: "No active game found. Please place a bet first.",
  NothingToCashOut: "You need to win at least one level to cash out.",
  InsufficientHouseBalance: "House cannot pay your winnings right now.",
  InvalidDoorIndex: "Invalid door selected.",
  MaxLevelReached: "You've reached the maximum level!",
  TransferFailed: "Transfer failed. Please try again.",
  GameAwaitingRandomness: "Waiting for randomness. Please wait...",
  InsufficientEntropyFee: "Insufficient fee for randomness. Try again.",
};

function decodeContractError(error: any): string {
  const msg = error?.message || error?.toString() || "";
  for (const [errorName, message] of Object.entries(CONTRACT_ERRORS)) {
    if (msg.includes(errorName)) return message;
  }
  if (msg.includes("insufficient funds")) return "Insufficient wallet balance for this bet.";
  if (msg.includes("user rejected") || msg.includes("User rejected")) return "Transaction was cancelled.";
  if (msg.includes("nonce")) return "Transaction conflict. Please try again.";
  if (msg.includes("execution reverted")) return "Transaction rejected by contract. Check your bet amount.";
  return "Transaction failed. Please try again.";
}

export function useRugBlitz() {
  const { address } = useAccount();
  const { wallets } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();
  const RUG_BLITZ_ADDRESS = CONTRACT_ADDRESSES.doorRunner;

  const embeddedWallet = wallets.find(wallet => wallet.walletClientType === 'privy');
  const embeddedAddress = embeddedWallet?.address as `0x${string}` | undefined;

  React.useEffect(() => {
    if (embeddedWallet && address !== embeddedAddress) {
      // Only set active wallet if it's not already active to avoid unnecessary RPC calls
      const setWallet = async () => {
        try {
          await setActiveWallet(embeddedWallet);
        } catch (error: any) {
          // Ignore errors if wallet is already active or connection issues
          if (!error?.message?.includes('already active') && !error?.message?.includes('406')) {
            console.warn('Failed to set active wallet:', error);
          }
        }
      };
      setWallet();
    }
  }, [embeddedWallet, address, embeddedAddress, setActiveWallet]);

  const contractAddress = embeddedAddress || address || "0x0000000000000000000000000000000000000000";

  const { data: reads, refetch: refetchContractState } = useReadContracts({
    contracts: [
      { address: RUG_BLITZ_ADDRESS, abi: ABI, functionName: "getGame", args: [contractAddress] },
      { address: RUG_BLITZ_ADDRESS, abi: ABI, functionName: "getCurrentPayout", args: [contractAddress] },
      { address: RUG_BLITZ_ADDRESS, abi: ABI, functionName: "getMaxBet" },
      { address: RUG_BLITZ_ADDRESS, abi: ABI, functionName: "MAX_LEVELS" },
      { address: RUG_BLITZ_ADDRESS, abi: ABI, functionName: "houseBalance" },
      { address: RUG_BLITZ_ADDRESS, abi: ABI, functionName: "MIN_BET" },
      { address: RUG_BLITZ_ADDRESS, abi: ABI, functionName: "HOUSE_EDGE_PERCENT" },
    ],
    query: { enabled: !!contractAddress && contractAddress !== "0x0000000000000000000000000000000000000000" },
  });

  const game = reads?.[0]?.result as any | undefined;
  const currentPayout = reads?.[1]?.result as bigint | undefined;
  const maxBet = reads?.[2]?.result as bigint | undefined;
  const maxLevels = reads?.[3]?.result as bigint | undefined;
  const houseBalance = reads?.[4]?.result as bigint | undefined;
  const minBet = reads?.[5]?.result as bigint | undefined;
  const houseEdgePercent = reads?.[6]?.result as bigint | undefined;
  const hasActiveGame = game?.isActive === true;

  // Game state helpers
  const isAwaitingRandomness = game?.awaitingRandomness === true;

  // Get entropy fee from contract
  async function getEntropyFee(): Promise<bigint> {
    // Pyth Entropy on Monad testnet - use fixed fee since getFeeV2 may not be available
    // Testnet fees are typically very low (~0.0001 MON)
    const FALLBACK_FEE = BigInt(110000000000000); // 0.00011 MON
    
    try {
      const fee = await publicClient.readContract({
        address: RUG_BLITZ_ADDRESS,
        abi: ABI,
        functionName: "getEntropyFee",
      }) as bigint;
      return fee > 0 ? fee : FALLBACK_FEE;
    } catch (error) {
      console.warn("Using fallback entropy fee (Pyth not fully deployed on Monad testnet)");
      return FALLBACK_FEE;
    }
  }

  async function sendTransaction(data: `0x${string}`, value?: bigint): Promise<string> {
    if (!embeddedWallet) throw new Error("Wallet not connected. Please connect first.");
    try {
      const provider = await embeddedWallet.getEthereumProvider();
      
      // Switch to correct chain
      try {
        await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x279F' }] });
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x279F',
              chainName: 'Monad Testnet',
              nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
              rpcUrls: ['https://testnet-rpc.monad.xyz'],
              blockExplorerUrls: ['https://testnet.monadscan.com'],
            }],
          });
        } else {
          throw switchError;
        }
      }
      
      // Send transaction
      const txHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: embeddedAddress,
          to: RUG_BLITZ_ADDRESS,
          data: data,
          value: value ? `0x${value.toString(16)}` : '0x0',
        }],
      });

      logDebug("Transaction sent", { txHash: shortHash(String(txHash)) });
      
      // Wait for transaction to be mined
      const receipt = await publicClient.waitForTransactionReceipt({ 
        hash: txHash as `0x${string}`,
        timeout: 60_000, // 60 second timeout
      });

      logDebug("Transaction confirmed", { status: receipt.status });
      
      if (receipt.status === 'reverted') {
        throw new Error("Transaction reverted on-chain. Check contract conditions.");
      }
      
      return txHash as string;
    } catch (error: any) {
      console.error("Transaction error:", error);
      throw new Error(decodeContractError(error));
    }
  }

  function validateBet(valueWei: bigint, doors: number): { valid: boolean; error?: string } {
    if (!embeddedAddress) return { valid: false, error: "Please connect your wallet first." };
    if (hasActiveGame) return { valid: false, error: "You already have an active game. Cash out or finish it first." };
    if (minBet && valueWei < minBet) return { valid: false, error: `Minimum bet is ${formatEther(minBet)} MON.` };
    if (maxBet && valueWei > maxBet) return { valid: false, error: `Maximum bet is ${formatEther(maxBet)} MON.` };
    if (!houseBalance || houseBalance === BigInt(0)) return { valid: false, error: "House has no funds. Please try again later." };
    if (![3, 4, 5].includes(doors)) return { valid: false, error: "Invalid difficulty." };
    return { valid: true };
  }

  // Pyth VRF version - no seeds needed
  async function placeBet(doors: number, valueWei: bigint) {
    const validation = validateBet(valueWei, doors);
    if (!validation.valid) throw new Error(validation.error);

    logDebug("Contract placeBet (Pyth VRF)", { doors, value: formatEther(valueWei) });
    
    const data = encodeFunctionData({ abi: ABI, functionName: "placeBet", args: [doors] });
    const txHash = await sendTransaction(data, valueWei);
    await refetchContractState();
    return txHash;
  }

  // Pyth VRF version - pays entropy fee, no serverSeed
  async function selectDoor(doorIndex: number) {
    if (!hasActiveGame) {
      console.warn("No active game");
      return null;
    }
    if (isAwaitingRandomness) {
      console.warn("Already waiting for randomness");
      return null;
    }

    logDebug("Contract selectDoor (Pyth VRF)", { doorIndex });
    
    // Get entropy fee and add buffer
    const entropyFee = await getEntropyFee();
    const feeWithBuffer = entropyFee + (entropyFee / BigInt(10)); // +10% buffer
    
    const data = encodeFunctionData({ abi: ABI, functionName: "selectDoor", args: [doorIndex] });
    const txHash = await sendTransaction(data, feeWithBuffer);
    await refetchContractState();
    return txHash;
  }

  async function cashOut() {
    if (!hasActiveGame) {
      console.warn("No active game to cash out");
      return null;
    }
    const data = encodeFunctionData({ abi: ABI, functionName: "cashOut", args: [] });
    const txHash = await sendTransaction(data);
    setTimeout(() => refetchContractState(), 2000);
    return txHash;
  }

  return {
    game, currentPayout, maxBet, maxLevels, houseBalance, minBet, houseEdgePercent,
    hasActiveGame, isAwaitingRandomness, contractAddress: embeddedAddress, isWalletConnected: !!embeddedWallet,
    placeBet, selectDoor, cashOut, refetchContractState, validateBet, getEntropyFee,
  };
}
