import { BigNumber, Contract, utils } from 'ethers';
import { Provider } from 'zksync-web3';

import { ExtraPropagateParam, InitialSetup } from 'src/utils/types';

const ZKSYNC_ABI = [
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_gasPrice',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_l2GasLimit',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_l2GasPerPubdataByteLimit',
        type: 'uint256',
      },
    ],
    name: 'l2TransactionBaseCost',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

export const getPropagateParams = async ({ provider }: InitialSetup): Promise<ExtraPropagateParam> => {
  const gasPrice = await provider.getGasPrice();
  const gasLimit = BigNumber.from(10000000);
  const gasPerPubdataByte = BigNumber.from(800);

  const l2Provider = new Provider('https://testnet.era.zksync.dev');
  const zk = await l2Provider.getMainContractAddress();
  console.log('zk: ', zk);
  const zkSyncContract = new Contract(zk, ZKSYNC_ABI, provider);
  const txCostPrice = await zkSyncContract.l2TransactionBaseCost(gasPrice, gasLimit, gasPerPubdataByte);

  const encodedData = utils.defaultAbiCoder.encode(['uint256'], [gasLimit]);

  return { _connector: '', _fee: txCostPrice.toString(), _encodedData: encodedData };
};
