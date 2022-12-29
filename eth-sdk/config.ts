import { defineConfig } from '@dethcrypto/eth-sdk';

export default defineConfig({
  contracts: {
    mainnet: {
      orderJob: '0x656027367B5e27dC21984B546e64dC24dBFaA187',
      //
      depositManagerJob: '0xa61d82a9127B1c1a34Ce03879A068Af5b786C835',
      //
      harvestingJob: '0xEC771dc7Bd0aA67a10b1aF124B9b9a0DC4aF5F9B',
      usdcSavingsVault: '0x6bAD6A9BcFdA3fd60Da6834aCe5F93B8cFed9598',
    },
  },
});
