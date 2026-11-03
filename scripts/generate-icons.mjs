import fs from "node:fs";
import zlib from "node:zlib";
// Code-native monogram, without generated raster artwork or new branding.
const crc = (buffer) => {
  let c = 0xffffffff;
  for (const b of buffer) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const name = Buffer.from(type), len = Buffer.alloc(4), sum = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  sum.writeUInt32BE(crc(Buffer.concat([name, data])));
  return Buffer.concat([len, name, data, sum]);
}
fs.mkdirSync("public/icons", { recursive: true });
for (const size of [192, 512]) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const px = x / size, py = y / size;
      const inA = py > .25 && py < .75 &&
        ((Math.abs(px - (.5 - (py - .25) * .4)) < .035) ||
          (Math.abs(px - (.5 + (py - .25) * .4)) < .035) ||
          (py > .55 && py < .60 && px > .36 && px < .64));
      const i = y * (size * 4 + 1) + 1 + x * 4;
      raw[i] = inA ? 242 : 16;
      raw[i + 1] = inA ? 138 : 14;
      raw[i + 2] = inA ? 148 : 15;
      raw[i + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  fs.writeFileSync(
    `public/icons/icon-${size}.png`,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", ihdr),
      chunk("IDAT", zlib.deflateSync(raw)),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}
