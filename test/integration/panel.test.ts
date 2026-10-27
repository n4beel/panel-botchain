import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, execSync, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseEther,
  formatEther,
  type Address,
  type PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { panelAbi } from "@/lib/botchain/abi";
import { totalCost, share, remaining, statusOf, closesIn } from "@/lib/panel";

const PORT = 8625;
const RPC = `http://127.0.0.1:${PORT}`;
const CHAIN_ID = 968 as const;

const KEY_ALICE = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const KEY_BOB = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const KEY_CHARLIE = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";
const KEY_DAVE = "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6";

const accountAlice = privateKeyToAccount(KEY_ALICE);
const accountBob = privateKeyToAccount(KEY_BOB);
const accountCharlie = privateKeyToAccount(KEY_CHARLIE);
const accountDave = privateKeyToAccount(KEY_DAVE);

const local = defineChain({
  id: CHAIN_ID,
  name: "anvil",
  nativeCurrency: { name: "Test BOT", symbol: "tBOT", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});

let node: ChildProcess;
let publicClient: PublicClient;
let walletAlice: any;
let walletBob: any;
let walletCharlie: any;
let walletDave: any;
let contractAddress: Address;

beforeAll(async () => {
  try {
    execSync(`fuser -k ${PORT}/tcp 2>/dev/null || true`);
  } catch {}

  node = spawn("anvil", [
    "--port",
    String(PORT),
    "--chain-id",
    String(CHAIN_ID),
    "--accounts",
    "10",
    "--silent",
  ]);

  publicClient = createPublicClient({ chain: local, transport: http(), pollingInterval: 50 });

  for (let i = 0; ; i++) {
    try {
      await publicClient.getBlockNumber();
      break;
    } catch {
      if (i > 80) throw new Error("Anvil failed to start on integration port");
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  walletAlice = createWalletClient({ account: accountAlice, chain: local, transport: http() });
  walletBob = createWalletClient({ account: accountBob, chain: local, transport: http() });
  walletCharlie = createWalletClient({ account: accountCharlie, chain: local, transport: http() });
  walletDave = createWalletClient({ account: accountDave, chain: local, transport: http() });

  const artifact = JSON.parse(
    readFileSync(new URL("../../contracts/out/Panel.sol/Panel.json", import.meta.url), "utf8")
  );

  const hash = await walletAlice.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode.object,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  contractAddress = receipt.contractAddress!;
}, 30_000);

afterAll(() => {
  try {
    node?.kill();
    execSync(`fuser -k ${PORT}/tcp 2>/dev/null || true`);
  } catch {}
});

describe("Panel On-Chain Integration (live Anvil)", () => {
  it("creates a survey with exact prefunding", async () => {
    const reward = parseEther("0.05");
    const maxResp = 4;
    const cost = totalCost(reward, maxResp); // 0.2 BOT

    const hash = await walletAlice.writeContract({
      address: contractAddress,
      abi: panelAbi,
      functionName: "create",
      args: [
        "Which consensus mechanism is best?",
        ["Proof of Work", "Proof of Stake", "Proof of History"],
        reward,
        maxResp,
        86400n * 3n, // 3 days
      ],
      value: cost,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    expect(receipt.status).toBe("success");

    const count = await publicClient.readContract({
      address: contractAddress,
      abi: panelAbi,
      functionName: "surveyCount",
    });
    expect(count).toBe(1n);

    const survey = await publicClient.readContract({
      address: contractAddress,
      abi: panelAbi,
      functionName: "surveyOf",
      args: [1n],
    });
    expect(survey.asker.toLowerCase()).toBe(accountAlice.address.toLowerCase());
    expect(survey.reward).toBe(reward);
    expect(survey.maxResponses).toBe(4);
    expect(survey.responses).toBe(0);
    expect(survey.question).toBe("Which consensus mechanism is best?");

    const options = await publicClient.readContract({
      address: contractAddress,
      abi: panelAbi,
      functionName: "optionsOf",
      args: [1n],
    });
    expect(options).toEqual(["Proof of Work", "Proof of Stake", "Proof of History"]);
  });

  it("fails to create if funding is incorrect (WrongFunding)", async () => {
    await expect(
      walletAlice.writeContract({
        address: contractAddress,
        abi: panelAbi,
        functionName: "create",
        args: [
          "Bad funding test?",
          ["Yes", "No"],
          parseEther("0.1"),
          2,
          86400n,
        ],
        value: parseEther("0.15"), // Expected 0.2
      })
    ).rejects.toThrow();
  });

  it("submits responses and credits pending reward immediately", async () => {
    // Bob answers option 1 (Proof of Stake)
    const hashBob = await walletBob.writeContract({
      address: contractAddress,
      abi: panelAbi,
      functionName: "respond",
      args: [1n, 1],
    });
    await publicClient.waitForTransactionReceipt({ hash: hashBob });

    const pendingBob = await publicClient.readContract({
      address: contractAddress,
      abi: panelAbi,
      functionName: "pending",
      args: [accountBob.address],
    });
    expect(pendingBob).toBe(parseEther("0.05"));

    const [answered, choice] = await publicClient.readContract({
      address: contractAddress,
      abi: panelAbi,
      functionName: "choiceOf",
      args: [1n, accountBob.address],
    });
    expect(answered).toBe(true);
    expect(choice).toBe(1);

    // Charlie answers option 0 (Proof of Work)
    const hashCharlie = await walletCharlie.writeContract({
      address: contractAddress,
      abi: panelAbi,
      functionName: "respond",
      args: [1n, 0],
    });
    await publicClient.waitForTransactionReceipt({ hash: hashCharlie });

    const tallies = await publicClient.readContract({
      address: contractAddress,
      abi: panelAbi,
      functionName: "tallyOf",
      args: [1n],
    });
    expect(tallies).toEqual([1, 1, 0]);

    const s = await publicClient.readContract({
      address: contractAddress,
      abi: panelAbi,
      functionName: "surveyOf",
      args: [1n],
    });
    expect(s.responses).toBe(2);
    expect(remaining(s)).toBe(2);
  });

  it("rejects second response from same wallet (AlreadyResponded)", async () => {
    await expect(
      walletBob.writeContract({
        address: contractAddress,
        abi: panelAbi,
        functionName: "respond",
        args: [1n, 2],
      })
    ).rejects.toThrow();
  });

  it("rejects response from survey creator (AskerCannotRespond)", async () => {
    await expect(
      walletAlice.writeContract({
        address: contractAddress,
        abi: panelAbi,
        functionName: "respond",
        args: [1n, 0],
      })
    ).rejects.toThrow();
  });

  it("rejects invalid option index (BadOption)", async () => {
    await expect(
      walletDave.writeContract({
        address: contractAddress,
        abi: panelAbi,
        functionName: "respond",
        args: [1n, 5],
      })
    ).rejects.toThrow();
  });

  it("allows respondent to withdraw accrued rewards (withdraw)", async () => {
    const balBefore = await publicClient.getBalance({ address: accountBob.address });

    const hash = await walletBob.writeContract({
      address: contractAddress,
      abi: panelAbi,
      functionName: "withdraw",
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    expect(receipt.status).toBe("success");

    const balAfter = await publicClient.getBalance({ address: accountBob.address });
    const gasPaid = receipt.gasUsed * receipt.effectiveGasPrice;
    expect(balAfter + gasPaid - balBefore).toBe(parseEther("0.05"));

    const pendingNow = await publicClient.readContract({
      address: contractAddress,
      abi: panelAbi,
      functionName: "pending",
      args: [accountBob.address],
    });
    expect(pendingNow).toBe(0n);
  });

  it("rejects withdraw when balance is zero (NothingToWithdraw)", async () => {
    await expect(
      walletBob.writeContract({
        address: contractAddress,
        abi: panelAbi,
        functionName: "withdraw",
      })
    ).rejects.toThrow();
  });

  it("creates a survey and fills to capacity (Full)", async () => {
    const cost = parseEther("0.1"); // 2 * 0.05
    const hash = await walletBob.writeContract({
      address: contractAddress,
      abi: panelAbi,
      functionName: "create",
      args: ["Coffee or Tea?", ["Coffee", "Tea"], parseEther("0.05"), 2, 86400n],
      value: cost,
    });
    await publicClient.waitForTransactionReceipt({ hash });

    // Alice and Charlie fill survey #2
    const hashA = await walletAlice.writeContract({
      address: contractAddress,
      abi: panelAbi,
      functionName: "respond",
      args: [2n, 0],
    });
    await publicClient.waitForTransactionReceipt({ hash: hashA });

    const hashC = await walletCharlie.writeContract({
      address: contractAddress,
      abi: panelAbi,
      functionName: "respond",
      args: [2n, 1],
    });
    await publicClient.waitForTransactionReceipt({ hash: hashC });

    // Now full: Dave tries to answer
    await expect(
      walletDave.writeContract({
        address: contractAddress,
        abi: panelAbi,
        functionName: "respond",
        args: [2n, 0],
      })
    ).rejects.toThrow();
  });

  it("rejects premature reclaim while open and not full (NotClosedOrFull)", async () => {
    await expect(
      walletAlice.writeContract({
        address: contractAddress,
        abi: panelAbi,
        functionName: "reclaim",
        args: [1n],
      })
    ).rejects.toThrow();
  });

  it("rejects reclaim by non-asker (NotAsker)", async () => {
    // Warp anvil time past Survey 1 close
    await publicClient.transport.request({
      method: "evm_increaseTime",
      params: [86400 * 5],
    });
    await publicClient.transport.request({
      method: "evm_mine",
      params: [],
    });

    await expect(
      walletBob.writeContract({
        address: contractAddress,
        abi: panelAbi,
        functionName: "reclaim",
        args: [1n],
      })
    ).rejects.toThrow();
  });

  it("reclaims unspent budget after close and credits asker pending", async () => {
    // Survey 1 had 4 max, 2 answered = 2 unspent spots = 0.1 BOT
    const hash = await walletAlice.writeContract({
      address: contractAddress,
      abi: panelAbi,
      functionName: "reclaim",
      args: [1n],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    expect(receipt.status).toBe("success");

    const pendingAlice = await publicClient.readContract({
      address: contractAddress,
      abi: panelAbi,
      functionName: "pending",
      args: [accountAlice.address],
    });
    // Alice had 0.05 from answering survey 2 + 0.1 reclaimed = 0.15 BOT
    expect(pendingAlice).toBe(parseEther("0.15"));

    const s = await publicClient.readContract({
      address: contractAddress,
      abi: panelAbi,
      functionName: "surveyOf",
      args: [1n],
    });
    expect(s.reclaimed).toBe(true);
  });

  it("rejects duplicate reclaim (AlreadyReclaimed)", async () => {
    await expect(
      walletAlice.writeContract({
        address: contractAddress,
        abi: panelAbi,
        functionName: "reclaim",
        args: [1n],
      })
    ).rejects.toThrow();
  });

  it("rejects responses after survey has closed (Closed)", async () => {
    await expect(
      walletDave.writeContract({
        address: contractAddress,
        abi: panelAbi,
        functionName: "respond",
        args: [1n, 0],
      })
    ).rejects.toThrow();
  });

  it("queries latest surveys with pagination", async () => {
    const [surveys, ids] = await publicClient.readContract({
      address: contractAddress,
      abi: panelAbi,
      functionName: "latest",
      args: [0n, 10n],
    });

    expect(surveys.length).toBe(2);
    expect(ids).toEqual([2n, 1n]);
  });
});
