import { utils } from 'ethers';
import { ExtraPropagateParam } from 'src/utils/types';

export const getPropagateParams = async (): Promise<ExtraPropagateParam> => {
  const _fee = utils.parseEther('0.01').toString();

  return { _connector: '', _fee, _encodedData: '0x' };
};
