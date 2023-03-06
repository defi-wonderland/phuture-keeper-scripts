import { createLoggingContext, getChainData, NxtpError, RequestContext, RootManagerMeta } from '@connext/nxtp-utils';
import { BigNumber, constants, Contract } from 'ethers';
import type { TransactionRequest } from '@ethersproject/abstract-provider';
import { SubgraphReader } from '@connext/nxtp-adapters-subgraph';
import dotenv from 'dotenv';
import {
  BlockListener,
  createBundlesWithSameTxs,
  Flashbots,
  getMainnetGasType2Parameters,
  populateTransactions,
  sendAndRetryUntilNotWorkable,
  sendTx,
} from '@keep3r-network/keeper-scripting-utils';
import { getMainnetSdk } from '@dethcrypto/eth-sdk-client';

import {
  getPropagateParamsArbitrum,
  getPropagateParamsBnb,
  getPropagateParamsConsensys,
  getPropagateParamsGnosis,
  getPropagateParamsZkSync,
} from '../helpers';
import { loadInitialSetup } from './shared/setup';
import { BURST_SIZE, CHAIN_ID, FLASHBOTS_RPC } from './utils/contants';

dotenv.config();

// Priority fee to use
const PRIORITY_FEE = 2;

/* ==============================================================/*
		                      SETUP
/*============================================================== */

// pull environment variables
const { provider, txSigner, bundleSigner } = loadInitialSetup();

const blockListener = new BlockListener(provider);

const job = getMainnetSdk(txSigner).relayerProxyHub;

export type ExtraPropagateParam = {
  _connector: string;
  _fee: string;
  _encodedData: string;
};

export const getParamsForDomainFn: Record<
  string,
  (spokeDomain: string, spokeChainId: number, hubChainId: number) => Promise<ExtraPropagateParam>
> = {
  // mainnet
  '1634886255': getPropagateParamsArbitrum,
  '6450786': getPropagateParamsBnb,
  '6778479': getPropagateParamsGnosis,
  // testnet
  '1734439522': getPropagateParamsArbitrum,
  '1668247156': getPropagateParamsConsensys,
  '2053862260': getPropagateParamsZkSync,
};

/* ==============================================================/*
		                   MAIN SCRIPT
/*============================================================== */

export async function run(): Promise<void> {
  const flashbots = await Flashbots.init(txSigner, bundleSigner, provider, [FLASHBOTS_RPC], true, CHAIN_ID);
  // Flag to track if there's a transaction in progress. If this is true, then we won't execute the main logic
  let txInProgress: boolean;

  const chainData = await getChainData();
  const subgraph = await SubgraphReader.create(chainData, 'production');
  const rootManagerMeta: RootManagerMeta = await subgraph.getRootManagerMeta('6648936');
  const domains = rootManagerMeta.domains;

  // Create a subscription and start listening to upcoming blocks
  blockListener.stream(async (block) => {
    // If the job is workable, and a new block comes, check if there's already a transaction in progress. Return if there is one.
    // We do this to avoid sending multiple transactions that try to work the same job.
    if (txInProgress) {
      console.debug(`Tx in progress (from block ${block.number}). Returning...`);
      return;
    }

    try {
      // Get the signer's (keeper) current nonce.
      const currentNonce = await provider.getTransactionCount(txSigner.address);

      // Fetch the priorityFeeInGwei and maxFeePerGas parameters from the getMainnetGasType2Parameters function
      // NOTE: this just returns our priorityFee in GWEI, it doesn't calculate it, so if we pass a priority fee of 10 wei
      //       this will return a priority fee of 10 GWEI. We need to pass it so that it properly calculated the maxFeePerGas
      const { priorityFeeInGwei, maxFeePerGas } = getMainnetGasType2Parameters({
        block,
        blocksAhead: 0,
        priorityFeeInWei: PRIORITY_FEE,
      });

      // We declare what options we would like our transaction to have
      const options = {
        gasLimit: 10_000_000,
        nonce: currentNonce,
        maxFeePerGas,
        maxPriorityFeePerGas: priorityFeeInGwei,
        type: 2,
      };

      const _connectors: string[] = [];
      const _encodedData: string[] = [];
      const _fees: string[] = [];
      let _totalFee = constants.Zero;

      for (const domain of domains) {
        const connector = rootManagerMeta.connectors[domains.indexOf(domain)];
        _connectors.push(connector);

        if (Object.keys(getParamsForDomainFn).includes(domain)) {
          const getParamsForDomain = getParamsForDomainFn[domain];
          const propagateParam = await getParamsForDomain(domain, chainData.get(domain)!.chainId, CHAIN_ID);
          _encodedData.push(propagateParam._encodedData);
          _fees.push(propagateParam._fee);
          _totalFee = _totalFee.add(BigNumber.from(propagateParam._fee));
        } else {
          _encodedData.push('0x');
          _fees.push('0');
        }
      }

      // encode data for relayer proxy hub
      const fee = BigNumber.from(0);

      // We populate the transactions we will use
      const txs: TransactionRequest[] = await populateTransactions({
        chainId: CHAIN_ID,
        contract: job as Contract,
        functionArgs: [[_connectors, _fees, _encodedData, fee]],
        functionName: 'propagate',
        options,
      });

      const firstBlockOfBatch = block.number;

      // We create our batch of bundles. In this case we use createBundlesWithSameTxs, as all bundles use the same transaction
      const bundles = createBundlesWithSameTxs({
        unsignedTxs: txs,
        burstSize: BURST_SIZE,
        firstBlockOfBatch,
      });

      // We send our bundles to Flashbots and retry until the job is worked by us or another keeper.
      const result = await sendAndRetryUntilNotWorkable({
        txs,
        provider,
        priorityFeeInWei: PRIORITY_FEE,
        bundles,
        newBurstSize: BURST_SIZE,
        flashbots,
        signer: txSigner,
        async isWorkableCheck() {
          // Provide the function with a function to re-check whether the deposits can still be updated
          // after a batch of bundles fails to be included
          const canUpdate = await job.canUpdateDeposits();
          if (!canUpdate) console.log('Deposits are not updateable at this time. Restarting the script...');
          return canUpdate;
        },
      });

      if (result) console.log('=== Work transaction included successfully ===');
    } catch (error: unknown) {
      console.error(error);
    } finally {
      // If us or another keeper worked the job, that means we should wait and send a new transaction so we set txInProgress to false
      txInProgress = false;
    }
  });
}
