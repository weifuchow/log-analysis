// Placeholder for Zstandard decoder.
// This shim defines a minimal ZstdCodec interface so the application can
// detect whether a real decoder bundle has been provided. Replace this file
// with a compiled decoder (e.g., zstddec.js) if native DecompressionStream
// ('zstd') is unavailable in the browser environment.
//
// The real decoder should expose `ZstdCodec.run(cb)` which invokes the callback
// with a codec module providing `new Simple().decompress(Uint8Array)`.
(function attachPlaceholderZstdCodec(global) {
    if (global.ZstdCodec) {
        return;
    }

    const placeholderError = new Error(
        'Zstd 解码器占位符已加载。要在缺少 DecompressionStream 的浏览器中解压 .zst/.tar.zst，请将 libs/zstddec.js 替换为编译后的解码器构建（例如 @kig/zstddec 的 dist 文件）。'
    );

    global.ZstdCodec = {
        isPlaceholder: true,
        /**
         * Mimic the async loader contract used by the real decoder.
         * Always rejects to prevent silent failures.
         */
        run(callback) {
            // Keep the API surface but prevent accidental use of the placeholder.
            throw placeholderError;
        }
    };

    if (global.console && global.console.warn) {
        global.console.warn(
            '[zstddec] Placeholder loaded. Bundle a real decoder at libs/zstddec.js for full zst support.'
        );
    }
})(typeof self !== 'undefined' ? self : window);
