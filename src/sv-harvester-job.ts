import {getMainnetSdk} from '@dethcrypto/eth-sdk-client';
import type {TransactionRequest} from '@ethersproject/abstract-provider';
import {
  BlockListener,
  createBundlesWithSameTxs,
  Flashbots,
  getMainnetGasType2Parameters,
  populateTransactions,
  sendAndRetryUntilNotWorkable,
} from '@keep3r-network/keeper-scripting-utils';
import dotenv from 'dotenv';
import type {Contract} from 'ethers';
import {loadInitialSetup} from './shared/setup';
import {BURST_SIZE, CHAIN_ID, FLASHBOTS_RPC, FUTURE_BLOCKS, PRIORITY_FEE, USV_ADDRESS} from './utils/contants';

dotenv.config();

/* ==============================================================/*
		                      SETUP
/*============================================================== */

// pull environment variables
const {provider, txSigner, bundleSigner} = loadInitialSetup();

const blockListener = new BlockListener(provider);
const job = getMainnetSdk(txSigner).harvestingJob;

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

    // Check if job is paused
    const paused = await job.paused();

    // If it's paused, then return
    if (paused) {
      console.info('Job is paused. Returning...');
      return;
    }

    console.log('Job is not paused.');

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
      const {priorityFeeInGwei, maxFeePerGas} = getMainnetGasType2Parameters({
        block,
        blocksAhead,
        priorityFeeInWei: PRIORITY_FEE,
      });

      // We declare what options we would like our transaction to have
      const options = {
        gasLimit: 5_000_000,
        nonce: currentNonce,
        maxFeePerGas,
        maxPriorityFeePerGas: priorityFeeInGwei,
        type: 2,
      };

      // We populate the transactions we will use in our bundles
      let txs: TransactionRequest[];

      // Check if account settlement is required
      const isAccountSettlementRequired = await job.isAccountSettlementRequired(USV_ADDRESS);

      // If it is, then we will send a transaction to the job to settle the account
      if (isAccountSettlementRequired) {
        console.info('Account settlement is required!');
        txs = await populateTransactions({
          chainId: CHAIN_ID,
          contract: job as Contract,
          functionArgs: [[USV_ADDRESS]],
          functionName: 'settleAccount',
          options,
        });
      } else {
        // If it's not, then we will send a transaction to the job to harvest
        txs = await populateTransactions({
          chainId: CHAIN_ID,
          contract: job as Contract,
          functionArgs: [[USV_ADDRESS]],
          functionName: 'harvest',
          options,
        });
      }

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
        isWorkableCheck: isAccountSettlementRequired
          ? async (): Promise<boolean> => {
              try {
                await job.callStatic.settleAccount(USV_ADDRESS);
              } catch {
                console.info('Account settlement is not required anymore or could not be done at this time.');
                return false;
              }

              return true;
            }
          : async (): Promise<boolean> => {
              try {
                await job.callStatic.harvest(USV_ADDRESS);
              } catch {
                console.info('Harvesting is not available or could not be done at this time.');
                return false;
              }

              return true;
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
