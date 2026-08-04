#!/usr/bin/env bash
set -euo pipefail

readonly ORIGIN="https://datacurve.ai"
readonly VERSION="2026-05-16T06%3A09%3A47.741Z"
readonly ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly MEDIA_DIR="${ROOT}/upstream/media"
readonly RUNTIME_DIR="${ROOT}/upstream/runtime"

mkdir -p "${MEDIA_DIR}" "${RUNTIME_DIR}"

for index in 01 02 03 04 05 06 07 08; do
  curl --fail --location --silent --show-error \
    "${ORIGIN}/api/depth-assets/media/depth-clip-${index}.mp4?v=${VERSION}" \
    --output "${MEDIA_DIR}/depth-clip-${index}.mp4"
done

curl --fail --location --silent --show-error \
  "${ORIGIN}/gifs/depth-scenes.json" \
  --output "${RUNTIME_DIR}/depth-scenes.json"

curl --fail --location --silent --show-error \
  "${ORIGIN}/_next/static/chunks/0s99a.txitfa_.js" \
  --output "${RUNTIME_DIR}/dotmorph-runtime.js"

(
  cd "${ROOT}/upstream"
  shasum -a 256 media/*.mp4 runtime/* > SHA256SUMS
)
