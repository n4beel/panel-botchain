"use client";

import { useState } from "react";
import Link from "next/link";
import { useAccount, useReadContract, useChainId } from "wagmi";
import PageShell from "@/components/layout/PageShell";
import QuestionnaireView from "@/components/panel/QuestionnaireView";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";
import { panelAbi } from "@/lib/botchain/abi";
import { getDeployment, isDeployed } from "@/lib/botchain/deployment";
import { type BotChainId, isBotChainId } from "@/lib/botchain/chain";
import { type SurveyData } from "@/lib/panel";

export default function Home() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const currentChainId: BotChainId = isBotChainId(chainId) ? chainId : 968;
  const deployment = getDeployment(currentChainId);
  const deployed = isDeployed(currentChainId);

  // 1. Read surveyCount
  const { data: totalCountRaw, refetch: refetchCount } = useReadContract({
    address: deployment.address,
    abi: panelAbi,
    functionName: "surveyCount",
    query: { enabled: deployed },
  });

  const totalCount = totalCountRaw ? Number(totalCountRaw) : 0;
  const [activeId, setActiveId] = useState<number | null>(null);

  // Default to newest survey if not manually chosen
  const currentId = activeId !== null ? activeId : totalCount;

  // 2. Read survey details
  const { data: surveyRaw, refetch: refetchSurvey } = useReadContract({
    address: deployment.address,
    abi: panelAbi,
    functionName: "surveyOf",
    args: currentId > 0 ? [BigInt(currentId)] : undefined,
    query: { enabled: deployed && currentId > 0 },
  });

  // 3. Read options
  const { data: optionsRaw } = useReadContract({
    address: deployment.address,
    abi: panelAbi,
    functionName: "optionsOf",
    args: currentId > 0 ? [BigInt(currentId)] : undefined,
    query: { enabled: deployed && currentId > 0 },
  });

  // 4. Read tallies
  const { data: talliesRaw, refetch: refetchTallies } = useReadContract({
    address: deployment.address,
    abi: panelAbi,
    functionName: "tallyOf",
    args: currentId > 0 ? [BigInt(currentId)] : undefined,
    query: { enabled: deployed && currentId > 0 },
  });

  // 5. Read user's choice
  const { data: choiceRaw, refetch: refetchChoice } = useReadContract({
    address: deployment.address,
    abi: panelAbi,
    functionName: "choiceOf",
    args: currentId > 0 && address ? [BigInt(currentId), address] : undefined,
    query: { enabled: deployed && currentId > 0 && Boolean(address) },
  });

  const handleRefresh = () => {
    refetchCount();
    refetchSurvey();
    refetchTallies();
    refetchChoice();
  };

  const survey: SurveyData | null = surveyRaw
    ? {
        asker: surveyRaw.asker,
        reward: surveyRaw.reward,
        maxResponses: Number(surveyRaw.maxResponses),
        responses: Number(surveyRaw.responses),
        closesAt: surveyRaw.closesAt,
        optionCount: Number(surveyRaw.optionCount),
        reclaimed: surveyRaw.reclaimed,
        question: surveyRaw.question,
      }
    : null;

  const options = optionsRaw ? [...optionsRaw] : [];
  const tallies = talliesRaw ? talliesRaw.map((t) => Number(t)) : [];
  const userChoice = choiceRaw
    ? { answered: choiceRaw[0], option: Number(choiceRaw[1]) }
    : undefined;

  return (
    <PageShell>
      {!deployed ? (
        <Panel variant="questionnaire">
          <div className="text-center py-12">
            <h2 className="font-serif text-[24px] text-[#0D0D0D]">Not Deployed</h2>
            <p className="text-[13px] text-[#5A5A5A] mt-2">
              Panel contract is not yet deployed on network {currentChainId}.
            </p>
          </div>
        </Panel>
      ) : totalCount === 0 ? (
        <Panel variant="questionnaire">
          <div className="text-center py-16 flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#F0ECFF] flex items-center justify-center text-[#6C47FF] text-[20px] font-serif">
              ?
            </div>
            <h2 className="font-serif text-[28px] text-[#0D0D0D]">
              No questions asked yet
            </h2>
            <p className="text-[14px] text-[#5A5A5A] max-w-[420px]">
              Be the first to fund a question and pay respondents for honest opinions.
            </p>
            <Link href="/ask">
              <Button variant="primary" size="lg">
                Ask a Question &rarr;
              </Button>
            </Link>
          </div>
        </Panel>
      ) : survey ? (
        <div className="flex flex-col gap-8">
          <Panel variant="questionnaire">
            <QuestionnaireView
              id={BigInt(currentId)}
              survey={survey}
              options={options}
              tallies={tallies}
              userChoice={userChoice}
              isConnected={isConnected}
              userAddress={address}
              deploymentAddress={deployment.address}
              onRefresh={handleRefresh}
            />
          </Panel>

          {/* Question Stepper / Navigation */}
          {totalCount > 1 && (
            <div className="flex items-center justify-between px-2 text-[13px] text-[#5A5A5A]">
              <button
                type="button"
                disabled={currentId <= 1}
                onClick={() => setActiveId(Math.max(1, currentId - 1))}
                className="cursor-pointer font-medium hover:text-[#6C47FF] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                &larr; Previous Question
              </button>

              <div className="font-mono text-[12px] bg-[#F7F5FF] px-3 py-1 rounded-full border border-[#ECE9F7]">
                Question {currentId} of {totalCount}
              </div>

              <button
                type="button"
                disabled={currentId >= totalCount}
                onClick={() => setActiveId(Math.min(totalCount, currentId + 1))}
                className="cursor-pointer font-medium hover:text-[#6C47FF] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Next Question &rarr;
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="py-20 text-center font-mono text-[13px] text-[#7A7A7A]">
          Loading question #{currentId}...
        </div>
      )}
    </PageShell>
  );
}
