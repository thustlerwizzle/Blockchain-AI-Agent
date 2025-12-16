import { createPublicClient, http } from "viem";
import type { Address } from "viem";
import { 
  avalancheFuji, 
  mainnet, 
  polygon, 
  bsc,
  arbitrum,
  optimism,
  base,
  zkSync,
  linea,
  scroll,
  sepolia,
  goerli,
  polygonMumbai,
  bscTestnet,
  arbitrumGoerli,
  optimismGoerli,
  baseGoerli
} from "viem/chains";
import type { Chain, PublicClient } from "viem";

export interface ChainConfig {
  name: string;
  chain: Chain;
  rpcUrl?: string;
}

export interface TransactionEvent {
  hash: string;
  from: Address;
  to: Address | null;
  value: bigint;
  blockNumber: bigint;
  timestamp: number;
  chain: string;
  data?: `0x${string}`;
}

export interface EventListener {
  stop: () => void;
}

export class MultiChainListener {
  private clients: Map<string, PublicClient> = new Map();
  private listeners: Map<string, EventListener[]> = new Map();
  private transactionCallbacks: ((tx: TransactionEvent) => void)[] = [];
  private blockCallbacks: ((block: any) => void)[] = [];

  constructor(chains: ChainConfig[] = []) {
    // Default chains - All major blockchain platforms for comprehensive monitoring
    const defaultChains: ChainConfig[] = [
      // Mainnets
      { name: "ethereum", chain: mainnet },
      { name: "polygon", chain: polygon },
      { name: "bsc", chain: bsc },
      { name: "arbitrum", chain: arbitrum },
      { name: "optimism", chain: optimism },
      { name: "base", chain: base },
      { name: "zkSync", chain: zkSync },
      { name: "linea", chain: linea },
      { name: "scroll", chain: scroll },
      // Testnets
      { name: "avalanche-fuji", chain: avalancheFuji },
      { name: "sepolia", chain: sepolia },
      { name: "goerli", chain: goerli },
      { name: "polygon-mumbai", chain: polygonMumbai },
      { name: "bsc-testnet", chain: bscTestnet },
      { name: "arbitrum-goerli", chain: arbitrumGoerli },
      { name: "optimism-goerli", chain: optimismGoerli },
      { name: "base-goerli", chain: baseGoerli },
    ];

    const chainsToUse = chains.length > 0 ? chains : defaultChains;

    for (const chainConfig of chainsToUse) {
      this.clients.set(
        chainConfig.name,
        createPublicClient({
          chain: chainConfig.chain,
          transport: http(chainConfig.rpcUrl),
        })
      );
    }
  }

  /**
   * Start listening to new blocks on all chains
   */
  startBlockListener(
    chainName: string,
    callback: (block: any) => void
  ): EventListener {
    const client = this.clients.get(chainName);
    if (!client) {
      throw new Error(`Chain ${chainName} not found`);
    }

    this.blockCallbacks.push(callback);

    const unwatch = client.watchBlocks({
      onBlock: async (block) => {
        callback({
          ...block,
          chain: chainName,
        });
      },
    });

    if (!this.listeners.has(chainName)) {
      this.listeners.set(chainName, []);
    }
    this.listeners.get(chainName)!.push({ stop: unwatch });

    return { stop: unwatch };
  }

  /**
   * Start listening to transactions on a specific chain
   */
  startTransactionListener(
    chainName: string,
    callback: (tx: TransactionEvent) => void
  ): EventListener {
    const client = this.clients.get(chainName);
    if (!client) {
      throw new Error(`Chain ${chainName} not found`);
    }

    this.transactionCallbacks.push(callback);

    const unwatch = client.watchBlocks({
      onBlock: async (block) => {
        try {
          const fullBlock = await client.getBlock({
            blockNumber: block.number,
            includeTransactions: true,
          });

          if (fullBlock.transactions) {
            for (const tx of fullBlock.transactions) {
              if (typeof tx === "object" && "hash" in tx) {
                callback({
                  hash: tx.hash,
                  from: tx.from,
                  to: tx.to,
                  value: tx.value || BigInt(0),
                  blockNumber: block.number,
                  timestamp: Number(fullBlock.timestamp),
                  chain: chainName,
                  data: tx.input,
                });
              }
            }
          }
        } catch (error) {
          console.error(`Error processing block on ${chainName}:`, error);
        }
      },
    });

    if (!this.listeners.has(chainName)) {
      this.listeners.set(chainName, []);
    }
    this.listeners.get(chainName)!.push({ stop: unwatch });

    return { stop: unwatch };
  }

  /**
   * Listen to specific contract events
   */
  startEventListener(
    chainName: string,
    eventAbi: any,
    callback: (event: any) => void
  ): EventListener {
    const client = this.clients.get(chainName);
    if (!client) {
      throw new Error(`Chain ${chainName} not found`);
    }

    const unwatch = client.watchEvent({
      event: eventAbi,
      onLogs: (logs) => {
        for (const log of logs) {
          callback({
            ...log,
            chain: chainName,
          });
        }
      },
    });

    if (!this.listeners.has(chainName)) {
      this.listeners.set(chainName, []);
    }
    this.listeners.get(chainName)!.push({ stop: unwatch });

    return { stop: unwatch };
  }

  /**
   * Stop all listeners for a specific chain
   */
  stopChainListeners(chainName: string): void {
    const listeners = this.listeners.get(chainName);
    if (listeners) {
      for (const listener of listeners) {
        listener.stop();
      }
      this.listeners.delete(chainName);
    }
  }

  /**
   * Stop all listeners
   */
  stopAllListeners(): void {
    for (const chainName of this.listeners.keys()) {
      this.stopChainListeners(chainName);
    }
  }

  /**
   * Get available chains
   */
  getChains(): string[] {
    return Array.from(this.clients.keys());
  }
}

