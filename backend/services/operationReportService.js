import { executeQuery } from '../config/database.js';
import DigitalFilesService from './digitalFilesService.js';

class OperationReportService {
  static getDigitalFileCode() {
    return String(process.env.BERKAS_LAP_OPERASI || '')
      .trim()
      .replace(/^['"`]+|['"`]+$/g, '');
  }

  static formatDateTimeLocal(dateTime) {
    if (!dateTime) {
      return '';
    }

    const value = String(dateTime).trim();
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
      return value;
    }

    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(value)) {
      return value.replace(' ', 'T').slice(0, 16);
    }

    try {
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return '';
      }

      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      const hours = String(parsed.getHours()).padStart(2, '0');
      const minutes = String(parsed.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch {
      return '';
    }
  }

  static normalizeTanggalOp(value) {
    if (!value) {
      return '';
    }

    const normalized = this.formatDateTimeLocal(value);
    if (normalized) {
      return normalized.replace('T', ' ');
    }

    return String(value).trim();
  }

  static async getReports(noRawat) {
    if (!noRawat) {
      throw new Error('no_rawat wajib diisi');
    }

    const sql = `
      SELECT
        lo.id,
        lo.no_rawat,
        lo.kd_dokter,
        lo.tanggal_op,
        lo.hasil_op,
        lo.pre_op,
        lo.post_op,
        lo.implan,
        lo.kirim_pa,
        lo.nm_op,
        DATE_FORMAT(lo.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        COALESCE(dl.nm_dokter, '') AS dokter_laporan,
        COALESCE((
          SELECT dop.nm_dokter
          FROM operasi o
          INNER JOIN dokter dop ON dop.kd_dokter = o.operator1
          WHERE o.no_rawat = lo.no_rawat
            AND (
              o.tgl_operasi = lo.tanggal_op
              OR DATE(o.tgl_operasi) = DATE(lo.tanggal_op)
            )
          ORDER BY
            CASE WHEN o.tgl_operasi = lo.tanggal_op THEN 0 ELSE 1 END,
            o.tgl_operasi DESC
          LIMIT 1
        ), '') AS dokter_operator,
        COALESCE((
          SELECT dans.nm_dokter
          FROM operasi o
          INNER JOIN dokter dans ON dans.kd_dokter = o.dokter_anestesi
          WHERE o.no_rawat = lo.no_rawat
            AND (
              o.tgl_operasi = lo.tanggal_op
              OR DATE(o.tgl_operasi) = DATE(lo.tanggal_op)
            )
          ORDER BY
            CASE WHEN o.tgl_operasi = lo.tanggal_op THEN 0 ELSE 1 END,
            o.tgl_operasi DESC
          LIMIT 1
        ), '') AS dokter_anestesi
      FROM mlite_lap_op lo
      LEFT JOIN dokter dl ON dl.kd_dokter = lo.kd_dokter
      WHERE lo.no_rawat = ?
        AND lo.deleted_at IS NULL
      ORDER BY lo.created_at DESC, lo.id DESC
    `;

    const rows = await executeQuery(sql, [noRawat]);

    return {
      success: true,
      data: rows.map((row) => ({
        id: row.id,
        no_rawat: row.no_rawat,
        kd_dokter: row.kd_dokter || '',
        tanggal_op: this.formatDateTimeLocal(row.tanggal_op) || row.tanggal_op || '',
        hasil_op: row.hasil_op || '',
        pre_op: row.pre_op || '',
        post_op: row.post_op || '',
        implan: row.implan || '',
        kirim_pa: row.kirim_pa === 'Ya' ? 'Ya' : 'Tidak',
        nm_op: row.nm_op || '',
        created_at: this.formatDateTimeLocal(row.created_at) || row.created_at || '',
        dokter_laporan: row.dokter_laporan || '',
        dokter_operator: row.dokter_operator || '',
        dokter_anestesi: row.dokter_anestesi || '',
      })),
    };
  }

  static async createReport(payload) {
    const {
      kd_dokter,
      no_rawat,
      tanggal_op,
      hasil_op,
      pre_op,
      post_op,
      implan,
      kirim_pa,
      nm_op,
    } = payload || {};

    if (
      !no_rawat ||
      !tanggal_op ||
      !hasil_op?.trim()
    ) {
      throw new Error('Data laporan operasi belum lengkap');
    }

    const sql = `
      INSERT INTO mlite_lap_op (
        no_rawat,
        kd_dokter,
        tanggal_op,
        hasil_op,
        pre_op,
        post_op,
        implan,
        kirim_pa,
        nm_op
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await executeQuery(sql, [
      no_rawat,
      kd_dokter || null,
      this.normalizeTanggalOp(tanggal_op),
      hasil_op.trim(),
      pre_op?.trim() || null,
      post_op?.trim() || null,
      implan?.trim() || null,
      kirim_pa === 'Ya' ? 'Ya' : 'Tidak',
      nm_op?.trim() || null,
    ]);

    return {
      success: true,
      message: 'Laporan operasi berhasil ditambahkan',
    };
  }

  static async updateReport(payload) {
    const {
      id,
      kd_dokter,
      no_rawat,
      tanggal_op,
      hasil_op,
      pre_op,
      post_op,
      implan,
      kirim_pa,
      nm_op,
    } = payload || {};

    if (
      !id ||
      !no_rawat ||
      !tanggal_op ||
      !hasil_op?.trim()
    ) {
      throw new Error('Data laporan operasi untuk update belum lengkap');
    }

    const sql = `
      UPDATE mlite_lap_op
      SET
        kd_dokter = ?,
        tanggal_op = ?,
        hasil_op = ?,
        pre_op = ?,
        post_op = ?,
        implan = ?,
        kirim_pa = ?,
        nm_op = ?
      WHERE id = ?
        AND no_rawat = ?
        AND deleted_at IS NULL
    `;

    const result = await executeQuery(sql, [
      kd_dokter || null,
      this.normalizeTanggalOp(tanggal_op),
      hasil_op.trim(),
      pre_op?.trim() || null,
      post_op?.trim() || null,
      implan?.trim() || null,
      kirim_pa === 'Ya' ? 'Ya' : 'Tidak',
      nm_op?.trim() || null,
      id,
      no_rawat,
    ]);

    if (!result.affectedRows) {
      throw new Error('Laporan operasi yang akan diperbarui tidak ditemukan');
    }

    return {
      success: true,
      message: 'Laporan operasi berhasil diperbarui',
    };
  }

  static async deleteReport(payload) {
    const { id, no_rawat } = payload || {};

    if (!id || !no_rawat) {
      throw new Error('id dan no_rawat wajib diisi');
    }

    const sql = `
      UPDATE mlite_lap_op
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND no_rawat = ?
        AND deleted_at IS NULL
    `;

    const result = await executeQuery(sql, [id, no_rawat]);

    if (!result.affectedRows) {
      throw new Error('Laporan operasi yang akan dihapus tidak ditemukan');
    }

    return {
      success: true,
      message: 'Laporan operasi berhasil dihapus',
    };
  }

  static async getDigitalFiles(noRawat, kdDokter = '') {
    const normalizedNoRawat = String(noRawat || '').trim();
    const configuredKode = this.getDigitalFileCode();

    if (!normalizedNoRawat) {
      throw new Error('no_rawat wajib diisi');
    }

    if (!configuredKode) {
      throw new Error('BERKAS_LAP_OPERASI belum dikonfigurasi');
    }

    const result = await DigitalFilesService.getFiles(normalizedNoRawat, kdDokter);
    const filteredData = Array.isArray(result?.data)
      ? result.data.filter((item) => String(item?.kode || '').trim() === configuredKode)
      : [];

    return {
      ...result,
      data: filteredData,
      kode_berkas: configuredKode
    };
  }

  static async uploadDigitalFiles({ noRawat, files = [] }) {
    const configuredKode = this.getDigitalFileCode();

    if (!configuredKode) {
      throw new Error('BERKAS_LAP_OPERASI belum dikonfigurasi');
    }

    return DigitalFilesService.uploadFiles({
      noRawat,
      kode: configuredKode,
      files
    });
  }

  static async deleteDigitalFile({ noRawat, lokasiFile, kdDokter = '' }) {
    const configuredKode = this.getDigitalFileCode();

    if (!configuredKode) {
      throw new Error('BERKAS_LAP_OPERASI belum dikonfigurasi');
    }

    return DigitalFilesService.deleteFile({
      noRawat,
      kode: configuredKode,
      lokasiFile,
      kdDokter
    });
  }
}

export default OperationReportService;
