# Phuture Keeper Script

This repository enables keepers of the Keep3r Network to execute Phuture's jobs on Ethereum.

## How to run

1. Clone the repository

```
  git clone https://github.com/Phuture-Finance/keeper-scripts
```

2. Install dependencies

```
  yarn install
```

3. Create and complete the `.env` file using `env.example` as an example

4. Fine-tune the constants in `src/constants.ts` to your liking. Read [the docs](https://docs.keep3r.network/keeper-scripts) for a technical in-depth explanation.

5. Try out the scripts

```
  yarn start:order
  yarn start:deposit-manager
```

## Run in production

1. Build the typescript into javascript

```
  yarn build
```

2. Run the job directly from javascript (using [PM2](https://github.com/Unitech/pm2) is highly recommended)

```
  node dist/order-job.js
  node dist/deposit-manager-job.js
```

## Keeper Requirements

- Must be a valid (activated) Keeper on [Keep3r V2](https://etherscan.io/address/0xeb02addCfD8B773A5FFA6B9d1FE99c566f8c44CC)

## Useful Links

- [Order Job](https://etherscan.io/address/0x133A4273589c2eE5F9Fe28898B68aC1B4B1BA9B0)
- [Deposit Manager Job](https://etherscan.io/address/0xa61d82a9127B1c1a34Ce03879A068Af5b786C835)
