// Netlify Serverless Function for Regulator Dashboard
// Handles all API endpoints used by the regulator dashboard
import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { generateComprehensiveDeFiResearch } from "../../dashboard/server.js";
import { FinancialStatementAnalyzer } from "../../src/regulator/financialStatementAnalyzer.js";

// Initialize components (singleton pattern)
let financialStatementAnalyzer: FinancialStatementAnalyzer | null = null;

async function initializeAgent() {
  if (!financialStatementAnalyzer) {
    financialStatementAnalyzer = new FinancialStatementAnalyzer();
  }
  return { financialStatementAnalyzer };
}

// Helper to serialize BigInt
function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return obj.toString();
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeBigInt(value);
    }
    return result;
  }
  return obj;
}

// CORS headers
const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// Netlify serverless function handler
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const path = event.path.replace('/.netlify/functions/server', '') || event.path;
  const method = event.httpMethod;

  // Handle OPTIONS (CORS preflight)
  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  try {
    // Health check
    if (path === '/api/test' || path === '/test' || path === '/api') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ status: "ok", message: "Server is running on Netlify" }),
      };
    }

    // DeFi Trends endpoint
    if (path === '/api/defi/trends' && method === 'GET') {
      const defiTrends = generateComprehensiveDeFiResearch();
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(defiTrends),
      };
    }

    // Financial statements endpoints
    if (path === '/api/financial-statements/entities' && method === 'GET') {
      const { financialStatementAnalyzer } = await initializeAgent();
      if (!financialStatementAnalyzer) {
        return {
          statusCode: 503,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Financial statement analyzer not initialized" }),
        };
      }
      const entities = financialStatementAnalyzer.getDABAEntities();
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ entities }),
      };
    }

    if (path === '/api/financial-statements/all' && method === 'GET') {
      const { financialStatementAnalyzer } = await initializeAgent();
      if (!financialStatementAnalyzer) {
        return {
          statusCode: 503,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Financial statement analyzer not initialized" }),
        };
      }
      const statements = financialStatementAnalyzer.getAllStatements();
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(serializeBigInt({ statements, count: statements.length })),
      };
    }

    // Financial statements - Get by entity
    if (path.startsWith('/api/financial-statements/entity/') && method === 'GET') {
      const entityName = decodeURIComponent(path.split('/entity/')[1]);
      const { financialStatementAnalyzer } = await initializeAgent();
      if (!financialStatementAnalyzer) {
        return {
          statusCode: 503,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Financial statement analyzer not initialized" }),
        };
      }
      const statements = financialStatementAnalyzer.getStatementsForEntity(entityName);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(serializeBigInt({ statements, entityName })),
      };
    }

    // Financial statements - Upload
    if (path === '/api/financial-statements/upload' && method === 'POST') {
      const { financialStatementAnalyzer } = await initializeAgent();
      if (!financialStatementAnalyzer) {
        return {
          statusCode: 503,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Financial statement analyzer not initialized" }),
        };
      }

      try {
        const body = event.body ? JSON.parse(event.body) : {};
        const { fileContent, fileName, entityName, period, fileType } = body;

        if (!fileContent || !fileName || !entityName) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: "Missing required fields: fileContent, fileName, entityName" }),
          };
        }

        const reportPeriod = period || `2024 Q${Math.floor((new Date().getMonth() + 3) / 3)}`;
        let statementText: string;

        if (fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
          try {
            const buffer = Buffer.from(fileContent, 'base64');
            const { createRequire } = await import("module");
            const require = createRequire(import.meta.url);
            const pdfParse = require("pdf-parse");
            const pdfData = await pdfParse(buffer);
            statementText = pdfData.text;

            if (!statementText || statementText.trim().length === 0) {
              return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: "PDF parsed but no text content extracted." }),
              };
            }
          } catch (pdfError: any) {
            return {
              statusCode: 400,
              headers: corsHeaders,
              body: JSON.stringify({ error: `Failed to parse PDF: ${pdfError.message}` }),
            };
          }
        } else {
          try {
            statementText = Buffer.from(fileContent, 'base64').toString('utf-8');
          } catch (error: any) {
            return {
              statusCode: 400,
              headers: corsHeaders,
              body: JSON.stringify({ error: `Failed to read file: ${error.message}` }),
            };
          }
        }

        const statement = await financialStatementAnalyzer.processFinancialStatement(
          entityName,
          statementText,
          reportPeriod,
          `Uploaded: ${fileName}`,
          "Financial Statement"
        );

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(serializeBigInt(statement)),
        };
      } catch (error: any) {
        console.error("Error processing uploaded file:", error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: String(error) }),
        };
      }
    }

    // Financial statements - Generate mock
    if (path.startsWith('/api/financial-statements/generate-mock/') && method === 'POST') {
      const { financialStatementAnalyzer } = await initializeAgent();
      if (!financialStatementAnalyzer) {
        return {
          statusCode: 503,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Financial statement analyzer not initialized" }),
        };
      }

      try {
        const entityName = decodeURIComponent(path.split('/generate-mock/')[1]);
        const body = event.body ? JSON.parse(event.body) : {};
        const period = body.period || `2024 Q${Math.floor((new Date().getMonth() + 3) / 3)}`;

        financialStatementAnalyzer.clearEntityStatements(entityName);
        const mockText = financialStatementAnalyzer.generateMockStatementWithRealData(entityName, period);
        const statement = await financialStatementAnalyzer.processFinancialStatement(
          entityName,
          mockText,
          period,
          "Auto-generated from Similar Entity Data (rule-based analysis)",
          "Financial Statement"
        );

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(serializeBigInt(statement)),
        };
      } catch (error: any) {
        console.error("Error generating financials:", error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: error.message || String(error) }),
        };
      }
    }

    // Financial statements - Analyze
    if (path === '/api/financial-statements/analyze' && method === 'POST') {
      const { financialStatementAnalyzer } = await initializeAgent();
      if (!financialStatementAnalyzer) {
        return {
          statusCode: 503,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Financial statement analyzer not initialized" }),
        };
      }

      try {
        const body = event.body ? JSON.parse(event.body) : {};
        const { entityName, statementText, period, source, statementType } = body;

        if (!entityName || !statementText || !period) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: "Missing required fields: entityName, statementText, period" }),
          };
        }

        const statement = await financialStatementAnalyzer.processFinancialStatement(
          entityName,
          statementText,
          period,
          source || "Manual Upload",
          statementType || "Financial Statement"
        );

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(serializeBigInt(statement)),
        };
      } catch (error: any) {
        console.error("Error analyzing statement:", error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: error.message || String(error) }),
        };
      }
    }

    // Return empty/mock data for endpoints that require full agent initialization
    // These would need more complex setup in a serverless environment
    
    // Regulatory endpoints - return empty structure
    if (path === '/api/regulatory' && method === 'GET') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          totalTransactions: 0,
          suspiciousCount: 0,
          complianceScore: 100,
          riskLevel: "Low",
          multiChainData: []
        }),
      };
    }

    if (path === '/api/daba' && method === 'GET') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          compliant: true,
          licenseClass: "F",
          headOfficeInBermuda: true,
          capitalAdequacy: "Adequate"
        }),
      };
    }

    // Monitor endpoints
    if (path === '/api/monitor/triggers' && method === 'GET') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify([]),
      };
    }

    if (path.startsWith('/api/monitor/events') && method === 'GET') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ events: [], count: 0 }),
      };
    }

    // High-risk endpoints
    if (path.startsWith('/api/high-risk/transactions') && method === 'GET') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ transactions: [], count: 0 }),
      };
    }

    if (path === '/api/high-risk/chains' && method === 'GET') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ chains: [] }),
      };
    }

    if (path.startsWith('/api/high-risk/flows') && method === 'GET') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ flows: [], count: 0 }),
      };
    }

    if (path === '/api/high-risk/recommendations' && method === 'GET') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ recommendations: [] }),
      };
    }

    // Wallet endpoints
    if (path.startsWith('/api/wallets/suspicious') && method === 'GET') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ wallets: [], count: 0 }),
      };
    }

    if (path === '/api/wallets/stats' && method === 'GET') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          totalWallets: 0,
          suspiciousCount: 0,
          monitoredCount: 0
        }),
      };
    }

    if (path === '/api/wallets/typologies' && method === 'GET') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ typologies: [] }),
      };
    }

    if (path.startsWith('/api/wallets/') && path.includes('/trace') && method === 'GET') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ trace: [], depth: 0 }),
      };
    }

    if (path.startsWith('/api/wallets/') && !path.includes('/trace') && method === 'GET') {
      const address = path.split('/wallets/')[1]?.split('/')[0];
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          address: address || '',
          balance: '0',
          transactionCount: 0,
          riskScore: 0
        }),
      };
    }

    // Regulatory summary
    if (path === '/api/regulatory/summary' && method === 'GET') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          summary: "Regulatory monitoring dashboard - Data will populate as transactions are processed",
          complianceStatus: "Compliant",
          riskLevel: "Low"
        }),
      };
    }

    // Suspicious activity endpoints
    if (path.startsWith('/api/suspicious-activity/enhanced') && method === 'GET') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ activities: [], count: 0 }),
      };
    }

    if (path.startsWith('/api/market-manipulation/alerts') && method === 'GET') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ alerts: [], count: 0 }),
      };
    }

    // Etherscan/market endpoints
    if (path === '/api/etherscan/market' && method === 'GET') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          blockNumber: "0",
          gasPrices: { proposed: 20, safe: 18, fast: 25 }
        }),
      };
    }

    if (path.startsWith('/api/etherscan/address/') && method === 'GET') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          address: path.split('/address/')[1],
          balance: "0",
          transactions: []
        }),
      };
    }

    // Stats endpoint
    if (path === '/api/stats' && method === 'GET') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          agentRunning: false,
          transactionsProcessed: 0,
          recentTransactionsCount: 0,
          hasRegulatoryData: false,
          multiChainCount: 0,
          stats: {
            totalTransactions: 0,
            suspiciousCount: 0
          }
        }),
      };
    }

    // Investigation endpoint
    if (path.startsWith('/api/investigation/address/') && method === 'GET') {
      const address = path.split('/address/')[1];
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          address: address || '',
          riskScore: 0,
          suspiciousActivities: [],
          transactions: [],
          analysis: "Address analysis requires full agent initialization"
        }),
      };
    }

    // Not found
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Not found", path }),
    };

  } catch (error: any) {
    console.error("Serverless function error:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message || String(error) }),
    };
  }
};
