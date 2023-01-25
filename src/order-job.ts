import { getMainnetSdk } from '@dethcrypto/eth-sdk-client';
import type { TransactionRequest } from '@ethersproject/abstract-provider';
import type { Contract } from 'ethers';
import isEqual from 'lodash.isequal';
import {
  createBundlesWithSameTxs,
  getMainnetGasType2Parameters,
  sendAndRetryUntilNotWorkable,
  populateTransactions,
  Flashbots,
  BlockListener,
} from '@keep3r-network/keeper-scripting-utils';
import { request } from 'undici';
import dotenv from 'dotenv';
import { loadInitialSetup } from './shared/setup';
import type { Order } from './utils/types';
import { BURST_SIZE, CHAIN_ID, FLASHBOTS_RPC, FUTURE_BLOCKS, ORDER_API_URL, PRIORITY_FEE } from './utils/contants';

dotenv.config();

/* ==============================================================/*
		                      SETUP
/*============================================================== */

// pull environment variables
const { provider, txSigner, bundleSigner } = loadInitialSetup();

const blockListener = new BlockListener(provider);
const job = getMainnetSdk(txSigner).orderJob;

/* ==============================================================/*
		                   MAIN SCRIPT
/*============================================================== */

export async function run(): Promise<void> {
  const flashbots = await Flashbots.init(txSigner, bundleSigner, provider, [FLASHBOTS_RPC], true, CHAIN_ID);

  // Flag to track if there's a transaction in progress. If this is true, then we won't execute the main logic
  let txInProgress: boolean;

  // Create a subscription and start listening to upcoming blocks
  blockListener.stream(async (block) => {
    // If the job is workable, and a new block comes, check if there's already a transaction in progress. Return if there is one.
    // We do this to avoid sending multiple transactions that try to work the same job.
    if (txInProgress) {
      console.debug(`Tx in progress (from block ${block.number}). Returning...`);
      return;
    }

    // Check if the job is paused
    const paused = await job.paused();

    // If it's paused, then return
    if (paused) {
      console.info('Job is paused. Returning...');
      return;
    }

    // Call the API to see if there's an order that needs to be executed
    const { statusCode, body } = await request(ORDER_API_URL);

    // Emit the logs according to the status code the API gave us. If the status code is not 200, return.
    switch (statusCode) {
      case 200:
        console.debug(`Got 200 OK from Validator.`);
        break;
      case 404:
        console.debug(`Error 404: There are no orders currently. Retrying in next block.`);
        return;
      default:
        console.debug(`Expected to get 200 OK from Validator but instead got ${statusCode}.`);
        return;
    }

    // If we get 200 as the status code, we parse the body of the response
    const { data } = await body.json();
    const { type, signs, external } = data[0] as Order;

    // Define variables whose values will depend on whether we need to send a external or internal order
    const functionToCall = 'externalSwap';

    // If we arrived here, it means we will be sending a transaction, so we optimistically set this to true.
    txInProgress = true;

    /*
      We are going to send this through Flashbots, which means we will be sending multiple bundles to different
      blocks inside a batch. Here we are calculating which will be the last block we will be sending the
      last bundle of our first batch to. This information is needed to calculate what will the maximum possible base
      fee be in that block, so we can calculate the maxFeePerGas parameter for all our transactions.
      For example: we are in block 100 and we send to 100, 101, 102. We would like to know what is the maximum possible
      base fee at block 102 to make sure we don't populate our transactions with a very low maxFeePerGas, as this would
      cause our transaction to not be mined until the max base fee lowers.
    */
    const blocksAhead = FUTURE_BLOCKS + BURST_SIZE;

    try {
      // Get the signer's (keeper) current nonce.
      const currentNonce = await provider.getTransactionCount(txSigner.address);

      // Fetch the priorityFeeInGwei and maxFeePerGas parameters from the getMainnetGasType2Parameters function
      // NOTE: this just returns our priorityFee in GWEI, it doesn't calculate it, so if we pass a priority fee of 10 wei
      //       this will return a priority fee of 10 GWEI. We need to pass it so that it properly calculated the maxFeePerGas
      const { priorityFeeInGwei, maxFeePerGas } = getMainnetGasType2Parameters({
        block,
        blocksAhead,
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

      // We populate the transactions we will use in our bundles
      const txs: TransactionRequest[] = await populateTransactions({
        chainId: CHAIN_ID,
        contract: job as Contract,
        functionArgs: [[signs, external]],
        functionName: functionToCall,
        options,
      });

      // We calculate the first block that the first bundle in our batch will target.
      // Example, if future blocks is 2, and we are in block 100, it will send a bundle to blocks 102, 103, 104 (assuming a burst size of 3)
      // and 102 would be the firstBlockOfBatch
      const firstBlockOfBatch = block.number + FUTURE_BLOCKS;

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
          // This job does not have a workable check. But we can check that the order we should call has not been called
          // by doing a call to their API. If the status is not 200, it means that the order is not available anymore.
          // If the status is 200, but a different order from the one we populated the first time we fetched the API is
          // returned, then we need to return and recompute our transaction to work that new order.
          const { statusCode, body } = await request(ORDER_API_URL);
          if (statusCode !== 200) return false;
          const { data } = await body.json();
          const { type, signs, ...order } = data[0] as Order;

          // If the returned type is either external or internal
          if (type === "external") {
            const parameter = (order as Order).external;
            // We verify that the work needed is still the same as the one requested initially
            if (isEqual({...parameter, swapData: null }, {...external, swapData: null})) return true;
            // In case not, restart the script
            console.log('The order differs from the one in our transaction. Restarting the script.');
            return false;
          }

          console.error(`Unexpected order type received. Restarting the script.`);
          return false;
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

(async () => {
  await run();
})();
