export const appConfig = {
  backendUrl: process.env.NEXT_PUBLIC_TEZCATLI_BACKEND_URL ?? "http://localhost:3001",
  complianceUrl: process.env.NEXT_PUBLIC_TEZCATLI_COMPLIANCE_URL ?? "http://localhost:4100",
  rpcUrl:
    process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL ??
    "https://sepolia-rollup.arbitrum.io/rpc",
};
