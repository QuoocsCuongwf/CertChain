import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const { Connection, PublicKey } = require("../app/node_modules/@solana/web3.js");

const rpcUrl = process.env.RPC_URL ?? "http://127.0.0.1:8899";
const resultPath = resolve(process.env.RESULT ?? "data/benchmark-results/issuance-1793673613832.json");
const connection = new Connection(rpcUrl, "confirmed");
const result = JSON.parse(await readFile(resultPath, "utf8"));
const accountSize = 178;
const rentLamports = await connection.getMinimumBalanceForRentExemption(accountSize);
const confirmed = result.results.filter(({ status, signature }) => status === "confirmed" && signature);
const costs = [];

for (const item of confirmed) {
  const transaction = await connection.getTransaction(item.signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  costs.push({
    id: item.id,
    signature: item.signature,
    feeLamports: transaction?.meta?.fee ?? null,
    rentLamports,
    totalLamports: transaction?.meta?.fee == null ? null : transaction.meta.fee + rentLamports,
  });
}

const fees = costs.flatMap(({ feeLamports }) => feeLamports == null ? [] : [feeLamports]);
const totalFees = fees.reduce((sum, fee) => sum + fee, 0);
const totalRent = rentLamports * confirmed.length;
const summary = {
  rpcUrl,
  source: resultPath,
  accountSizeBytes: accountSize,
  confirmed: confirmed.length,
  rentExemptPerCertificateLamports: rentLamports,
  rentExemptPerCertificateSol: rentLamports / 1e9,
  totalTransactionFeesLamports: totalFees,
  totalTransactionFeesSol: totalFees / 1e9,
  totalRentLamports: totalRent,
  totalRentSol: totalRent / 1e9,
  totalCostLamports: totalFees + totalRent,
  totalCostSol: (totalFees + totalRent) / 1e9,
  averageTransactionFeeLamports: fees.length ? totalFees / fees.length : null,
  averageCostPerCertificateLamports: confirmed.length
    ? (totalFees + totalRent) / confirmed.length
    : null,
  costs,
};

const outputPath = resolve(dirname(resultPath), `${basename(resultPath, ".json")}-cost.json`);
await writeFile(outputPath, `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify({ ...summary, costs: undefined, outputPath }, null, 2));
