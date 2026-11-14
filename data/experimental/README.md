# Bộ dữ liệu thực nghiệm

Bộ dữ liệu này mô phỏng ba tình huống trong báo cáo:

| Mã | Tình huống | Kỳ vọng |
|---|---|---|
| `CERT-001` | Văn bằng nguyên bản, đang hiệu lực | `ACTIVE` |
| `CERT-002` | Văn bằng nguyên bản, sau đó bị thu hồi trên chuỗi | `REVOKED` |
| `CERT-003` | Tệp bị thay đổi sau khi cấp | `TAMPERED` / không khớp hash |

Toàn bộ thông tin người học là dữ liệu giả lập, không phải dữ liệu cá nhân
thật. Các tệp JSON được định dạng ổn định bằng hai khoảng trắng; không sửa
định dạng sau khi đã cấp phát nếu muốn giữ nguyên `cert_hash`.

## Tạo hash và PDA

```bash
node scripts/hash-experimental-data.mjs
```

Lệnh ghi kết quả vào `data/experimental/manifest.json`. Có thể dùng
`manifest.json` làm đầu vào cho script cấp phát Anchor:

```text
issue_certificate(cert_hash)
PDA = findProgramAddress(["certificate", cert_hash], programId)
```

`tampered/cert-003-tampered.json` cố ý thay đổi `classification` từ `Khá`
sang `Xuất sắc`; không được cấp phát tệp này lên chuỗi.
