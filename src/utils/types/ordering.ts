import type { BigNumberish, BytesLike } from 'ethers';

type Address = string;

export enum OrderType {
  External = 'external',
  Internal = 'internal',
}

export type Sign = {
  v: number;
  r: string;
  s: string;
  signer: string;
  deadline: string;
};

export type BaseOrder<T extends OrderType> = {
  type: T;
  signs: Sign[];
};

export type InternalOrder = {
  internal: {
    sellAccount: Address;
    buyAccount: Address;
    sellAsset: Address;
    buyAsset: Address;
    maxSellShares: BigNumberish;
  };
} & BaseOrder<OrderType.Internal>;

export type ExternalOrder = {
  external: {
    account: Address;
    sellAsset: Address;
    buyAsset: Address;
    sellShares: BigNumberish;
    swapTarget: Address;
    swapData: BytesLike;
  };
} & BaseOrder<OrderType.External>;

export type Order = InternalOrder | ExternalOrder;
