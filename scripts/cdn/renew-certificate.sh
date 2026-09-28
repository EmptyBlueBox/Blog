set -euo pipefail
umask 077
cdn_acme_state=$(mktemp -d)
trap 'rm -rf "$cdn_acme_state"' EXIT
cdn_domain=cdn.lyt0112.com
cdn_endpoints=(cdn.lyt0112.com.w.kunlunaq.com d1r52mz4kdo28t.cloudfront.net)
cdn_renew=false
for cdn_endpoint in "${cdn_endpoints[@]}"; do
  if timeout 30 openssl s_client -4 -connect "$cdn_endpoint:443" -servername "$cdn_domain" </dev/null 2>/dev/null | openssl x509 -out "$cdn_acme_state/current.pem"; then
    if openssl x509 -in "$cdn_acme_state/current.pem" -checkhost "$cdn_domain" -noout && openssl x509 -in "$cdn_acme_state/current.pem" -checkend 2592000 -noout; then
      continue
    fi
  fi
  cdn_renew=true
done
if ! "$cdn_renew"; then
  exit 0
fi
printf '%s\n' "$ACME_ACCOUNT_KEY" > "$cdn_acme_state/account.key"
cdn_acme=(bash .tmp/acme/acme.sh --home "$PWD/.tmp/acme" --config-home "$cdn_acme_state" --cert-home "$cdn_acme_state/certs" --accountkey "$cdn_acme_state/account.key" --server letsencrypt)
"${cdn_acme[@]}" --register-account -m lyt0112@outlook.com
"${cdn_acme[@]}" --issue --dns dns_dp --dnssleep 120 -d "$cdn_domain" --keylength ec-256
export DEPLOY_ALI_CDN_DOMAIN="$cdn_domain"
"${cdn_acme[@]}" --deploy -d "$cdn_domain" --ecc --deploy-hook ali_cdn
aws acm import-certificate \
  --certificate-arn "$CDN_CERTIFICATE_ARN" \
  --certificate "fileb://$cdn_acme_state/certs/${cdn_domain}_ecc/${cdn_domain}.cer" \
  --private-key "fileb://$cdn_acme_state/certs/${cdn_domain}_ecc/${cdn_domain}.key" \
  --certificate-chain "fileb://$cdn_acme_state/certs/${cdn_domain}_ecc/ca.cer"
cdn_expected=$(openssl x509 -in "$cdn_acme_state/certs/${cdn_domain}_ecc/${cdn_domain}.cer" -noout -fingerprint -sha256)
for cdn_attempt in {1..20}; do
  cdn_verified=true
  for cdn_endpoint in "${cdn_endpoints[@]}"; do
    cdn_actual=$(timeout 30 openssl s_client -4 -connect "$cdn_endpoint:443" -servername "$cdn_domain" </dev/null 2>/dev/null | openssl x509 -noout -fingerprint -sha256) || cdn_actual=
    if [[ "$cdn_actual" != "$cdn_expected" ]]; then
      cdn_verified=false
    fi
  done
  if "$cdn_verified"; then
    printf 'Certificate deployment verified for %s\n' "$cdn_domain"
    exit 0
  fi
  sleep 15
done
printf 'Certificate deployment verification failed for %s\n' "$cdn_domain" >&2
exit 1
