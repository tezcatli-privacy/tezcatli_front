export type ScanResponse = {
  scanSessionId: string;
  status: "completed" | "partial";
  progress: number;
  currentStage?: string;
  stages: Array<{
    stage: "identity" | "financial" | "exchange" | "score";
    status: "completed" | "partial" | "failed" | "skipped";
    progress: number;
    error?: string;
  }>;
  data: {
    arkham?: unknown;
    zerion?: unknown;
    neynar?: unknown;
  };
  privacy: {
    score: number;
    band: "Low" | "Moderate" | "High" | "Critical";
    confidence: number;
  };
  report?: {
    summary?: {
      signals?: {
        arkhamOk?: boolean;
        zerionOk?: boolean;
        neynarOk?: boolean;
      };
    };
    findings?: Array<{
      id: string;
      pillar: string;
      severity: string;
      title: string;
      details: string;
    }>;
    recommendations?: Array<{
      id: string;
      priority: string;
      title: string;
      description: string;
    }>;
  };
  supportedAssets: Array<{
    symbol: "USDC" | "USDT" | "WBTC" | "WETH";
    displaySymbol: "USDC" | "USDT" | "WBTC" | "ETH";
    name: string;
    kind: "erc20" | "wrapped_native";
    migrationRoute: "direct" | "wrap_then_migrate";
    description: string;
  }>;
  nextActions: Array<{
    id: string;
    label: string;
    intent: string;
    enabled: boolean;
  }>;
};

export type MigrationEligibilityResponse = {
  wallet: string;
  registration: {
    provider: "wavy";
    status?: "simulated";
    error?: string;
  };
  risk: {
    available: boolean;
    provider: "wavy";
    chainId: number;
    score?: number;
    level: string;
    suspiciousActivity: boolean;
    migrationEligible: boolean;
    reviewRecommended: boolean;
    policyBand: "eligible" | "review" | "blocked";
    reason: string;
    riskReason?: string;
    failureReason?: string;
    analysisId?: string;
    patternsDetected: string[];
    transactionsAnalyzed?: number;
    completedAt?: string;
  };
  supportedAssets: ScanResponse["supportedAssets"];
  nextActions: ScanResponse["nextActions"];
};

export type AuditSummary = {
  activeIdentities: number;
  linkedWallets: number;
  openCases: number;
  thresholdBreaches: number;
  rootsPublished: number;
  recentEvents: number;
  highRiskWallets: number;
};
