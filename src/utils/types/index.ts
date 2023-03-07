import type { providers, Wallet } from 'ethers';

export type InitialSetup = {
  provider: providers.WebSocketProvider;
  arbProvider: providers.JsonRpcProvider;
  txSigner: Wallet;
  bundleSigner: Wallet;
};
