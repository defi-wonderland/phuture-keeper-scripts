import { defineConfig } from '@dethcrypto/eth-sdk';

export default defineConfig({
  contracts: {
    mainnet: {
      orderJob: '0x133A4273589c2eE5F9Fe28898B68aC1B4B1BA9B0',
      depositManagerJob: '0xa61d82a9127B1c1a34Ce03879A068Af5b786C835',
    },
  },
});
