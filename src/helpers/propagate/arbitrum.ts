import { BigNumber, constants, utils } from 'ethers';
import { L1ToL2MessageGasEstimator } from '@arbitrum/sdk/dist/lib/message/L1ToL2MessageGasEstimator';
import { getBaseFee } from '@arbitrum/sdk/dist/lib/utils/lib';

import { ExtraPropagateParam } from 'src/propagate-job';
import { getArbitrumOneSdk, getMainnetSdk } from '@dethcrypto/eth-sdk-client';
import { InitialSetup } from 'src/utils/types';

// example at https://github.com/OffchainLabs/arbitrum-tutorials/blob/master/packages/greeter/scripts/exec.js
export const getPropagateParams = async ({ txSigner, arbProvider, provider }: InitialSetup): Promise<ExtraPropagateParam> => {
  let submissionPriceWei;
  let maxGas;
  let gasPriceBid;
  let callValue;

  const mainnetSdk = getMainnetSdk(txSigner);

  const arbSdk = getArbitrumOneSdk(arbProvider);
  const l1ToL2MessageGasEstimate = new L1ToL2MessageGasEstimator(arbProvider);

  try {
    // example encoded payload: 0x4ff746f6000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000207465737400000000000000000000000000000000000000000000000000000000
    // length = 200 not including 0x = 100 bytes
    // TODO: verify this is the correct payload to use

    gasPriceBid = await provider.getGasPrice();

    const baseFee = await getBaseFee(provider);
    const callData = arbSdk.spokeConnector.interface.encodeFunctionData('processMessage', [
      '0x0000000000000000000000000000000000000000000000000000000000000001',
    ]);
    const L1ToL2MessageGasParams = await l1ToL2MessageGasEstimate.estimateAll(
      mainnetSdk.arbitrumHubConnector.address,
      arbSdk.spokeConnector.address,
      callData,
      constants.Zero,
      baseFee,
      arbSdk.spokeConnector.address,
      arbSdk.spokeConnector.address,
      provider
    );
    const gasLimitForAutoRedeem = L1ToL2MessageGasParams.gasLimit.mul(5);

    submissionPriceWei = L1ToL2MessageGasParams.maxSubmissionFee.mul(5).toString();
    // multiply gasLimit by 15 to be successful in auto-redeem
    maxGas = gasLimitForAutoRedeem.toString();
    callValue = BigNumber.from(submissionPriceWei).add(gasPriceBid.mul(maxGas)).toString();
  } catch (err: unknown) {
    console.log(err);
    submissionPriceWei = '0';
    maxGas = '0';
    gasPriceBid = '0';
    callValue = '0';
  }

  const encodedData = utils.defaultAbiCoder.encode(['uint256', 'uint256', 'uint256'], [submissionPriceWei, maxGas, gasPriceBid]);

  return { _connector: '', _fee: callValue, _encodedData: encodedData };
};
