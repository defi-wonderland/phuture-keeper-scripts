import type { providers, Wallet } from 'ethers';

export type InitialSetup = {
  provider: providers.WebSocketProvider;
  txSigner: Wallet;
  bundleSigner: Wallet;
};
