// Lightweight loader for the Zstandard decoder used in the browser.
// If the runtime already supports DecompressionStream('zstd'), this loader will
// never be used. Otherwise, it attempts to fetch a prebuilt decoder from a CDN
// and exposes a promise-returning loader function on `window.loadZstdCodec`.
(function(global) {
    const BUNDLED_DECODER = (() => {
        if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
            return chrome.runtime.getURL('libs/zstd-codec.min.js');
        }

        if (typeof browser !== 'undefined' && browser.runtime?.getURL) {
            return browser.runtime.getURL('libs/zstd-codec.min.js');
        }

        return 'libs/zstd-codec.min.js';
    })();

    const CDN_SOURCES = [
        'https://cdn.jsdelivr.net/npm/zstd-codec@0.1.22/dist/zstd-codec.min.js',
        'https://unpkg.com/zstd-codec@0.1.22/dist/zstd-codec.min.js'
    ];

    let loadPromise = null;

    function injectScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.onload = () => {
                if (global.ZstdCodec) {
                    resolve(global.ZstdCodec);
                } else {
                    reject(new Error(`ZstdCodec not available after loading ${src}`));
                }
            };
            script.onerror = () => reject(new Error(`加载 Zstd 解码器失败: ${src}`));
            document.head.appendChild(script);
        });
    }

    async function loadZstdCodec() {
        if (global.ZstdCodec) return global.ZstdCodec;
        if (loadPromise) return loadPromise;

        if (typeof document === 'undefined') {
            throw new Error('无法在非浏览器环境加载 Zstd 解码器');
        }

        const sources = [BUNDLED_DECODER, ...CDN_SOURCES];

        loadPromise = (async () => {
            const errors = [];
            for (const src of sources) {
                try {
                    return await injectScript(src);
                } catch (error) {
                    errors.push(error);
                    console.warn('[zstddec] 尝试加载解码器失败:', error);
                }
            }
            throw new Error(errors.map(err => err.message).join('; '));
        })();

        return loadPromise;
    }

    global.loadZstdCodec = loadZstdCodec;
})(typeof window !== 'undefined' ? window : globalThis);
