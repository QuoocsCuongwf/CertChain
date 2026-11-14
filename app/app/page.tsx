"use client";

import { useMemo, useState } from "react";
import { AnchorProvider, Program, web3 } from "@coral-xyz/anchor";
import type { Idl } from "@coral-xyz/anchor";
type AnchorWallet = ConstructorParameters<typeof AnchorProvider>[1];
type CertificateData = {
  certHash: number[];
  student: web3.PublicKey;
  status: number;
};

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "http://127.0.0.1:8899";
const PROGRAM_ID = new web3.PublicKey("BcKXZDdJ2M6oWy73Kve4VCGrhPsFqBN1rLZagVmkPKb6");
const SYSTEM_PROGRAM = web3.SystemProgram.programId;

declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean;
      publicKey?: web3.PublicKey;
      connect: () => Promise<{ publicKey: web3.PublicKey }>;
      signTransaction: (transaction: web3.Transaction) => Promise<web3.Transaction>;
      signAllTransactions: (transactions: web3.Transaction[]) => Promise<web3.Transaction[]>;
    };
  }
}

const IDL = {
  address: PROGRAM_ID.toBase58(),
  metadata: { name: "certificate_registry", version: "0.1.0", spec: "0.1.0" },
  instructions: [
    { name: "issueCertificate", discriminator: [61, 197, 55, 28, 159, 18, 132, 128], accounts: [
      { name: "certificate", writable: true, signer: false },
      { name: "issuer", writable: true, signer: true },
      { name: "systemProgram", writable: false, signer: false },
    ], args: [
      { name: "certHash", type: { array: ["u8", 32] } },
      { name: "student", type: "pubkey" },
      { name: "metadataCid", type: { array: ["u8", 64] } },
    ] },
    { name: "revokeCertificate", discriminator: [236, 5, 130, 119, 9, 164, 130, 122], accounts: [
      { name: "certificate", writable: true, signer: false },
      { name: "issuer", writable: false, signer: true },
    ], args: [{ name: "certHash", type: { array: ["u8", 32] } }] },
  ],
  accounts: [{ name: "certificateAccount", discriminator: [9, 141, 26, 14, 246, 14, 202, 133] }],
  types: [{
    name: "certificateAccount",
    type: { kind: "struct", fields: [
      { name: "certHash", type: { array: ["u8", 32] } },
      { name: "issuer", type: "pubkey" },
      { name: "student", type: "pubkey" },
      { name: "metadataCid", type: { array: ["u8", 64] } },
      { name: "status", type: "u8" },
      { name: "createdAt", type: "i64" },
      { name: "bump", type: "u8" },
    ] },
  }],
  errors: [],
} as unknown as Idl;

function getWallet(address: string): AnchorWallet {
  const provider = window.solana;
  if (!provider?.signTransaction || !provider.signAllTransactions) {
    throw new Error("Hãy kết nối ví trước.");
  }
  return {
    publicKey: new web3.PublicKey(address),
    signTransaction: provider.signTransaction as AnchorWallet["signTransaction"],
    signAllTransactions: provider.signAllTransactions as AnchorWallet["signAllTransactions"],
  };
}

function getProgram(address: string) {
  const connection = new web3.Connection(RPC_URL, "confirmed");
  return new Program(IDL, new AnchorProvider(connection, getWallet(address), { commitment: "confirmed" }));
}

async function sha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bytes(hex: string, length: number) {
  const output = Array.from({ length }, () => 0);
  hex.match(/.{2}/g)?.slice(0, length).forEach((part, index) => { output[index] = Number.parseInt(part, 16); });
  return output;
}

function utf8Bytes(value: string, length: number) {
  const encoded = new TextEncoder().encode(value);
  if (encoded.length > length) throw new Error(`Metadata CID không được dài quá ${length} byte.`);
  return [...encoded, ...Array.from({ length: length - encoded.length }, () => 0)];
}

export default function Home() {
  const [tab, setTab] = useState<"verify" | "issuer" | "student">("verify");
  const [wallet, setWallet] = useState("");
  const [message, setMessage] = useState("");
  const [hash, setHash] = useState("");
  const [student, setStudent] = useState("");
  const [studentName, setStudentName] = useState("");
  const [course, setCourse] = useState("");
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [revokeHash, setRevokeHash] = useState("");
  const [records, setRecords] = useState<Array<{ hash: string; student: string; status: string }>>([]);

  const connected = useMemo(() => Boolean(wallet), [wallet]);

  async function connect() {
    if (!window.solana) { setMessage("Chưa tìm thấy ví tương thích (Phantom/Solflare)."); return; }
    const result = await window.solana.connect();
    setWallet(result.publicKey.toBase58());
    setMessage("Đã kết nối ví.");
  }

  async function verify(file: File) {
    setMessage("Đang đối soát…");
    try {
      const nextHash = await sha256(file);
      setHash(nextHash);
      const connection = new web3.Connection(RPC_URL, "confirmed");
      const accounts = await connection.getProgramAccounts(PROGRAM_ID);
      const account = accounts.find(({ account }) => bytes(nextHash, 32).every((value, index) => account.data[index + 8] === value));
      setMessage(account ? "Chứng chỉ nguyên bản, có bản ghi trên localnet." : "Không tìm thấy bản ghi: file có thể bị sửa hoặc chưa được cấp.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Không thể xác minh."); }
  }

  async function issue(event: React.FormEvent) {
    event.preventDefault();
    try {
      if (!certificateFile) throw new Error("Hãy chọn file chứng chỉ cần cấp.");
      const certHash = bytes(await sha256(certificateFile), 32);
      const metadata = JSON.stringify({ studentName, course, student, createdAt: new Date().toISOString() });
      const metadataHash = await sha256(new File([metadata], "metadata.json"));
      const cid = metadataHash;
      const studentKey = new web3.PublicKey(student);
      const [certificate] = web3.PublicKey.findProgramAddressSync([Buffer.from("certificate"), Buffer.from(certHash)], PROGRAM_ID);
      await getProgram(wallet).methods.issueCertificate(certHash, studentKey, utf8Bytes(cid, 64))
        .accounts({ certificate, issuer: new web3.PublicKey(wallet), systemProgram: SYSTEM_PROGRAM }).rpc();
      localStorage.setItem(`certchain:${cid}`, metadata);
      setMessage(`Đã cấp chứng chỉ. Mock CID: ${cid}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Không thể cấp chứng chỉ."); }
  }

  async function loadStudentRecords() {
    try {
      const connection = new web3.Connection(RPC_URL, "confirmed");
      const studentKey = new web3.PublicKey(wallet);
      const accounts = await connection.getProgramAccounts(PROGRAM_ID);
      const accountSize = 8 + 32 + 32 + 32 + 64 + 1 + 8 + 1;
      const result = accounts.flatMap(({ account }) => {
        if (account.data.length !== accountSize) return [];
        const data = account.data;
        const studentOffset = 8 + 32 + 32;
        const accountStudent = new web3.PublicKey(data.subarray(studentOffset, studentOffset + 32));
        if (!accountStudent.equals(studentKey)) return [];
        return [{
          hash: data.subarray(8, 8 + 32).toString("hex"),
          student: accountStudent.toBase58(),
          status: data[8 + 32 + 32 + 32 + 64] === 1 ? "REVOKED" : "ACTIVE",
        }];
      });
      setRecords(result);
      setMessage("Đã tải các chứng chỉ của ví hiện tại.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Không thể tải chứng chỉ."); }
  }

  async function revoke(event: React.FormEvent) {
    event.preventDefault();
    try {
      if (!/^[0-9a-f]{64}$/i.test(revokeHash)) throw new Error("Hash phải gồm đúng 64 ký tự hex.");
      const certHash = bytes(revokeHash, 32);
      const [certificate] = web3.PublicKey.findProgramAddressSync([Buffer.from("certificate"), Buffer.from(certHash)], PROGRAM_ID);
      await getProgram(wallet).methods.revokeCertificate(certHash)
        .accounts({ certificate, issuer: new web3.PublicKey(wallet) }).rpc();
      setMessage("Đã thu hồi chứng chỉ trên localnet.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Không thể thu hồi chứng chỉ."); }
  }

  return (
    <main className="shell">
      <header className="topbar"><div className="brand"><div className="brand-mark">C</div><div><strong>CertChain</strong><small>Certificate registry</small></div></div><div className="top-actions"><span className="network"><i /> Localnet</span><button className="wallet-button" onClick={connect}>{connected ? `${wallet.slice(0, 4)}…${wallet.slice(-4)}` : "Kết nối ví"}</button></div></header>
      {connected && <nav className="tabs">{(["verify", "issuer", "student"] as const).map((name) => <button className={tab === name ? "active" : ""} onClick={() => { setTab(name); setMessage(""); }} key={name}>{name === "verify" ? "Tra cứu" : name === "issuer" ? "Đơn vị cấp" : "Sinh viên"}</button>)}</nav>}
      <section className="page-intro"><p className="eyebrow">{tab === "verify" ? "XÁC THỰC CÔNG KHAI" : tab === "issuer" ? "KHÔNG GIAN ĐƠN VỊ CẤP" : "KHÔNG GIAN SINH VIÊN"}</p><h1>{tab === "verify" ? <>Xác thực văn bằng<br /><span>không cần niềm tin.</span></> : tab === "issuer" ? <>Quản lý<br /><span>chứng chỉ.</span></> : <>Hồ sơ<br /><span>của bạn.</span></>}</h1><p className="lede">{tab === "verify" ? "Đối soát SHA-256 của chứng chỉ với mỏ neo bất biến trên Solana." : tab === "issuer" ? "Cấp và thu hồi chứng chỉ bằng chữ ký ví của đơn vị phát hành." : "Xem các chứng chỉ được gắn với địa chỉ ví của bạn."}</p></section>
      <section className="card">
        {tab === "verify" && <><div className="card-heading"><div><p className="eyebrow">TRA CỨU KHÔNG CẦN VÍ</p><h2>Kiểm tra chứng chỉ</h2></div><span className="pill">SHA-256</span></div><label className="dropzone" htmlFor="certificate"><span className="upload-icon">↑</span><strong>Chọn tệp JSON hoặc PDF</strong><small>Hash được tính ngay trong trình duyệt</small><input id="certificate" type="file" accept=".json,.pdf,application/json,application/pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) void verify(file); }} /></label></>}
        {tab === "issuer" && <><div className="card-heading"><div><p className="eyebrow">ISSUER CONSOLE</p><h2>Vòng đời chứng chỉ</h2></div><span className="pill">{connected ? "ĐÃ KẾT NỐI" : "CẦN KẾT NỐI VÍ"}</span></div><div className="action-grid"><div className="action-panel"><span className="panel-icon">＋</span><h3>Cấp chứng chỉ</h3><p>Ghi hash file và ví sinh viên lên localnet.</p><form onSubmit={issue} className="form"><input required type="file" accept=".json,.pdf,application/json,application/pdf" onChange={(event) => setCertificateFile(event.target.files?.[0] ?? null)} /><input required placeholder="Tên sinh viên" value={studentName} onChange={(event) => setStudentName(event.target.value)} /><input required placeholder="Khoá học / văn bằng" value={course} onChange={(event) => setCourse(event.target.value)} /><input required placeholder="Địa chỉ ví sinh viên" value={student} onChange={(event) => setStudent(event.target.value)} /><button type="submit" disabled={!connected}>Ký và cấp chứng chỉ</button></form></div><div className="action-panel danger"><span className="panel-icon">−</span><h3>Thu hồi chứng chỉ</h3><p>Chỉ issuer gốc mới có quyền thực hiện.</p><form onSubmit={revoke} className="form"><input required placeholder="SHA-256 (64 ký tự)" value={revokeHash} onChange={(event) => setRevokeHash(event.target.value)} /><button type="submit" disabled={!connected}>Ký và thu hồi</button></form></div></div><small>Metadata được tạo dưới dạng mock-IPFS CID; file gốc không được đưa lên chain.</small></>}
        {tab === "student" && <><div className="card-heading"><div><p className="eyebrow">MY CREDENTIALS</p><h2>Chứng chỉ của tôi</h2></div><span className="pill">{records.length} BẢN GHI</span></div><div className="student-callout"><span className="panel-icon">◎</span><div><strong>Danh tính ví</strong><code>{connected ? wallet : "Kết nối ví để xem hồ sơ"}</code></div></div><button className="primary-button" onClick={() => void loadStudentRecords()} disabled={!connected}>Tải chứng chỉ của tôi</button>{records.map((record) => <div className="record" key={record.hash}><strong>{record.status}</strong><code>{record.hash}</code></div>)}</>}
        {message && <div className={`result ${message.includes("Không") || message.includes("không") ? "error" : ""}`}><strong>{message}</strong>{hash && <code>{hash}</code>}</div>}
      </section>
      <footer><span>W3C VC 2.0 · SHA-256 · mock-IPFS</span><span>RPC: {RPC_URL}</span></footer>
    </main>
  );
}
