/**
 * @jest-environment node
 */
import { onchainParties, ZERO_ADDRESS } from "@/lib/financials";

const SAVINGS = "0xb01ccce2d75d517ee520de31eae6afca735aadc1";
const SENDER = "0x2cff890f0378a11913b6129b2e97417a2c302680";
const EURE = "0x420ca0f9b9b604ce0fd9c18ef134c705e5fa3430";

describe("onchainParties", () => {
  test("incoming transfer: sender is the counterparty, not our own account", () => {
    const tx = { type: "CREDIT" as const, counterpartyId: `ethereum:100:address:${SENDER}` };
    expect(onchainParties(tx, SAVINGS, "in")).toEqual({ from: SENDER, to: SAVINGS });
  });

  test("outgoing transfer: recipient is the counterparty", () => {
    const tx = { type: "DEBIT" as const, counterpartyId: `ethereum:100:address:${SENDER}` };
    expect(onchainParties(tx, SAVINGS, "out")).toEqual({ from: SAVINGS, to: SENDER });
  });

  test("mint/burn: the token contract is not shown as the counterparty", () => {
    const tokenCp = `ethereum:100:token:${EURE}`;
    expect(onchainParties({ type: "MINT", counterpartyId: tokenCp }, SAVINGS, "in")).toEqual({
      from: ZERO_ADDRESS,
      to: SAVINGS,
    });
    expect(onchainParties({ type: "BURN", counterpartyId: tokenCp }, SAVINGS, "out")).toEqual({
      from: SAVINGS,
      to: ZERO_ADDRESS,
    });
  });

  test("missing counterparty stays undefined", () => {
    expect(onchainParties({ type: "CREDIT", counterpartyId: null }, SAVINGS, "in")).toEqual({
      from: undefined,
      to: SAVINGS,
    });
  });
});
