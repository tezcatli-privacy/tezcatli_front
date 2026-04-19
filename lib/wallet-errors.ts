"use client";

const extractMessage = (caught: unknown): string => {
  if (caught instanceof Error && caught.message) {
    return caught.message;
  }

  if (typeof caught === "string") {
    return caught;
  }

  if (caught && typeof caught === "object" && "message" in caught) {
    const candidate = (caught as { message?: unknown }).message;
    if (typeof candidate === "string") {
      return candidate;
    }
  }

  return "Unexpected wallet error.";
};

const extractCode = (caught: unknown): number | null => {
  if (caught && typeof caught === "object" && "code" in caught) {
    const code = (caught as { code?: unknown }).code;
    if (typeof code === "number") {
      return code;
    }
    if (typeof code === "string" && !Number.isNaN(Number(code))) {
      return Number(code);
    }
  }

  return null;
};

export const formatWalletError = (
  caught: unknown,
  fallback = "Wallet action failed.",
): string => {
  const message = extractMessage(caught);
  const normalized = message.toLowerCase();
  const code = extractCode(caught);

  if (
    code === 4001 ||
    normalized.includes("user rejected") ||
    normalized.includes("user denied transaction signature") ||
    normalized.includes("user denied message signature") ||
    normalized.includes("rejected the request")
  ) {
    return "You rejected the signature request in your wallet.";
  }

  if (
    normalized.includes("insufficient funds") ||
    normalized.includes("exceeds the balance")
  ) {
    return "This wallet does not have enough balance to complete the transaction.";
  }

  if (
    normalized.includes("chain mismatch") ||
    normalized.includes("switch to chain") ||
    normalized.includes("wrong network")
  ) {
    return "Switch your wallet to Arbitrum Sepolia and try again.";
  }

  if (normalized.includes("internal json-rpc error")) {
    return "The wallet provider returned an internal RPC error. Try again.";
  }

  if (normalized.includes("max fee per gas less than block base fee")) {
    return "Network fees moved before the transaction was submitted. Try again and the app will refresh the gas settings.";
  }

  if (normalized.includes("execution reverted")) {
    return "The transaction reverted onchain. Review the selected asset and amount, then try again.";
  }

  return message || fallback;
};
