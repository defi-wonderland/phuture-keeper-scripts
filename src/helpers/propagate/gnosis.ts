import { getMainnetSdk } from '@dethcrypto/eth-sdk-client';
import { Contract, utils } from 'ethers';

import { ExtraPropagateParam, InitialSetup } from 'src/utils/types';

export const getPropagateParams = async ({ txSigner, provider }: InitialSetup): Promise<ExtraPropagateParam> => {
  const mainnetSdk = getMainnetSdk(txSigner);
  const ambAddress = await mainnetSdk.gnosisHubConnector.AMB();
  const ambContract = new Contract(ambAddress, ['function maxGasPerTx() external view returns (uint256)'], provider);
  const maxGasPerTx = await ambContract.maxGasPerTx();
  const encodedData = utils.defaultAbiCoder.encode(['uint256'], [maxGasPerTx as string]);

  return { _connector: '', _fee: '0', _encodedData: encodedData };
};
