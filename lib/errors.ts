import { activeBotChain } from "@/lib/botchain/chain";
import { formatEther } from "viem";

/**
 * Human-readable explanations for Panel contract errors and transaction issues.
 */
export function describeError(err: unknown): string {
  // A wallet on the other BOT Chain network: writes are pinned to this build's chain (lib/useChainWrite.ts), so wagmi
  // refuses before the wallet opens. Say what to do, not the library's name for it.
  if (/ConnectorChainMismatch|chain mismatch|does not match the target chain/i.test(err instanceof Error ? `${err.name} ${err.message}` : String(err))) {
    return `Your wallet is on a different network. Switch it to ${activeBotChain.name}, then try again.`;
  }
  if (!err) return "An unknown error occurred.";

  const str = String(err);
  const msg = err instanceof Error ? err.message : str;

  // Custom Contract Errors
  if (msg.includes("WrongFunding") || str.includes("WrongFunding")) {
    const match = msg.match(/WrongFunding\((\d+)\)/);
    if (match?.[1]) {
      try {
        const expectedBot = formatEther(BigInt(match[1]));
        return `Fund exactly ${expectedBot} BOT.`;
      } catch {
        return "Incorrect funding provided.";
      }
    }
    return "Incorrect funding provided for survey budget.";
  }

  if (msg.includes("AlreadyResponded") || str.includes("AlreadyResponded")) {
    return "This wallet has already answered.";
  }

  if (msg.includes("NotClosedOrFull") || str.includes("NotClosedOrFull")) {
    return "Survey must be closed or full before unspent funds can be reclaimed.";
  }

  if (msg.includes("Full") || str.includes("Full")) {
    return "All paid responses are taken.";
  }

  if (msg.includes("Closed") || str.includes("Closed")) {
    return "This survey is closed.";
  }

  if (msg.includes("AskerCannotRespond") || str.includes("AskerCannotRespond")) {
    return "The survey creator cannot respond to their own survey.";
  }

  if (msg.includes("BadQuestion") || str.includes("BadQuestion")) {
    return "Question must be between 1 and 120 bytes.";
  }

  if (msg.includes("BadOptions") || str.includes("BadOptions")) {
    return "Options must contain 2 to 6 choices, each up to 32 bytes.";
  }

  if (msg.includes("BadOption") || str.includes("BadOption")) {
    return "Invalid option choice.";
  }

  if (msg.includes("BadReward") || str.includes("BadReward")) {
    return "Reward per response must be greater than zero.";
  }

  if (msg.includes("BadResponses") || str.includes("BadResponses")) {
    return "Maximum responses must be between 1 and 1,000.";
  }

  if (msg.includes("BadDuration") || str.includes("BadDuration")) {
    return "Duration must be between 1 hour and 90 days.";
  }

  if (msg.includes("NotAsker") || str.includes("NotAsker")) {
    return "Only the survey creator can reclaim unspent funds.";
  }

  if (msg.includes("AlreadyReclaimed") || str.includes("AlreadyReclaimed")) {
    return "Unspent funds have already been reclaimed.";
  }

  if (msg.includes("NothingToWithdraw") || str.includes("NothingToWithdraw")) {
    return "No pending funds available to withdraw.";
  }

  if (msg.includes("NoSuchSurvey") || str.includes("NoSuchSurvey")) {
    return "Survey does not exist.";
  }

  if (msg.includes("TransferFailed") || str.includes("TransferFailed")) {
    return "BOT transfer failed during withdrawal.";
  }

  if (msg.includes("ReentrantCall") || str.includes("ReentrantCall")) {
    return "Reentrancy detected.";
  }

  // Standard wallet errors
  if (msg.includes("User rejected") || msg.includes("user rejected")) {
    return "Transaction was cancelled in wallet.";
  }

  if (msg.includes("insufficient funds") || msg.includes("exceeds balance")) {
    return "Insufficient BOT balance for transaction and gas.";
  }

  return msg.length > 120 ? `${msg.slice(0, 117)}...` : msg;
}
