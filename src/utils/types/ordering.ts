import type { BigNumberish, BytesLike } from 'ethers';

type Address = string;

export type Sign = {
  v: number;
  r: string;
  s: string;
  signer: string;
  deadline: string;
};

export type Order = {
  type: 'external';
  signs: Sign[];
  external: {
    account: Address;
    sellAsset: Address;
    buyAsset: Address;
    sellShares: BigNumberish;
    swapTarget: Address;
    swapData: BytesLike;
  }
};
