import fs from "node:fs";
import path from "node:path";
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  encodeAbiParameters,
  encodeFunctionData,
  formatEther,
  formatUnits,
  getContract,
  http,
  maxUint256,
  parseAbi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";
import { createCofheClient, createCofheConfig } from "@cofhe/sdk/node";
import { Encryptable } from "@cofhe/sdk";
import { getChainById } from "@cofhe/sdk/chains";

const ROOT = path.resolve(process.cwd(), "..");
const MANIFEST_PATH = path.resolve(ROOT, "shared/deployments/arbitrum-sepolia.alpha.json");

const parseArgs = argv => {
  const [command, ...rest] = argv.slice(2);
  const flags = {};
  for (let i = 0; i < rest.length; i += 1) {
    const current = rest[i];
    if (!current.startsWith("--")) continue;
    const key = current.slice(2);
    const next = rest[i + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = true;
      continue;
    }
    flags[key] = next;
    i += 1;
  }
  return { command, flags };
};

const requiredEnv = key => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
};

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
const rpcUrl = requiredEnv("ARBITRUM_SEPOLIA_RPC_URL");
const account = privateKeyToAccount(requiredEnv("PRIVATE_KEY"));

const publicClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(rpcUrl),
});

const walletClient = createWalletClient({
  account,
  chain: arbitrumSepolia,
  transport: http(rpcUrl),
});

const permit2BatchTypes = {
  PermitDetails: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint160" },
    { name: "expiration", type: "uint48" },
    { name: "nonce", type: "uint48" },
  ],
  PermitBatch: [
    { name: "details", type: "PermitDetails[]" },
    { name: "spender", type: "address" },
    { name: "sigDeadline", type: "uint256" },
  ],
};

const erc20Abi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

const accountFactoryAbi = parseAbi([
  "function predictAccountAddress(address owner, uint256 salt) view returns (address)",
  "function createAccount(address owner, uint256 salt) returns (address)",
  "event AccountCreated(address indexed account, address indexed owner, uint256 salt)",
]);

const batchMigratorAbi = parseAbi([
  "function predictAccountAddress(address owner, uint256 salt) view returns (address)",
  "function createAccountAndMigrateBatchWithPermit2(address owner, uint256 salt, ((address token,uint160 amount,uint48 expiration,uint48 nonce)[] details,address spender,uint256 sigDeadline) permitBatch, bytes signature) returns (address)",
  "function wrappedTokenForUnderlying(address underlying) view returns (address)",
  "event BatchPermitMigrationExecuted(address indexed owner, address indexed confidentialAccount, uint256 indexed salt, uint256 assetCount)",
  "event MigrationExecuted(address indexed owner, address indexed token, address indexed confidentialToken, uint256 amount)",
]);

const permit2Abi = parseAbi([
  "function allowance(address owner, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)",
]);

const wrappedTokenAbi = parseAbi([
  "function confidentialTransferAndCall(address to, (uint256,uint8,uint8,bytes) encryptedAmount, bytes data) external",
  "function confidentialBalanceOf(address account) view returns (bytes32)",
]);

const smartAccountAbi = parseAbi([
  "function execute(address target, uint256 value, bytes data) returns (bytes result)",
  "event Executed(address indexed target, uint256 value, bytes data)",
]);

const chain = getChainById(arbitrumSepolia.id);
if (!chain) {
  throw new Error(`No CoFHE chain config found for ${arbitrumSepolia.id}`);
}

const prettyLogs = (receipt, abis) => {
  for (const log of receipt.logs) {
    let decoded = null;
    for (const abi of abis) {
      try {
        decoded = decodeEventLog({ abi, data: log.data, topics: log.topics });
        break;
      } catch {}
    }
    if (decoded) {
      console.log("event", decoded.eventName, decoded.args);
    } else {
      console.log("log", { address: log.address, topics: log.topics, data: log.data });
    }
  }
};

const getManifestAsset = symbol => {
  const asset = manifest.migrator.assets[symbol];
  if (!asset) {
    throw new Error(`Unknown asset ${symbol}`);
  }
  return asset;
};

const feeOverrides = async () => {
  const fees = await publicClient.estimateFeesPerGas();
  const maxPriorityFeePerGas = fees.maxPriorityFeePerGas ?? 1000000n;
  const baseMaxFee = fees.maxFeePerGas ?? (fees.gasPrice ? fees.gasPrice * 2n : 20000000n);
  return {
    maxPriorityFeePerGas,
    maxFeePerGas: (baseMaxFee * 12n) / 10n,
  };
};

const getSalt = flags => BigInt(flags.salt ?? Date.now());
const getAmount = (flags, decimals) => {
  const raw = flags.amount;
  if (!raw) throw new Error("--amount is required");
  const [whole, frac = ""] = String(raw).split(".");
  const normalizedFrac = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(`${whole}${normalizedFrac}`);
};

const printState = async flags => {
  const salt = getSalt(flags);
  const usdc = getManifestAsset("USDC");
  const ownerEth = await publicClient.getBalance({ address: account.address });
  const ownerUsdc = await publicClient.readContract({
    address: usdc.underlying,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });
  const erc20Allowance = await publicClient.readContract({
    address: usdc.underlying,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, manifest.migrator.permit2],
  });
  const permit2Allowance = await publicClient.readContract({
    address: manifest.migrator.permit2,
    abi: permit2Abi,
    functionName: "allowance",
    args: [account.address, usdc.underlying, manifest.migrator.batchMigrator],
  });
  const predicted = await publicClient.readContract({
    address: manifest.migrator.account4337Factory,
    abi: accountFactoryAbi,
    functionName: "predictAccountAddress",
    args: [account.address, salt],
  });
  const code = await publicClient.getBytecode({ address: predicted });
  console.log({
    owner: account.address,
    salt: salt.toString(),
    ownerEth: formatEther(ownerEth),
    ownerUsdc: formatUnits(ownerUsdc, usdc.decimals),
    erc20AllowanceToPermit2: formatUnits(erc20Allowance, usdc.decimals),
    permit2AllowanceToBatchMigrator: {
      amount: formatUnits(permit2Allowance[0], usdc.decimals),
      expiration: permit2Allowance[1],
      nonce: permit2Allowance[2],
    },
    predictedAccount: predicted,
    predictedAccountHasCode: Boolean(code && code !== "0x"),
  });
};

const createAccount = async flags => {
  const salt = getSalt(flags);
  const predicted = await publicClient.readContract({
    address: manifest.migrator.account4337Factory,
    abi: accountFactoryAbi,
    functionName: "predictAccountAddress",
    args: [account.address, salt],
  });
  console.log("predictedAccount", predicted);
  const txHash = await walletClient.writeContract({
    address: manifest.migrator.account4337Factory,
    abi: accountFactoryAbi,
    functionName: "createAccount",
    args: [account.address, salt],
    ...await feeOverrides(),
  });
  console.log("createAccountTx", txHash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log("status", receipt.status, "gasUsed", receipt.gasUsed.toString());
  prettyLogs(receipt, [accountFactoryAbi]);
};

const approvePermit2 = async flags => {
  const symbol = flags.asset ?? "USDC";
  const asset = getManifestAsset(symbol);
  const amount = flags.amount ? getAmount(flags, asset.decimals) : maxUint256;
  const txHash = await walletClient.writeContract({
    address: asset.underlying,
    abi: erc20Abi,
    functionName: "approve",
    args: [manifest.migrator.permit2, amount],
    ...await feeOverrides(),
  });
  console.log("approvePermit2Tx", txHash, "amount", amount.toString());
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log("status", receipt.status, "gasUsed", receipt.gasUsed.toString());
};

const migrate = async flags => {
  const symbol = flags.asset ?? "USDC";
  const asset = getManifestAsset(symbol);
  const salt = getSalt(flags);
  const amount = getAmount(flags, asset.decimals);

  const predicted = await publicClient.readContract({
    address: manifest.migrator.batchMigrator,
    abi: batchMigratorAbi,
    functionName: "predictAccountAddress",
    args: [account.address, salt],
  });
  console.log("predictedAccount", predicted);

  const permit2State = await publicClient.readContract({
    address: manifest.migrator.permit2,
    abi: permit2Abi,
    functionName: "allowance",
    args: [account.address, asset.underlying, manifest.migrator.batchMigrator],
  });
  console.log("permit2StateBefore", permit2State);

  const now = Math.floor(Date.now() / 1000);
  const permitBatch = {
    details: [
      {
        token: asset.underlying,
        amount,
        expiration: now + 30 * 24 * 60 * 60,
        nonce: Number(permit2State[2]),
      },
    ],
    spender: manifest.migrator.batchMigrator,
    sigDeadline: BigInt(now + 15 * 60),
  };

  const signature = await walletClient.signTypedData({
    account,
    domain: {
      name: "Permit2",
      chainId: arbitrumSepolia.id,
      verifyingContract: manifest.migrator.permit2,
    },
    types: permit2BatchTypes,
    primaryType: "PermitBatch",
    message: permitBatch,
  });

  console.log("permitSignature", signature);

  try {
    const result = await publicClient.simulateContract({
      account,
      address: manifest.migrator.batchMigrator,
      abi: batchMigratorAbi,
      functionName: "createAccountAndMigrateBatchWithPermit2",
      args: [account.address, salt, permitBatch, signature],
    });
    console.log("simulate.ok", result.result);
  } catch (error) {
    console.error("simulate.failed", error.shortMessage ?? error.message ?? error);
    if (error.cause) {
      console.error("simulate.cause", error.cause.shortMessage ?? error.cause.message ?? error.cause);
    }
    throw error;
  }

  const txHash = await walletClient.writeContract({
    address: manifest.migrator.batchMigrator,
    abi: batchMigratorAbi,
    functionName: "createAccountAndMigrateBatchWithPermit2",
    args: [account.address, salt, permitBatch, signature],
    ...await feeOverrides(),
  });
  console.log("batchMigrateTx", txHash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log("status", receipt.status, "gasUsed", receipt.gasUsed.toString());
  prettyLogs(receipt, [batchMigratorAbi, accountFactoryAbi]);

  const ownerUsdc = await publicClient.readContract({
    address: asset.underlying,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });
  console.log("ownerUsdcAfter", formatUnits(ownerUsdc, asset.decimals));
};

const depositToVault = async flags => {
  const amount = getAmount(flags, 6);
  const smartAccountAddress = flags.account;
  if (!smartAccountAddress) throw new Error("--account is required");

  const usdc = getManifestAsset("USDC");
  const config = createCofheConfig({
    environment: "node",
    supportedChains: [chain],
  });
  const cofheClient = createCofheClient(config);
  await cofheClient.connect(publicClient, walletClient);

  const [encryptedDeposit] = await cofheClient
    .encryptInputs([Encryptable.uint64(amount)])
    .setAccount(smartAccountAddress)
    .setChainId(arbitrumSepolia.id)
    .execute();

  const depositData = encodeFunctionData({
    abi: wrappedTokenAbi,
    functionName: "confidentialTransferAndCall",
    args: [
      usdc.vault,
      [
        encryptedDeposit.ctHash,
        encryptedDeposit.securityZone,
        encryptedDeposit.utype,
        encryptedDeposit.signature,
      ],
      encodeAbiParameters([{ type: "address" }], [smartAccountAddress]),
    ],
  });

  try {
    await publicClient.simulateContract({
      account,
      address: smartAccountAddress,
      abi: smartAccountAbi,
      functionName: "execute",
      args: [usdc.wrapped, 0n, depositData],
    });
    console.log("simulate.ok");
  } catch (error) {
    console.error("simulate.failed", error.shortMessage ?? error.message ?? error);
    if (error.cause) {
      console.error("simulate.cause", error.cause.shortMessage ?? error.cause.message ?? error.cause);
    }
    throw error;
  }

  const txHash = await walletClient.writeContract({
    address: smartAccountAddress,
    abi: smartAccountAbi,
    functionName: "execute",
    args: [usdc.wrapped, 0n, depositData],
    ...await feeOverrides(),
  });
  console.log("depositTx", txHash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log("status", receipt.status, "gasUsed", receipt.gasUsed.toString());
  prettyLogs(receipt, [smartAccountAbi]);
};

const main = async () => {
  const { command, flags } = parseArgs(process.argv);
  switch (command) {
    case "state":
      await printState(flags);
      break;
    case "create-account":
      await createAccount(flags);
      break;
    case "approve-permit2":
      await approvePermit2(flags);
      break;
    case "migrate":
      await migrate(flags);
      break;
    case "deposit":
      await depositToVault(flags);
      break;
    default:
      throw new Error("Usage: node scripts/manual-flow.mjs <state|create-account|approve-permit2|migrate|deposit> [--salt N] [--amount 10] [--asset USDC] [--account 0x...]");
  }
};

main().catch(error => {
  console.error("manual-flow.error", error);
  process.exitCode = 1;
});
