import { parseEventLogs, type Log } from "viem";
import { panelAbi } from "./botchain/abi";

export interface CreatedEvent {
  id: bigint;
  asker: `0x${string}`;
  question: string;
  reward: bigint;
  maxResponses: number;
  closesAt: bigint;
}

export interface RespondedEvent {
  id: bigint;
  responder: `0x${string}`;
  option: number;
}

export interface ReclaimedEvent {
  id: bigint;
  amount: bigint;
}

export interface WithdrawnEvent {
  account: `0x${string}`;
  amount: bigint;
}

export function parseCreatedEvents(logs: Log[]): CreatedEvent[] {
  try {
    const parsed = parseEventLogs({
      abi: panelAbi,
      eventName: "Created",
      logs,
    });
    return parsed.map((e) => ({
      id: e.args.id,
      asker: e.args.asker,
      question: e.args.question,
      reward: e.args.reward,
      maxResponses: Number(e.args.maxResponses),
      closesAt: e.args.closesAt,
    }));
  } catch {
    return [];
  }
}

export function parseRespondedEvents(logs: Log[]): RespondedEvent[] {
  try {
    const parsed = parseEventLogs({
      abi: panelAbi,
      eventName: "Responded",
      logs,
    });
    return parsed.map((e) => ({
      id: e.args.id,
      responder: e.args.responder,
      option: Number(e.args.option),
    }));
  } catch {
    return [];
  }
}

export function parseReclaimedEvents(logs: Log[]): ReclaimedEvent[] {
  try {
    const parsed = parseEventLogs({
      abi: panelAbi,
      eventName: "Reclaimed",
      logs,
    });
    return parsed.map((e) => ({
      id: e.args.id,
      amount: e.args.amount,
    }));
  } catch {
    return [];
  }
}

export function parseWithdrawnEvents(logs: Log[]): WithdrawnEvent[] {
  try {
    const parsed = parseEventLogs({
      abi: panelAbi,
      eventName: "Withdrawn",
      logs,
    });
    return parsed.map((e) => ({
      account: e.args.account,
      amount: e.args.amount,
    }));
  } catch {
    return [];
  }
}
