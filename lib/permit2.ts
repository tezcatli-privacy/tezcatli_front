import type { Address } from "viem";

export const CANONICAL_PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as Address;

export const permit2Abi = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
      { name: "nonce", type: "uint48" },
    ],
  },
] as const;

export const permit2BatchTypes = {
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
} as const;

export type Permit2Detail = {
  token: Address;
  amount: bigint;
  expiration: number;
  nonce: number;
};

export const buildPermit2BatchTypedData = ({
  chainId,
  permit2Address,
  details,
  spender,
  sigDeadline,
}: {
  chainId: number;
  permit2Address?: Address;
  details: Permit2Detail[];
  spender: Address;
  sigDeadline: bigint;
}) => ({
  domain: {
    name: "Permit2",
    chainId,
    verifyingContract: permit2Address ?? CANONICAL_PERMIT2_ADDRESS,
  },
  types: permit2BatchTypes,
  primaryType: "PermitBatch" as const,
  message: {
    details,
    spender,
    sigDeadline,
  },
});
