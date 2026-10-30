"use client";

import { useMemo } from "react";
import Link from "next/link";
import { formatEther } from "viem";
import { useAccount, useReadContract, useChainId, useBlock } from "wagmi";
import { useWaitForTransactionReceipt } from "@/lib/useChainWrite";
import { useWriteContract } from "@/lib/useChainWrite";
import PageShell from "@/components/layout/PageShell";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { panelAbi } from "@/lib/botchain/abi";
import { getDeployment, isDeployed } from "@/lib/botchain/deployment";
import { type BotChainId, isBotChainId } from "@/lib/botchain/chain";
import { describeError } from "@/lib/errors";
import { remaining, statusOf, totalCost } from "@/lib/panel";

export default function MePage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { toast } = useToast();

  const currentChainId: BotChainId = isBotChainId(chainId) ? chainId : 968;
  const deployment = getDeployment(currentChainId);
  const deployed = isDeployed(currentChainId);
  const { data: block } = useBlock();
  const nowSecs = block?.timestamp ? Number(block.timestamp) : Math.floor(Date.now() / 1000);

  // 1. Read user's pending balance
  const {
    data: pendingRaw,
    isLoading: isPendingBalanceLoading,
    refetch: refetchPending,
  } = useReadContract({
    address: deployment.address,
    abi: panelAbi,
    functionName: "pending",
    args: address ? [address] : undefined,
    query: { enabled: deployed && Boolean(address) },
  });

  const pendingBalance = pendingRaw ? BigInt(pendingRaw) : 0n;

  // 2. Read latest surveys for created / answered lists
  const { data: latestSurveysRaw, refetch: refetchLatest } = useReadContract({
    address: deployment.address,
    abi: panelAbi,
    functionName: "latest",
    args: [0n, 50n],
    query: { enabled: deployed },
  });

  // Withdraw action
  const {
    writeContract: writeWithdraw,
    data: withdrawTxHash,
    isPending: isWithdrawPending,
    error: withdrawError,
  } = useWriteContract();

  const { isLoading: isWithdrawWaiting } = useWaitForTransactionReceipt({
    hash: withdrawTxHash,
  });

  // Reclaim action
  const {
    writeContract: writeReclaim,
    data: reclaimTxHash,
    isPending: isReclaimPending,
    error: reclaimError,
  } = useWriteContract();

  const { isLoading: isReclaimWaiting } = useWaitForTransactionReceipt({
    hash: reclaimTxHash,
  });

  const handleWithdraw = () => {
    if (!isConnected || pendingBalance === 0n) return;
    try {
      writeWithdraw({
        address: deployment.address,
        abi: panelAbi,
        functionName: "withdraw",
      });
      toast("info", "Withdraw transaction submitted to wallet.");
    } catch (err) {
      toast("error", describeError(err));
    }
  };

  const handleReclaim = (id: bigint) => {
    if (!isConnected) return;
    try {
      writeReclaim({
        address: deployment.address,
        abi: panelAbi,
        functionName: "reclaim",
        args: [id],
      });
      toast("info", `Reclaim transaction for Question #${id} submitted.`);
    } catch (err) {
      toast("error", describeError(err));
    }
  };

  const surveysWithIds = useMemo(() => {
    if (!latestSurveysRaw || !latestSurveysRaw[0] || !latestSurveysRaw[1]) return [];
    const list = latestSurveysRaw[0];
    const ids = latestSurveysRaw[1];
    return list.map((s, idx) => ({
      id: ids[idx],
      asker: s.asker,
      reward: s.reward,
      maxResponses: Number(s.maxResponses),
      responses: Number(s.responses),
      closesAt: s.closesAt,
      optionCount: Number(s.optionCount),
      reclaimed: s.reclaimed,
      question: s.question,
    }));
  }, [latestSurveysRaw]);

  const createdSurveys = useMemo(() => {
    if (!address) return [];
    return surveysWithIds.filter(
      (s) => s.asker.toLowerCase() === address.toLowerCase()
    );
  }, [surveysWithIds, address]);

  return (
    <PageShell
      title="Your Answers &amp; Earnings"
      description="View accrued bounty, withdraw pull payments, and manage your questions."
    >
      <div className="flex flex-col gap-8 max-w-[760px] mx-auto w-full">
        {/* Earnings Card */}
        <Panel variant="questionnaire">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-[12px] font-mono uppercase tracking-wider text-[#7A7A7A]">
                Available Balance
              </span>
              <div className="font-mono text-[32px] font-bold text-[#0D0D0D] mt-0.5">
                {formatEther(pendingBalance)} BOT
              </div>
              <p className="text-[13px] text-[#5A5A5A] mt-1">
                Bounties and reclaimed budgets waiting to be withdrawn to your wallet.
              </p>
            </div>

            <Button
              type="button"
              variant="primary"
              size="lg"
              disabled={pendingBalance === 0n || !isConnected}
              loading={isWithdrawPending || isWithdrawWaiting}
              onClick={handleWithdraw}
            >
              {pendingBalance === 0n ? "No Balance" : "Withdraw BOT"}
            </Button>
          </div>

          {withdrawError && (
            <div className="mt-4 p-3.5 bg-[#FCE8E6] text-[#C5221F] border border-[#F5C6CB] rounded-[12px] text-[13px]">
              {describeError(withdrawError)}
            </div>
          )}
        </Panel>

        {/* Questions You Created */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-[22px] text-[#0D0D0D]">
              Questions You Created ({createdSurveys.length})
            </h2>
            <Link
              href="/ask"
              className="text-[13px] font-semibold text-[#6C47FF] hover:underline"
            >
              + Ask New Question
            </Link>
          </div>

          {createdSurveys.length === 0 ? (
            <Panel variant="surface" compact>
              <div className="text-center py-8 text-[13px] text-[#5A5A5A]">
                You haven&apos;t asked any questions yet.
              </div>
            </Panel>
          ) : (
            <div className="flex flex-col gap-3">
              {createdSurveys.map((s) => {
                const status = statusOf(s, nowSecs);
                const unspentSpots = remaining(s);
                const unspentAmount = s.reward * BigInt(unspentSpots);
                const canReclaim =
                  !s.reclaimed &&
                  (status === "closed" || status === "full") &&
                  unspentAmount > 0n;

                return (
                  <Panel key={s.id.toString()} variant="surface" compact>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-[11px] text-[#7A7A7A]">
                            #{s.id.toString()}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider ${
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
                        <Link
                          href={`/q/${s.id.toString()}`}
                          className="font-medium text-[15px] text-[#0D0D0D] hover:text-[#6C47FF] transition-colors"
                        >
                          {s.question}
                        </Link>
                        <div className="flex items-center gap-4 text-[12px] text-[#7A7A7A] mt-1 font-mono">
                          <span>
                            {s.responses}/{s.maxResponses} answered
                          </span>
                          <span>Pays {formatEther(s.reward)} BOT</span>
                          <span>Total: {formatEther(totalCost(s.reward, s.maxResponses))} BOT</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {canReclaim ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            loading={isReclaimPending || isReclaimWaiting}
                            onClick={() => handleReclaim(s.id)}
                          >
                            Reclaim {formatEther(unspentAmount)} BOT
                          </Button>
                        ) : s.reclaimed ? (
                          <span className="text-[12px] text-[#137333] font-medium font-mono">
                            ✓ Reclaimed
                          </span>
                        ) : null}

                        <Link
                          href={`/q/${s.id.toString()}`}
                          className="text-[12px] text-[#6C47FF] hover:underline whitespace-nowrap font-medium"
                        >
                          View &rarr;
                        </Link>
                      </div>
                    </div>
                  </Panel>
                );
              })}
            </div>
          )}
        </div>

        {/* Global Recent Questions Index */}
        <div className="flex flex-col gap-4 pt-4 border-t border-[#ECE9F7]">
          <h2 className="font-serif text-[22px] text-[#0D0D0D]">
            Recent Questions on Panel ({surveysWithIds.length})
          </h2>

          <div className="flex flex-col gap-2.5">
            {surveysWithIds.map((s) => {
              const status = statusOf(s, nowSecs);
              return (
                <Link
                  key={s.id.toString()}
                  href={`/q/${s.id.toString()}`}
                  className="p-4 rounded-[12px] border border-[#ECE9F7] bg-white hover:border-[#6C47FF] hover:bg-[#F7F5FF] transition-all flex items-center justify-between gap-4 no-underline"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#F0ECFF] text-[#6C47FF] flex items-center justify-center font-mono text-[11px] font-bold">
                      #{s.id.toString()}
                    </span>
                    <span className="text-[14px] font-medium text-[#0D0D0D]">
                      {s.question}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 font-mono text-[12px] flex-shrink-0">
                    <span className="text-[#6C47FF] font-semibold">
                      {formatEther(s.reward)} BOT
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] uppercase ${
                        status === "open"
                          ? "bg-[#E6F4EA] text-[#137333]"
                          : "bg-[#F1F3F4] text-[#7A7A7A]"
                      }`}
                    >
                      {status}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
