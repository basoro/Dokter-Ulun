import { executeQuery } from '../config/database.js';

class EkstrapiramidalService {
  static answerKeys = Array.from({ length: 12 }, (_, index) => `piramidal${index + 1}`);

  static normalizeNoRawat(noRawat) {
    const normalized = String(noRawat || '').trim();
    if (!normalized) {
      throw new Error('no_rawat wajib diisi');
    }

    return normalized;
  }

  static normalizeDokter(dokter) {
    const normalized = String(dokter || '').trim();
    if (!normalized) {
      throw new Error('Nama dokter wajib diisi');
    }

    return normalized;
  }

  static normalizeHasil(payload = {}) {
    const hasil = {};

    for (const key of this.answerKeys) {
      const value = String(payload?.[key] ?? '').trim();
      if (!['1', '2', '3', '4'].includes(value)) {
        throw new Error(`Nilai ${key} wajib diisi`);
      }
      hasil[key] = value;
    }

    return hasil;
  }

  static async save(payload = {}) {
    const noRawat = this.normalizeNoRawat(payload.no_rawat);
    const dokter = this.normalizeDokter(payload.dokter);
    const hasil = JSON.stringify(this.normalizeHasil(payload));

    const existingRows = await executeQuery(
      `
        SELECT id
        FROM mlite_ekstrapiramidal
        WHERE no_rawat = ?
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `,
      [noRawat]
    );

    const existing = Array.isArray(existingRows) ? existingRows[0] : null;

    if (existing?.id) {
      await executeQuery(
        `
          UPDATE mlite_ekstrapiramidal
          SET dokter = ?,
              hasil = ?
          WHERE id = ?
        `,
        [dokter, hasil, existing.id]
      );
    } else {
      await executeQuery(
        `
          INSERT INTO mlite_ekstrapiramidal (
            no_rawat,
            dokter,
            hasil,
            created_at
          ) VALUES (?, ?, ?, NOW())
        `,
        [noRawat, dokter, hasil]
      );
    }

    return {
      success: true,
      message: 'Ekstrapiramidal berhasil disimpan'
    };
  }
}

export default EkstrapiramidalService;
