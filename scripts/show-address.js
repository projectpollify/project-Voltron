// What is my wallet's address, and does it have anything in it?
//
//   npm run wallet
//
// Lace is a viewer, not the wallet. The wallet is the 24 words. This
// derives the address from those words directly, so the answer never
// depends on finding the right screen in someone's UI.
//
// Nothing here leaves the machine except a balance lookup, and the
// mnemonic is never printed, logged, or sent anywhere.

import { anchorEnv } from "../src/anchorCardano.js";

const env = anchorEnv(); // throws loudly on mainnet or a missing mnemonic

const { MeshWallet, BlockfrostProvider } = await import("@meshsdk/core");
const provider = new BlockfrostProvider(env.projectId);
const wallet = new MeshWallet({
  networkId: 0, // testnet, always
  fetcher: provider,
  submitter: provider,
  key: { type: "mnemonic", words: env.mnemonic.trim().split(/\s+/) },
});
await wallet.init();

const address = (await wallet.getUsedAddresses())[0] ?? (await wallet.getChangeAddress());

console.log("\n  network :", env.network);
console.log("  address :", address);

// A mainnet address here would mean the words were derived wrong, which
// is worth catching before anyone sends anything anywhere.
if (!address.startsWith("addr_test1")) {
  console.error("\n  ✗ That is not a testnet address. Refusing to continue.\n");
  process.exit(1);
}

// ★ Ask Blockfrost directly rather than trusting a library that returns
// an empty balance on an auth failure. A bad key reporting "0 ADA" is
// the same defect as an outage reporting "not anchored": a failure
// wearing the costume of a real answer.
const res = await fetch(`https://cardano-${env.network}.blockfrost.io/api/v0/addresses/${address}`, {
  headers: { project_id: env.projectId },
  cache: "no-store",
});

if (res.status === 403 || res.status === 401) {
  console.error("\n  ✗ Blockfrost rejected the project id (" + res.status + ").");
  console.error("    Check BLOCKFROST_PROJECT_ID in .env, and that it is a PREPROD key.\n");
  process.exit(1);
}

let lovelace = 0n;
if (res.status === 404) {
  // Genuinely unused: Cardano has no record of this address yet. That
  // is a real answer, and distinct from "we could not ask".
  lovelace = 0n;
} else if (!res.ok) {
  console.error("\n  ✗ Could not reach Blockfrost (" + res.status + "). Not the same as an empty wallet.\n");
  process.exit(1);
} else {
  const info = await res.json();
  lovelace = BigInt(info.amount?.find((a) => a.unit === "lovelace")?.quantity ?? "0");
}

const ada = Number(lovelace) / 1_000_000;
console.log("  balance :", ada, "test ADA");

if (lovelace === 0n) {
  console.log("\n  Empty. Fund it here, choosing Preprod:");
  console.log("  https://docs.cardano.org/cardano-testnets/tools/faucet");
  console.log("\n  Paste the address above. It arrives in a minute or two.\n");
} else if (ada < 5) {
  console.log("\n  ⚠ Low. An anchor costs roughly 1.2 test ADA (1 self-sent plus fee),");
  console.log("  and Phase 1 does two of them. Top up if this looks thin.\n");
} else {
  console.log("\n  ✓ Funded. You can run: npm run anchor:genesis\n");
}
