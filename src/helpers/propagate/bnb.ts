import { Contract } from 'ethers';
import { getMainnetSdk } from '@dethcrypto/eth-sdk-client';

import { InitialSetup } from 'src/utils/types';
import { ExtraPropagateParam } from 'src/propagate-job';

export const getPropagateParams = async ({ txSigner, provider }: InitialSetup): Promise<ExtraPropagateParam> => {
  const mainnetSdk = getMainnetSdk(txSigner);
  const ambAddress = await mainnetSdk.bnbHubConnector.AMB();

  const ambContract = new Contract(
    ambAddress,
    ['function calcSrcFees(string calldata _appID, uint256 _toChainID, uint256 _dataLength) external view returns (uint256)'],
    provider
  );
  const fee = await ambContract.calcSrcFees('', 56, 32);

  return { _connector: '', _fee: fee, _encodedData: '0x' };
};
