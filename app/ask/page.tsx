"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseEther, formatEther } from "viem";
import { useAccount, useChainId } from "wagmi";
import { useWaitForTransactionReceipt } from "@/lib/useChainWrite";
import { useWriteContract } from "@/lib/useChainWrite";
import PageShell from "@/components/layout/PageShell";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { panelAbi } from "@/lib/botchain/abi";
import { getDeployment, isDeployed } from "@/lib/botchain/deployment";
import { activeBotChain, isBotChainId, type BotChainId } from "@/lib/botchain/chain";
import {
  MAX_QUESTION,
  MIN_OPTIONS,
  MAX_OPTIONS,
  MAX_OPTION_LEN,
  MIN_RESPONSES,
  MAX_RESPONSES,
} from "@/lib/limits";
import { describeError } from "@/lib/errors";
import { parseCreatedEvents } from "@/lib/logs";
import { totalCost } from "@/lib/panel";

const DURATION_PRESETS = [
  { label: "1 hour", value: 3600 },
  { label: "1 day", value: 86400 },
  { label: "3 days", value: 86400 * 3 },
  { label: "7 days", value: 86400 * 7 },
  { label: "14 days", value: 86400 * 14 },
  { label: "30 days", value: 86400 * 30 },
];

const REWARD_PRESETS = ["0.01", "0.02", "0.05", "0.1", "0.2"];
const RESPONSES_PRESETS = [5, 10, 20, 50, 100];

export default function AskPage() {
  const router = useRouter(); // stable-hook-result
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { toast } = useToast();

  const currentChainId: BotChainId = activeBotChain.id;
  const deployment = getDeployment(currentChainId);
  const deployed = isDeployed(currentChainId);

  // Form states
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [rewardInput, setRewardInput] = useState("0.05");
  const [maxResponses, setMaxResponses] = useState(10);
  const [durationSecs, setDurationSecs] = useState(86400 * 7); // 7 days

  const questionBytes = useMemo(() => new TextEncoder().encode(question.trim()).length, [question]);

  const parsedReward = useMemo(() => {
    try {
      if (!rewardInput || isNaN(Number(rewardInput)) || Number(rewardInput) <= 0) return 0n;
      return parseEther(rewardInput);
    } catch {
      return 0n;
    }
  }, [rewardInput]);

  const requiredFunding = useMemo(
    () => totalCost(parsedReward, maxResponses),
    [parsedReward, maxResponses]
  );

  const {
    writeContract,
    data: txHash,
    isPending,
    error: writeError,
  } = useWriteContract();

  const { isLoading: isWaiting, isSuccess, data: receipt } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Watch for receipt to extract created ID and redirect
  useEffect(() => {
    if (isSuccess && receipt) {
      const created = parseCreatedEvents(receipt.logs);
      if (created.length > 0) {
        const newId = created[0].id.toString();
        toast("success", `Question #${newId} created and funded!`);
        router.push(`/q/${newId}`);
      } else {
        toast("success", "Question created and funded!");
        router.push("/");
      }
    }
  }, [isSuccess, receipt, router, toast]);

  const handleOptionChange = (idx: number, val: string) => {
    const next = [...options];
    next[idx] = val;
    setOptions(next);
  };

  const handleAddOption = () => {
    if (options.length < MAX_OPTIONS) {
      setOptions([...options, ""]);
    }
  };

  const handleRemoveOption = (idx: number) => {
    if (options.length > MIN_OPTIONS) {
      const next = options.filter((_, i) => i !== idx);
      setOptions(next);
    }
  };

  const isFormValid =
    questionBytes > 0 &&
    questionBytes <= MAX_QUESTION &&
    options.length >= MIN_OPTIONS &&
    options.length <= MAX_OPTIONS &&
    options.every(
      (opt) =>
        new TextEncoder().encode(opt.trim()).length > 0 &&
        new TextEncoder().encode(opt.trim()).length <= MAX_OPTION_LEN
    ) &&
    parsedReward > 0n &&
    maxResponses >= MIN_RESPONSES &&
    maxResponses <= MAX_RESPONSES &&
    durationSecs >= 3600 &&
    durationSecs <= 7776000;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) {
      toast("error", "Please connect your wallet first.");
      return;
    }
    if (!isFormValid) {
      toast("error", "Please fill all fields within required limits.");
      return;
    }

    try {
      const cleanOpts = options.map((o) => o.trim());
      writeContract({
        address: deployment.address,
        abi: panelAbi,
        functionName: "create",
        args: [question.trim(), cleanOpts, parsedReward, maxResponses, BigInt(durationSecs)],
        value: requiredFunding,
      });
      toast("info", "Create transaction submitted to wallet.");
    } catch (err) {
      toast("error", describeError(err));
    }
  };

  return (
    <PageShell title="Ask a Question" description="Pay people for quick, honest signal. One question at a time.">
      <Panel variant="questionnaire">
        <form onSubmit={handleSubmit} className="flex flex-col gap-8 max-w-[680px] mx-auto">
          {/* 1. Question Text */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label htmlFor="survey-q" className="font-semibold text-[15px] text-[#0D0D0D]">
                The Question
              </label>
              <span
                className={`font-mono text-[12px] ${
                  questionBytes > MAX_QUESTION ? "text-[#C5221F] font-bold" : "text-[#7A7A7A]"
                }`}
              >
                {questionBytes} / {MAX_QUESTION} bytes
              </span>
            </div>
            <textarea
              id="survey-q"
              rows={3}
              placeholder="e.g. Which consensus mechanism is most sustainable long-term?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full font-serif text-[18px] md:text-[20px] p-4 rounded-[12px] border-2 border-[#D6D2E6] focus:border-[#6C47FF] outline-none text-[#0D0D0D] transition-colors"
            />
          </div>

          {/* 2. Options (2 to 6 choices) */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-[15px] text-[#0D0D0D]">
                Answer Options (2 to 6)
              </label>
              <span className="font-mono text-[12px] text-[#7A7A7A]">
                {options.length} choices
              </span>
            </div>

            <div className="flex flex-col gap-2.5">
              {options.map((opt, idx) => {
                const optBytes = new TextEncoder().encode(opt.trim()).length;
                const letter = String.fromCharCode(65 + idx);

                return (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-[#ECE9F7] text-[#0D0D0D] flex items-center justify-center font-mono text-[13px] font-bold flex-shrink-0">
                      {letter}
                    </span>
                    <input
                      type="text"
                      id={`option-input-${idx}`}
                      placeholder={`Option ${letter}`}
                      value={opt}
                      onChange={(e) => handleOptionChange(idx, e.target.value)}
                      className={`flex-1 px-4 py-2.5 rounded-full border-2 text-[14px] text-[#0D0D0D] outline-none transition-colors ${
                        optBytes > MAX_OPTION_LEN
                          ? "border-[#C5221F]"
                          : "border-[#D6D2E6] focus:border-[#6C47FF]"
                      }`}
                    />
                    {options.length > MIN_OPTIONS && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(idx)}
                        className="w-8 h-8 rounded-full text-[#7A7A7A] hover:text-[#C5221F] hover:bg-[#FCE8E6] transition-colors flex items-center justify-center font-bold text-[14px] cursor-pointer"
                        title="Remove option"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {options.length < MAX_OPTIONS && (
              <div className="pt-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleAddOption}
                >
                  + Add Option
                </Button>
              </div>
            )}
          </div>

          {/* 3. Budget & Duration Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-[#ECE9F7]">
            {/* Reward Per Answer */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="reward-input" className="font-semibold text-[13px] text-[#0D0D0D]">
                Reward Per Answer
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="reward-input"
                  value={rewardInput}
                  onChange={(e) => setRewardInput(e.target.value)}
                  className="w-full px-3 py-2 pr-12 rounded-[8px] border-2 border-[#D6D2E6] font-mono text-[14px] text-[#0D0D0D] outline-none focus:border-[#6C47FF]"
                />
                <span className="absolute right-3 top-2.5 font-mono text-[12px] text-[#7A7A7A]">
                  BOT
                </span>
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {REWARD_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setRewardInput(p)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                      rewardInput === p
                        ? "bg-[#6C47FF] text-white"
                        : "bg-[#F0ECFF] text-[#6C47FF] hover:bg-[#E2DBFC]"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Max Responses */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="max-resp-input" className="font-semibold text-[13px] text-[#0D0D0D]">
                Maximum Answers
              </label>
              <input
                type="number"
                id="max-resp-input"
                min={MIN_RESPONSES}
                max={MAX_RESPONSES}
                value={maxResponses}
                onChange={(e) => setMaxResponses(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 rounded-[8px] border-2 border-[#D6D2E6] font-mono text-[14px] text-[#0D0D0D] outline-none focus:border-[#6C47FF]"
              />
              <div className="flex flex-wrap gap-1 mt-1">
                {RESPONSES_PRESETS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setMaxResponses(r)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                      maxResponses === r
                        ? "bg-[#6C47FF] text-white"
                        : "bg-[#F0ECFF] text-[#6C47FF] hover:bg-[#E2DBFC]"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="duration-select" className="font-semibold text-[13px] text-[#0D0D0D]">
                Survey Duration
              </label>
              <select
                id="duration-select"
                value={durationSecs}
                onChange={(e) => setDurationSecs(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-[8px] border-2 border-[#D6D2E6] text-[13px] text-[#0D0D0D] outline-none focus:border-[#6C47FF] bg-white cursor-pointer"
              >
                {DURATION_PRESETS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-[#7A7A7A]">
                Unspent budget is returned after closing.
              </span>
            </div>
          </div>

          {/* Cost Summary & Submission */}
          <div className="p-5 rounded-[16px] bg-[#F7F5FF] border border-[#D6D2E6] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="font-mono font-bold text-[18px] text-[#0D0D0D]">
                Total: {formatEther(requiredFunding)} BOT
              </div>
              <p className="text-[12px] text-[#5A5A5A] mt-0.5">
                {rewardInput || "0"} BOT &times; {maxResponses} answers. Funded up front in escrow.
              </p>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={!isFormValid || !isConnected}
              loading={isPending || isWaiting}
            >
              {!isConnected
                ? "Connect Wallet"
                : isWaiting
                ? "Creating on-chain..."
                : isPending
                ? "Confirm in Wallet..."
                : `Fund & Ask (${formatEther(requiredFunding)} BOT)`}
            </Button>
          </div>

          {writeError && (
            <div className="p-3.5 bg-[#FCE8E6] text-[#C5221F] border border-[#F5C6CB] rounded-[12px] text-[13px]">
              {describeError(writeError)}
            </div>
          )}
        </form>
      </Panel>
    </PageShell>
  );
}
