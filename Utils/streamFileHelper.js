const fs = require('fs');
const os = require('os');
const path = require('path');
const { once } = require('events');
const { AttachmentBuilder } = require('discord.js');

function _tmpName(filename) {
  return `noxx-${Date.now()}-${Math.random().toString(36).slice(2,8)}-${filename}`;
}

async function writeIterableToTempFile(iterable, filename) {
  const tmp = os.tmpdir();
  const name = _tmpName(filename);
  const full = path.join(tmp, name);

  const ws = fs.createWriteStream(full, { encoding: 'utf8' });
  try {
    if (iterable[Symbol.asyncIterator]) {
      for await (const line of iterable) {
        if (!ws.write(line + '\n')) await once(ws, 'drain');
      }
    } else {
      for (const line of iterable) {
        if (!ws.write(line + '\n')) await once(ws, 'drain');
      }
    }
  } finally {
    ws.end();
    await once(ws, 'finish');
  }

  return full;
}

async function attachmentFromIterable(iterable, filename, threshold = 2000) {
  try {
    // Fast-path for arrays so we can avoid writing files for small lists
    if (Array.isArray(iterable)) {
      if (iterable.length <= threshold) {
        const joined = iterable.join('\n');
        return new AttachmentBuilder(Buffer.from(joined, 'utf8'), { name: filename });
      }
      const full = await writeIterableToTempFile(iterable, filename);
      const rs = fs.createReadStream(full);
      rs.on('close', () => { try { fs.unlinkSync(full); } catch (e) {} });
      // Fallback cleanup in case 'close' never fires
      setTimeout(() => { try { fs.unlinkSync(full); } catch (e) {} }, 60_000);
      return new AttachmentBuilder(rs, { name: filename });
    }

    // Generic iterable (including async iterables) - stream to temp file
    const full = await writeIterableToTempFile(iterable, filename);
    const rs = fs.createReadStream(full);
    rs.on('close', () => { try { fs.unlinkSync(full); } catch (e) {} });
    setTimeout(() => { try { fs.unlinkSync(full); } catch (e) {} }, 60_000);
    return new AttachmentBuilder(rs, { name: filename });
  } catch (e) {
    console.warn('attachmentFromIterable failed, falling back to buffer:', e?.message || e);
  }

  // Fallback defensive path
  if (Array.isArray(iterable)) {
    const joined = iterable.join('\n');
    return new AttachmentBuilder(Buffer.from(joined, 'utf8'), { name: filename });
  }
  return new AttachmentBuilder(Buffer.from(String(iterable), 'utf8'), { name: filename });
}

function attachmentFromContent(content, filename, threshold = 2000) {
  try {
    if (Buffer.isBuffer(content)) return new AttachmentBuilder(content, { name: filename });
    if (typeof content !== 'string') content = String(content);

    const lines = content.split(/\r?\n/);
    if (lines.length > threshold) {
      const tmp = os.tmpdir();
      const name = _tmpName(filename);
      const full = path.join(tmp, name);
      fs.writeFileSync(full, content, 'utf8');
      const rs = fs.createReadStream(full);
      rs.on('close', () => { try { fs.unlinkSync(full); } catch (e) {} });
      setTimeout(() => { try { fs.unlinkSync(full); } catch (e) {} }, 60_000);
      return new AttachmentBuilder(rs, { name: filename });
    }
  } catch (e) {
    console.warn('attachmentFromContent failed, falling back to buffer:', e?.message || e);
  }

  return new AttachmentBuilder(Buffer.from(content, 'utf8'), { name: filename });
}

module.exports = {
  writeIterableToTempFile,
  attachmentFromIterable,
  attachmentFromContent,
};
