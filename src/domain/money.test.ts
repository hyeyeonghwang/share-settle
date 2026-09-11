import { describe, expect, it } from "vitest";
import { formatMoney, parseMoney, toInputValue } from "./money";

describe("money helpers", () => {
  it("keeps zero-decimal currencies in whole units", () => {
    expect(parseMoney("90,000", "KRW")).toBe(90_000);
    expect(formatMoney(90_000, "KRW")).toBe("₩90,000");
    expect(toInputValue(90_000, "KRW")).toBe("90000");
  });

  it("converts decimal currencies to and from minor units", () => {
    expect(parseMoney("$12.34", "USD")).toBe(1234);
    expect(formatMoney(1234, "USD")).toBe("$12.34");
    expect(toInputValue(1234, "USD")).toBe("12.34");
  });

  it("rejects invalid values and formats signed balances", () => {
    expect(parseMoney("twelve", "EUR")).toBeNull();
    expect(formatMoney(-2050, "EUR", { signed: true })).toBe("−€20.50");
    expect(formatMoney(2050, "EUR", { signed: true })).toBe("+€20.50");
  });
});