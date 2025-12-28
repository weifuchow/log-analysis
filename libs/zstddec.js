// Placeholder for Zstandard decoder.
// Replace this file with a compiled decoder (e.g., zstddec.js) if native
// DecompressionStream('zstd') is unavailable in the browser environment.
if (typeof console !== 'undefined') {
    console.warn('[zstddec] Placeholder loaded. For full zst support, bundle a real decoder at libs/zstddec.js.');
}
