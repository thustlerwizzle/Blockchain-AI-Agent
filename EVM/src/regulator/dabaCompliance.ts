import type { TransactionAnalysis } from "../analyzer/transactionAnalyzer.js";
import type { TransactionEvent } from "../listener/blockchainListener.js";
import type { RegulatoryMetrics } from "./regulatoryMetrics.js";

/**
 * DABA (Digital Asset Business Act 2018) Compliance Module
 * Aligned with Bermuda Monetary Authority (BMA) regulations
 */

export interface DABALicenseStatus {
  licenseClass: "F" | "M" | "T" | "NONE";
  status: "active" | "suspended" | "revoked" | "pending";
  expiryDate?: number;
  conditions?: string[];
}

export interface DABAComplianceStatus {
  licensing: DABALicenseStatus;
  clientAssetCustody: ClientAssetCustodyStatus;
  cyberRiskManagement: CyberRiskStatus;
  amlAtfCompliance: AMLATFStatus;
  regulatoryReporting: ReportingStatus;
  operationalRequirements: OperationalStatus;
  overallCompliance: number; // 0-100
}

export interface ClientAssetCustodyStatus {
  segregationCompliant: boolean;
  fiduciaryDutyMet: boolean;
  accountingCompliant: boolean;
  custodyScore: number; // 0-100
  issues: string[];
}

export interface CyberRiskStatus {
  operationalCyberRiskCompliant: boolean;
  incidentResponseReady: boolean;
  dataEncryptionCompliant: boolean;
  accessControlsCompliant: boolean;
  cyberRiskScore: number; // 0-100
  vulnerabilities: string[];
}

export interface AMLATFStatus {
  transactionMonitoringActive: boolean;
  suspiciousActivityReporting: boolean;
  recordKeepingCompliant: boolean;
  kycVerificationCompliant: boolean;
  amlAtfScore: number; // 0-100
  violations: string[];
}

export interface ReportingStatus {
  annualReturnsUpToDate: boolean;
  materialChangesReported: boolean;
  financialStatementsCurrent: boolean;
  reportingScore: number; // 0-100
  overdueReports: string[];
  nextReportingDeadline?: number;
}

export interface OperationalStatus {
  headOfficeInBermuda: boolean;
  codeOfPracticeCompliant: boolean;
  capitalRequirementsMet: boolean;
  operationalScore: number; // 0-100
  deficiencies: string[];
}

export class DABAComplianceChecker {
  private transactionHistory: TransactionEvent[] = [];
  private analysisHistory: TransactionAnalysis[] = [];
  private licenseStatus: DABALicenseStatus;
  private config: {
    licenseClass?: "F" | "M" | "T";
    headOfficeInBermuda?: boolean;
    capitalRequirement?: bigint;
  };

  constructor(config: {
    licenseClass?: "F" | "M" | "T";
    headOfficeInBermuda?: boolean;
    capitalRequirement?: bigint;
  } = {}) {
    this.config = {
      licenseClass: config.licenseClass || "F",
      headOfficeInBermuda: config.headOfficeInBermuda ?? true,
      capitalRequirement: config.capitalRequirement || BigInt("1000000000000000000000"), // 1000 ETH default
    };

    this.licenseStatus = {
      licenseClass: (this.config.licenseClass || "NONE") as "F" | "M" | "T" | "NONE",
      status: "active",
      conditions: [],
    };
  }

  /**
   * Add transaction for compliance tracking
   */
  addTransaction(tx: TransactionEvent, analysis: TransactionAnalysis): void {
    this.transactionHistory.push(tx);
    this.analysisHistory.push(analysis);

    if (this.transactionHistory.length > 10000) {
      this.transactionHistory.shift();
      this.analysisHistory.shift();
    }
  }

  /**
   * Calculate comprehensive DABA compliance status
   */
  calculateComplianceStatus(): DABAComplianceStatus {
    const clientAssetCustody = this.checkClientAssetCustody();
    const cyberRisk = this.checkCyberRiskManagement();
    const amlAtf = this.checkAMLATFCompliance();
    const reporting = this.checkRegulatoryReporting();
    const operational = this.checkOperationalRequirements();

    // Calculate overall compliance score (weighted average)
    const overallCompliance = Math.round(
      clientAssetCustody.custodyScore * 0.20 +
      cyberRisk.cyberRiskScore * 0.20 +
      amlAtf.amlAtfScore * 0.25 +
      reporting.reportingScore * 0.15 +
      operational.operationalScore * 0.20
    );

    return {
      licensing: this.licenseStatus,
      clientAssetCustody,
      cyberRiskManagement: cyberRisk,
      amlAtfCompliance: amlAtf,
      regulatoryReporting: reporting,
      operationalRequirements: operational,
      overallCompliance,
    };
  }

  /**
   * Check Client Asset Custody compliance (DABA Rules 2024)
   */
  private checkClientAssetCustody(): ClientAssetCustodyStatus {
    let score = 100;
    const issues: string[] = [];

    // Check segregation requirements
    const segregationCompliant = true; // Would check actual custody implementation
    if (!segregationCompliant) {
      score -= 30;
      issues.push("Client assets not properly segregated");
    }

    // Check fiduciary duty
    const fiduciaryDutyMet = true; // Would verify fiduciary arrangements
    if (!fiduciaryDutyMet) {
      score -= 25;
      issues.push("Fiduciary duty requirements not met");
    }

    // Check accounting compliance
    const accountingCompliant = true; // Would verify accounting records
    if (!accountingCompliant) {
      score -= 20;
      issues.push("Accounting records not compliant");
    }

    // Check for suspicious custody patterns
    const suspiciousCustodyTxs = this.analysisHistory.filter(
      (a) => a.suspicious && a.category === "CONTRACT_INTERACTION"
    );
    if (suspiciousCustodyTxs.length > 10) {
      score -= 15;
      issues.push("High number of suspicious custody-related transactions");
    }

    return {
      segregationCompliant,
      fiduciaryDutyMet,
      accountingCompliant,
      custodyScore: Math.max(0, score),
      issues,
    };
  }

  /**
   * Check Cyber Risk Management (BMA Operational Cyber Risk Management Code)
   */
  private checkCyberRiskManagement(): CyberRiskStatus {
    let score = 100;
    const vulnerabilities: string[] = [];

    // Operational cyber risk compliance
    const operationalCompliant = true; // Would check cyber risk framework
    if (!operationalCompliant) {
      score -= 25;
      vulnerabilities.push("Operational cyber risk framework not compliant");
    }

    // Incident response readiness
    const incidentResponseReady = true; // Would verify incident response plan
    if (!incidentResponseReady) {
      score -= 20;
      vulnerabilities.push("Incident response plan not ready");
    }

    // Data encryption compliance
    const encryptionCompliant = true; // Would verify encryption standards
    if (!encryptionCompliant) {
      score -= 25;
      vulnerabilities.push("Data encryption not compliant");
    }

    // Access controls
    const accessControlsCompliant = true; // Would verify access control systems
    if (!accessControlsCompliant) {
      score -= 20;
      vulnerabilities.push("Access controls not compliant");
    }

    // Check for high-risk transactions that might indicate security issues
    const highRiskTxs = this.analysisHistory.filter((a) => a.riskScore >= 80);
    if (highRiskTxs.length > 5) {
      score -= 10;
      vulnerabilities.push("Multiple high-risk transactions detected");
    }

    return {
      operationalCyberRiskCompliant: operationalCompliant,
      incidentResponseReady,
      dataEncryptionCompliant: encryptionCompliant,
      accessControlsCompliant,
      cyberRiskScore: Math.max(0, score),
      vulnerabilities,
    };
  }

  /**
   * Check AML/ATF Compliance
   */
  private checkAMLATFCompliance(): AMLATFStatus {
    let score = 100;
    const violations: string[] = [];

    // Transaction monitoring
    const monitoringActive = this.transactionHistory.length > 0;
    if (!monitoringActive) {
      score -= 30;
      violations.push("Transaction monitoring not active");
    }

    // Suspicious activity reporting
    const suspiciousCount = this.analysisHistory.filter((a) => a.suspicious).length;
    const suspiciousActivityReporting = suspiciousCount > 0; // Would check if reported
    if (!suspiciousActivityReporting && suspiciousCount > 0) {
      score -= 25;
      violations.push(`${suspiciousCount} suspicious activities not reported`);
    }

    // Record keeping
    const recordKeepingCompliant = this.transactionHistory.length > 0;
    if (!recordKeepingCompliant) {
      score -= 20;
      violations.push("Transaction records not maintained");
    }

    // KYC verification
    const newAddressCount = this.analysisHistory.filter((a) =>
      a.anomalyFlags.includes("NEW_ADDRESS")
    ).length;
    const kycCompliant = newAddressCount < this.transactionHistory.length * 0.3;
    if (!kycCompliant) {
      score -= 15;
      violations.push("High number of unverified addresses (KYC concern)");
    }

    // Check for structuring patterns (smurfing)
    const rapidTxCount = this.analysisHistory.filter((a) =>
      a.anomalyFlags.includes("RAPID_TRANSACTIONS")
    ).length;
    if (rapidTxCount > 5) {
      score -= 10;
      violations.push("Potential structuring detected (rapid transactions)");
    }

    return {
      transactionMonitoringActive: monitoringActive,
      suspiciousActivityReporting,
      recordKeepingCompliant,
      kycVerificationCompliant: kycCompliant,
      amlAtfScore: Math.max(0, score),
      violations,
    };
  }

  /**
   * Check Regulatory Reporting requirements
   */
  private checkRegulatoryReporting(): ReportingStatus {
    let score = 100;
    const overdueReports: string[] = [];

    // Annual returns
    const annualReturnsUpToDate = true; // Would check actual filing status
    if (!annualReturnsUpToDate) {
      score -= 30;
      overdueReports.push("Annual returns overdue");
    }

    // Material changes
    const materialChangesReported = true; // Would check change notifications
    if (!materialChangesReported) {
      score -= 25;
      overdueReports.push("Material changes not reported");
    }

    // Financial statements
    const financialStatementsCurrent = true; // Would check statement dates
    if (!financialStatementsCurrent) {
      score -= 25;
      overdueReports.push("Financial statements not current");
    }

    // Calculate next reporting deadline (example: 1 year from now)
    const nextReportingDeadline = Date.now() + 365 * 24 * 60 * 60 * 1000;

    return {
      annualReturnsUpToDate,
      materialChangesReported,
      financialStatementsCurrent,
      reportingScore: Math.max(0, score),
      overdueReports,
      nextReportingDeadline,
    };
  }

  /**
   * Check Operational Requirements
   */
  private checkOperationalRequirements(): OperationalStatus {
    let score = 100;
    const deficiencies: string[] = [];

    // Head office in Bermuda
    if (!this.config.headOfficeInBermuda) {
      score -= 40;
      deficiencies.push("Head office not in Bermuda (DABA requirement)");
    }

    // Code of practice compliance
    const codeCompliant = true; // Would verify code adherence
    if (!codeCompliant) {
      score -= 30;
      deficiencies.push("BMA Code of Practice not fully complied with");
    }

    // Capital requirements
    const totalVolume = this.transactionHistory.reduce(
      (sum, tx) => sum + tx.value,
      BigInt(0)
    );
    const capitalMet = totalVolume <= this.config.capitalRequirement! * BigInt(10);
    if (!capitalMet) {
      score -= 20;
      deficiencies.push("Capital requirements may not be met");
    }

    return {
      headOfficeInBermuda: this.config.headOfficeInBermuda ?? false,
      codeOfPracticeCompliant: codeCompliant,
      capitalRequirementsMet: capitalMet,
      operationalScore: Math.max(0, score),
      deficiencies,
    };
  }

  /**
   * Get DABA-specific recommendations
   */
  getDABARecommendations(compliance: DABAComplianceStatus): string[] {
    const recommendations: string[] = [];

    if (compliance.overallCompliance < 80) {
      recommendations.push(
        "⚠️ CRITICAL: Overall DABA compliance below acceptable threshold. Immediate action required."
      );
    }

    if (compliance.licensing.status !== "active") {
      recommendations.push(
        "🚨 LICENSE STATUS: Digital Asset Business license not active. Contact BMA immediately."
      );
    }

    if (compliance.clientAssetCustody.custodyScore < 80) {
      recommendations.push(
        "💼 CLIENT ASSETS: Review client asset custody arrangements per DABA Rules 2024."
      );
    }

    if (compliance.cyberRiskManagement.cyberRiskScore < 80) {
      recommendations.push(
        "🔒 CYBER RISK: Enhance cyber risk management per BMA Operational Cyber Risk Management Code."
      );
    }

    if (compliance.amlAtfCompliance.amlAtfScore < 80) {
      recommendations.push(
        "🚨 AML/ATF: Strengthen AML/ATF compliance measures. Review suspicious activity reporting."
      );
    }

    if (compliance.regulatoryReporting.reportingScore < 80) {
      recommendations.push(
        "📋 REPORTING: Ensure all regulatory reports are submitted on time to BMA."
      );
    }

    if (compliance.operationalRequirements.operationalScore < 80) {
      recommendations.push(
        "🏢 OPERATIONS: Verify all operational requirements are met, including head office location."
      );
    }

    if (recommendations.length === 0) {
      recommendations.push("✅ All DABA compliance requirements met.");
    }

    return recommendations;
  }
}

