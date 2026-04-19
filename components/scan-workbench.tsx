"use client";

import { useEffect, useMemo, useState } from "react";
import { Encryptable } from "@cofhe/sdk";
import { arbSepolia as cofheArbSepolia } from "@cofhe/sdk/chains";
import { createCofheClient, createCofheConfig } from "@cofhe/sdk/web";
import {
  createPublicClient,
  createWalletClient,
  custom,
  encodePacked,
  formatUnits,
  http,
  keccak256,
  maxUint256,
  parseAbi,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { arbitrumSepolia } from "viem/chains";
import { useConfidentialVaultDeposit } from "@/hooks/use-confidential-vault-deposit";
import { appConfig } from "@/lib/config";
import { buildWriteFeeOverrides } from "@/lib/wallet-fees";
import type { AlphaManifest, AlphaManifestAsset } from "@/lib/alpha-manifest";
import { buildPermit2BatchTypedData, CANONICAL_PERMIT2_ADDRESS, permit2Abi } from "@/lib/permit2";
import type { MigrationEligibilityResponse, ScanResponse } from "@/lib/types";
import { formatWalletError } from "@/lib/wallet-errors";

declare global {
  interface Window {
    ethereum?: {
      request(args: { method: string; params?: unknown[] }): Promise<unknown>;
      on?(event: string, listener: (...args: unknown[]) => void): void;
      removeListener?(event: string, listener: (...args: unknown[]) => void): void;
      selectedAddress?: string;
    };
  }
}

type AssetBalance = {
  symbol: string;
  displaySymbol: string;
  balance: string;
  rawBalance: bigint;
  selected: boolean;
  route: string;
  description: string;
};

type MigrationFlowState = "idle" | "creating_account" | "migrating_assets" | "ready";

const DEMO_APPROVED_WALLETS = [
  {
    label: "Demo 1",
    wallet: "0xD5077AF882673C9D6Aa9aF127afB17D85AadfEEd",
    smartAccount: "0x940655E3E5dcC2dA1b03fD6bE5b31A9303369bB1",
  },
  {
    label: "Demo 2",
    wallet: "0x153BaD7D0dA9B776F28a05be373a149cD358f312",
    smartAccount: "0xF3FF9181657921c18D22D1F413019ca0a1eB80E4",
  },
  {
    label: "Demo 3",
    wallet: "0x95bcd377d3D18AA7b59e9dbB573850133Dc5558f",
    smartAccount: "0x1c9c31002541B23e5aD0A3308A546769faA85A22",
  },
] as const;

const BLOCKED_DEMO_SUGGESTION = {
  label: "Blocked path",
  wallet: "Any wallet outside the approved demo set",
  reason:
    "Expected outcome: the compliance gate rejects migration because the wallet and its predicted smart account are not linked to the shared demo identity.",
} as const;

const erc20Abi = parseAbi(["function balanceOf(address owner) view returns (uint256)"]);
const erc20ApproveAbi = parseAbi(["function approve(address spender, uint256 amount) external returns (bool)"]);
const erc20AllowanceAbi = parseAbi(["function allowance(address owner, address spender) view returns (uint256)"]);
const wrappedNativeAbi = parseAbi(["function deposit() payable"]);
const account4337FactoryAbi = parseAbi([
  "function predictAccountAddress(address owner, uint256 salt) view returns (address)",
  "function createAccount(address owner, uint256 salt) returns (address)",
]);
const migratorAbi = parseAbi([
  "function nonces(address wallet) view returns (uint256)",
  "function getSweepDigest((address stealthAddress,address recipient,address token,address confidentialToken,uint256 amount,uint256 nonce,uint256 deadline) authorization) view returns (bytes32)",
  "function sweepAndMigrate((address stealthAddress,address recipient,address token,address confidentialToken,uint256 amount,uint256 nonce,uint256 deadline) authorization, bytes signature)",
]);
const batchMigratorAbi = parseAbi([
  "function predictAccountAddress(address owner, uint256 salt) view returns (address)",
  "function createAccountAndMigrateBatchWithPermit2(address owner, uint256 salt, ((address token,uint160 amount,uint48 expiration,uint48 nonce)[] details,address spender,uint256 sigDeadline) permitBatch, bytes signature) returns (address)",
]);
const smartAccount4337Abi = parseAbi([
  "function execute(address target, uint256 value, bytes data) returns (bytes result)",
]);

const stageTone = (status: "completed" | "partial" | "failed" | "skipped") => {
  switch (status) {
    case "completed":
      return "ok";
    case "partial":
      return "warn";
    case "failed":
      return "critical";
    default:
      return "neutral";
  }
};

const riskTone = (policyBand: "eligible" | "review" | "blocked") => {
  switch (policyBand) {
    case "eligible":
      return "ok";
    case "review":
      return "warn";
    default:
      return "critical";
  }
};

const visibleStages = (
  stages: Array<{
    stage: "identity" | "financial" | "exchange" | "score";
    status: "completed" | "partial" | "failed" | "skipped";
    progress: number;
    error?: string;
  }>,
) => stages.filter(stage => stage.stage !== "exchange");

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const arbiscanAddressUrl = (address: string) => `https://sepolia.arbiscan.io/address/${address}`;

const formatAddress = (value?: string | null) => {
  if (!value) return "pending";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}....${value.slice(-4)}`;
};

const formatBalancePreview = (value: string) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;
  if (parsed === 0) return "0";
  if (parsed >= 1) return parsed.toFixed(4).replace(/\.?0+$/, "");
  return parsed.toFixed(6).replace(/\.?0+$/, "");
};

const GAS_RESERVE_WEI = parseUnits("0.003", 18);

const buildMigrationSalt = (wallet: Address) => {
  const digest = keccak256(encodePacked(["string", "address"], ["tezcatli-alpha-migration", wallet]));
  return BigInt(digest);
};

export function ScanWorkbench({ manifest }: { manifest: AlphaManifest | null }) {
  const [wallet, setWallet] = useState<string>("");
  const [scanResult, setScanResult] = useState<ScanResponse | null>(null);
  const [eligibilityResult, setEligibilityResult] = useState<MigrationEligibilityResponse | null>(null);
  const [scanError, setScanError] = useState<string>("");
  const [backendRedisAvailable, setBackendRedisAvailable] = useState<boolean | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
  const [balances, setBalances] = useState<AssetBalance[]>([]);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [recoveryToken, setRecoveryToken] = useState<string>("");
  const [cofheClient, setCofheClient] = useState<any | null>(null);
  const [isPreparingCofhe, setIsPreparingCofhe] = useState(false);
  const [depositAmount, setDepositAmount] = useState<string>("");
  const [depositMessage, setDepositMessage] = useState<string>("");
  const [depositError, setDepositError] = useState<string>("");
  const [migrationFlowState, setMigrationFlowState] = useState<MigrationFlowState>("idle");
  const [migrationFlowMessage, setMigrationFlowMessage] = useState<string>("");
  const [confidentialAccountAddress, setConfidentialAccountAddress] = useState<string>("");
  const [migratedAssetBalances, setMigratedAssetBalances] = useState<Record<string, bigint>>({});
  const [migrationTxHashes, setMigrationTxHashes] = useState<Hex[]>([]);
  const [confidentialAccountScan, setConfidentialAccountScan] = useState<ScanResponse | null>(null);
  const [isScanningConfidentialAccount, setIsScanningConfidentialAccount] = useState(false);
  const [confidentialAccountScanError, setConfidentialAccountScanError] = useState<string>("");
  const normalizedWallet = wallet.toLowerCase();
  const approvedDemoWallet = DEMO_APPROVED_WALLETS.find(item => item.wallet.toLowerCase() === normalizedWallet);

  const manifestAssets = useMemo(() => manifest?.migrator?.assets ?? {}, [manifest]);
  const publicClient = useMemo(
    () =>
      createPublicClient({
        chain: arbitrumSepolia,
        transport: http(appConfig.rpcUrl),
      }),
    [],
  );
  const walletClient = useMemo(() => {
    if (typeof window === "undefined" || !window.ethereum) return undefined;

    return createWalletClient({
      chain: arbitrumSepolia,
      transport: custom(window.ethereum),
    });
  }, [wallet]);
  const {
    lane: usdcLane,
    depositFromEoa,
    depositFromSmartAccount,
    isPending: isDepositingToVault,
    error: hookDepositError,
  } = useConfidentialVaultDeposit(manifest, walletClient, publicClient);

  useEffect(() => {
    let cancelled = false;

    const loadBackendHealth = async () => {
      try {
        const response = await fetch(`${appConfig.backendUrl}/health`);
        if (!response.ok) {
          if (!cancelled) setBackendRedisAvailable(null);
          return;
        }

        const payload = (await response.json()) as {
          services?: { redis?: boolean };
        };

        if (!cancelled) {
          setBackendRedisAvailable(payload.services?.redis ?? null);
        }
      } catch {
        if (!cancelled) {
          setBackendRedisAvailable(null);
        }
      }
    };

    void loadBackendHealth();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!window.ethereum) return;

    let cancelled = false;

    const syncWallet = async () => {
      try {
        const accounts = (await window.ethereum?.request({
          method: "eth_accounts",
        })) as string[] | undefined;

        if (cancelled) return;

        setWallet(accounts?.[0] ?? window.ethereum?.selectedAddress ?? "");
      } catch {
        if (!cancelled) {
          setWallet(window.ethereum?.selectedAddress ?? "");
        }
      }
    };

    const handleAccountsChanged = (...args: unknown[]) => {
      const [accounts] = args as [string[] | undefined];
      setWallet(accounts?.[0] ?? window.ethereum?.selectedAddress ?? "");
      setScanResult(null);
      setEligibilityResult(null);
      setBalances([]);
      setRecoveryToken("");
      setDepositMessage("");
      setDepositError("");
      setMigrationFlowState("idle");
      setMigrationFlowMessage("");
      setConfidentialAccountAddress("");
      setMigratedAssetBalances({});
      setMigrationTxHashes([]);
      setConfidentialAccountScan(null);
      setConfidentialAccountScanError("");
    };

    void syncWallet();
    window.ethereum.on?.("accountsChanged", handleAccountsChanged);

    return () => {
      cancelled = true;
      window.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
    };
  }, []);

  useEffect(() => {
    if (!wallet || !eligibilityResult?.risk.migrationEligible) {
      setBalances([]);
      return;
    }

    const loadBalances = async () => {
      setIsLoadingBalances(true);
      try {
        const client = createPublicClient({
          chain: arbitrumSepolia,
          transport: http(appConfig.rpcUrl),
        });

        const entries = await Promise.all(
          eligibilityResult.supportedAssets.map(async (asset) => {
            if (asset.symbol === "WETH") {
              const balance = await client.getBalance({ address: wallet as `0x${string}` });
              return {
                symbol: asset.symbol,
                displaySymbol: asset.displaySymbol,
                balance: formatUnits(balance, 18),
                rawBalance: balance,
                selected: balance > 0n,
                route: asset.migrationRoute,
                description: asset.description,
              } satisfies AssetBalance;
            }

            const manifestAsset = manifestAssets[asset.symbol] as AlphaManifestAsset | undefined;
            if (!manifestAsset?.underlying) {
              return {
                symbol: asset.symbol,
                displaySymbol: asset.displaySymbol,
                balance: "0",
                rawBalance: 0n,
                selected: false,
                route: asset.migrationRoute,
                description: `${asset.description} Manifest not found.`,
              } satisfies AssetBalance;
            }

            const balance = await client.readContract({
              address: manifestAsset.underlying as `0x${string}`,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [wallet as `0x${string}`],
            });

            return {
              symbol: asset.symbol,
              displaySymbol: asset.displaySymbol,
              balance: formatUnits(balance, manifestAsset.decimals),
              rawBalance: balance,
              selected: balance > 0n,
              route: asset.migrationRoute,
              description: asset.description,
            } satisfies AssetBalance;
          }),
        );

        setBalances(entries);
      } catch (error) {
        setScanError(
          error instanceof Error ? error.message : "Unable to read onchain balances.",
        );
      } finally {
        setIsLoadingBalances(false);
      }
    };

    void loadBalances();
  }, [eligibilityResult, manifestAssets, wallet]);

  useEffect(() => {
    if (!wallet || !walletClient) {
      setCofheClient(null);
      return;
    }

    let cancelled = false;

    const connectCofhe = async () => {
      setIsPreparingCofhe(true);
      try {
        const client = createCofheClient(
          createCofheConfig({
            supportedChains: [cofheArbSepolia],
          }),
        );

        await client.connect(publicClient, walletClient);

        if (!cancelled) {
          setCofheClient(client);
        }
      } catch (error) {
        if (!cancelled) {
          setCofheClient(null);
          setDepositError(
            error instanceof Error ? error.message : "Unable to initialize confidential deposit client.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsPreparingCofhe(false);
        }
      }
    };

    void connectCofhe();

    return () => {
      cancelled = true;
    };
  }, [publicClient, wallet, walletClient]);

  const connectWallet = async () => {
    if (!window.ethereum) {
      setScanError("No injected wallet found. Install a browser wallet first.");
      return;
    }

    setIsConnecting(true);
    setScanError("");
    try {
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];

      if (!accounts[0]) {
        throw new Error("Wallet connection returned no accounts.");
      }

      setWallet(accounts[0]);
    } catch (error) {
      setScanError(formatWalletError(error, "Wallet connection failed."));
    } finally {
      setIsConnecting(false);
    }
  };

  const runScan = async () => {
    if (!wallet) return;
    setIsScanning(true);
    setScanError("");
    setRecoveryToken("");
    setEligibilityResult(null);
    setBalances([]);
    setDepositMessage("");
    setDepositError("");
    setMigrationFlowState("idle");
    setMigrationFlowMessage("");
    setConfidentialAccountAddress("");
    setMigratedAssetBalances({});
    setMigrationTxHashes([]);
    setConfidentialAccountScan(null);
    setConfidentialAccountScanError("");

    try {
      const response = await fetch(`${appConfig.backendUrl}/api/scan`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ wallet }),
      });

      if (!response.ok) {
        throw new Error(`Scan failed with status ${response.status}`);
      }

      const payload = (await response.json()) as ScanResponse;
      setScanResult(payload);
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "Scan failed.");
    } finally {
      setIsScanning(false);
    }
  };

  const requestMigrationEligibility = async () => {
    if (!wallet || !scanResult) return;

    setIsCheckingEligibility(true);
    setScanError("");
    setMigrationFlowState("idle");
    setMigrationFlowMessage("");
    setConfidentialAccountAddress("");
    setMigratedAssetBalances({});
    setMigrationTxHashes([]);
    setConfidentialAccountScan(null);
    setConfidentialAccountScanError("");

    try {
      const response = await fetch(`${appConfig.backendUrl}/api/migration/eligibility`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          wallet,
          scanSessionId: scanResult.scanSessionId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Eligibility check failed with status ${response.status}`);
      }

      const payload = (await response.json()) as MigrationEligibilityResponse;
      setEligibilityResult(payload);
    } catch (error) {
      setScanError(
        error instanceof Error ? error.message : "Migration eligibility check failed.",
      );
    } finally {
      setIsCheckingEligibility(false);
    }
  };

  const generateRecoveryToken = async () => {
    if (!scanResult?.scanSessionId) return;
    const response = await fetch(
      `${appConfig.backendUrl}/api/scan/${scanResult.scanSessionId}/recovery-token`,
      { method: "POST" },
    );
    if (!response.ok) {
      let details = `Recovery token failed with status ${response.status}`;
      try {
        const payload = (await response.json()) as { error?: string };
        if (payload.error) {
          details = payload.error;
        }
      } catch {
        // ignore invalid json bodies
      }
      throw new Error(details);
    }
    const payload = (await response.json()) as { recoveryToken: string };
    setRecoveryToken(payload.recoveryToken);
  };

  const toggleAsset = (symbol: string) => {
    setBalances(current =>
      current.map(item =>
        item.symbol === symbol ? { ...item, selected: !item.selected } : item,
      ),
    );
  };

  const selectedAssets = balances.filter(item => item.selected && item.rawBalance > 0n);
  const selectedUsdc = selectedAssets.find(item => item.symbol === "USDC");
  const activeUsdcStrategy = manifest?.migrator?.defi?.strategies?.USDC?.active ?? "aave";
  const migratedUsdcRawBalance = migratedAssetBalances.USDC ?? 0n;
  const migratedUsdcDisplayBalance =
    migratedUsdcRawBalance > 0n ? formatUnits(migratedUsdcRawBalance, 6) : "";
  const migrationFlowReady = migrationFlowState === "ready";
  const migrationPrimaryCta =
    migrationFlowState === "creating_account"
      ? "Creating confidential account..."
      : migrationFlowState === "migrating_assets"
        ? "Migrating selected assets..."
        : migrationFlowReady
          ? "Confidential account ready"
          : "Create confidential account and migrate";

  useEffect(() => {
    if (migrationFlowReady && migratedUsdcRawBalance > 0n) {
      if (!depositAmount) {
        setDepositAmount(migratedUsdcDisplayBalance);
      }
      return;
    }

    if (!selectedUsdc) {
      setDepositAmount("");
      return;
    }

    if (!depositAmount) {
      setDepositAmount(selectedUsdc.balance);
    }
  }, [depositAmount, migratedUsdcDisplayBalance, migratedUsdcRawBalance, migrationFlowReady, selectedUsdc]);

  useEffect(() => {
    if (hookDepositError) {
      setDepositError(hookDepositError);
    }
  }, [hookDepositError]);

  const handleVaultDeposit = async () => {
    if (!wallet || !cofheClient) return;

    setDepositError("");
    setDepositMessage("");

    try {
      const amount = parseUnits(depositAmount || "0", 6);
      if (amount <= 0n) {
        throw new Error("Enter a USDC amount greater than zero.");
      }

      if (confidentialAccountAddress && migratedUsdcRawBalance > 0n) {
        if (amount > migratedUsdcRawBalance) {
          throw new Error("Deposit amount exceeds the confidential USDC balance in the smart account.");
        }

        const executeSmartAccount = async ({
          target,
          data,
          value = 0n,
        }: {
          target: Address;
          data: Hex;
          value?: bigint;
        }) =>
          walletClient!.writeContract({
            address: confidentialAccountAddress as Address,
            abi: smartAccount4337Abi,
            functionName: "execute",
            args: [target, value, data],
            account: wallet as Address,
            chain: arbitrumSepolia,
            ...(await buildWriteFeeOverrides(publicClient)),
          });

        const result = await depositFromSmartAccount({
          amount,
          smartAccountAddress: confidentialAccountAddress as Address,
          fundingMode: "confidential_usdc",
          executeSmartAccount,
          encryptUint64: async ({
            amount: value,
            account,
          }: {
            amount: bigint;
            account: Address;
          }) => {
            const [encryptedDeposit] = await cofheClient
              .encryptInputs([Encryptable.uint64(value)])
              .setAccount(account)
              .setChainId(arbitrumSepolia.id)
              .execute();

            return [
              encryptedDeposit.ctHash,
              encryptedDeposit.securityZone,
              encryptedDeposit.utype,
              encryptedDeposit.signature,
            ] as const;
          },
        });

        setMigratedAssetBalances(current => ({
          ...current,
          USDC: current.USDC && current.USDC > amount ? current.USDC - amount : 0n,
        }));
        setDepositMessage(
          `Private yield deployment submitted from the confidential smart account. Last tx: ${result.txHashes[result.txHashes.length - 1]}`,
        );
        return;
      }

      if (!selectedUsdc) {
        throw new Error("Select funded USDC before attempting a direct deposit.");
      }
      if (amount > selectedUsdc.rawBalance) {
        throw new Error("Deposit amount exceeds the selected USDC balance.");
      }

      const result = await depositFromEoa({
        amount,
        account: wallet as Address,
        fundingMode: "public_usdc",
        encryptUint64: async ({ amount: value, account }) => {
          const [encryptedDeposit] = await cofheClient
            .encryptInputs([Encryptable.uint64(value)])
            .setAccount(account)
            .setChainId(arbitrumSepolia.id)
            .execute();

          return [
            encryptedDeposit.ctHash,
            encryptedDeposit.securityZone,
            encryptedDeposit.utype,
            encryptedDeposit.signature,
          ] as const;
        },
      });

      setDepositMessage(
        `Vault deposit submitted. Last tx: ${result.txHashes[result.txHashes.length - 1]}`,
      );
    } catch (error) {
      setDepositError(formatWalletError(error, "Confidential vault deposit failed."));
    }
  };

  const runPrivacyScan = async (address: string) => {
    const response = await fetch(`${appConfig.backendUrl}/api/scan`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ wallet: address }),
    });

    if (!response.ok) {
      throw new Error(`Scan failed with status ${response.status}`);
    }

    return (await response.json()) as ScanResponse;
  };

  const handleCreateAndMigrate = async () => {
    if (
      !wallet ||
      !walletClient ||
      selectedAssets.length === 0 ||
      migrationFlowState === "creating_account" ||
      migrationFlowState === "migrating_assets"
    ) {
      return;
    }

    setMigrationFlowState("creating_account");
    setMigrationFlowMessage("Creating a new confidential smart account for this wallet.");
    setDepositError("");
    setMigrationTxHashes([]);
    setConfidentialAccountScan(null);
    setConfidentialAccountScanError("");

    try {
      const factoryAddress = manifest?.migrator?.account4337Factory as Address | undefined;
      const migratorAddress = manifest?.migrator?.migrator as Address | undefined;
      const batchMigratorAddress = manifest?.migrator?.batchMigrator as Address | undefined;
      const permit2Address = (manifest?.migrator?.permit2 as Address | undefined) ?? CANONICAL_PERMIT2_ADDRESS;

      const salt = buildMigrationSalt(wallet as Address);
      const txHashes: Hex[] = [];
      const migrationCandidates: Array<{
        symbol: string;
        displaySymbol: string;
        manifestAsset: AlphaManifestAsset;
        amount: bigint;
      }> = [];

      for (const asset of selectedAssets) {
        const manifestAsset = manifestAssets[asset.symbol] as AlphaManifestAsset | undefined;
        if (!manifestAsset?.underlying || !manifestAsset?.wrapped) {
          continue;
        }

        let amountToMigrate = asset.rawBalance;
        if (asset.symbol === "WETH") {
          if (amountToMigrate <= GAS_RESERVE_WEI) {
            continue;
          }
          amountToMigrate -= GAS_RESERVE_WEI;

          const wrapHash = await walletClient.writeContract({
            address: manifestAsset.underlying as Address,
            abi: wrappedNativeAbi,
            functionName: "deposit",
            args: [],
            account: wallet as Address,
            chain: arbitrumSepolia,
            value: amountToMigrate,
            ...(await buildWriteFeeOverrides(publicClient)),
          });
          txHashes.push(wrapHash);
        }

        if (amountToMigrate <= 0n) {
          continue;
        }

        migrationCandidates.push({
          symbol: asset.symbol,
          displaySymbol: asset.displaySymbol,
          manifestAsset,
          amount: amountToMigrate,
        });
      }

      if (migrationCandidates.length === 0) {
        throw new Error("No funded ERC-20 assets were available to migrate. Native ETH requires enough headroom for gas.");
      }

      const predictedAccount = batchMigratorAddress
        ? await publicClient.readContract({
            address: batchMigratorAddress,
            abi: batchMigratorAbi,
            functionName: "predictAccountAddress",
            args: [wallet as Address, salt],
          })
        : factoryAddress
          ? await publicClient.readContract({
              address: factoryAddress,
              abi: account4337FactoryAbi,
              functionName: "predictAccountAddress",
              args: [wallet as Address, salt],
            })
          : undefined;

      if (!predictedAccount) {
        throw new Error("Alpha manifest is missing the account factory or batch migrator address.");
      }

      setConfidentialAccountAddress(predictedAccount);
      setMigrationFlowState("migrating_assets");
      setMigrationFlowMessage(
        `Migrating ${migrationCandidates.map(asset => asset.displaySymbol).join(", ")} into the new confidential smart account.`,
      );

      const migratedBalances: Record<string, bigint> = {};
      if (batchMigratorAddress) {
        setMigrationFlowMessage("Checking Permit2 approvals and preparing the batch migration signature.");

        for (const candidate of migrationCandidates) {
          const approvedAmount = await publicClient.readContract({
            address: candidate.manifestAsset.underlying as Address,
            abi: erc20AllowanceAbi,
            functionName: "allowance",
            args: [wallet as Address, permit2Address],
          });

          if (approvedAmount < candidate.amount) {
            const permit2ApprovalHash = await walletClient.writeContract({
              address: candidate.manifestAsset.underlying as Address,
              abi: erc20ApproveAbi,
              functionName: "approve",
              args: [permit2Address, maxUint256],
              account: wallet as Address,
              chain: arbitrumSepolia,
              ...(await buildWriteFeeOverrides(publicClient)),
            });
            txHashes.push(permit2ApprovalHash);
          }
        }

        const now = Math.floor(Date.now() / 1000);
        const permitExpiration = now + 30 * 24 * 60 * 60;
        const sigDeadline = BigInt(now + 15 * 60);
        const permitDetails = await Promise.all(
          migrationCandidates.map(async candidate => {
            const [, , nonce] = await publicClient.readContract({
              address: permit2Address,
              abi: permit2Abi,
              functionName: "allowance",
              args: [wallet as Address, candidate.manifestAsset.underlying as Address, batchMigratorAddress],
            });

            return {
              token: candidate.manifestAsset.underlying as Address,
              amount: candidate.amount,
              expiration: permitExpiration,
              nonce: Number(nonce),
            };
          }),
        );

        const permitBatch = {
          details: permitDetails,
          spender: batchMigratorAddress,
          sigDeadline,
        };

        const typedData = buildPermit2BatchTypedData({
          chainId: arbitrumSepolia.id,
          permit2Address,
          details: permitDetails,
          spender: batchMigratorAddress,
          sigDeadline,
        });
        const signature = await walletClient.signTypedData({
          account: wallet as Address,
          domain: typedData.domain,
          types: typedData.types,
          primaryType: typedData.primaryType,
          message: typedData.message,
        });

        setMigrationFlowMessage("Submitting the batch migration into the new confidential smart account.");

        const migrateHash = await walletClient.writeContract({
          address: batchMigratorAddress,
          abi: batchMigratorAbi,
          functionName: "createAccountAndMigrateBatchWithPermit2",
          args: [wallet as Address, salt, permitBatch, signature],
          account: wallet as Address,
          chain: arbitrumSepolia,
          ...(await buildWriteFeeOverrides(publicClient)),
        });
        txHashes.push(migrateHash);

        for (const candidate of migrationCandidates) {
          migratedBalances[candidate.symbol] = candidate.amount;
        }
      } else {
        if (!factoryAddress || !migratorAddress) {
          throw new Error("Alpha manifest is missing the account factory or migrator address.");
        }

        const existingCode = await publicClient.getBytecode({
          address: predictedAccount,
        });

        if (!existingCode) {
          const createAccountHash = await walletClient.writeContract({
            address: factoryAddress,
            abi: account4337FactoryAbi,
            functionName: "createAccount",
            args: [wallet as Address, salt],
            account: wallet as Address,
            chain: arbitrumSepolia,
            ...(await buildWriteFeeOverrides(publicClient)),
          });
          txHashes.push(createAccountHash);
        }

        for (const candidate of migrationCandidates) {
          const approveHash = await walletClient.writeContract({
            address: candidate.manifestAsset.underlying as Address,
            abi: erc20ApproveAbi,
            functionName: "approve",
            args: [migratorAddress, candidate.amount],
            account: wallet as Address,
            chain: arbitrumSepolia,
            ...(await buildWriteFeeOverrides(publicClient)),
          });
          txHashes.push(approveHash);

          const nonce = await publicClient.readContract({
            address: migratorAddress,
            abi: migratorAbi,
            functionName: "nonces",
            args: [wallet as Address],
          });
          const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
          const authorization = {
            stealthAddress: wallet as Address,
            recipient: predictedAccount,
            token: candidate.manifestAsset.underlying as Address,
            confidentialToken: candidate.manifestAsset.wrapped as Address,
            amount: candidate.amount,
            nonce,
            deadline,
          };

          const digest = await publicClient.readContract({
            address: migratorAddress,
            abi: migratorAbi,
            functionName: "getSweepDigest",
            args: [authorization],
          });
          const signature = await walletClient.signMessage({
            account: wallet as Address,
            message: {
              raw: digest,
            },
          });

          const migrateHash = await walletClient.writeContract({
            address: migratorAddress,
            abi: migratorAbi,
            functionName: "sweepAndMigrate",
            args: [authorization, signature],
            account: wallet as Address,
            chain: arbitrumSepolia,
            ...(await buildWriteFeeOverrides(publicClient)),
          });
          txHashes.push(migrateHash);
          migratedBalances[candidate.symbol] = candidate.amount;
        }
      }

      setMigrationTxHashes(txHashes);
      setMigratedAssetBalances(migratedBalances);
      setBalances(current =>
        current.map(item =>
          migratedBalances[item.symbol]
            ? {
                ...item,
                rawBalance: item.rawBalance > migratedBalances[item.symbol]! ? item.rawBalance - migratedBalances[item.symbol]! : 0n,
                balance:
                  item.rawBalance > migratedBalances[item.symbol]!
                    ? formatUnits(
                        item.rawBalance - migratedBalances[item.symbol]!,
                        item.symbol === "WBTC" ? 8 : item.symbol === "WETH" ? 18 : 6,
                      )
                    : "0",
                selected: false,
              }
            : item,
        ),
      );

      setMigrationFlowState("ready");
      setMigrationFlowMessage(
        "Confidential smart account deployed and funded. Assets are ready for private DeFi actions.",
      );

      setIsScanningConfidentialAccount(true);
      try {
        const payload = await runPrivacyScan(predictedAccount);
        setConfidentialAccountScan(payload);
      } catch (error) {
        setConfidentialAccountScanError(
          error instanceof Error ? error.message : "Unable to scan the new confidential smart account.",
        );
      } finally {
        setIsScanningConfidentialAccount(false);
      }
    } catch (error) {
      setMigrationFlowState("idle");
      setMigrationFlowMessage("");
      setDepositError(formatWalletError(error, "Unable to prepare the confidential account."));
    }
  };

  return (
    <div className="scan-shell">
      <section className="panel hero-panel">
        <p className="eyebrow">Alpha Flow</p>
        <h1>Measure exposure, then decide whether this wallet can move.</h1>
        <p className="lede">
          First scan the wallet for visible privacy leakage. Only when the user asks to
          migrate do we run the Wavy Node eligibility check.
        </p>
        <div className="hero-actions hero-actions-scan">
          <button className={wallet ? "ghost-button" : "primary-button"} onClick={connectWallet} disabled={isConnecting}>
            {wallet ? "Wallet Connected" : isConnecting ? "Connecting..." : "Connect Wallet"}
          </button>
          <button className="primary-button prominent-button" onClick={runScan} disabled={!wallet || isScanning}>
            {isScanning ? "Scanning..." : "Scan Wallet"}
          </button>
        </div>
        {wallet ? <p className="wallet-pill wallet-address-pill">{wallet}</p> : null}
        <div className="list-grid">
          <article className="list-card">
            <div className="list-card-header">
              <strong>Demo-approved wallets</strong>
              <span>3 linked</span>
            </div>
            {DEMO_APPROVED_WALLETS.map(item => (
              <p key={item.wallet} className="muted">
                {item.label}:{" "}
                <a href={arbiscanAddressUrl(item.wallet)} target="_blank" rel="noreferrer" className="address-link">
                  {formatAddress(item.wallet)}
                </a>
                {" → "}
                <a
                  href={arbiscanAddressUrl(item.smartAccount)}
                  target="_blank"
                  rel="noreferrer"
                  className="address-link"
                >
                  {formatAddress(item.smartAccount)}
                </a>
              </p>
            ))}
          </article>
          <article className="list-card">
            <div className="list-card-header">
              <strong>{BLOCKED_DEMO_SUGGESTION.label}</strong>
              <span>not linked</span>
            </div>
            <p className="muted">{BLOCKED_DEMO_SUGGESTION.wallet}</p>
            <p className="muted">{BLOCKED_DEMO_SUGGESTION.reason}</p>
          </article>
        </div>
        {wallet ? (
          approvedDemoWallet ? (
            <p className="wallet-pill small-pill">
              Demo-approved wallet detected. This address and its predicted smart account are already linked in the compliance lane.
            </p>
          ) : (
            <p className="wallet-pill small-pill">
              This wallet is outside the approved demo set. The privacy scan still works, but onchain migration may be rejected by the compliance gate.
            </p>
          )
        ) : null}
        {scanError ? <p className="error-text">{scanError}</p> : null}
      </section>

      <section className="panel stage-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Scan Stages</p>
            <h2>Current pipeline</h2>
          </div>
          <span className="metric-chip">
            {scanResult ? `${scanResult.progress}%` : "Idle"}
          </span>
        </div>
        <div className="stage-grid">
          {visibleStages(
            scanResult?.stages ?? [
              { stage: "identity", status: "skipped", progress: 0 },
              { stage: "financial", status: "skipped", progress: 0 },
              { stage: "exchange", status: "skipped", progress: 0 },
              { stage: "score", status: "skipped", progress: 0 },
            ],
          ).map(stage => (
            <article
              key={stage.stage}
              className={`stage-card stage-${stage.status} tone-${stageTone(stage.status)}`}
            >
              <div className="stage-topline">
                <strong>{stage.stage}</strong>
                <span>{stage.status}</span>
              </div>
              <div className="progress-track">
                <span style={{ width: `${stage.progress}%` }} />
              </div>
              {stage.error ? <p className="muted">{stage.error}</p> : null}
            </article>
          ))}
        </div>
      </section>

      {scanResult ? (
        <>
          <section className="metrics-grid">
            <article className={`panel metric-card tone-${scanResult.privacy.score >= 75 ? "ok" : scanResult.privacy.score >= 45 ? "warn" : "critical"}`}>
              <p className="eyebrow">Privacy Score</p>
              <div className="score-value">{scanResult.privacy.score}</div>
              <p>{scanResult.privacy.band} visibility band</p>
            </article>
            <article className="panel metric-card">
              <p className="eyebrow">Confidence</p>
              <div className="score-value">{Math.round(scanResult.privacy.confidence * 100)}%</div>
              <p>privacy signal confidence</p>
            </article>
            <article className="panel metric-card">
              <p className="eyebrow">Next Step</p>
              <div className="decision-badge">privacy only</div>
              <p>Run the migration eligibility check only when the user requests migration.</p>
            </article>
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Findings</p>
                <h2>Exposure report</h2>
              </div>
              <button
                className="ghost-button"
                onClick={() =>
                  void generateRecoveryToken().catch(error => {
                    setScanError(
                      error instanceof Error ? error.message : "Recovery token failed.",
                    );
                  })
                }
                disabled={backendRedisAvailable === false}
                title={
                  backendRedisAvailable === false
                    ? "Recovery tokens require Redis-backed scan persistence."
                    : undefined
                }
              >
                Generate Recovery Token
              </button>
            </div>
            {recoveryToken ? (
              <p className="wallet-pill small-pill">Recovery token: {recoveryToken}</p>
            ) : null}
            {backendRedisAvailable === false ? (
              <p className="muted">
                Recovery token is unavailable in this local session because Redis is not configured.
              </p>
            ) : null}
            <div className="list-grid">
              {(scanResult.report?.findings ?? []).map(item => (
                <article key={item.id} className="list-card">
                  <div className="list-card-header">
                    <strong>{item.title}</strong>
                    <span>{item.severity}</span>
                  </div>
                  <p className="muted">{item.details}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Migration Gate</p>
                <h2>Request migration eligibility</h2>
              </div>
              <button
                className="primary-button"
                onClick={() => void requestMigrationEligibility()}
                disabled={isCheckingEligibility}
              >
                {isCheckingEligibility ? "Checking eligibility..." : "I want to migrate my wallet"}
              </button>
            </div>
            <p className="muted">
              For alpha we are using simulated eligibility scores aligned to Wavy risk bands, so
              the migration gate can be tested without depending on the live provider.
            </p>
            <p className="muted">
              For the demo, only the three approved wallets listed above are prelinked onchain. Any other wallet should be treated as the blocked compliance case.
            </p>
            {eligibilityResult ? (
              <div className="runbook-grid">
                <article className={`panel metric-card tone-${riskTone(eligibilityResult.risk.policyBand)}`}>
                  <p className="eyebrow">Risk Score</p>
                  <div className="score-value">{eligibilityResult.risk.score ?? "N/A"}</div>
                  <p>{eligibilityResult.risk.level}</p>
                </article>
                <article className={`panel metric-card tone-${riskTone(eligibilityResult.risk.policyBand)}`}>
                  <p className="eyebrow">Decision</p>
                  <div className="decision-badge">{eligibilityResult.risk.policyBand}</div>
                  <p>{eligibilityResult.risk.reason}</p>
                </article>
                <article className="panel metric-card">
                  <p className="eyebrow">Risk Band</p>
                  <div className="decision-badge">{eligibilityResult.risk.level}</div>
                  <p>{eligibilityResult.risk.riskReason ?? "Simulated alpha risk score."}</p>
                </article>
              </div>
            ) : null}
          </section>

	          {eligibilityResult?.risk.migrationEligible ? (
	            <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Migration Selection</p>
                <h2>Assets eligible for alpha</h2>
              </div>
              {isLoadingBalances ? <span className="metric-chip">Loading balances...</span> : null}
            </div>
            <div className="asset-list">
              {balances.length === 0
                ? eligibilityResult.supportedAssets.map(asset => (
                    <article key={asset.symbol} className="asset-card">
                      <div>
                        <strong>{asset.displaySymbol}</strong>
                        <p className="muted">{asset.description}</p>
                      </div>
                      <span className="metric-chip">Awaiting balances</span>
                    </article>
                  ))
                : balances.map(asset => (
                    <label key={asset.symbol} className="asset-card selectable-card">
                      <div>
                        <strong>{asset.displaySymbol}</strong>
                        <p className="muted">{asset.description}</p>
                        <p className="muted">Route: {asset.route}</p>
                      </div>
                      <div className="asset-actions">
                        <span className="metric-chip">{asset.balance}</span>
                        <input
                          type="checkbox"
                          checked={asset.selected}
                          onChange={() => toggleAsset(asset.symbol)}
                          disabled={!eligibilityResult.risk.migrationEligible || asset.rawBalance === 0n}
                        />
                      </div>
                    </label>
                  ))}
            </div>
            <div className="deferred-panel">
              <strong>Selected assets</strong>
              <p className="muted">
                {selectedAssets.length > 0
                  ? selectedAssets.map(item => item.displaySymbol).join(", ")
                  : "No funded alpha assets selected yet."}
              </p>
            </div>
            </section>
          ) : null}

	          {eligibilityResult?.risk.migrationEligible ? (
	            <section className="panel">
	            <div className="section-heading">
	              <div>
	                <p className="eyebrow">Alpha Runbook</p>
	                <h2>Confidential account and private actions</h2>
	              </div>
	            </div>
	            <div className="runbook-grid">
	              <article className="runbook-card">
	                <p className="eyebrow">Step 1</p>
	                <h3>Create confidential smart account</h3>
	                <p className="muted compact-meta">
	                  Factory:{" "}
	                  {manifest?.migrator?.account4337Factory ? (
	                    <a
	                      href={arbiscanAddressUrl(manifest.migrator.account4337Factory)}
	                      target="_blank"
	                      rel="noreferrer"
	                      className="address-link"
	                    >
	                      {formatAddress(manifest.migrator.account4337Factory)}
	                    </a>
	                  ) : (
	                    "pending"
	                  )}
	                </p>
	              </article>
	              <article className="runbook-card">
	                <p className="eyebrow">Step 2</p>
	                <h3>Migrate selected assets</h3>
	                <p className="muted compact-meta">
	                  Migrator:{" "}
	                  {manifest?.migrator?.migrator ? (
	                    <a
	                      href={arbiscanAddressUrl(manifest.migrator.migrator)}
	                      target="_blank"
	                      rel="noreferrer"
	                      className="address-link"
	                    >
	                      {formatAddress(manifest.migrator.migrator)}
	                    </a>
	                  ) : (
	                    "pending"
	                  )}
	                </p>
	              </article>
	              <article className="runbook-card">
	                <p className="eyebrow">Step 3</p>
	                <h3>Access DeFi confidentially</h3>
	                <p className="muted compact-meta">
	                  Vault:{" "}
	                  {(usdcLane?.asset.vault ?? manifest?.migrator?.assets?.USDC?.vault) ? (
	                    <a
	                      href={arbiscanAddressUrl(usdcLane?.asset.vault ?? manifest?.migrator?.assets?.USDC?.vault ?? "")}
	                      target="_blank"
	                      rel="noreferrer"
	                      className="address-link"
	                    >
	                      {formatAddress(usdcLane?.asset.vault ?? manifest?.migrator?.assets?.USDC?.vault)}
	                    </a>
	                  ) : (
	                    "pending"
	                  )}
	                </p>
	                <p className="muted">
	                  Yield strategy: {activeUsdcStrategy} {manifest?.migrator?.defi?.buyGoldAdapter ? "• Gold route available" : "• Gold route pending"}
	                </p>
	              </article>
	            </div>
	            <div className="deferred-panel journey-actions">
	              <strong>One click to prepare the confidential account</strong>
	              <p className="muted">
	                The app will create the confidential smart account first and then migrate the selected assets in order.
	              </p>
	              <div className="hero-actions">
	                <button
	                  className="primary-button"
	                  onClick={() => void handleCreateAndMigrate()}
	                  disabled={!wallet || selectedAssets.length === 0 || migrationFlowReady || migrationFlowState !== "idle"}
	                >
	                  {migrationPrimaryCta}
	                </button>
	              </div>
	                  {selectedAssets.length > 0 ? (
	                    <p className="muted">
	                      Selected for migration: {selectedAssets.map(item => `${item.displaySymbol} (${formatBalancePreview(item.balance)})`).join(", ")}
	                    </p>
	                  ) : (
	                <p className="muted">Select funded assets above to enable the confidential migration flow.</p>
	              )}
	              {migrationFlowMessage ? <p className="wallet-pill small-pill">{migrationFlowMessage}</p> : null}
	              {depositError ? <p className="error-text">{depositError}</p> : null}
	            </div>

	            {migrationFlowReady ? (
	              <div className="feature-grid">
	                <article className="panel feature-card">
	                  <p className="eyebrow">Confidential Account</p>
	                  <h3>New private smart account ready</h3>
	                  {confidentialAccountAddress ? (
	                    <a
	                      href={arbiscanAddressUrl(confidentialAccountAddress)}
	                      target="_blank"
	                      rel="noreferrer"
	                      className="wallet-pill wallet-address-pill address-link"
	                    >
	                      {formatAddress(confidentialAccountAddress)}
	                    </a>
	                  ) : (
	                    <p className="wallet-pill wallet-address-pill">Pending account address</p>
	                  )}
	                  <p className="muted">
	                    Assets migrated: {Object.keys(migratedAssetBalances).join(", ")}
	                  </p>
	                  {migrationTxHashes.length > 0 ? (
	                    <p className="muted compact-meta">
	                      Migration txs: {migrationTxHashes.length}
	                    </p>
	                  ) : null}
	                </article>

	                <article className="panel feature-card">
	                  <p className="eyebrow">Generate Private Yield</p>
	                  <h3>Deploy capital without exposing the strategy</h3>
	                  <p className="muted">
	                    Shield public USDC into tzcUSDC and transfer it confidentially into the USDC vault.
	                  </p>
	                  <div className="compact-address-list">
	                    <p className="muted compact-meta">
	                      Underlying:{" "}
	                      {usdcLane?.asset.underlying ? (
	                        <a
	                          href={arbiscanAddressUrl(usdcLane.asset.underlying)}
	                          target="_blank"
	                          rel="noreferrer"
	                          className="address-link"
	                        >
	                          {formatAddress(usdcLane.asset.underlying)}
	                        </a>
	                      ) : (
	                        "pending"
	                      )}
	                    </p>
	                    <p className="muted compact-meta">
	                      Wrapped:{" "}
	                      {usdcLane?.asset.wrapped ? (
	                        <a
	                          href={arbiscanAddressUrl(usdcLane.asset.wrapped)}
	                          target="_blank"
	                          rel="noreferrer"
	                          className="address-link"
	                        >
	                          {formatAddress(usdcLane.asset.wrapped)}
	                        </a>
	                      ) : (
	                        "pending"
	                      )}
	                    </p>
	                  </div>
	                  <div className="hero-actions">
	                    <input
	                      type="number"
	                      min="0"
	                      step="0.000001"
	                      value={depositAmount}
	                      onChange={event => setDepositAmount(event.target.value)}
	                      placeholder="USDC amount"
	                      className="wallet-pill"
	                    />
	                    <button
	                      className="primary-button"
	                      onClick={() => void handleVaultDeposit()}
	                      disabled={
	                        !wallet ||
	                        (migratedUsdcRawBalance === 0n && !selectedUsdc) ||
	                        !cofheClient ||
	                        isPreparingCofhe ||
	                        isDepositingToVault
	                      }
	                    >
	                      {isPreparingCofhe
	                        ? "Preparing CoFHE..."
	                        : isDepositingToVault
	                          ? "Depositing..."
	                          : "Generate Private Yield"}
	                    </button>
	                  </div>
	                  {migratedUsdcRawBalance > 0n ? (
	                    <p className="muted">Confidential USDC available: {formatBalancePreview(migratedUsdcDisplayBalance)}</p>
	                  ) : selectedUsdc ? (
	                    <p className="muted">Selected USDC balance: {selectedUsdc.balance}</p>
	                  ) : (
	                    <p className="muted">Select funded USDC in Migration Selection to enable private yield.</p>
	                  )}
	                  {depositMessage ? <p className="wallet-pill small-pill">{depositMessage}</p> : null}
	                </article>

	                <article className="panel feature-card">
	                  <p className="eyebrow">Buy Gold Privately</p>
	                  <h3>Route the confidential account through the GMX adapter</h3>
	                  <p className="muted compact-meta">
	                    {manifest?.migrator?.defi?.buyGoldAdapter ? (
	                      <>
	                        Adapter ready:{" "}
	                        <a
	                          href={arbiscanAddressUrl(manifest.migrator.defi.buyGoldAdapter)}
	                          target="_blank"
	                          rel="noreferrer"
	                          className="address-link"
	                        >
	                          {formatAddress(manifest.migrator.defi.buyGoldAdapter)}
	                        </a>
	                      </>
	                    ) : (
	                      "Gold adapter not deployed yet."
	                    )}
	                  </p>
	                  <button className="ghost-button" disabled>
	                    Buy Gold Privately
	                  </button>
	                </article>
	              </div>
	            ) : null}

	            {migrationFlowReady ? (
	              <section className="panel">
	                <div className="section-heading">
	                  <div>
	                    <p className="eyebrow">New Account Scan</p>
	                    <h2>Privacy score for the confidential smart account</h2>
	                  </div>
	                  <span className="metric-chip">
	                    {isScanningConfidentialAccount ? "Scanning..." : "Completed"}
	                  </span>
	                </div>
	                {confidentialAccountScan ? (
	                  <div className="metrics-grid">
	                    <article className={`panel metric-card tone-${confidentialAccountScan.privacy.score >= 75 ? "ok" : confidentialAccountScan.privacy.score >= 45 ? "warn" : "critical"}`}>
	                      <p className="eyebrow">Privacy Score</p>
	                      <div className="score-value">{confidentialAccountScan.privacy.score}</div>
	                      <p>{confidentialAccountScan.privacy.band} visibility band</p>
	                    </article>
	                    <article className="panel metric-card">
	                      <p className="eyebrow">Confidence</p>
	                      <div className="score-value">{Math.round(confidentialAccountScan.privacy.confidence * 100)}%</div>
	                      <p>confidence for the new smart account scan</p>
	                    </article>
	                    <article className="panel metric-card">
	                      <p className="eyebrow">Scanned Account</p>
	                      <div className="decision-badge">
	                        {formatAddress(confidentialAccountAddress)}
	                      </div>
	                      <p>The scan reflects the public footprint of the new confidential smart account.</p>
	                    </article>
	                  </div>
	                ) : null}
	                {confidentialAccountScanError ? <p className="error-text">{confidentialAccountScanError}</p> : null}
	              </section>
	            ) : null}
	            </section>
	          ) : null}
        </>
      ) : null}
    </div>
  );
}
