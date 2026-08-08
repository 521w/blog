#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
PROJECT_NAME="${CF_PAGES_PROJECT:-leon-blog}"
npx wrangler pages deploy . --project-name="$PROJECT_NAME" --branch=main
