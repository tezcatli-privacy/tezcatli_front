import fs from "node:fs";
import path from "node:path";

export type AlphaManifestAsset = {
  symbol: string;
  displaySymbol: string;
  underlying: string;
  wrapped: string;
  vault: string;
  decimals: number;
  liveUnderlying?: boolean;
};

export type AlphaManifestStrategyRoute = {
  adapter: string;
  pool?: string;
  aToken?: string;
  vault?: string;
};

export type AlphaManifestAssetStrategies = {
  active?: string;
  aave?: AlphaManifestStrategyRoute;
  morphoMock?: AlphaManifestStrategyRoute;
};

export type AlphaManifest = {
  network: string;
  chainId: number;
  updatedAt: string;
  compliance?: {
    gate?: string;
    manager?: string;
    aggregator?: string;
    rootRegistry?: string;
    thresholdOracle?: string;
  };
  migrator?: {
    migrator?: string;
    batchMigrator?: string;
    permit2?: string;
    paymaster?: string;
    smartAccountFactory?: string;
    account4337Factory?: string;
    entryPoint?: string;
    vaultCoordinator?: string;
    vaultFeeModel?: string;
    complianceGate?: string | null;
    defi?: {
      buyGoldAdapter?: string | null;
      depositVaults?: Record<string, string>;
      strategies?: Record<string, AlphaManifestAssetStrategies>;
    };
    assets?: Record<string, AlphaManifestAsset>;
  };
};

const MANIFEST_PATH = path.resolve(process.cwd(), "../shared/deployments/arbitrum-sepolia.alpha.json");

export const loadAlphaManifest = (): AlphaManifest | null => {
  if (!fs.existsSync(MANIFEST_PATH)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as AlphaManifest;
};
