/**
 * Local stack runner and seeder for Panel (Archetype AD · Questionnaire).
 *
 * Spawns anvil on port 8725 with chain id 968, deploys Panel, and seeds 5 surveys:
 * - Survey 1: Open with 3 answers (Asker: Alice, Respondents: Bob, Charlie, Dave)
 * - Survey 2: Full (Asker: Bob, Respondents: Alice, Charlie)
 * - Survey 3: Closed with unspent budget (reclaimable) (Asker: Alice, Respondent: Bob)
 * - Survey 4: Reclaimed (Asker: Charlie, Respondent: Bob, reclaimed by Charlie)
 * - Survey 5: Brand new (Asker: Dave, 0 answers)
 *
 * Usage:
 *   node scripts/local-stack.mjs
 *   npm run dev
 */

import { spawn, execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const PORT = 8725;
const RPC = `http://127.0.0.1:${PORT}`;
const CHAIN_ID = 968;

const KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // 0: Alice (Asker 1 & 3)
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // 1: Bob (Asker 2, Respondent 1, 3, 4)
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // 2: Charlie (Asker 4, Respondent 1, 2)
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // 3: Dave (Asker 5, Respondent 1)
  "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a", // 4: Eve (Outsider)
];

const accounts = KEYS.map((k) => privateKeyToAccount(k));

const local = defineChain({
  id: CHAIN_ID,
  name: "anvil",
  nativeCurrency: { name: "Test BOT", symbol: "tBOT", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});

try {
  execSync(`fuser -k ${PORT}/tcp 2>/dev/null || true`);
} catch {}

console.log(`Starting anvil on port ${PORT}...`);
spawn(
  "anvil",
  [
    "--port",
    String(PORT),
    "--chain-id",
    String(CHAIN_ID),
    "--accounts",
    "10",
    "--block-time",
    "1",
    "--silent",
  ],
  {
    detached: true,
    stdio: "ignore",
  }
).unref();

const pub = createPublicClient({ chain: local, transport: http(), pollingInterval: 50 });

for (let i = 0; ; i++) {
  try {
    await pub.getBlockNumber();
    break;
  } catch {
    if (i > 100) throw new Error(`anvil never answered on ${RPC}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

const artifact = JSON.parse(
  readFileSync(new URL("../contracts/out/Panel.sol/Panel.json", import.meta.url), "utf8")
);

const wallets = accounts.map((account) =>
  createWalletClient({ account, chain: local, transport: http() })
);

console.log("Deploying Panel contract...");
const deployHash = await wallets[0].deployContract({
  abi: artifact.abi,
  bytecode: artifact.bytecode.object,
});

const deployReceipt = await pub.waitForTransactionReceipt({ hash: deployHash });
const contractAddress = deployReceipt.contractAddress;
const startBlock = deployReceipt.blockNumber;

console.log(`Deployed Panel to ${contractAddress} at block ${startBlock}`);

// -------------------------------------------------------------
// Seed Survey 1: Open with 3 answers (Alice asks, 6 spots, 3 answered)
// -------------------------------------------------------------
console.log("Seeding Survey 1 (Open with 3 answers)...");
const s1Hash = await wallets[0].writeContract({
  address: contractAddress,
  abi: artifact.abi,
  functionName: "create",
  args: [
    "Which consensus mechanism is most sustainable long-term?",
    ["Proof of Stake", "Proof of Work", "Proof of Authority", "Proof of Space"],
    parseEther("0.05"),
    6,
    86400n * 7n, // 7 days
  ],
  value: parseEther("0.3"), // 6 * 0.05
});
await pub.waitForTransactionReceipt({ hash: s1Hash });

// Bob answers opt 0
const s1Ans1 = await wallets[1].writeContract({
  address: contractAddress,
  abi: artifact.abi,
  functionName: "respond",
  args: [1n, 0],
});
await pub.waitForTransactionReceipt({ hash: s1Ans1 });

// Charlie answers opt 0
const s1Ans2 = await wallets[2].writeContract({
  address: contractAddress,
  abi: artifact.abi,
  functionName: "respond",
  args: [1n, 0],
});
await pub.waitForTransactionReceipt({ hash: s1Ans2 });

// Dave answers opt 2 (Proof of Authority)
const s1Ans3 = await wallets[3].writeContract({
  address: contractAddress,
  abi: artifact.abi,
  functionName: "respond",
  args: [1n, 2],
});
await pub.waitForTransactionReceipt({ hash: s1Ans3 });

// -------------------------------------------------------------
// Seed Survey 2: Full (Bob asks, 2 spots, 2 answered)
// -------------------------------------------------------------
console.log("Seeding Survey 2 (Full)...");
const s2Hash = await wallets[1].writeContract({
  address: contractAddress,
  abi: artifact.abi,
  functionName: "create",
  args: [
    "Coffee or tea for morning focus?",
    ["Pour-over coffee", "Ceremonial matcha", "English breakfast tea"],
    parseEther("0.1"),
    2,
    86400n * 5n, // 5 days
  ],
  value: parseEther("0.2"), // 2 * 0.1
});
await pub.waitForTransactionReceipt({ hash: s2Hash });

// Alice answers opt 0
const s2Ans1 = await wallets[0].writeContract({
  address: contractAddress,
  abi: artifact.abi,
  functionName: "respond",
  args: [2n, 0],
});
await pub.waitForTransactionReceipt({ hash: s2Ans1 });

// Charlie answers opt 1
const s2Ans2 = await wallets[2].writeContract({
  address: contractAddress,
  abi: artifact.abi,
  functionName: "respond",
  args: [2n, 1],
});
await pub.waitForTransactionReceipt({ hash: s2Ans2 });

// -------------------------------------------------------------
// Seed Survey 3: Closed with unspent budget (reclaimable) (Alice asks)
// -------------------------------------------------------------
console.log("Seeding Survey 3 (Closed with unspent budget)...");
const s3Hash = await wallets[0].writeContract({
  address: contractAddress,
  abi: artifact.abi,
  functionName: "create",
  args: [
    "Should BotChain introduce quadratic voting?",
    ["Yes, immediately", "No, keep simple 1p1v", "Run a pilot first"],
    parseEther("0.2"),
    5,
    3600n, // 1 hour duration
  ],
  value: parseEther("1.0"), // 5 * 0.2
});
await pub.waitForTransactionReceipt({ hash: s3Hash });

// Bob answers opt 0
const s3Ans1 = await wallets[1].writeContract({
  address: contractAddress,
  abi: artifact.abi,
  functionName: "respond",
  args: [3n, 0],
});
await pub.waitForTransactionReceipt({ hash: s3Ans1 });

// -------------------------------------------------------------
// Seed Survey 4: Reclaimed (Charlie asks, 1 hour, answered once, reclaimed)
// -------------------------------------------------------------
console.log("Seeding Survey 4 (Reclaimed)...");
const s4Hash = await wallets[2].writeContract({
  address: contractAddress,
  abi: artifact.abi,
  functionName: "create",
  args: [
    "Preferred deployment target for BotChain apps?",
    ["Self-hosted Docker", "Vercel / Next.js", "Decentralized IPFS"],
    parseEther("0.05"),
    4,
    3600n, // 1 hour duration
  ],
  value: parseEther("0.2"), // 4 * 0.05
});
await pub.waitForTransactionReceipt({ hash: s4Hash });

// Bob answers opt 1
const s4Ans1 = await wallets[1].writeContract({
  address: contractAddress,
  abi: artifact.abi,
  functionName: "respond",
  args: [4n, 1],
});
await pub.waitForTransactionReceipt({ hash: s4Ans1 });

// Warp time by 3601 seconds so Survey 3 & 4 expire
console.log("Advancing time past 1 hour for Survey 3 & 4 expiry...");
await pub.transport.request({
  method: "evm_increaseTime",
  params: [3601],
});
await pub.transport.request({
  method: "evm_mine",
  params: [],
});

// Charlie reclaims Survey 4 unspent funds (3 spots = 0.15 BOT)
console.log("Charlie reclaiming unspent budget for Survey 4...");
const s4Reclaim = await wallets[2].writeContract({
  address: contractAddress,
  abi: artifact.abi,
  functionName: "reclaim",
  args: [4n],
});
await pub.waitForTransactionReceipt({ hash: s4Reclaim });

// -------------------------------------------------------------
// Seed Survey 5: Brand new (Dave asks, 0 answers)
// -------------------------------------------------------------
console.log("Seeding Survey 5 (Brand new)...");
const s5Hash = await wallets[3].writeContract({
  address: contractAddress,
  abi: artifact.abi,
  functionName: "create",
  args: [
    "Would you stake BOT to earn governance rights?",
    ["Yes, up to 100 BOT", "Yes, unlimited", "No, keep liquid"],
    parseEther("0.02"),
    10,
    86400n * 14n, // 14 days
  ],
  value: parseEther("0.2"), // 10 * 0.02
});
await pub.waitForTransactionReceipt({ hash: s5Hash });

console.log("\nRoles Table:");
console.log("----------------------------------------------------------------------------------------");
console.log("| Role              | Index | Address                                    | Private Key (first 10) |");
console.log("----------------------------------------------------------------------------------------");
console.log(`| Asker A (Alice)   | 0     | ${accounts[0].address} | ${KEYS[0].slice(0, 10)}... |`);
console.log(`| Asker B (Bob)     | 1     | ${accounts[1].address} | ${KEYS[1].slice(0, 10)}... |`);
console.log(`| Asker C (Charlie) | 2     | ${accounts[2].address} | ${KEYS[2].slice(0, 10)}... |`);
console.log(`| Asker D (Dave)    | 3     | ${accounts[3].address} | ${KEYS[3].slice(0, 10)}... |`);
console.log(`| Outsider (Eve)    | 4     | ${accounts[4].address} | ${KEYS[4].slice(0, 10)}... |`);
console.log("----------------------------------------------------------------------------------------\n");

console.log("Seeded Surveys Table:");
console.log("----------------------------------------------------------------------------------------");
console.log("| ID | Question                                      | Asker   | Reward    | Taken / Max | Status    |");
console.log("----------------------------------------------------------------------------------------");
console.log("| 1  | Which consensus mechanism is most sustainable | Alice   | 0.05 BOT  | 3 / 6       | Open      |");
console.log("| 2  | Coffee or tea for morning focus?              | Bob     | 0.10 BOT  | 2 / 2       | Full      |");
console.log("| 3  | Should BotChain introduce quadratic voting?   | Alice   | 0.20 BOT  | 1 / 5       | Reclaim!  |");
console.log("| 4  | Preferred deployment target for BotChain apps | Charlie | 0.05 BOT  | 1 / 4       | Reclaimed |");
console.log("| 5  | Would you stake BOT to earn governance rights | Dave    | 0.02 BOT  | 0 / 10      | Open      |");
console.log("----------------------------------------------------------------------------------------\n");

// Write .env.local
const envContent = [
  `NEXT_PUBLIC_BOTCHAIN_NETWORK=testnet`,
  `NEXT_PUBLIC_BOHR_RPC=${RPC}`,
  `NEXT_PUBLIC_CONTRACT_968=${contractAddress}`,
  `NEXT_PUBLIC_DEPLOY_BLOCK_968=${startBlock}`,
  "",
].join("\n");

writeFileSync(".env.local", envContent);
console.log("Wrote .env.local");
console.log(`\nLocal stack ready on port ${PORT}!`);
