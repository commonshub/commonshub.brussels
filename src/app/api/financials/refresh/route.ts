import { NextResponse } from "next/server";
import { warmupTransactionCache } from "@/lib/transaction-cache";

export async function POST() {
  try {
    // Directly call the warmup function
    const accountData = await warmupTransactionCache({
      stripeSecretKey: process.env.STRIPE_SECRET_KEY,
      etherscanApiKey: process.env.ETHERSCAN_API_KEY,
    });

    return NextResponse.json({
      success: true,
      message: "Transactions refreshed successfully",
      accountsProcessed: accountData.length,
      accounts: accountData,
    });
  } catch (error: any) {
    console.error("Error refreshing transactions:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to refresh transactions",
      },
      { status: 500 }
    );
  }
}
