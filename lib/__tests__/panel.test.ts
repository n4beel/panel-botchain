import { describe, expect, it } from "vitest";
import { parseEther } from "viem";
import {
  totalCost,
  share,
  remaining,
  statusOf,
  closesIn,
  formatDuration,
} from "../panel";
import { describeError } from "../errors";
import {
  parseCreatedEvents,
  parseRespondedEvents,
  parseReclaimedEvents,
  parseWithdrawnEvents,
} from "../logs";

describe("totalCost", () => {
  it("calculates exact required budget", () => {
    expect(totalCost(parseEther("0.1"), 5)).toBe(parseEther("0.5"));
    expect(totalCost(1n, 1000)).toBe(1000n);
  });

  it("handles zero values cleanly", () => {
    expect(totalCost(0n, 10)).toBe(0n);
    expect(totalCost(parseEther("1"), 0)).toBe(0n);
  });
});

describe("share", () => {
  it("returns empty array for empty input", () => {
    expect(share([])).toEqual([]);
  });

  it("returns zeros when all tallies are zero", () => {
    expect(share([0, 0, 0])).toEqual([0, 0, 0]);
  });

  it("calculates equal proportions", () => {
    expect(share([10, 10])).toEqual([50, 50]);
  });

  it("calculates single option dominance", () => {
    expect(share([5, 0, 0])).toEqual([100, 0, 0]);
  });

  it("calculates fractional percentages", () => {
    const s = share([1, 1, 1]);
    expect(s).toEqual([33.3, 33.3, 33.3]);
  });
});

describe("remaining", () => {
  it("returns remaining spots", () => {
    expect(remaining({ maxResponses: 10, responses: 3 })).toBe(7);
    expect(remaining({ maxResponses: 5, responses: 5 })).toBe(0);
    expect(remaining({ maxResponses: 5, responses: 8 })).toBe(0);
  });
});

describe("statusOf", () => {
  const now = 1_000_000;

  it("identifies open survey", () => {
    expect(
      statusOf(
        { closesAt: BigInt(now + 3600), responses: 2, maxResponses: 10, reclaimed: false },
        now
      )
    ).toBe("open");
  });

  it("identifies full survey", () => {
    expect(
      statusOf(
        { closesAt: BigInt(now + 3600), responses: 10, maxResponses: 10, reclaimed: false },
        now
      )
    ).toBe("full");
  });

  it("identifies closed survey by time", () => {
    expect(
      statusOf(
        { closesAt: BigInt(now - 10), responses: 5, maxResponses: 10, reclaimed: false },
        now
      )
    ).toBe("closed");
  });

  it("identifies reclaimed survey", () => {
    expect(
      statusOf(
        { closesAt: BigInt(now - 10), responses: 5, maxResponses: 10, reclaimed: true },
        now
      )
    ).toBe("reclaimed");
  });
});

describe("closesIn", () => {
  const now = 1_000_000;

  it("formats days and hours", () => {
    expect(closesIn(now + 86400 * 2 + 3600 * 4, now)).toBe("Closes in 2d 4h");
  });

  it("formats hours and minutes", () => {
    expect(closesIn(now + 3600 * 3 + 60 * 12, now)).toBe("Closes in 3h 12m");
  });

  it("formats minutes", () => {
    expect(closesIn(now + 60 * 25, now)).toBe("Closes in 25m");
  });

  it("formats seconds", () => {
    expect(closesIn(now + 42, now)).toBe("Closes in 42s");
  });

  it("returns Closed when past expiry", () => {
    expect(closesIn(now - 1, now)).toBe("Closed");
  });
});

describe("formatDuration", () => {
  it("formats days and hours", () => {
    expect(formatDuration(86400)).toBe("1 day");
    expect(formatDuration(86400 * 7)).toBe("7 days");
    expect(formatDuration(3600)).toBe("1 hour");
    expect(formatDuration(3600 * 6)).toBe("6 hours");
  });
});

describe("describeError", () => {
  it("describes contract errors clearly", () => {
    expect(describeError("AlreadyResponded()")).toBe("This wallet has already answered.");
    expect(describeError("Full()")).toBe("All paid responses are taken.");
    expect(describeError("Closed()")).toBe("This survey is closed.");
    expect(describeError("AskerCannotRespond()")).toBe(
      "The survey creator cannot respond to their own survey."
    );
    expect(describeError("WrongFunding(1000000000000000000)")).toBe("Fund exactly 1 BOT.");
    expect(describeError("BadQuestion()")).toBe("Question must be between 1 and 120 bytes.");
    expect(describeError("BadOptions()")).toBe("Options must contain 2 to 6 choices, each up to 32 bytes.");
    expect(describeError("BadReward()")).toBe("Reward per response must be greater than zero.");
    expect(describeError("BadResponses()")).toBe("Maximum responses must be between 1 and 1,000.");
    expect(describeError("BadDuration()")).toBe("Duration must be between 1 hour and 90 days.");
    expect(describeError("NotAsker()")).toBe("Only the survey creator can reclaim unspent funds.");
    expect(describeError("AlreadyReclaimed()")).toBe("Unspent funds have already been reclaimed.");
    expect(describeError("NotClosedOrFull()")).toBe(
      "Survey must be closed or full before unspent funds can be reclaimed."
    );
    expect(describeError("NothingToWithdraw()")).toBe("No pending funds available to withdraw.");
    expect(describeError("NoSuchSurvey()")).toBe("Survey does not exist.");
  });

  it("describes user rejection", () => {
    expect(describeError(new Error("User rejected the request."))).toBe(
      "Transaction was cancelled in wallet."
    );
  });
});

describe("logs parsing", () => {
  it("handles empty logs gracefully", () => {
    expect(parseCreatedEvents([])).toEqual([]);
    expect(parseRespondedEvents([])).toEqual([]);
    expect(parseReclaimedEvents([])).toEqual([]);
    expect(parseWithdrawnEvents([])).toEqual([]);
  });
});
