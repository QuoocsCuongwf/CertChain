import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

const root = resolve("data/experimental");
const names = (await readdir(root))
  .filter((name) => name.endsWith(".json") && name.startsWith("cert-"))
  .sort();
const records = [];

for (const name of names) {
  const file = await readFile(join(root, name));
  const hash = createHash("sha256").update(file).digest("hex");
  records.push({
    id: basename(name, ".json"),
    file: `data/experimental/${name}`,
    certHash: hash,
    statusBeforeChain: "ACTIVE",
    instruction: "issue_certificate",
  });
}

const tampered = await readFile(join(root, "tampered/cert-003-tampered.json"));
records.push({
  id: "cert-003-tampered",
  file: "data/experimental/tampered/cert-003-tampered.json",
  certHash: createHash("sha256").update(tampered).digest("hex"),
  statusBeforeChain: "TAMPERED",
  instruction: "must_not_issue",
});

const output = {
  generatedAt: new Date().toISOString(),
  programId: "bT4dCEPvh6HYQ7tZJT3KgVHfcx4Uc63oBv2mof1K3mm",
  pdaSeed: "certificate",
  records,
  revocationScenario: {
    id: "cert-002",
    issueFirst: true,
    then: "revoke_certificate",
    expectedStatus: "REVOKED",
  },
};

await writeFile(join(root, "manifest.json"), `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote ${records.length} experimental hashes to ${join(root, "manifest.json")}`);
