import dotenv from 'dotenv';
import { providers, Wallet } from 'ethers';
import { getEnvVariable } from '../utils/misc';
import type { InitialSetup } from '../utils/types';

dotenv.config();

export function loadInitialSetup(): InitialSetup {
  const provider = new providers.JsonRpcProvider(getEnvVariable('RPC_HTTPS_URI'));
  const txSigner = new Wallet(getEnvVariable('TX_SIGNER_PRIVATE_KEY'), provider);
  const bundleSigner = new Wallet(getEnvVariable('BUNDLE_SIGNER_PRIVATE_KEY'), provider);
  return {
    provider,
    txSigner,
    bundleSigner,
  };
}
