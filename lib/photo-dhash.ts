import sharp from "sharp";

/**
 * Uztveres hash (dHash, 64 biti -> 16 hex): tā pati bilde ar citu kompresiju / izmēru dod
 * mazu Hamming attālumu, tāpēc der dublikātiem, kur sha256 nepalīdz (CarVertical PDF divreiz tās pašas bildes).
 */
export async function dhashImage(buf: Buffer): Promise<string | null> {
  try {
    const data = await sharp(buf).rotate().greyscale().resize(9, 8, { fit: "fill" }).raw().toBuffer();
    if (data.length < 72) return null;
    // 8 rindas × 8 biti -> 2 hex cipari rindā (bez BigInt - tsconfig mērķis < ES2020).
    let out = "";
    for (let y = 0; y < 8; y++) {
      let row = 0;
      for (let x = 0; x < 8; x++) row = (row << 1) | (data[y * 9 + x]! > data[y * 9 + x + 1]! ? 1 : 0);
      out += row.toString(16).padStart(2, "0");
    }
    return out;
  } catch {
    return null;
  }
}
