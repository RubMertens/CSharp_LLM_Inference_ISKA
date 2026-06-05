#!/usr/bin/env bash
set -euo pipefail

# Deploy the presentation to Azure Static Web Apps.
# Build output is expected in ./dist (produced by `npm run build`).

# --- Config (override via environment) ---
RESOURCE_GROUP="${RESOURCE_GROUP:-rg-presentation}"
APP_NAME="${APP_NAME:-iska-presentation}"
LOCATION="${LOCATION:-westeurope}"

# --- Preflight checks ---
if ! command -v az >/dev/null 2>&1; then
  echo "Error: Azure CLI (az) not found. Install: https://learn.microsoft.com/cli/azure/install-azure-cli" >&2
  exit 1
fi

if ! az account show >/dev/null 2>&1; then
  echo "Error: not logged in to Azure. Run: az login" >&2
  exit 1
fi

if ! command -v npx >/dev/null 2>&1; then
  echo "Error: npx not found. Install Node.js: https://nodejs.org" >&2
  exit 1
fi

# --- Resource group (idempotent) ---
echo "Ensuring resource group '$RESOURCE_GROUP' in '$LOCATION'..."
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none

# --- Static Web App (create if missing) ---
if az staticwebapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" >/dev/null 2>&1; then
  echo "Static Web App '$APP_NAME' already exists."
else
  echo "Creating Static Web App '$APP_NAME'..."
  az staticwebapp create \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --sku Free \
    --output none
fi

# --- Build ---
echo "Building..."
npm run build

# --- Deployment token ---
echo "Fetching deployment token..."
TOKEN="$(az staticwebapp secrets list \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.apiKey" -o tsv)"

if [ -z "$TOKEN" ]; then
  echo "Error: failed to fetch deployment token." >&2
  exit 1
fi

# --- Deploy ---
echo "Deploying ./dist..."
npx @azure/static-web-apps-cli deploy ./dist \
  --deployment-token "$TOKEN" \
  --env production

# --- Final URL ---
HOSTNAME="$(az staticwebapp show \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "defaultHostname" -o tsv)"

echo "Deployed: https://${HOSTNAME}"
