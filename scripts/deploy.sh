#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<EOF
Deploy the YouTube Grave Robber stack via AWS SAM.

Usage:
  $(basename "$0") [options]

Options:
  --stack-name NAME           CloudFormation stack name (default: yt-grave-robber or $STACK_NAME)
  --region REGION             AWS region (default: env AWS_REGION or us-east-1)
  --profile PROFILE           AWS profile (default: env AWS_PROFILE)
  --allowed-origin ORIGIN     CORS allowed origin (default: http://localhost:5500)
  --secret-arn ARN            Secrets Manager ARN containing SecretString key YT_API_KEYS (required)
  --frontend-dir DIR          Path to static assets to upload (default: client/src)
  --no-sync-frontend          Skip S3 sync of frontend files
  --no-invalidate             Skip CloudFront invalidation
  --no-container              Build without Docker (local esbuild)
  -h, --help                  Show this help

Environment overrides:
  STACK_NAME, AWS_REGION, AWS_PROFILE, ALLOWED_ORIGIN, YT_SECRET_ARN,
  FRONTEND_DIR, SYNC_FRONTEND=true|false, INVALIDATE_CF=true|false.
EOF
}

# Defaults from env with sensible fallbacks
STACK_NAME=${STACK_NAME:-yt-grave-robber}
REGION=${AWS_REGION:-us-east-1}
PROFILE=${AWS_PROFILE:-}
ALLOWED_ORIGIN=${ALLOWED_ORIGIN:-http://localhost:5500}
SECRET_ARN=${YT_SECRET_ARN:-}
FRONTEND_DIR=${FRONTEND_DIR:-client/src}
SYNC_FRONTEND=${SYNC_FRONTEND:-true}
INVALIDATE_CF=${INVALIDATE_CF:-true}
USE_CONTAINER=${USE_CONTAINER:-true}

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --stack-name)
      STACK_NAME="$2"; shift 2;;
    --stack-name=*)
      STACK_NAME="${1#*=}"; shift;;
    --region)
      REGION="$2"; shift 2;;
    --region=*)
      REGION="${1#*=}"; shift;;
    --profile)
      PROFILE="$2"; shift 2;;
    --profile=*)
      PROFILE="${1#*=}"; shift;;
    --allowed-origin)
      ALLOWED_ORIGIN="$2"; shift 2;;
    --allowed-origin=*)
      ALLOWED_ORIGIN="${1#*=}"; shift;;
    --secret-arn)
      SECRET_ARN="$2"; shift 2;;
    --secret-arn=*)
      SECRET_ARN="${1#*=}"; shift;;
    --frontend-dir)
      FRONTEND_DIR="$2"; shift 2;;
    --frontend-dir=*)
      FRONTEND_DIR="${1#*=}"; shift;;
    --no-sync-frontend)
      SYNC_FRONTEND=false; shift;;
    --no-invalidate)
      INVALIDATE_CF=false; shift;;
    --no-container)
      USE_CONTAINER=false; shift;;
    -h|--help)
      usage; exit 0;;
    *)
      echo "Unknown option: $1" >&2; usage; exit 2;;
  esac
done

export AWS_REGION="$REGION"
if [[ -n "$PROFILE" ]]; then
  export AWS_PROFILE="$PROFILE"
fi

# Checks
need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing dependency: $1" >&2; exit 1; }; }
need aws
need sam

if [[ -z "$SECRET_ARN" ]]; then
  echo "Error: --secret-arn or env YT_SECRET_ARN is required (must contain SecretString key YT_API_KEYS)." >&2
  exit 1
fi

echo "== Context =="
echo "Stack:        $STACK_NAME"
echo "Region:       $REGION"
echo "Profile:      ${AWS_PROFILE:-<none>}"
echo "AllowedOrigin:$ALLOWED_ORIGIN"
echo "Secret ARN:   $SECRET_ARN"
echo "Frontend dir: $FRONTEND_DIR (sync=$SYNC_FRONTEND)"
echo "Invalidate CF:$INVALIDATE_CF"

echo "\nChecking AWS identity..."
aws sts get-caller-identity >/dev/null || {
  echo "AWS credentials not configured. Try: aws sso login --profile <profile>" >&2
  exit 1
}

# Ensure local esbuild available when building without container
if [[ "$USE_CONTAINER" == "false" ]]; then
  echo "\nEnsuring local dependencies (including esbuild) are installed in workspace..."
  npm -w server install --no-audit --no-fund >/dev/null
fi

echo "\nValidating template.yaml..."
sam validate --lint --template template.yaml

if [[ ! -f server/src/index.js ]]; then
  echo "Error: expected file server/src/index.js not found. Check your working copy." >&2
  exit 1
fi

if [[ "$USE_CONTAINER" == "true" ]]; then
  echo "\nBuilding (containerized)..."
  sam build --template template.yaml --use-container
else
  echo "\nBuilding (local, no container)..."
  sam build --template template.yaml
fi

echo "\nDeploying stack $STACK_NAME..."
sam deploy \
  --stack-name "$STACK_NAME" \
  --resolve-s3 \
  --no-confirm-changeset \
  --capabilities CAPABILITY_IAM \
  --region "$REGION" \
  --parameter-overrides \
    AllowedOrigin="$ALLOWED_ORIGIN" \
    YtKeySecretArn="$SECRET_ARN"

echo "\nFetching outputs..."
API_URL=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text || true)
FRONTEND_BUCKET=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" --output text || true)
CF_DOMAIN=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='CloudFrontURL'].OutputValue" --output text || true)
echo "API URL:        ${API_URL:-<none>}"
echo "Frontend bucket: ${FRONTEND_BUCKET:-<none>}"
echo "CloudFront URL: ${CF_DOMAIN:-<none>}"

if [[ "$SYNC_FRONTEND" == "true" ]]; then
  if [[ -n "$FRONTEND_BUCKET" && "$FRONTEND_BUCKET" != "None" ]]; then
    echo "\nSyncing frontend to s3://$FRONTEND_BUCKET ..."
    aws s3 sync "$FRONTEND_DIR" "s3://$FRONTEND_BUCKET" --delete --exact-timestamps
  else
    echo "\nSkipping frontend sync: bucket not available."
  fi
fi

if [[ "$INVALIDATE_CF" == "true" ]]; then
  DIST_ID=$(aws cloudformation describe-stack-resources --stack-name "$STACK_NAME" --query "StackResources[?LogicalResourceId=='CloudFrontDistribution'].PhysicalResourceId" --output text || true)
  if [[ -n "$DIST_ID" && "$DIST_ID" != "None" ]]; then
    echo "\nCreating CloudFront invalidation for /* ..."
    aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*" >/dev/null || true
    echo "Invalidation submitted on distribution $DIST_ID"
  else
    echo "\nSkipping CloudFront invalidation: distribution not found."
  fi
fi

echo "\nDone."
