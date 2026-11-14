import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const outputDir = resolve("data/benchmark-300");
const issuer = "solana:pubkey:BcKXZDdJ2M6oWy73Kve4VCGrhPsFqBN1rLZagVmkPKb6";
const firstNames = ["An", "Binh", "Chi", "Dung", "Giang", "Ha", "Khanh", "Linh", "Minh", "Ngoc"];
const lastNames = ["Nguyen", "Tran", "Le", "Pham", "Vo", "Dang", "Bui", "Do", "Ho", "Phan"];

await mkdir(outputDir, { recursive: true });

for (let index = 1; index <= 300; index += 1) {
  const number = String(index).padStart(4, "0");
  const date = `2026-${String(((index - 1) % 12) + 1).padStart(2, "0")}-15`;
  const fullName = `${lastNames[(index - 1) % lastNames.length]} ${firstNames[(index - 1) % firstNames.length]}`;
  const certificate = {
    "@context": [
      "https://www.w3.org/2018/credentials/v1",
      "https://schema.org",
    ],
    id: `urn:uuid:certchain-benchmark-${number}`,
    type: ["VerifiableCredential", "UniversityDegreeCredential"],
    issuer,
    issuanceDate: `${date}T08:00:00Z`,
    credentialSubject: {
      id: `urn:citizen:BENCH-${number}`,
      fullName,
      dateOfBirth: `200${index % 10}-05-15`,
      placeOfBirth: "Test Province",
      gender: index % 2 === 0 ? "Nu" : "Nam",
      ethnicity: "Kinh",
      nationality: "Viet Nam",
      degreeName: "Bang Cu nhan",
      major: "Cong nghe Thong tin",
      classification: index % 3 === 0 ? "Kha" : "Gioi",
      diplomaNumber: `BENCH-2026-${number}`,
      registerNumber: `BENCH-${number}/2026`,
      decisionNumber: `BENCH-${number}/QD`,
      signDate: date,
      signerTitle: "Hieu truong",
      signerName: "Test Signer",
    },
    evidence: {
      pdfFile: `benchmark-${number}.pdf`,
      ipfsCid: `benchmark-cid-${number}`,
    },
    proof: {
      type: "Ed25519Signature2020",
      created: `${date}T08:05:00Z`,
      verificationMethod: `${issuer}#key-1`,
      proofPurpose: "assertionMethod",
      proofValue: `TEST_SIGNATURE_BENCHMARK_${number}`,
    },
  };
  await writeFile(
    join(outputDir, `cert-${number}.json`),
    `${JSON.stringify(certificate, null, 2)}\n`,
  );
}

console.log(`Generated 300 benchmark certificates in ${outputDir}`);
