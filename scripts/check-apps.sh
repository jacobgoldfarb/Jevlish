#!/usr/bin/env sh
# Install the local build into each sample app exactly as npm would deliver it
# (via `npm pack`), then typecheck and dry-run the app. Nothing under apps/ is
# saved: package.json and package-lock.json keep pointing at the registry.
set -eu

root=$(cd "$(dirname "$0")/.." && pwd)
pack_dir=$(mktemp -d)
trap 'rm -rf "$pack_dir"' EXIT

cd "$root"
tarball=$(npm pack --silent --pack-destination "$pack_dir")

for app in "$root"/apps/*/; do
  echo "==> $(basename "$app")"
  (
    cd "$app"
    npm install --silent --no-save "$pack_dir/$tarball"
    npm run --silent typecheck
    npm run --silent plan >/dev/null
  )
done

echo "apps ok against $tarball"
