/**
 * Etherscan API Integration
 * Provides functions to fetch real blockchain data from Etherscan
 */

// Use environment variable for API key, fallback to hardcoded if not set
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || 'X8WZ9EXJSH9IM8XG8NH7UZDMFKEU9SKBWG';
// Etherscan API V2 endpoints (chainid=1 for Ethereum mainnet)
const ETHERSCAN_API_URL = 'https://api.etherscan.io/v2/api';
const ETHEREUM_CHAINID = '1'; // Ethereum mainnet

interface EtherscanResponse<T> {
  status: string;
  message: string;
  result: T;
}

interface GasPriceResult {
  LastBlock: string;
  SafeGasPrice: string;
  ProposeGasPrice: string;
  FastGasPrice: string;
  suggestBaseFee: string;
  gasUsedRatio: string;
}

interface Transaction {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  nonce: string;
  blockHash: string;
  transactionIndex: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  isError: string;
  txreceipt_status: string;
  input: string;
  contractAddress: string;
  cumulativeGasUsed: string;
  gasUsed: string;
  confirmations: string;
  methodId?: string;
  functionName?: string;
}

interface TokenTransfer {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  nonce: string;
  blockHash: string;
  from: string;
  contractAddress: string;
  to: string;
  value: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  transactionIndex: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  cumulativeGasUsed: string;
  input: string;
  confirmations: string;
}

/**
 * Get current ETH price in USD - tries Etherscan first, falls back to CoinGecko
 */
export async function getEthPrice(): Promise<number> {
  // Try CoinGecko first (more reliable, no API key needed)
  try {
    const coingeckoUrl = 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd';
    console.log('Fetching ETH price from CoinGecko...');
    const coingeckoResponse = await fetch(coingeckoUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (coingeckoResponse.ok) {
      const coingeckoData = await coingeckoResponse.json();
      if (coingeckoData.ethereum && coingeckoData.ethereum.usd) {
        const price = coingeckoData.ethereum.usd;
        console.log(`✅ ETH price fetched from CoinGecko: $${price}`);
        return price;
      }
    }
  } catch (coingeckoError) {
    console.warn('CoinGecko fetch failed, trying Etherscan...', coingeckoError);
  }
  
  // Fallback to Etherscan (V1 still works for stats)
  try {
    const url = `https://api.etherscan.io/api?module=stats&action=ethprice&apikey=${ETHERSCAN_API_KEY}`;
    console.log('Fetching ETH price from Etherscan...');
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data: EtherscanResponse<{ ethbtc: string; ethbtc_timestamp: string; ethusd: string; ethusd_timestamp: string }> = await response.json();
    
    if (data.status === '1' && data.result) {
      const price = parseFloat(data.result.ethusd);
      console.log(`✅ ETH price fetched from Etherscan: $${price}`);
      return price;
    }
    
    const errorMsg = data.message || 'Failed to fetch ETH price';
    console.error('❌ Etherscan API error:', errorMsg);
    throw new Error(errorMsg);
  } catch (error) {
    console.error('❌ Error fetching ETH price from Etherscan:', error);
  }
  
  // Final fallback
  console.warn('⚠️ Using fallback ETH price');
  return 2500; // Fallback price
}

/**
 * Get current gas prices from Etherscan
 */
export async function getGasPrices(): Promise<GasPriceResult> {
  try {
    // Gas oracle still uses V1 API
    const url = `https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=${ETHERSCAN_API_KEY}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data: EtherscanResponse<GasPriceResult> = await response.json();
    
    if (data.status === '1' && data.result) {
      console.log('✅ Gas prices fetched successfully');
      return data.result;
    }
    
    const errorMsg = data.message || 'Failed to fetch gas prices';
    console.error('❌ Etherscan API error:', errorMsg);
    throw new Error(errorMsg);
  } catch (error) {
    console.error('❌ Error fetching gas prices:', error);
    // Return fallback gas prices
    console.warn('⚠️ Using fallback gas prices');
    return {
      LastBlock: '0',
      SafeGasPrice: '20',
      ProposeGasPrice: '25',
      FastGasPrice: '30',
      suggestBaseFee: '15',
      gasUsedRatio: '0.5'
    };
  }
}

/**
 * Get latest block number
 */
export async function getLatestBlockNumber(): Promise<string> {
  try {
    // Proxy endpoints still use V1 API
    const url = `https://api.etherscan.io/api?module=proxy&action=eth_blockNumber&apikey=${ETHERSCAN_API_KEY}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data: EtherscanResponse<string> = await response.json();
    
    if (data.status === '1' && data.result) {
      // Convert hex to decimal
      const blockNumber = parseInt(data.result, 16).toString();
      console.log(`✅ Latest block number: ${blockNumber}`);
      return blockNumber;
    }
    
    const errorMsg = data.message || 'Failed to fetch block number';
    console.error('❌ Etherscan API error:', errorMsg);
    throw new Error(errorMsg);
  } catch (error) {
    console.error('❌ Error fetching block number:', error);
    // Return fallback block number
    console.warn('⚠️ Using fallback block number');
    return '20000000';
  }
}

/**
 * Get transactions for an address
 */
export async function getAddressTransactions(
  address: string,
  startBlock: number = 0,
  endBlock: number = 99999999,
  page: number = 1,
  offset: number = 100,
  sort: 'asc' | 'desc' = 'desc'
): Promise<Transaction[]> {
  try {
    // Use V2 API with chainid parameter
    const url = `${ETHERSCAN_API_URL}?module=account&action=txlist&address=${address}&startblock=${startBlock}&endblock=${endBlock}&page=${page}&offset=${offset}&sort=${sort}&chainid=${ETHEREUM_CHAINID}&apikey=${ETHERSCAN_API_KEY}`;
    console.log(`📡 Fetching transactions from Etherscan V2 API for ${address}...`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data: EtherscanResponse<Transaction[] | string> = await response.json();
    
    if (data.status === '1' && Array.isArray(data.result)) {
      console.log(`✅ Fetched ${data.result.length} transactions from Etherscan`);
      return data.result;
    }
    
    if (data.status === '0') {
      if (data.result === 'No transactions found' || data.message === 'No transactions found') {
        console.log(`ℹ️ No transactions found for address ${address}`);
        return [];
      }
      // Log API errors
      console.error(`❌ Etherscan API error: ${data.message || 'Unknown error'}`);
      if (data.message?.includes('rate limit') || data.message?.includes('Max rate limit')) {
        throw new Error('Etherscan API rate limit exceeded. Please try again later.');
      }
      throw new Error(data.message || 'Failed to fetch transactions');
    }
    
    throw new Error(typeof data.result === 'string' ? data.result : data.message || 'Failed to fetch transactions');
  } catch (error: any) {
    console.error('❌ Error fetching transactions:', error?.message || error);
    // Don't throw, return empty array to allow fallback
    return [];
  }
}

/**
 * Get token transfers for an address
 */
export async function getTokenTransfers(
  address: string,
  startBlock: number = 0,
  endBlock: number = 99999999,
  page: number = 1,
  offset: number = 100,
  sort: 'asc' | 'desc' = 'desc'
): Promise<TokenTransfer[]> {
  try {
    // Use V2 API with chainid parameter
    const url = `${ETHERSCAN_API_URL}?module=account&action=tokentx&address=${address}&startblock=${startBlock}&endblock=${endBlock}&page=${page}&offset=${offset}&sort=${sort}&chainid=${ETHEREUM_CHAINID}&apikey=${ETHERSCAN_API_KEY}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data: EtherscanResponse<TokenTransfer[] | string> = await response.json();
    
    if (data.status === '1' && Array.isArray(data.result)) {
      return data.result;
    }
    
    if (data.status === '0') {
      if (data.result === 'No transactions found' || data.message === 'No transactions found') {
        return [];
      }
      console.error(`❌ Etherscan API error: ${data.message || 'Unknown error'}`);
      if (data.message?.includes('rate limit') || data.message?.includes('Max rate limit')) {
        throw new Error('Etherscan API rate limit exceeded. Please try again later.');
      }
      throw new Error(data.message || 'Failed to fetch token transfers');
    }
    
    throw new Error(typeof data.result === 'string' ? data.result : data.message || 'Failed to fetch token transfers');
  } catch (error: any) {
    console.error('❌ Error fetching token transfers:', error?.message || error);
    // Don't throw, return empty array to allow fallback
    return [];
  }
}

/**
 * Get account balance
 */
export async function getAccountBalance(address: string): Promise<string> {
  try {
    // Use V2 API with chainid parameter
    const url = `${ETHERSCAN_API_URL}?module=account&action=balance&address=${address}&tag=latest&chainid=${ETHEREUM_CHAINID}&apikey=${ETHERSCAN_API_KEY}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data: EtherscanResponse<string> = await response.json();
    
    if (data.status === '1' && data.result) {
      // Convert wei to ETH (divide by 1e18)
      const wei = BigInt(data.result);
      const eth = Number(wei) / 1e18;
      return eth.toString();
    }
    
    console.error(`❌ Etherscan balance error: ${data.message || 'Unknown error'}`);
    if (data.message?.includes('rate limit') || data.message?.includes('Max rate limit')) {
      throw new Error('Etherscan API rate limit exceeded. Please try again later.');
    }
    throw new Error(data.message || 'Failed to fetch balance');
  } catch (error: any) {
    console.error('❌ Error fetching balance:', error?.message || error);
    // Return '0' as fallback instead of throwing
    return '0';
  }
}

/**
 * Analyze transactions for suspicious patterns
 */
export function analyzeSuspiciousPatterns(transactions: Transaction[]): {
  suspicious: boolean;
  flags: string[];
  riskScore: number;
  totalVolume: bigint;
  averageTransactionSize: bigint;
  rapidTransactions: number;
} {
  const flags: string[] = [];
  let totalVolume = BigInt(0);
  let rapidTransactions = 0;
  
  // Analyze transactions
  const sortedTx = transactions.sort((a, b) => parseInt(a.timeStamp) - parseInt(b.timeStamp));
  
  sortedTx.forEach((tx, index) => {
    const value = BigInt(tx.value);
    totalVolume += value;
    
    // Check for rapid transactions (multiple transactions within 60 seconds)
    if (index > 0) {
      const prevTime = parseInt(sortedTx[index - 1].timeStamp);
      const currTime = parseInt(tx.timeStamp);
      if (currTime - prevTime < 60) {
        rapidTransactions++;
      }
    }
    
    // Check for large transactions (>100 ETH)
    const ethValue = Number(value) / 1e18;
    if (ethValue > 100) {
      if (!flags.includes('LARGE_VALUE')) {
        flags.push('LARGE_VALUE');
      }
    }
    
    // Check for failed transactions
    if (tx.isError === '1') {
      if (!flags.includes('FAILED_TRANSACTIONS')) {
        flags.push('FAILED_TRANSACTIONS');
      }
    }
  });
  
  // Calculate risk score
  let riskScore = 0;
  if (rapidTransactions > 5) {
    riskScore += 30;
    flags.push('RAPID_TRANSACTIONS');
  }
  if (rapidTransactions > 10) {
    riskScore += 20;
    flags.push('POTENTIAL_STRUCTURING');
  }
  if (flags.includes('LARGE_VALUE')) {
    riskScore += 25;
  }
  if (flags.includes('FAILED_TRANSACTIONS')) {
    riskScore += 15;
  }
  
  const avgSize = transactions.length > 0 ? totalVolume / BigInt(transactions.length) : BigInt(0);
  
  return {
    suspicious: riskScore >= 40 || flags.length > 0,
    flags,
    riskScore: Math.min(riskScore, 100),
    totalVolume,
    averageTransactionSize: avgSize,
    rapidTransactions,
  };
}

export type { Transaction, TokenTransfer, GasPriceResult };

