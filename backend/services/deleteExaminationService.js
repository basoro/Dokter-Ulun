import db from '../config/database.js';

class DeleteExaminationService {
  static async deleteExamination(no_rawat, status_rawat, tgl_perawatan, jam_rawat, username = '') {
    try {
      console.log('Delete examination request:', { no_rawat, status_rawat, tgl_perawatan, jam_rawat, username });

      if (!no_rawat || !status_rawat || !tgl_perawatan || !jam_rawat) {
        throw new Error('Missing required parameters: no_rawat, status_rawat, tgl_perawatan, jam_rawat');
      }

      let result;
      let table;
      
      const normalizedUsername = String(username || '').trim();

      if (status_rawat === 'Ralan') {
        // Delete from pemeriksaan_ralan table
        table = 'pemeriksaan_ralan';
        if (normalizedUsername) {
          const [rows] = await db.execute(
            `SELECT nip FROM pemeriksaan_ralan WHERE no_rawat = ? AND tgl_perawatan = ? AND jam_rawat = ? LIMIT 1`,
            [no_rawat, tgl_perawatan, jam_rawat]
          );

          if (!rows.length) {
            throw new Error('No examination record found to delete');
          }

          if (String(rows[0].nip || '').trim() !== normalizedUsername) {
            throw new Error('Anda tidak berhak menghapus data pemeriksaan ini');
          }
        }
        [result] = await db.execute(`
          DELETE FROM pemeriksaan_ralan 
          WHERE no_rawat = ? AND tgl_perawatan = ? AND jam_rawat = ?
        `, [no_rawat, tgl_perawatan, jam_rawat]);
      } else {
        // Delete from pemeriksaan_ranap table
        table = 'pemeriksaan_ranap';
        const [rows] = await db.execute(
          `SELECT nip, verified_at FROM pemeriksaan_ranap WHERE no_rawat = ? AND tgl_perawatan = ? AND jam_rawat = ? LIMIT 1`,
          [no_rawat, tgl_perawatan, jam_rawat]
        );

        if (!rows.length) {
          throw new Error('No examination record found to delete');
        }

        if (rows[0]?.verified_at) {
          throw new Error('SOAP harian rawat inap yang sudah diverifikasi tidak dapat dihapus');
        }

        if (normalizedUsername && String(rows[0].nip || '').trim() !== normalizedUsername) {
          throw new Error('Anda tidak berhak menghapus data pemeriksaan ini');
        }
        [result] = await db.execute(`
          DELETE FROM pemeriksaan_ranap 
          WHERE no_rawat = ? AND tgl_perawatan = ? AND jam_rawat = ?
        `, [no_rawat, tgl_perawatan, jam_rawat]);
      }

      console.log('Delete result:', result);

      if (result.affectedRows === 0) {
        throw new Error('No examination record found to delete');
      }

      return {
        success: true,
        message: 'Examination deleted successfully',
        table: table,
        affectedRows: result.affectedRows
      };

    } catch (error) {
      console.error('Error in delete examination service:', error);
      throw error;
    }
  }
}

export default DeleteExaminationService;
