"use client";

import { useEffect, useRef } from "react";
import { keccak256, toHex } from "viem";
import { publicClient } from "@/lib/viem";
import ABI from "@/lib/contract/abi.json";

let globalRateLimitUntil: number | null = null;
const MAX_BLOCK_RANGE = BigInt(90);

interface UseContractEventPollingProps {
  address: `0x${string}`;
  eventName: string;
  args?: any;
  enabled?: boolean;
  onLogs: (logs: any[]) => void;
  onError?: (error: Error) => void;
  pollingInterval?: number;
}

export function useContractEventPolling({
  address,
  eventName,
  args,
  enabled,
  onLogs,
  onError,
  pollingInterval = 5000,
}: UseContractEventPollingProps) {
  const lastBlockNumber = useRef<bigint | null>(null);
  const isPolling = useRef(false);
  const processedEvents = useRef<Set<string>>(new Set());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failureCount = useRef(0);
  const rateLimitUntil = useRef<number | null>(null);
  const consecutiveRateLimits = useRef(0);

  useEffect(() => {
    if (!enabled || !address) return;

    const isRateLimited = () => {
      const instanceLimited = rateLimitUntil.current !== null && Date.now() < rateLimitUntil.current;
      const globalLimited = globalRateLimitUntil !== null && Date.now() < globalRateLimitUntil;
      return instanceLimited || globalLimited;
    };

    const computeNextDelayMs = () => {
      const instanceWait = rateLimitUntil.current !== null && Date.now() < rateLimitUntil.current 
        ? rateLimitUntil.current - Date.now() + 5000 
        : 0;
      const globalWait = globalRateLimitUntil !== null && Date.now() < globalRateLimitUntil
        ? globalRateLimitUntil - Date.now() + 5000
        : 0;
      const waitTime = Math.max(instanceWait, globalWait);
      
      if (waitTime > 0) {
        return Math.max(waitTime, 30_000);
      }

      const maxDelayMs = 60_000;
      const exp = Math.min(failureCount.current, 5);
      const base = pollingInterval * Math.pow(2, exp);
      const delay = Math.min(base, maxDelayMs);
      const jitter = delay * 0.1 * (Math.random() * 2 - 1);
      return Math.max(500, Math.floor(delay + jitter));
    };

    const scheduleNext = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(pollEvents, computeNextDelayMs());
    };

    const pollEvents = async () => {
      if (isPolling.current) return;
      
      if (isRateLimited()) {
        scheduleNext();
        return;
      }
      
      isPolling.current = true;

      try {
        const currentBlock = await publicClient.getBlockNumber();
        let fromBlock = lastBlockNumber.current ?? (currentBlock > MAX_BLOCK_RANGE ? currentBlock - MAX_BLOCK_RANGE : BigInt(0));
        if (currentBlock - fromBlock > MAX_BLOCK_RANGE) {
          fromBlock = currentBlock - MAX_BLOCK_RANGE;
        }
        
        const logs = await publicClient.getLogs({
          address,
          event: {
            name: eventName,
            type: 'event',
            inputs: ABI.find((item: any) => item.type === 'event' && item.name === eventName)?.inputs || []
          },
          args,
          fromBlock,
          toBlock: currentBlock,
        });

        if (logs.length > 0) {
          const newLogs = logs.filter((log: any) => {
            const eventId = `${log.transactionHash}-${log.logIndex}`;
            if (processedEvents.current.has(eventId)) return false;
            processedEvents.current.add(eventId);
            return true;
          });
          if (newLogs.length > 0) onLogs(newLogs);
        }

        if (processedEvents.current.size > 5000) {
          processedEvents.current.clear();
        }

        lastBlockNumber.current = currentBlock;
        failureCount.current = 0;
        consecutiveRateLimits.current = 0;
      } catch (error: any) {
        const isRateLimitError = 
          error?.status === 429 || 
          error?.statusCode === 429 ||
          error?.message?.includes('429') ||
          error?.message?.includes('Too Many Requests') ||
          error?.message?.includes('rate limit');

        if (isRateLimitError) {
          consecutiveRateLimits.current += 1;
          const rateLimitDuration = Math.min(30_000 * Math.pow(2, consecutiveRateLimits.current - 1), 300_000);
          const rateLimitExpiry = Date.now() + rateLimitDuration;
          
          rateLimitUntil.current = rateLimitExpiry;
          globalRateLimitUntil = rateLimitExpiry;
          isPolling.current = false;
          scheduleNext();
          return;
        }

        try {
          const currentBlock = await publicClient.getBlockNumber();
          let fromBlock = lastBlockNumber.current ?? (currentBlock > MAX_BLOCK_RANGE ? currentBlock - MAX_BLOCK_RANGE : BigInt(0));
          if (currentBlock - fromBlock > MAX_BLOCK_RANGE) {
            fromBlock = currentBlock - MAX_BLOCK_RANGE;
          }
          const logs = await publicClient.getLogs({ address, fromBlock, toBlock: currentBlock });

          const eventAbi = ABI.find((item: any) => item.type === 'event' && item.name === eventName);
          if (eventAbi && eventAbi.inputs) {
            const signatureString = `${eventName}(${eventAbi.inputs.map((input: any) => input.type).join(',')})`;
            const eventSignature = keccak256(toHex(signatureString));
            const filteredLogs = logs.filter((log: any) => log.topics[0] === eventSignature);
            
            const newLogs = filteredLogs.filter((log: any) => {
              const eventId = `${log.transactionHash}-${log.logIndex}`;
              if (processedEvents.current.has(eventId)) return false;
              processedEvents.current.add(eventId);
              return true;
            });
            if (newLogs.length > 0) onLogs(newLogs);
          }
          lastBlockNumber.current = currentBlock;
          if (processedEvents.current.size > 5000) {
            processedEvents.current.clear();
          }
          failureCount.current = 0;
          consecutiveRateLimits.current = 0;
        } catch (fallbackError: any) {
          const isRateLimitError = 
            fallbackError?.status === 429 || 
            fallbackError?.statusCode === 429 ||
            fallbackError?.message?.includes('429') ||
            fallbackError?.message?.includes('Too Many Requests') ||
            fallbackError?.message?.includes('rate limit');

          if (isRateLimitError) {
            consecutiveRateLimits.current += 1;
            const rateLimitDuration = Math.min(30_000 * Math.pow(2, consecutiveRateLimits.current - 1), 300_000);
            const rateLimitExpiry = Date.now() + rateLimitDuration;
            
            rateLimitUntil.current = rateLimitExpiry;
            globalRateLimitUntil = rateLimitExpiry;
            isPolling.current = false;
            scheduleNext();
            return;
          }

          console.error(`Error polling ${eventName} (fallback):`, fallbackError);
          failureCount.current += 1;
          onError?.(fallbackError as Error);
        }
      } finally {
        isPolling.current = false;
        scheduleNext();
      }
    };

    pollEvents();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      isPolling.current = false;
    };
  }, [address, eventName, args, enabled, onLogs, onError, pollingInterval]);
}

export { publicClient };
