"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ConnectButton from "@/components/ui/ConnectButton";
import NetworkBadge from "@/components/botchain/NetworkBadge";
import { footerLinks } from "@/lib/botchain/chain";
import BuiltOnBotChain from "@/components/botchain/BuiltOnBotChain";
import { app } from "@/lib/app-config";

interface PageShellProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export default function PageShell({ children, title, description }: PageShellProps) {
  const links = footerLinks();
  const pathname = usePathname();

  return (
    <div
      className="flex flex-col min-h-[100dvh] overflow-x-hidden bg-[#FFFFFF]"
      style={{ background: "var(--bg-base)" }}
    >
      {/* Questionnaire Top Bar: Wordmark + Connect (no cluttered top tabs) */}
      <header
        className="sticky top-0 z-30 w-full border-b border-[#ECE9F7] bg-white/90 backdrop-blur-md"
      >
        <div className="mx-auto w-full max-w-[800px] px-4 md:px-6">
          <div className="flex items-center justify-between py-3">
            <Link href="/" className="flex items-center gap-2.5 no-underline group">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-transform group-hover:scale-125"
                style={{ background: "var(--accent)" }}
                aria-hidden="true"
              />
              <span
                className="font-serif text-[20px] font-bold tracking-tight text-[#0D0D0D]"
              >
                {app.name}
              </span>
            </Link>

            <div className="flex items-center gap-2">
              <NetworkBadge />
              <div className="w-[150px] md:w-[170px] flex-shrink-0">
                <ConnectButton />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Single-Question Area */}
      <main className="flex-1 flex flex-col justify-center mx-auto w-full max-w-[800px] px-4 py-8 md:px-6 md:py-12">
        {(title || description) && (
          <div className="mb-8 text-center max-w-[620px] mx-auto">
            {title && (
              <h1 className="font-serif text-[28px] md:text-[34px] leading-tight text-[#0D0D0D]">
                {title}
              </h1>
            )}
            {description && (
              <p className="mt-2 text-[14px] text-[#5A5A5A] leading-relaxed">
                {description}
              </p>
            )}
          </div>
        )}
        {children}
      </main>

      {/* Bottom Questionnaire Navigation Strip */}
      <nav
        aria-label="Survey navigation"
        className="border-t border-[#ECE9F7] py-4 bg-[#F7F5FF]"
      >
        <div className="mx-auto w-full max-w-[800px] px-4 md:px-6 flex flex-wrap items-center justify-between gap-4 text-[13px] font-medium">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className={`transition-colors hover:text-[#6C47FF] ${
                pathname === "/" ? "text-[#6C47FF] font-semibold" : "text-[#5A5A5A]"
              }`}
            >
              Latest Question
            </Link>
            <Link
              href="/ask"
              className={`transition-colors hover:text-[#6C47FF] ${
                pathname === "/ask" ? "text-[#6C47FF] font-semibold" : "text-[#5A5A5A]"
              }`}
            >
              Ask a Question
            </Link>
          </div>

          <div>
            <Link
              href="/me"
              className={`transition-colors hover:text-[#6C47FF] ${
                pathname === "/me" ? "text-[#6C47FF] font-semibold" : "text-[#5A5A5A]"
              }`}
            >
              Your Answers &amp; Surveys &rarr;
            </Link>
          </div>
        </div>
      </nav>

      {/* Statutory Limits & Three Mandatory Links Footer */}
      <footer className="border-t border-[#D6D2E6] py-8 px-4 md:px-6 bg-white">
        <div className="mx-auto w-full max-w-[800px] flex flex-col gap-6">
          {/* Limits Disclaimer */}
          <div className="p-4 rounded-[12px] bg-[#F7F5FF] border border-[#ECE9F7] text-[13px] text-[#5A5A5A] leading-relaxed">
            <div className="font-semibold text-[#0D0D0D] mb-1.5">
              Read the result as wallets, not people
            </div>
            <ul className="list-disc pl-5 space-y-1 text-[12px]">
              <li>One wallet answers once. One person can have many wallets.</li>
              <li>Answers are public and tied to the address.</li>
              <li>Everyone who answers in time is paid. You can&apos;t screen them.</li>
            </ul>
          </div>

          {/* Mandatory Ecosystem Links */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-[12px] text-[#5A5A5A]">
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: "var(--accent)" }}
                aria-hidden="true"
              />
              <BuiltOnBotChain className="text-[12px] uppercase tracking-wider text-[#5A5A5A]" />
            </div>

            <div className="flex items-center gap-6">
              <a
                href={links.site}
                target="_blank"
                rel="noreferrer"
                className="hover:underline transition-colors hover:text-[#0D0D0D]"
              >
                botchain.ai
              </a>
              <a
                href={links.explorer}
                target="_blank"
                rel="noreferrer"
                className="hover:underline transition-colors hover:text-[#0D0D0D]"
              >
                scan.botchain.ai
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
