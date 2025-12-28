// Zstd 调试助手 - 在控制台运行以检查 Zstd 支持
(function() {
    console.log('=== Zstd 解压支持检查 ===');

    // 1. 检查浏览器原生支持
    const nativeSupport = typeof DecompressionStream !== 'undefined';
    console.log('1. DecompressionStream:', nativeSupport ? '✅ 支持' : '❌ 不支持');

    if (nativeSupport) {
        try {
            new DecompressionStream('zstd');
            console.log('   - Zstd 格式: ✅ 支持');
        } catch (e) {
            console.log('   - Zstd 格式: ❌ 不支持 -', e.message);
        }
    }

    // 2. 检查 fzstd 库
    console.log('2. fzstd 库:', typeof fzstd !== 'undefined' ? '✅ 已加载' : '❌ 未加载');

    if (typeof fzstd !== 'undefined') {
        console.log('   - decompress:', typeof fzstd.decompress === 'function' ? '✅' : '❌');
        console.log('   - Decompress:', typeof fzstd.Decompress === 'function' ? '✅' : '❌');
    }

    // 3. 检查旧的 zstddec/ZstdCodec
    console.log('3. 旧库检查:');
    console.log('   - loadZstdCodec:', typeof loadZstdCodec !== 'undefined' ? '⚠️ 还存在（应该移除）' : '✅ 不存在');
    console.log('   - ZstdCodec:', typeof ZstdCodec !== 'undefined' ? '⚠️ 还存在（应该移除）' : '✅ 不存在');

    // 4. 推荐方案
    console.log('\n=== 推荐使用 ===');
    if (nativeSupport) {
        try {
            new DecompressionStream('zstd');
            console.log('✅ 使用浏览器原生 DecompressionStream (最快)');
        } catch {
            console.log('⚠️ 浏览器不支持 zstd，使用 fzstd 回退');
        }
    } else {
        console.log(typeof fzstd !== 'undefined'
            ? '✅ 使用 fzstd 库 (兼容性好)'
            : '❌ 无可用的 Zstd 解压方案！');
    }
})();
