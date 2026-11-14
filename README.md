# CertChain

MVP theo báo cáo `lequoccuong_DACN.pdf`: Anchor program lưu một mỏ neo
SHA-256 tối giản trên Solana, còn ứng dụng Next.js xác minh tệp JSON/PDF trực
tiếp qua RPC. Dữ liệu cá nhân không được ghi lên chain.

## Thành phần

- `programs/certificate-registry`: `issue_certificate([u8; 32], Pubkey, [u8; 64])`
  khởi tạo PDA `[b"certificate", cert_hash]`, lưu ví người học và CID metadata;
  `revoke_certificate([u8; 32])` chỉ cho phép issuer ban đầu gọi.
- `app`: cổng tra cứu công khai; hash được tính bằng Web Crypto API, sau đó
  đọc `getProgramAccounts` và kiểm tra discriminator/hash/status.
- `data/experimental`: bộ dữ liệu giả lập theo các trường W3C VC trong báo cáo,
  gồm ca `ACTIVE`, `REVOKED` và tệp bị sửa `TAMPERED`.
- `lequoccuong_DACN.pdf`: báo cáo nguồn yêu cầu.

## Chạy localnet

Cần cài Solana CLI, Anchor 0.32.1 và Node.js. Từ thư mục gốc:

```bash
solana-test-validator
solana config set --url localhost
anchor build
anchor deploy
npm install --prefix app
NEXT_PUBLIC_SOLANA_RPC_URL=http://127.0.0.1:8899 npm run dev --prefix app
```

Mở `http://localhost:3000`. Frontend có ba tab: xác thực công khai, issuer dashboard (cấp/thu hồi bằng ví)
và sinh viên (xem các account gắn với ví hiện tại). Metadata được tạo dưới
dạng mock-IPFS CID để demo; khi dùng IPFS thật cần thay lớp mock bằng dịch vụ
pinning và không đưa dữ liệu cá nhân nhạy cảm lên chain.

## Kiểm tra

```bash
cargo check -p certificate-registry
npm run build --prefix app
```

`cargo check` có thể in cảnh báo `unexpected cfg` từ macro Anchor 0.32; đây
là cảnh báo upstream, không phải lỗi biên dịch của chương trình.

## Dữ liệu thực nghiệm

Tạo lại manifest hash SHA-256:

```bash
npm run data:hash
```

Manifest sinh tại `data/experimental/manifest.json`. Cấp phát ba tệp
`cert-001-active.json`, `cert-002-revoked.json` và `cert-003-original.json`
bằng `issue_certificate`. Sau đó gọi `revoke_certificate` cho `cert-002`.
Khi tải `data/experimental/tampered/cert-003-tampered.json` lên cổng tra cứu,
kết quả kỳ vọng là không tìm thấy bản ghi vì hash đã thay đổi.
