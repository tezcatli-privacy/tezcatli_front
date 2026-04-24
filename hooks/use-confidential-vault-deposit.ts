"use client";

import { useMemo, useState } from "react";
import {
  encodeAbiParameters,
  encodeFunctionData,
  parseAbi,
  type Account,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import type { AlphaManifest, AlphaManifestAsset, AlphaManifestAssetStrategies } from "@/lib/alpha-manifest";
import { buildWriteFeeOverrides } from "@/lib/wallet-fees";
import { formatWalletError } from "@/lib/wallet-errors";

const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) external returns (bool)",
]);

const wrappedTokenAbi = parseAbi([
  "function shield(uint64 amount) external",
  "function confidentialTransferAndCall(address to, (uint256,uint8,uint8,bytes) encryptedAmount, bytes data) external",
]);

const vaultCoordinatorAbi = parseAbi([
  "function deployToStrategyWithAdapter(address vault, address strategyAdapter, uint64 assets, uint256 minSharesOut) returns (uint256 sharesOut)",
  "function redeemFromStrategyWithAdapter(address vault, address strategyAdapter, uint256 shares, uint64 minAssetsOut) returns (uint256 assetsOut)",
]);

const vaultAbi = parseAbi([
  "function withdrawConfidential(address recipient) returns (uint256)",
  "function strategySharesByAdapter(address adapter) view returns (uint256)",
  "function minWithdrawDelay() view returns (uint64)",
]);

export type EncryptedUint64 = readonly [bigint, number, number, Hex];

export type EncryptUint64 = (args: {
  amount: bigint;
  account: Address;
}) => Promise<EncryptedUint64>;

export type SmartAccountExecutor = (args: {
  target: Address;
  data: Hex;
  value?: bigint;
}) => Promise<Hex>;

export type DepositFundingMode = "public_usdc" | "confidential_usdc";

export type EoaDepositArgs = {
  amount: bigint;
  encryptUint64: EncryptUint64;
  account?: Address | Account;
  beneficiary?: Address;
  lockOption?: number;
  fundingMode?: DepositFundingMode;
};

export type SmartAccountDepositArgs = {
  amount: bigint;
  smartAccountAddress: Address;
  encryptUint64: EncryptUint64;
  executeSmartAccount: SmartAccountExecutor;
  beneficiary?: Address;
  lockOption?: number;
  fundingMode?: DepositFundingMode;
};

export type EoaWithdrawalArgs = {
  recipient?: Address;
  account?: Address | Account;
};

export type SmartAccountWithdrawalArgs = {
  smartAccountAddress: Address;
  recipient?: Address;
  executeSmartAccount: SmartAccountExecutor;
};

export type StrategyDeploymentResult = {
  attempted: boolean;
  succeeded: boolean;
  strategyName?: string;
  strategyAdapter?: Address;
  coordinator?: Address;
  txHash?: Hex;
  error?: string;
};

export type StrategyRedemptionResult = {
  attempted: boolean;
  succeeded: boolean;
  strategyName?: string;
  strategyAdapter?: Address;
  coordinator?: Address;
  sharesRedeemed?: bigint;
  txHash?: Hex;
  error?: string;
};

export type VaultWithdrawalResult = {
  txHashes: Hex[];
  vault: Address;
  wrapped: Address;
  recipient: Address;
  minWithdrawDelaySeconds?: bigint;
  strategyRedemption: StrategyRedemptionResult;
};

const normalizeAddress = (account?: Address | Account | null): Address | null => {
  if (!account) return null;
  if (typeof account === "string") return account;
  return account.address;
};

const encodeVaultDepositData = (beneficiary: Address, lockOption?: number) => {
  if (typeof lockOption === "number") {
    return encodeAbiParameters(
      [{ type: "address" }, { type: "uint8" }],
      [beneficiary, lockOption],
    );
  }

  return encodeAbiParameters([{ type: "address" }], [beneficiary]);
};

const getUsdcLane = (manifest: AlphaManifest | null) => {
  const asset = manifest?.migrator?.assets?.USDC as AlphaManifestAsset | undefined;
  const strategies = manifest?.migrator?.defi?.strategies?.USDC as
    | AlphaManifestAssetStrategies
    | undefined;

  if (!asset?.underlying || !asset.wrapped || !asset.vault) {
    return null;
  }

  return {
    asset,
    strategies,
    coordinator: manifest?.migrator?.vaultCoordinator as Address | undefined,
  };
};

const getActiveStrategyRoute = (
  lane: NonNullable<ReturnType<typeof getUsdcLane>>,
): { name: string; adapter: Address } | null => {
  const activeStrategy = lane.strategies?.active;
  if (!activeStrategy) {
    return null;
  }

  if (activeStrategy === "aave" && lane.strategies?.aave?.adapter) {
    return {
      name: "aave",
      adapter: lane.strategies.aave.adapter as Address,
    };
  }

  if (activeStrategy === "morphoMock" && lane.strategies?.morphoMock?.adapter) {
    return {
      name: "morphoMock",
      adapter: lane.strategies.morphoMock.adapter as Address,
    };
  }

  return null;
};

const readMinWithdrawDelay = async (
  publicClient: PublicClient | undefined,
  vault: Address,
): Promise<bigint | undefined> => {
  if (!publicClient) return undefined;

  return publicClient.readContract({
    address: vault,
    abi: vaultAbi,
    functionName: "minWithdrawDelay",
  });
};

const readOutstandingStrategyShares = async (
  publicClient: PublicClient | undefined,
  vault: Address,
  adapter: Address,
): Promise<bigint> => {
  if (!publicClient) return 0n;

  return publicClient.readContract({
    address: vault,
    abi: vaultAbi,
    functionName: "strategySharesByAdapter",
    args: [adapter],
  });
};

export function useConfidentialVaultDeposit(
  manifest: AlphaManifest | null,
  walletClient?: WalletClient,
  publicClient?: PublicClient,
) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string>("");

  const lane = useMemo(() => getUsdcLane(manifest), [manifest]);

  const depositFromEoa = async ({
    amount,
    encryptUint64,
    account,
    beneficiary,
    lockOption,
    fundingMode = "public_usdc",
  }: EoaDepositArgs) => {
    if (!walletClient) {
      throw new Error("walletClient is required for EOA deposits");
    }

    if (!lane) {
      throw new Error("USDC lane is not available in the alpha manifest");
    }

    const resolvedAccount = normalizeAddress(account ?? walletClient.account);
    if (!resolvedAccount) {
      throw new Error("No wallet account available for EOA deposit");
    }

    setIsPending(true);
    setError("");

    try {
      const txHashes: Hex[] = [];

      if (fundingMode === "public_usdc") {
        const approveHash = await walletClient.writeContract({
          address: lane.asset.underlying as Address,
          abi: erc20Abi,
          functionName: "approve",
          args: [lane.asset.wrapped as Address, amount],
          account: resolvedAccount,
          chain: walletClient.chain,
          ...(await buildWriteFeeOverrides(publicClient)),
        });
        txHashes.push(approveHash);

        const shieldHash = await walletClient.writeContract({
          address: lane.asset.wrapped as Address,
          abi: wrappedTokenAbi,
          functionName: "shield",
          args: [amount],
          account: resolvedAccount,
          chain: walletClient.chain,
          ...(await buildWriteFeeOverrides(publicClient)),
        });
        txHashes.push(shieldHash);
      }

      const encryptedDeposit = await encryptUint64({
        amount,
        account: resolvedAccount,
      });

      const depositHash = await walletClient.writeContract({
        address: lane.asset.wrapped as Address,
        abi: wrappedTokenAbi,
        functionName: "confidentialTransferAndCall",
        args: [
          lane.asset.vault as Address,
          encryptedDeposit,
          encodeVaultDepositData(beneficiary ?? resolvedAccount, lockOption),
        ],
        account: resolvedAccount,
        chain: walletClient.chain,
        ...(await buildWriteFeeOverrides(publicClient)),
      });
      txHashes.push(depositHash);

      let strategyDeployment: StrategyDeploymentResult = {
        attempted: false,
        succeeded: false,
      };

      const activeStrategy = getActiveStrategyRoute(lane);
      if (lane.coordinator && activeStrategy) {
        strategyDeployment = {
          attempted: true,
          succeeded: false,
          strategyName: activeStrategy.name,
          strategyAdapter: activeStrategy.adapter,
          coordinator: lane.coordinator,
        };

        try {
          const deployHash = await walletClient.writeContract({
            address: lane.coordinator,
            abi: vaultCoordinatorAbi,
            functionName: "deployToStrategyWithAdapter",
            args: [lane.asset.vault as Address, activeStrategy.adapter, amount, 0n],
            account: resolvedAccount,
            chain: walletClient.chain,
            ...(await buildWriteFeeOverrides(publicClient)),
          });
          txHashes.push(deployHash);
          strategyDeployment = {
            ...strategyDeployment,
            succeeded: true,
            txHash: deployHash,
          };
        } catch (caught) {
          strategyDeployment = {
            ...strategyDeployment,
            error: formatWalletError(
              caught,
              `Vault deposit completed, but deploying into ${activeStrategy.name} failed`,
            ),
          };
        }
      }

      return {
        txHashes,
        underlying: lane.asset.underlying,
        wrapped: lane.asset.wrapped,
        vault: lane.asset.vault,
        strategies: lane.strategies,
        strategyDeployment,
      };
    } catch (caught) {
      const message = formatWalletError(caught, "EOA confidential deposit failed");
      setError(message);
      throw new Error(message);
    } finally {
      setIsPending(false);
    }
  };

  const depositFromSmartAccount = async ({
    amount,
    smartAccountAddress,
    encryptUint64,
    executeSmartAccount,
    beneficiary,
    lockOption,
    fundingMode = "public_usdc",
  }: SmartAccountDepositArgs) => {
    if (!lane) {
      throw new Error("USDC lane is not available in the alpha manifest");
    }

    setIsPending(true);
    setError("");

    try {
      const txHashes: Hex[] = [];

      if (fundingMode === "public_usdc") {
        const approveData = encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [lane.asset.wrapped as Address, amount],
        });
        txHashes.push(
          await executeSmartAccount({
            target: lane.asset.underlying as Address,
            data: approveData,
            value: 0n,
          }),
        );

        const shieldData = encodeFunctionData({
          abi: wrappedTokenAbi,
          functionName: "shield",
          args: [amount],
        });
        txHashes.push(
          await executeSmartAccount({
            target: lane.asset.wrapped as Address,
            data: shieldData,
            value: 0n,
          }),
        );
      }

      const encryptedDeposit = await encryptUint64({
        amount,
        account: smartAccountAddress,
      });

      const depositData = encodeFunctionData({
        abi: wrappedTokenAbi,
        functionName: "confidentialTransferAndCall",
        args: [
          lane.asset.vault as Address,
          encryptedDeposit,
          encodeVaultDepositData(beneficiary ?? smartAccountAddress, lockOption),
        ],
      });

      txHashes.push(
        await executeSmartAccount({
          target: lane.asset.wrapped as Address,
          data: depositData,
          value: 0n,
        }),
      );

      let strategyDeployment: StrategyDeploymentResult = {
        attempted: false,
        succeeded: false,
      };

      const activeStrategy = getActiveStrategyRoute(lane);
      const operatorAccount = normalizeAddress(walletClient?.account);
      if (lane.coordinator && activeStrategy && walletClient && operatorAccount) {
        strategyDeployment = {
          attempted: true,
          succeeded: false,
          strategyName: activeStrategy.name,
          strategyAdapter: activeStrategy.adapter,
          coordinator: lane.coordinator,
        };

        try {
          const deployHash = await walletClient.writeContract({
            address: lane.coordinator,
            abi: vaultCoordinatorAbi,
            functionName: "deployToStrategyWithAdapter",
            args: [lane.asset.vault as Address, activeStrategy.adapter, amount, 0n],
            account: operatorAccount,
            chain: walletClient.chain,
            ...(await buildWriteFeeOverrides(publicClient)),
          });
          txHashes.push(deployHash);
          strategyDeployment = {
            ...strategyDeployment,
            succeeded: true,
            txHash: deployHash,
          };
        } catch (caught) {
          strategyDeployment = {
            ...strategyDeployment,
            error: formatWalletError(
              caught,
              `Vault deposit completed, but deploying into ${activeStrategy.name} failed`,
            ),
          };
        }
      }

      return {
        txHashes,
        underlying: lane.asset.underlying,
        wrapped: lane.asset.wrapped,
        vault: lane.asset.vault,
        strategies: lane.strategies,
        strategyDeployment,
      };
    } catch (caught) {
      const message = formatWalletError(caught, "Smart account confidential deposit failed");
      setError(message);
      throw new Error(message);
    } finally {
      setIsPending(false);
    }
  };

  const withdrawFromEoa = async ({
    recipient,
    account,
  }: EoaWithdrawalArgs = {}): Promise<VaultWithdrawalResult> => {
    if (!walletClient) {
      throw new Error("walletClient is required for EOA withdrawals");
    }

    if (!lane) {
      throw new Error("USDC lane is not available in the alpha manifest");
    }

    const resolvedAccount = normalizeAddress(account ?? walletClient.account);
    if (!resolvedAccount) {
      throw new Error("No wallet account available for EOA withdrawal");
    }

    setIsPending(true);
    setError("");

    try {
      const txHashes: Hex[] = [];
      const minWithdrawDelaySeconds = await readMinWithdrawDelay(publicClient, lane.asset.vault as Address);

      let strategyRedemption: StrategyRedemptionResult = {
        attempted: false,
        succeeded: false,
      };

      const activeStrategy = getActiveStrategyRoute(lane);
      if (lane.coordinator && activeStrategy) {
        strategyRedemption = {
          attempted: true,
          succeeded: false,
          strategyName: activeStrategy.name,
          strategyAdapter: activeStrategy.adapter,
          coordinator: lane.coordinator,
        };

        try {
          const outstandingShares = await readOutstandingStrategyShares(
            publicClient,
            lane.asset.vault as Address,
            activeStrategy.adapter,
          );

          if (outstandingShares > 0n) {
            const redeemHash = await walletClient.writeContract({
              address: lane.coordinator,
              abi: vaultCoordinatorAbi,
              functionName: "redeemFromStrategyWithAdapter",
              args: [lane.asset.vault as Address, activeStrategy.adapter, outstandingShares, 0n],
              account: resolvedAccount,
              chain: walletClient.chain,
              ...(await buildWriteFeeOverrides(publicClient)),
            });
            txHashes.push(redeemHash);
            strategyRedemption = {
              ...strategyRedemption,
              succeeded: true,
              sharesRedeemed: outstandingShares,
              txHash: redeemHash,
            };
          } else {
            strategyRedemption = {
              ...strategyRedemption,
              succeeded: true,
              sharesRedeemed: 0n,
            };
          }
        } catch (caught) {
          strategyRedemption = {
            ...strategyRedemption,
            error: formatWalletError(
              caught,
              `Vault position was not redeemed from ${activeStrategy.name}`,
            ),
          };
        }
      }

      const withdrawHash = await walletClient.writeContract({
        address: lane.asset.vault as Address,
        abi: vaultAbi,
        functionName: "withdrawConfidential",
        args: [recipient ?? resolvedAccount],
        account: resolvedAccount,
        chain: walletClient.chain,
        ...(await buildWriteFeeOverrides(publicClient)),
      });
      txHashes.push(withdrawHash);

      return {
        txHashes,
        vault: lane.asset.vault as Address,
        wrapped: lane.asset.wrapped as Address,
        recipient: recipient ?? resolvedAccount,
        minWithdrawDelaySeconds,
        strategyRedemption,
      };
    } catch (caught) {
      const message = formatWalletError(caught, "EOA confidential withdrawal failed");
      setError(message);
      throw new Error(message);
    } finally {
      setIsPending(false);
    }
  };

  const withdrawFromSmartAccount = async ({
    smartAccountAddress,
    recipient,
    executeSmartAccount,
  }: SmartAccountWithdrawalArgs): Promise<VaultWithdrawalResult> => {
    if (!lane) {
      throw new Error("USDC lane is not available in the alpha manifest");
    }

    setIsPending(true);
    setError("");

    try {
      const txHashes: Hex[] = [];
      const minWithdrawDelaySeconds = await readMinWithdrawDelay(publicClient, lane.asset.vault as Address);

      let strategyRedemption: StrategyRedemptionResult = {
        attempted: false,
        succeeded: false,
      };

      const activeStrategy = getActiveStrategyRoute(lane);
      const operatorAccount = normalizeAddress(walletClient?.account);
      if (lane.coordinator && activeStrategy && walletClient && operatorAccount) {
        strategyRedemption = {
          attempted: true,
          succeeded: false,
          strategyName: activeStrategy.name,
          strategyAdapter: activeStrategy.adapter,
          coordinator: lane.coordinator,
        };

        try {
          const outstandingShares = await readOutstandingStrategyShares(
            publicClient,
            lane.asset.vault as Address,
            activeStrategy.adapter,
          );

          if (outstandingShares > 0n) {
            const redeemHash = await walletClient.writeContract({
              address: lane.coordinator,
              abi: vaultCoordinatorAbi,
              functionName: "redeemFromStrategyWithAdapter",
              args: [lane.asset.vault as Address, activeStrategy.adapter, outstandingShares, 0n],
              account: operatorAccount,
              chain: walletClient.chain,
              ...(await buildWriteFeeOverrides(publicClient)),
            });
            txHashes.push(redeemHash);
            strategyRedemption = {
              ...strategyRedemption,
              succeeded: true,
              sharesRedeemed: outstandingShares,
              txHash: redeemHash,
            };
          } else {
            strategyRedemption = {
              ...strategyRedemption,
              succeeded: true,
              sharesRedeemed: 0n,
            };
          }
        } catch (caught) {
          strategyRedemption = {
            ...strategyRedemption,
            error: formatWalletError(
              caught,
              `Vault position was not redeemed from ${activeStrategy.name}`,
            ),
          };
        }
      }

      const withdrawData = encodeFunctionData({
        abi: vaultAbi,
        functionName: "withdrawConfidential",
        args: [recipient ?? smartAccountAddress],
      });
      txHashes.push(
        await executeSmartAccount({
          target: lane.asset.vault as Address,
          data: withdrawData,
          value: 0n,
        }),
      );

      return {
        txHashes,
        vault: lane.asset.vault as Address,
        wrapped: lane.asset.wrapped as Address,
        recipient: recipient ?? smartAccountAddress,
        minWithdrawDelaySeconds,
        strategyRedemption,
      };
    } catch (caught) {
      const message = formatWalletError(caught, "Smart account confidential withdrawal failed");
      setError(message);
      throw new Error(message);
    } finally {
      setIsPending(false);
    }
  };

  return {
    isPending,
    error,
    lane,
    depositFromEoa,
    depositFromSmartAccount,
    withdrawFromEoa,
    withdrawFromSmartAccount,
  };
}
