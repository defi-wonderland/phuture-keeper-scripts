import { getMainnetSdk } from '@dethcrypto/eth-sdk-client';
import { providers, Wallet } from 'ethers';
import { FlashbotsBundleProvider } from '@flashbots/ethers-provider-bundle';
import { FlashbotsBroadcastor, getEnvVariable } from '@keep3r-network/keeper-scripting-utils';
import { runPropagate } from './shared/run-propagate';
import { InitialSetup } from './utils/types';

// SETUP
const WORK_FUNCTION = 'propagate';
const GAS_LIMIT = 10_000_000;
const PRIORITY_FEE = 2e9;

(async () => {
  // ENVIRONMENT
  const provider = new providers.WebSocketProvider(getEnvVariable('RPC_WSS_URI'));
  const arbProvider = new providers.JsonRpcProvider(getEnvVariable('ARBITRUM_RPC_URI'));
  const txSigner = new Wallet(getEnvVariable('TX_SIGNER_PRIVATE_KEY'), provider);
  const bundleSigner = new Wallet(getEnvVariable('BUNDLE_SIGNER_PRIVATE_KEY'), provider);

  const setup: InitialSetup = {
    provider,
    arbProvider,
    txSigner,
    bundleSigner,
  };

  // CONTRACTS
  const proxyHub = getMainnetSdk(txSigner).relayerProxyHub;

  // PROVIDERS
  const flashbotsProvider = await FlashbotsBundleProvider.create(provider, bundleSigner);
  const flashbotBroadcastor = new FlashbotsBroadcastor(flashbotsProvider, PRIORITY_FEE, GAS_LIMIT);

  // INITIALIZE
  await runPropagate(proxyHub, setup, WORK_FUNCTION, flashbotBroadcastor.tryToWorkOnFlashbots.bind(flashbotBroadcastor));
})();
