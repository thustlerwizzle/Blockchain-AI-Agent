// API client for fetching data from the Blockchain AI Agent server
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface ApiStats {
  running: boolean;
  stats: {
    transactionsProcessed?: number;
    suspiciousTransactions?: number;
    strategiesTriggered?: number;
    chainsMonitored?: number;
    uptime?: number;
  };
  metrics: {
    averageReward?: number;
    successRate?: number;
  };
  recentTransactions?: Transaction[];
}

export interface Transaction {
  id?: string;
  hash: string;
  from: string;
  to: string | null;
  value: string | bigint;
  chain: string;
  riskScore?: number;
  suspicious?: boolean;
  timestamp?: number;
  blockNumber?: string | bigint;
  flags?: string[];
  anomalyFlags?: string[];
  summary?: string;
  category?: string;
}

export interface ChainData {
  chain: string;
  transactions: number;
  value: number;
}

async function fetchApi<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    cache: 'no-store',
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }
  
  return response.json();
}

export const api = {
  async getStats(): Promise<ApiStats> {
    return fetchApi<ApiStats>('/api/stats');
  },

  async getRecentTransactions(limit: number = 100): Promise<Transaction[]> {
    try {
      const stats = await this.getStats();
      const txs = stats.recentTransactions || [];
      
      // If we need more transactions, try to get high-risk ones too
      if (txs.length < limit) {
        try {
          const highRisk = await this.getHighRiskTransactions();
          // Merge and deduplicate by hash
          const txMap = new Map<string, Transaction>();
          txs.forEach(tx => {
            if (tx.hash) txMap.set(tx.hash, tx);
          });
          highRisk.forEach(tx => {
            if (tx.hash && !txMap.has(tx.hash)) txMap.set(tx.hash, tx);
          });
          return Array.from(txMap.values()).slice(0, limit);
        } catch {
          return txs;
        }
      }
      
      return txs.slice(0, limit);
    } catch (error) {
      console.error('Failed to fetch recent transactions:', error);
      return [];
    }
  },

  async getHighRiskTransactions(): Promise<Transaction[]> {
    try {
      const data = await fetchApi<{ transactions: Transaction[] }>('/api/high-risk/transactions?limit=50');
      return data.transactions || [];
    } catch (error) {
      console.error('Failed to fetch high-risk transactions:', error);
      return [];
    }
  },

  async getChainActivity(): Promise<ChainData[]> {
    try {
      const data = await fetchApi<{ chains: any[] }>('/api/high-risk/chains');
      const chains = data.chains || [];
      
      // Transform the API response to match our ChainData interface
      // The API might return different field names
      return chains.map((chain: any) => ({
        chain: chain.chain || chain.name || 'unknown',
        transactions: chain.transactions || chain.txCount || chain.count || 0,
        value: chain.value || chain.totalValue || chain.volume || 0,
      }));
    } catch (error) {
      console.error('Failed to fetch chain activity:', error);
      return [];
    }
  },

  async getMarketManipulationAlerts(limit: number = 50): Promise<any[]> {
    try {
      const data = await fetchApi<{ alerts: any[] }>(`/api/market-manipulation/alerts?limit=${limit}`);
      return data.alerts || [];
    } catch (error) {
      console.error('Failed to fetch market manipulation alerts:', error);
      return [];
    }
  },

  async getSuspiciousWallets(limit: number = 50): Promise<any[]> {
    try {
      const data = await fetchApi<{ wallets: any[] }>(`/api/wallets/suspicious?limit=${limit}`);
      return data.wallets || [];
    } catch (error) {
      console.error('Failed to fetch suspicious wallets:', error);
      return [];
    }
  },

  async getEnhancedSuspiciousActivity(): Promise<any> {
    try {
      const data = await fetchApi<any>('/api/suspicious-activity/enhanced');
      return data || { totalFlagged: 0, flaggedAddresses: [] };
    } catch (error) {
      console.error('Failed to fetch enhanced suspicious activity:', error);
      return { totalFlagged: 0, flaggedAddresses: [] };
    }
  },

  async getRegulatory(): Promise<any> {
    try {
      const data = await fetchApi<any>('/api/regulatory');
      return data || {};
    } catch (error) {
      console.error('Failed to fetch regulatory data:', error);
      return {};
    }
  },
};

