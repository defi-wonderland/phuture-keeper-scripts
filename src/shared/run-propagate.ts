import { Contract, BigNumber } from 'ethers';
import type { Block } from '@ethersproject/abstract-provider';
import type { BroadcastorProps } from '@keep3r-network/keeper-scripting-utils';
import { BlockListener } from '@keep3r-network/keeper-scripting-utils';
import { getChainData, RootManagerMeta } from '@connext/nxtp-utils';
import { SubgraphReader } from '@connext/nxtp-adapters-subgraph';

import { populateParamsForDomains } from '../utils/propagate';
import { InitialSetup } from '../utils/types';

export async function runPropagate(
  jobContract: Contract,
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
    const { connectors, encodedData, fees } = await populateParamsForDomains(domains, rootManagerMeta, setup);

    // encode data for relayer proxy hub

    try {
      await broadcastMethod({ jobContract, workMethod, workArguments: [connectors, fees, encodedData], block });
    } catch (error: unknown) {
      if (error instanceof Error) console.log(`Propagate failed with:`, error.message);
    }
  });
}
