import { getMainnetSdk, getGoerliSdk, MainnetSdk } from '@dethcrypto/eth-sdk-client';
import { providers, Wallet } from 'ethers';
import { FlashbotsBundleProvider } from '@flashbots/ethers-provider-bundle';
import { FlashbotsBroadcastor, getEnvVariable, MempoolBroadcastor } from '@keep3r-network/keeper-scripting-utils';
import { runPropagate } from './shared/run-propagate';
import { InitialSetup } from './utils/types';

// SETUP
const WORK_FUNCTION = 'propagateKeep3r';
const GAS_LIMIT = 10_000_000;
const PRIORITY_FEE = 2e9;

(async () => {
  // ENVIRONMENT
  const flashbotsProviderUrl = getEnvVariable('FLASHBOTS_PROVIDER_URL');
  const provider = new providers.JsonRpcProvider(getEnvVariable('RPC_HTTPS_URI'));
  const arbProvider = new providers.JsonRpcProvider(getEnvVariable('ARBITRUM_RPC_URI'));
  const txSigner = new Wallet(getEnvVariable('TX_SIGNER_PRIVATE_KEY'), provider);
  const bundleSigner = new Wallet(getEnvVariable('BUNDLE_SIGNER_PRIVATE_KEY'), provider);

  const setup: InitialSetup = {
    provider,
    arbProvider,
    txSigner,
    bundleSigner,
    environment: getEnvVariable('ENVIRONMENT') as 'staging' | 'testnet' | 'mainnet',
  };

  // CONTRACTS
  let proxyHub;
  if (setup.environment === 'mainnet') {
    proxyHub = getMainnetSdk(txSigner).relayerProxyHub;
  } else if (setup.environment === 'testnet') {
    proxyHub = getGoerliSdk(txSigner).relayerProxyHub;
  } else if (setup.environment === 'staging') {
    proxyHub = getGoerliSdk(txSigner).relayerProxyHubStaging;
  } else {
    throw new Error('Invalid environment');
  }

  console.log('proxyHub: ', proxyHub.address);

  // PROVIDERS
  // flashbots:
  // const flashbotsProvider = await FlashbotsBundleProvider.create(provider, bundleSigner, flashbotsProviderUrl);
  // const flashbotBroadcastor = new FlashbotsBroadcastor(flashbotsProvider, PRIORITY_FEE, GAS_LIMIT);
  // mempool:
  const mempoolBroadcastor = new MempoolBroadcastor(provider, PRIORITY_FEE, GAS_LIMIT);

  // INITIALIZE
  // flashbots:
  // await runPropagate(proxyHub, setup, WORK_FUNCTION, flashbotBroadcastor.tryToWorkOnFlashbots.bind(flashbotBroadcastor));
  // mempool:
  await runPropagate(
    proxyHub as MainnetSdk['relayerProxyHub'],
    setup,
    WORK_FUNCTION,
    mempoolBroadcastor.tryToWorkOnMempool.bind(mempoolBroadcastor)
  );
})();
