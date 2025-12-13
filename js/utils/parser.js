/**
 * 文件解析工具
 * 包含TAR解析器和时间范围提取功能
 */

/**
 * 简化的TAR解析器（内置实现，不依赖外部库）
 */
export class SimpleTarReader {
    constructor(buffer) {
        this.buffer = new Uint8Array(buffer);
        this.offset = 0;
    }

    readString(length) {
        const bytes = this.buffer.slice(this.offset, this.offset + length);
        this.offset += length;

        // 找到第一个null字节的位置
        let nullIndex = bytes.indexOf(0);
        if (nullIndex === -1) nullIndex = bytes.length;

        return new TextDecoder().decode(bytes.slice(0, nullIndex));
    }

    readOctal(length) {
        const str = this.readString(length).trim();
        return str ? parseInt(str, 8) : 0;
    }

    async extractFiles() {
        const files = [];

        while (this.offset < this.buffer.length - 1024) {
            // 检查是否到达文件末尾（连续的零字节）
            if (this.buffer[this.offset] === 0) {
                // 检查接下来的512字节是否都是0
                let allZero = true;
                for (let i = 0; i < 512 && this.offset + i < this.buffer.length; i++) {
                    if (this.buffer[this.offset + i] !== 0) {
                        allZero = false;
                        break;
                    }
                }
                if (allZero) break;
            }

            const originalOffset = this.offset;

            try {
                // 读取TAR头部
                const name = this.readString(100);
                const mode = this.readString(8);
                const uid = this.readString(8);
                const gid = this.readString(8);
                const size = this.readOctal(12);
                const mtime = this.readString(12);
                const checksum = this.readString(8);
                const type = this.readString(1);

                // 跳过剩余的头部信息到512字节边界
                this.offset = originalOffset + 512;

                if (name && size >= 0 && (type === '0' || type === '' || type === '\0')) {
                    // 读取文件内容
                    if (this.offset + size <= this.buffer.length) {
                        const fileData = this.buffer.slice(this.offset, this.offset + size);
                        files.push({
                            name: name,
                            size: size,
                            buffer: fileData
                        });
                    }
                }

                // 跳到下一个512字节边界
                const paddedSize = Math.ceil(size / 512) * 512;
                this.offset += paddedSize;

            } catch (error) {
                console.warn('TAR解析错误:', error);
                break;
            }
        }

        return files;
    }
}

/**
 * 从内容中提取时间范围
 */
export function extractTimeRangeFromContent(content) {
    const timestampRegex = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3}/;
    let firstTimestamp = null;
    let lastTimestamp = null;

    const lines = content.split('\n');

    // 查找第一个时间戳
    for (let i = 0; i < Math.min(lines.length, 1000); i++) {
        const line = lines[i];
        if (timestampRegex.test(line)) {
            firstTimestamp = extractTimestamp(line);
            break;
        }
    }

    // 查找最后一个时间戳
    for (let i = Math.max(0, lines.length - 1000); i < lines.length; i++) {
        const line = lines[i];
        if (timestampRegex.test(line)) {
            lastTimestamp = extractTimestamp(line);
        }
    }

    if (!firstTimestamp || !lastTimestamp) {
        throw new Error('无法在文件中找到有效的时间戳');
    }

    return { start: firstTimestamp, end: lastTimestamp };
}

/**
 * 从日志行中提取时间戳
 */
export function extractTimestamp(line) {
    const match = line.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})/);
    return match ? new Date(match[1]) : new Date();
}

/**
 * 从ZIP buffer中解压文件
 */
export async function extractFromZipBuffer(buffer) {
    try {
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip库未加载，请检查CDN链接');
        }

        console.log('开始使用JSZip解析ZIP文件，buffer大小:', buffer.byteLength);
        const zip = new JSZip();

        // 加载ZIP文件
        const zipContent = await zip.loadAsync(buffer);

        console.log('ZIP文件解析成功，文件列表:', Object.keys(zipContent.files));

        // 查找第一个非目录的文件
        for (const [filename, zipEntry] of Object.entries(zipContent.files)) {
            if (!zipEntry.dir) {
                console.log('读取ZIP中的文件:', filename);
                try {
                    const content = await zipEntry.async('string');
                    console.log('文件内容长度:', content.length);

                    if (content && content.length > 0) {
                        return content;
                    } else {
                        console.warn('文件内容为空:', filename);
                    }
                } catch (readError) {
                    console.error('读取ZIP文件内容失败:', filename, readError);
                    // 尝试以二进制方式读取，然后转换
                    try {
                        const uint8Array = await zipEntry.async('uint8array');
                        const decoder = new TextDecoder('utf-8', { fatal: false });
                        const content = decoder.decode(uint8Array);
                        if (content && content.length > 0) {
                            return content;
                        }
                    } catch (binaryError) {
                        console.error('二进制读取也失败:', binaryError);
                    }
                }
            }
        }

        throw new Error('ZIP文件中没有找到有效的文本文件');

    } catch (error) {
        console.error('JSZip处理失败:', error);
        throw new Error(`JSZip处理ZIP文件失败: ${error.message}`);
    }
}

/**
 * 解压gzip文件（支持多种格式）
 */
export async function decompressGzipFile(buffer, fileName) {
    if (typeof pako === 'undefined') {
        throw new Error('pako库未加载');
    }

    try {
        console.log('尝试使用pako.inflate解压:', fileName);
        return pako.inflate(buffer, { to: 'string' });
    } catch (pakoError) {
        console.warn('pako.inflate失败，检查是否为ZIP格式:', pakoError.message);

        // 检查是否是ZIP文件（ZIP文件头是PK，即0x504B）
        if (buffer[0] === 0x50 && buffer[1] === 0x4B) {
            console.log('检测到ZIP格式，使用JSZip解压');
            return await extractFromZipBuffer(buffer);
        } else {
            // 尝试其他gzip方法
            try {
                console.log('尝试使用pako.ungzip解压:', fileName);
                return pako.ungzip(buffer, { to: 'string' });
            } catch (ungzipError) {
                console.error('pako.ungzip也失败:', ungzipError);
                throw new Error(`无法解压文件 ${fileName}: ${pakoError.message}`);
            }
        }
    }
}
