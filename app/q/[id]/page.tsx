"use client";

import { use, useEffect } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useAccount, useReadContract, useChainId } from "wagmi";
import PageShell from "@/components/layout/PageShell";
import QuestionnaireView from "@/components/panel/QuestionnaireView";
import Panel from "@/components/ui/Panel";
import { panelAbi } from "@/lib/botchain/abi";
import { getDeployment, isDeployed } from "@/lib/botchain/deployment";
import { type BotChainId, isBotChainId } from "@/lib/botchain/chain";
import { type SurveyData } from "@/lib/panel";

interface QuestionPageProps {
  params: Promise<{ id: string }>;
}

export default function QuestionPage({ params }: QuestionPageProps) {
  const { id: rawId } = use(params);
  const surveyId = Number(rawId);

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const currentChainId: BotChainId = isBotChainId(chainId) ? chainId : 968;
  const deployment = getDeployment(currentChainId);
  const deployed = isDeployed(currentChainId);

  if (isNaN(surveyId) || surveyId <= 0) {
    notFound();
  }

  // 1. Read survey details
  const {
    data: surveyRaw,
    isLoading,
    isError,
    refetch: refetchSurvey,
  } = useReadContract({
    address: deployment.address,
    abi: panelAbi,
    functionName: "surveyOf",
    args: [BigInt(surveyId)],
    query: { enabled: deployed },
  });

  // 2. Read options
  const { data: optionsRaw } = useReadContract({
    address: deployment.address,
    abi: panelAbi,
    functionName: "optionsOf",
    args: [BigInt(surveyId)],
    query: { enabled: deployed },
  });

  // 3. Read tallies
  const { data: talliesRaw, refetch: refetchTallies } = useReadContract({
    address: deployment.address,
    abi: panelAbi,
    functionName: "tallyOf",
    args: [BigInt(surveyId)],
    query: { enabled: deployed },
  });

  // 4. Read user's choice
  const { data: choiceRaw, refetch: refetchChoice } = useReadContract({
    address: deployment.address,
    abi: panelAbi,
    functionName: "choiceOf",
    args: address ? [BigInt(surveyId), address] : undefined,
    query: { enabled: deployed && Boolean(address) },
  });

  const handleRefresh = () => {
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
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-[13px] text-[#5A5A5A] hover:text-[#6C47FF] transition-colors inline-flex items-center gap-1.5"
          >
            &larr; Back to Latest Question
          </Link>
          <div className="font-mono text-[12px] text-[#7A7A7A]">
            Question #{surveyId}
          </div>
        </div>

        {isLoading ? (
          <div className="py-24 text-center font-mono text-[13px] text-[#7A7A7A]">
            Loading question #{surveyId}...
          </div>
        ) : isError || !survey ? (
          <Panel variant="questionnaire">
            <div className="text-center py-16">
              <h2 className="font-serif text-[26px] text-[#0D0D0D]">
                Question #{surveyId} Not Found
              </h2>
              <p className="text-[13px] text-[#5A5A5A] mt-2">
                This question does not exist or has not been created yet.
              </p>
              <div className="mt-6">
                <Link href="/">
                  <span className="font-semibold text-[#6C47FF] hover:underline">
                    Return to Home
                  </span>
                </Link>
              </div>
            </div>
          </Panel>
        ) : (
          <Panel variant="questionnaire">
            <QuestionnaireView
              id={BigInt(surveyId)}
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
        )}
      </div>
    </PageShell>
  );
}
