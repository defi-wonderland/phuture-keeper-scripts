import { RootManagerMeta } from '@connext/nxtp-utils';
import { BigNumber, constants } from 'ethers';
import {
  getPropagateParamsArbitrum,
  getPropagateParamsBnb,
  getPropagateParamsConsensys,
  getPropagateParamsGnosis,
  getPropagateParamsZkSync,
} from '../helpers/propagate';
import { ExtraPropagateParam, InitialSetup, ParamsForDomains } from './types';

export const getParamsForDomainFn: Record<string, (setup: InitialSetup) => Promise<ExtraPropagateParam>> = {
  // mainnet
  '1634886255': getPropagateParamsArbitrum,
  '6450786': getPropagateParamsBnb,
  '6778479': getPropagateParamsGnosis,

  // testnet
  '1734439522': getPropagateParamsArbitrum,
  '2053862260': getPropagateParamsZkSync,
  '1668247156': getPropagateParamsConsensys,
};

export async function populateParamsForDomains(
  domains: string[],
  rootManagerMeta: RootManagerMeta,
  setup: InitialSetup
): Promise<ParamsForDomains> {
  const _connectors: string[] = [];
  const _encodedData: string[] = [];
  const _fees: string[] = [];
  let _totalFee = constants.Zero;

  for (const domain of domains) {
    const connector = rootManagerMeta.connectors[domains.indexOf(domain)];
    _connectors.push(connector);

    if (Object.keys(getParamsForDomainFn).includes(domain)) {
      const getParamsForDomain = getParamsForDomainFn[domain];
      const propagateParam = await getParamsForDomain(setup);
      _encodedData.push(propagateParam._encodedData);
      _fees.push(propagateParam._fee);
      _totalFee = _totalFee.add(BigNumber.from(propagateParam._fee));
    } else {
      _encodedData.push('0x');
      _fees.push('0');
    }
  }

  return {
    connectors: _connectors,
    encodedData: _encodedData,
    fees: _fees,
  };
}
