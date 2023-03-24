import type { providers, Wallet } from 'ethers';

export type InitialSetup = {
  provider: providers.WebSocketProvider;
  arbProvider: providers.JsonRpcProvider;
  txSigner: Wallet;
  bundleSigner: Wallet;
  environment: "staging" | "testnet" | "mainnet";
};

export type ExtraPropagateParam = {
  _connector: string;
  _fee: string;
  _encodedData: string;
};

export type ParamsForDomains = {
  connectors: string[];
  encodedData: string[];
  fees: string[];
};
