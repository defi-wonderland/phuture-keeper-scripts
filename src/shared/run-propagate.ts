import { Contract } from 'ethers';
import type { Block } from '@ethersproject/abstract-provider';
import type { BroadcastorProps } from '@keep3r-network/keeper-scripting-utils';
import { BlockListener } from '@keep3r-network/keeper-scripting-utils';
import { getChainData, RootManagerMeta } from '@connext/nxtp-utils';
import { SubgraphReader } from '@connext/nxtp-adapters-subgraph';

import { populateParamsForDomains } from '../utils/propagate';
import { InitialSetup } from '../utils/types';
import { MainnetSdk } from '@dethcrypto/eth-sdk-client';

export async function runPropagate(
  jobContract: MainnetSdk['relayerProxyHub'],
  setup: InitialSetup,
  workMethod: string,
  broadcastMethod: (props: BroadcastorProps) => Promise<void>
) {
  // SETUP
  const blockListener = new BlockListener(setup.provider);
  const chainData = await getChainData();
  let subgraph: SubgraphReader;
  if (setup.environment === 'staging') {
    subgraph = await SubgraphReader.create(chainData, 'staging');
  } else {
    subgraph = await SubgraphReader.create(chainData, 'production');
  }

  let rootManagerMeta: RootManagerMeta;
  if (setup.environment === 'mainnet') {
    rootManagerMeta = await subgraph.getRootManagerMeta('6648936');
  } else {
    rootManagerMeta = await subgraph.getRootManagerMeta('1735353714');
  }
  const domains = rootManagerMeta.domains;

  blockListener.stream(async (block: Block) => {
    const isWorkable = await jobContract.propagateWorkable();
    if (!isWorkable) {
      console.log(`Propagate not workable`);
      return;
    }
    
    // encode data for relayer proxy hub
    const { connectors, encodedData, fees } = await populateParamsForDomains(domains, rootManagerMeta, setup);

    try {
      // TODO: delete this
      console.debug({ jobContract: jobContract.address, workMethod, workArguments: [connectors, fees, encodedData], block: block.number });
      await broadcastMethod({ jobContract, workMethod, workArguments: [connectors, fees, encodedData], block });
    } catch (error: unknown) {
      if (error instanceof Error) console.log(`Propagate failed with:`, error.message);
    }
  });
}
