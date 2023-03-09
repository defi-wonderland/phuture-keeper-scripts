import { Contract, BigNumber } from 'ethers';
import type { Block } from '@ethersproject/abstract-provider';
import type { BroadcastorProps } from '@keep3r-network/keeper-scripting-utils';
import { BlockListener } from '@keep3r-network/keeper-scripting-utils';
import { getChainData, RootManagerMeta } from '@connext/nxtp-utils';
import { SubgraphReader } from '@connext/nxtp-adapters-subgraph';
import { populateParamsForDomains } from 'src/utils/propagate';
import { InitialSetup } from 'src/utils/types';

export async function runPropagate(
  jobContract: Contract,
  setup: InitialSetup,
  workMethod: string,
  broadcastMethod: (props: BroadcastorProps) => Promise<void>
) {
  // SETUP
  const blockListener = new BlockListener(setup.provider);
  const chainData = await getChainData();
  const subgraph = await SubgraphReader.create(chainData, 'production');
  const rootManagerMeta: RootManagerMeta = await subgraph.getRootManagerMeta('6648936');
  const domains = rootManagerMeta.domains;

  blockListener.stream(async (block: Block) => {
    const { connectors, encodedData, fees } = await populateParamsForDomains(domains, rootManagerMeta, setup);

    // encode data for relayer proxy hub
    const fee = BigNumber.from(0); // 0 fee since we arent paying for the tx synchronously

    try {
      await broadcastMethod({ jobContract, workMethod, workArguments: [connectors, encodedData, fees, fee], block });
    } catch (error: unknown) {
      if (error instanceof Error) console.log(`Propagate failed with:`, error.message);
    }
  });
}
