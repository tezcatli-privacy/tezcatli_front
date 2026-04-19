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
  };
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

      return {
        txHashes,
        underlying: lane.asset.underlying,
        wrapped: lane.asset.wrapped,
        vault: lane.asset.vault,
        strategies: lane.strategies,
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

      return {
        txHashes,
        underlying: lane.asset.underlying,
        wrapped: lane.asset.wrapped,
        vault: lane.asset.vault,
        strategies: lane.strategies,
      };
    } catch (caught) {
      const message = formatWalletError(caught, "Smart account confidential deposit failed");
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
  };
}
