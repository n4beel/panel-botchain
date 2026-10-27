"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatEther, type Address } from "viem";
import { useWriteContract, useWaitForTransactionReceipt, useBlock } from "wagmi";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { panelAbi } from "@/lib/botchain/abi";
import { describeError } from "@/lib/errors";
import {
  totalCost,
  share,
  remaining,
  statusOf,
  closesIn,
  type SurveyData,
} from "@/lib/panel";

interface QuestionnaireViewProps {
  id: bigint;
  survey: SurveyData;
  options: string[];
  tallies: number[];
  userChoice?: { answered: boolean; option: number };
  isConnected: boolean;
  userAddress?: Address;
  deploymentAddress: Address;
  onRefresh?: () => void;
}

export default function QuestionnaireView({
  id,
  survey,
  options,
  tallies,
  userChoice,
  isConnected,
  userAddress,
  deploymentAddress,
  onRefresh,
}: QuestionnaireViewProps) {
  const { toast } = useToast();
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [submittedOption, setSubmittedOption] = useState<number | null>(null);

  const { data: block } = useBlock();
  const nowSecs = block?.timestamp ? Number(block.timestamp) : Math.floor(Date.now() / 1000);
  const status = statusOf(survey, nowSecs);
  const isAsker =
    userAddress && survey.asker.toLowerCase() === userAddress.toLowerCase();
  const hasAnswered = (userChoice?.answered ?? false) || submittedOption !== null;
  const myOption = userChoice?.answered ? userChoice.option : submittedOption;
  const showResults = hasAnswered || status !== "open" || isAsker;

  const shares = share(tallies);
  const rewardBot = formatEther(survey.reward);
  const progressPercent = Math.min(
    100,
    Math.round((survey.responses / survey.maxResponses) * 100)
  );

  // Contract Write for respond
  const {
    writeContract: writeRespond,
    data: respondTxHash,
    isPending: isRespondPending,
    error: respondError,
  } = useWriteContract();

  const { isLoading: isRespondWaiting, isSuccess: isRespondSuccess } = useWaitForTransactionReceipt({
    hash: respondTxHash,
  });

  // Contract Write for reclaim
  const {
    writeContract: writeReclaim,
    data: reclaimTxHash,
    isPending: isReclaimPending,
    error: reclaimError,
  } = useWriteContract();

  const { isLoading: isReclaimWaiting, isSuccess: isReclaimSuccess } = useWaitForTransactionReceipt({
    hash: reclaimTxHash,
  });

  useEffect(() => {
    if (isRespondSuccess) {
      if (selectedOption !== null) {
        setSubmittedOption(selectedOption);
      }
      toast("success", "Answer recorded! Bounty credited to your balance.");
      onRefresh?.();
    }
  }, [isRespondSuccess]);

  useEffect(() => {
    if (isReclaimSuccess) {
      toast("success", "Unspent budget reclaimed to your balance.");
      onRefresh?.();
    }
  }, [isReclaimSuccess]);

  const handleRespond = (opt: number) => {
    if (!isConnected) {
      toast("error", "Connect wallet to answer.");
      return;
    }
    if (isAsker) {
      toast("error", "The survey creator cannot respond to their own survey.");
      return;
    }
    try {
      writeRespond({
        address: deploymentAddress,
        abi: panelAbi,
        functionName: "respond",
        args: [id, opt],
      });
      toast("info", "Answer submitted to wallet.");
    } catch (err) {
      toast("error", describeError(err));
    }
  };

  const handleReclaim = () => {
    if (!isConnected) {
      toast("error", "Connect wallet to reclaim.");
      return;
    }
    try {
      writeReclaim({
        address: deploymentAddress,
        abi: panelAbi,
        functionName: "reclaim",
        args: [id],
      });
      toast("info", "Reclaim transaction submitted to wallet.");
    } catch (err) {
      toast("error", describeError(err));
    }
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Top Questionnaire Meta Bar */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-[13px]">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-semibold bg-[#6C47FF] text-white tracking-wide">
              Pays {rewardBot} BOT
            </span>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono uppercase tracking-wider ${
                status === "open"
                  ? "bg-[#E6F4EA] text-[#137333]"
                  : status === "full"
                  ? "bg-[#FEF7E0] text-[#B06000]"
                  : status === "reclaimed"
                  ? "bg-[#F1F3F4] text-[#5F6368]"
                  : "bg-[#FCE8E6] text-[#C5221F]"
              }`}
            >
              {status}
            </span>
          </div>

          <div className="text-[#5A5A5A] font-mono text-[12px]">
            {closesIn(survey.closesAt, nowSecs)}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full">
          <div className="w-full h-1.5 bg-[#ECE9F7] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#6C47FF] transition-all duration-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[11px] text-[#7A7A7A] mt-1 font-mono">
            <span>
              {survey.responses} of {survey.maxResponses} answered
            </span>
            <span>{remaining(survey)} spots left</span>
          </div>
        </div>
      </div>

      {/* Main Question Heading */}
      <div className="py-2">
        <h2 className="font-serif text-[28px] md:text-[38px] leading-tight text-[#0D0D0D]">
          {survey.question}
        </h2>
      </div>

      {/* Error Notices */}
      {respondError && (
        <div className="p-3.5 bg-[#FCE8E6] text-[#C5221F] border border-[#F5C6CB] rounded-[12px] text-[13px]">
          {describeError(respondError)}
        </div>
      )}
      {reclaimError && (
        <div className="p-3.5 bg-[#FCE8E6] text-[#C5221F] border border-[#F5C6CB] rounded-[12px] text-[13px]">
          {describeError(reclaimError)}
        </div>
      )}

      {/* Survey State A: Unanswered & Open */}
      {!showResults ? (
        <div className="flex flex-col gap-3.5 mt-2">
          {options.map((optText, index) => {
            const letter = String.fromCharCode(65 + index);
            const isSelected = selectedOption === index;

            return (
              <button
                key={index}
                type="button"
                onClick={() => setSelectedOption(index)}
                className={`w-full flex items-center justify-between p-4 md:p-5 rounded-full text-left transition-all cursor-pointer ${
                  isSelected
                    ? "bg-[#6C47FF] text-white border-2 border-[#6C47FF] shadow-md shadow-[#6C47FF]/20"
                    : "bg-[#FFFFFF] text-[#0D0D0D] border-2 border-[#D6D2E6] hover:border-[#6C47FF] hover:bg-[#F7F5FF]"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-[12px] font-bold ${
                      isSelected
                        ? "bg-white text-[#6C47FF]"
                        : "bg-[#ECE9F7] text-[#0D0D0D]"
                    }`}
                  >
                    {letter}
                  </span>
                  <span className="text-[15px] md:text-[17px] font-medium">
                    {optText}
                  </span>
                </div>

                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    isSelected ? "border-white bg-white" : "border-[#D6D2E6]"
                  }`}
                >
                  {isSelected && (
                    <div className="w-2.5 h-2.5 rounded-full bg-[#6C47FF]" />
                  )}
                </div>
              </button>
            );
          })}

          {/* Confirm Action Button */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-[12px] text-[#5A5A5A]">
              {selectedOption !== null ? (
                <span>
                  Option {String.fromCharCode(65 + selectedOption)} selected.
                  Reward will be added to your balance.
                </span>
              ) : (
                <span>Select an option to answer.</span>
              )}
            </div>

            <Button
              type="button"
              variant="primary"
              size="lg"
              disabled={selectedOption === null || !isConnected}
              loading={isRespondPending || isRespondWaiting}
              onClick={() => {
                if (selectedOption !== null) handleRespond(selectedOption);
              }}
            >
              {!isConnected
                ? "Connect to Answer"
                : isRespondWaiting
                ? "Confirming Answer..."
                : isRespondPending
                ? "Submitting..."
                : `Confirm & Earn ${rewardBot} BOT`}
            </Button>
          </div>
        </div>
      ) : (
        /* Survey State B: Results View (Answered, Full, or Closed) */
        <div className="flex flex-col gap-6 mt-2">
          {/* Answered Banner */}
          {hasAnswered && myOption !== null && myOption !== undefined && (
            <div className="p-4 bg-[#F0ECFF] border border-[#D6D2E6] rounded-[16px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[14px]">
              <div>
                <span className="font-semibold text-[#0D0D0D]">
                  You answered {String.fromCharCode(65 + myOption)}:{" "}
                  {options[myOption]}
                </span>
                <p className="text-[13px] text-[#5A5A5A] mt-0.5">
                  {rewardBot} BOT has been credited to your balance.
                </p>
              </div>

              <Link
                href="/me"
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#6C47FF] hover:underline whitespace-nowrap"
              >
                Withdraw Balance &rarr;
              </Link>
            </div>
          )}

          {/* Asker Notice Banner */}
          {isAsker && (
            <div className="p-4 bg-[#F7F5FF] border border-[#D6D2E6] rounded-[16px] flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[13px] uppercase tracking-wider text-[#6C47FF]">
                  Creator Dashboard
                </span>
                <span className="text-[12px] font-mono text-[#5A5A5A]">
                  Total Budget: {formatEther(totalCost(survey.reward, survey.maxResponses))} BOT
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center py-1 bg-white rounded-[10px] p-2 border border-[#ECE9F7]">
                <div>
                  <div className="text-[11px] text-[#7A7A7A]">Spent</div>
                  <div className="font-mono font-bold text-[13px] text-[#0D0D0D]">
                    {formatEther(survey.reward * BigInt(survey.responses))} BOT
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-[#7A7A7A]">Unspent</div>
                  <div className="font-mono font-bold text-[13px] text-[#0D0D0D]">
                    {formatEther(survey.reward * BigInt(remaining(survey)))} BOT
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-[#7A7A7A]">Status</div>
                  <div className="font-mono font-bold text-[13px] text-[#0D0D0D] uppercase">
                    {status}
                  </div>
                </div>
              </div>

              {!survey.reclaimed && (status === "closed" || status === "full") && remaining(survey) > 0 && (
                <div className="flex justify-end pt-1">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    loading={isReclaimPending || isReclaimWaiting}
                    onClick={handleReclaim}
                  >
                    Reclaim Unspent ({formatEther(survey.reward * BigInt(remaining(survey)))} BOT)
                  </Button>
                </div>
              )}

              {survey.reclaimed && (
                <div className="text-[12px] text-[#137333] font-medium text-right">
                  ✓ Unspent budget reclaimed to pending balance.
                </div>
              )}
            </div>
          )}

          {/* Results Bar Graph */}
          <div className="flex flex-col gap-4">
            {options.map((optText, index) => {
              const letter = String.fromCharCode(65 + index);
              const count = tallies[index] ?? 0;
              const pct = shares[index] ?? 0;
              const isUserChoice = hasAnswered && myOption === index;

              return (
                <div key={index} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[14px]">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#ECE9F7] text-[#0D0D0D] flex items-center justify-center font-mono text-[11px] font-bold">
                        {letter}
                      </span>
                      <span className={`font-medium ${isUserChoice ? "text-[#6C47FF] font-bold" : "text-[#0D0D0D]"}`}>
                        {optText}
                      </span>
                      {isUserChoice && (
                        <span className="px-2 py-0.5 rounded-full bg-[#F0ECFF] text-[#6C47FF] text-[10px] font-bold tracking-wider uppercase">
                          You
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[13px] font-mono">
                      <span className="text-[#5A5A5A]">{count} votes</span>
                      <span className="font-bold text-[#0D0D0D] w-12 text-right">
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Horizontal Growing Bar */}
                  <div className="w-full h-3 bg-[#F0ECFF] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 animate-bar-grow ${
                        isUserChoice ? "bg-[#6C47FF]" : "bg-[#A9A2C7]"
                      }`}
                      style={{
                        ["--bar-target-width" as string]: `${pct}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
