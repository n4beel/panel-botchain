import Link from "next/link";
import PageShell from "@/components/layout/PageShell";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";

export default function NotFound() {
  return (
    <PageShell>
      <Panel variant="questionnaire">
        <div className="text-center py-16 flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[#F0ECFF] flex items-center justify-center text-[#6C47FF] text-[24px] font-serif">
            404
          </div>
          <h2 className="font-serif text-[32px] text-[#0D0D0D]">
            Question Not Found
          </h2>
          <p className="text-[14px] text-[#5A5A5A] max-w-[420px] leading-relaxed">
            The question you are looking for does not exist, has been removed, or was never created.
          </p>
          <div className="mt-4">
            <Link href="/">
              <Button variant="primary" size="lg">
                &larr; Return to Latest Question
              </Button>
            </Link>
          </div>
        </div>
      </Panel>
    </PageShell>
  );
}
