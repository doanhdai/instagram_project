#!/usr/bin/env bash
# Tạo/cập nhật Secret `instagram-secrets` từ file .env ở thư mục gốc dự án.
# Yêu cầu: kubectl đã trỏ tới cluster đích.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"
NAMESPACE="${NAMESPACE:-instagram}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Không tìm thấy $ENV_FILE. Hãy tạo file .env trước (xem README.md)." >&2
  exit 1
fi

# Đọc biến từ .env mà không cần source (tránh lỗi với giá trị có ký tự đặc biệt)
get_env() {
  local key="$1" default="${2:-}"
  local value
  value="$(grep -E "^[[:space:]]*${key}=" "$ENV_FILE" | tail -n 1 | cut -d= -f2- || true)"
  # Bỏ dấu nháy bao quanh nếu có
  value="${value%\"}"; value="${value#\"}"
  value="${value%\'}"; value="${value#\'}"
  if [[ -z "$value" ]]; then
    printf '%s' "$default"
  else
    printf '%s' "$value"
  fi
}

JWT_SECRET="$(get_env JWT_BASE64_SECRET)"
if [[ -z "$JWT_SECRET" ]]; then
  echo "JWT_BASE64_SECRET đang trống trong $ENV_FILE" >&2
  exit 1
fi

kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

kubectl -n "$NAMESPACE" create secret generic instagram-secrets \
  --from-literal=DB_ROOT_PASSWORD="$(get_env DB_ROOT_PASSWORD rootpassword)" \
  --from-literal=DB_PASSWORD="$(get_env DB_PASSWORD instagram_pass)" \
  --from-literal=JWT_BASE64_SECRET="$JWT_SECRET" \
  --from-literal=GEMINI_API_KEY="$(get_env GEMINI_API_KEY)" \
  --from-literal=ACCESS_KEY="$(get_env ACCESS_KEY test)" \
  --from-literal=SECRET_KEY="$(get_env SECRET_KEY test)" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "Đã tạo/cập nhật Secret instagram-secrets trong namespace $NAMESPACE."
