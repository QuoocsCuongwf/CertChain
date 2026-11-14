import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { homedir } from "node:os";

const require = createRequire(import.meta.url);
const anchor = require("../app/node_modules/@coral-xyz/anchor");
const { Keypair, PublicKey, SystemProgram } = anchor.web3;

const rpcUrl = process.env.RPC_URL ?? "http://127.0.0.1:8899";
const walletValue = process.env.WALLET ?? "~/.config/solana/id.json";
const walletPath = resolve(walletValue.replace(/^~/, homedir()));
const inputDir = resolve(process.env.INPUT_DIR ?? "data/benchmark-300");
const count = Number.parseInt(process.env.COUNT ?? "300", 10);
const programId = new PublicKey("BcKXZDdJ2M6oWy73Kve4VCGrhPsFqBN1rLZagVmkPKb6");

if (!Number.isInteger(count) || count < 1) throw new Error("COUNT must be a positive integer.");

const keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(await readFile(walletPath, "utf8"))));
const connection = new anchor.web3.Connection(rpcUrl, "confirmed");
const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(keypair), {
  commitment: "confirmed",
});
const idl = JSON.parse(await readFile(resolve("target/idl/certificate_registry.json"), "utf8"));
const program = new anchor.Program(idl, provider);
const names = (await readdir(inputDir))
  .filter((name) => name.endsWith(".json") && name.startsWith("cert-"))
  .sort()
  .slice(0, count);

if (names.length < count) {
  throw new Error(`Requested ${count} files, but only found ${names.length} in ${inputDir}.`);
}

const results = [];
for (const name of names) {
  const file = await readFile(join(inputDir, name));
  const certHash = createHash("sha256").update(file).digest();
  const metadataCid = Buffer.concat([certHash, Buffer.alloc(32)]);
  const [certificate] = PublicKey.findProgramAddressSync(
    [Buffer.from("certificate"), certHash],
    programId,
  );
  const startedAt = performance.now();

  try {
    const signature = await program.methods
      .issueCertificate([...certHash], keypair.publicKey, [...metadataCid])
      .accounts({
        certificate,
        issuer: keypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    results.push({
      id: basename(name, ".json"),
      signature,
      status: "confirmed",
      latencyMs: Math.round(performance.now() - startedAt),
    });
  } catch (error) {
    results.push({
      id: basename(name, ".json"),
      status: "failed",
      latencyMs: Math.round(performance.now() - startedAt),
      error: error instanceof Error ? error.message : String(error),
    });
  }
  process.stdout.write(`\rProcessed ${results.length}/${names.length}`);
}
process.stdout.write("\n");

const successful = results.filter(({ status }) => status === "confirmed");
const latencies = successful.map(({ latencyMs }) => latencyMs).sort((a, b) => a - b);
const percentile = (value) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * value))] ?? null;
const totalMs = results.reduce((sum, result) => sum + result.latencyMs, 0);
const summary = {
  rpcUrl,
  wallet: keypair.publicKey.toBase58(),
  requested: names.length,
  confirmed: successful.length,
  failed: results.length - successful.length,
  successRate: successful.length / names.length,
  totalWallTimeMs: totalMs,
  averageLatencyMs: latencies.length
    ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length)
    : null,
  p50LatencyMs: percentile(0.5),
  p95LatencyMs: percentile(0.95),
  tps: totalMs ? Number((successful.length / (totalMs / 1000)).toFixed(3)) : 0,
  results,
};

const outputDir = resolve("data/benchmark-results");
await mkdir(outputDir, { recursive: true });
const timestamp = Date.now();
const outputPath = join(outputDir, `issuance-${timestamp}.json`);
await writeFile(outputPath, `${JSON.stringify(summary, null, 2)}\n`);

const chartWidth = 1000;
const chartHeight = 360;
const chartPadding = 48;
const maxLatency = Math.max(...results.map(({ latencyMs }) => latencyMs), 1);
const x = (index) => chartPadding + (index / Math.max(results.length - 1, 1)) * (chartWidth - chartPadding * 2);
const y = (latency) => chartHeight - chartPadding - (latency / maxLatency) * (chartHeight - chartPadding * 2);
const points = results.map(({ latencyMs }, index) => `${x(index)},${y(latencyMs)}`).join(" ");
const p50Y = y(summary.p50LatencyMs ?? 0);
const p95Y = y(summary.p95LatencyMs ?? 0);
const chart = `
<svg viewBox="0 0 ${chartWidth} ${chartHeight}" role="img" aria-label="Request latency chart">
  <rect width="100%" height="100%" fill="#fff"/>
  <line x1="${chartPadding}" y1="${chartPadding}" x2="${chartPadding}" y2="${chartHeight - chartPadding}" stroke="#cbd5e1"/>
  <line x1="${chartPadding}" y1="${chartHeight - chartPadding}" x2="${chartWidth - chartPadding}" y2="${chartHeight - chartPadding}" stroke="#cbd5e1"/>
  <line x1="${chartPadding}" y1="${p50Y}" x2="${chartWidth - chartPadding}" y2="${p50Y}" stroke="#2563eb" stroke-dasharray="6 4"/>
  <line x1="${chartPadding}" y1="${p95Y}" x2="${chartWidth - chartPadding}" y2="${p95Y}" stroke="#dc2626" stroke-dasharray="6 4"/>
  <polyline points="${points}" fill="none" stroke="#15803d" stroke-width="2"/>
  <text x="${chartPadding + 8}" y="${p50Y - 6}" fill="#2563eb">p50: ${summary.p50LatencyMs ?? "n/a"} ms</text>
  <text x="${chartPadding + 8}" y="${p95Y - 6}" fill="#dc2626">p95: ${summary.p95LatencyMs ?? "n/a"} ms</text>
  <text x="${chartPadding}" y="${chartHeight - 12}" fill="#475569">Request 1</text>
  <text x="${chartWidth - chartPadding - 72}" y="${chartHeight - 12}" fill="#475569">Request ${results.length}</text>
</svg>`;
const chartPath = join(outputDir, `issuance-${timestamp}.html`);
await writeFile(chartPath, `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Issuance benchmark</title>
<style>body{font:16px system-ui;margin:2rem;color:#172033}main{max-width:1100px;margin:auto}svg{width:100%;border:1px solid #e2e8f0;border-radius:8px}.metrics{display:flex;gap:1rem;flex-wrap:wrap}.metric{padding:1rem;background:#f1f5f9;border-radius:8px}</style>
</head><body><main><h1>Certificate issuance benchmark</h1>
<div class="metrics">
<div class="metric"><b>Requests</b><br>${summary.requested}</div>
<div class="metric"><b>Success rate</b><br>${(summary.successRate * 100).toFixed(2)}%</div>
<div class="metric"><b>TPS</b><br>${summary.tps}</div>
<div class="metric"><b>Average</b><br>${summary.averageLatencyMs ?? "n/a"} ms</div>
</div>${chart}</main></body></html>`);
console.log(JSON.stringify({ ...summary, results: undefined, outputPath, chartPath }, null, 2));
