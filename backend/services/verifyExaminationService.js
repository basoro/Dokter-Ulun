import db from '../config/database.js';

class VerifyExaminationService {
  static async verifyInpatientExamination(no_rawat, tgl_perawatan, jam_rawat, username = '') {
    const normalizedNoRawat = String(no_rawat || '').trim();
    const normalizedDate = String(tgl_perawatan || '').trim();
    const normalizedTime = String(jam_rawat || '').trim();
    const normalizedUsername = String(username || '').trim();

    if (!normalizedNoRawat || !normalizedDate || !normalizedTime) {
      throw new Error('Missing required parameters: no_rawat, tgl_perawatan, jam_rawat');
    }

    if (!normalizedUsername) {
      throw new Error('Username wajib diisi untuk verifikasi SOAP harian rawat inap');
    }

    const [rows] = await db.execute(
      `
        SELECT nip, verified_at
        FROM pemeriksaan_ranap
        WHERE no_rawat = ? AND tgl_perawatan = ? AND jam_rawat = ?
        LIMIT 1
      `,
      [normalizedNoRawat, normalizedDate, normalizedTime]
    );

    if (!rows.length) {
      throw new Error('Data SOAP harian rawat inap tidak ditemukan');
    }

    const record = rows[0] || {};
    if (record.verified_at) {
      throw new Error('SOAP harian rawat inap ini sudah diverifikasi');
    }

    const [updateResult] = await db.execute(
      `
        UPDATE pemeriksaan_ranap
        SET verified_at = NOW()
        WHERE no_rawat = ? AND tgl_perawatan = ? AND jam_rawat = ? AND verified_at IS NULL
      `,
      [normalizedNoRawat, normalizedDate, normalizedTime]
    );

    if (!updateResult?.affectedRows) {
      throw new Error('Verifikasi SOAP harian rawat inap gagal diproses');
    }

    const [updatedRows] = await db.execute(
      `
        SELECT verified_at
        FROM pemeriksaan_ranap
        WHERE no_rawat = ? AND tgl_perawatan = ? AND jam_rawat = ?
        LIMIT 1
      `,
      [normalizedNoRawat, normalizedDate, normalizedTime]
    );

    return {
      success: true,
      message: 'SOAP harian rawat inap berhasil diverifikasi',
      action_type: 'verify',
      no_rawat: normalizedNoRawat,
      tgl_perawatan: normalizedDate,
      jam_rawat: normalizedTime,
      verified_at: updatedRows?.[0]?.verified_at || null
    };
  }
}

export default VerifyExaminationService;
