"use client";

import type { PublicClient } from "viem";

export const buildWriteFeeOverrides = async (publicClient?: PublicClient) => {
  if (!publicClient) {
    return {};
  }

  try {
    const fees = await publicClient.estimateFeesPerGas();
    if (fees.maxFeePerGas && fees.maxPriorityFeePerGas) {
      return {
        maxFeePerGas: (fees.maxFeePerGas * 12n) / 10n + 1n,
        maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
      };
    }
  } catch {
    // Fall back to wallet/provider defaults when fee estimation is unavailable.
  }

  return {};
};
