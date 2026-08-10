import pool from '../config/database.js';
import fs from 'fs';

// #region debug-point B:save-exam-service-reporter
const reportSaveExaminationDebug = (hypothesisId, location, msg, data = {}, runId = 'pre-fix') => {
  let debugServerUrl = 'http://127.0.0.1:7777/event';
  let debugSessionId = 'spo2-ranap-save';
  try {
    const envContent = fs.readFileSync('.dbg/spo2-ranap-save.env', 'utf8');
    debugServerUrl = envContent.match(/DEBUG_SERVER_URL=(.+)/)?.[1]?.trim() || debugServerUrl;
    debugSessionId = envContent.match(/DEBUG_SESSION_ID=(.+)/)?.[1]?.trim() || debugSessionId;
  } catch {}
  fetch(debugServerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: debugSessionId,
      runId,
      hypothesisId,
      location,
      msg,
      data,
      ts: Date.now()
    })
  }).catch(() => {});
};
// #endregion

class SaveExaminationService {
  /**
   * Save examination data to appropriate table based on status_rawat
   * @param {Object} examinationData - Examination data
   * @returns {Promise<Object>} Result object
   */
  static async saveExamination(examinationData) {
    const connection = await pool.getConnection();
    
    try {
      const {
        no_rawat,
        status_rawat,
        tgl_perawatan,
        jam_rawat,
        suhu,
        tensi,
        nadi,
        respirasi,
        tinggi,
        berat,
        spo2,
        gcs,
        kesadaran,
        keluhan,
        pemeriksaan,
        rtl,
        penilaian,
        instruksi,
        evaluasi,
        nip
      } = examinationData;

      // #region debug-point B:save-exam-service-entry
      reportSaveExaminationDebug('B', 'backend/services/saveExaminationService.js:saveExamination', '[DEBUG] save examination service entry', {
        no_rawat: no_rawat || null,
        status_rawat: status_rawat || null,
        spo2: spo2 ?? null,
        tgl_perawatan: tgl_perawatan || null,
        jam_rawat: jam_rawat || null,
        nip: nip || null,
        hasKeluhan: Boolean(keluhan),
        hasPemeriksaan: Boolean(pemeriksaan)
      });
      // #endregion

      console.log('Save examination request:', { no_rawat, status_rawat, tgl_perawatan });

      // Validate required fields
      if (!no_rawat || !status_rawat || !tgl_perawatan || !jam_rawat || !nip) {
        // #region debug-point B:save-exam-validation-failed
        reportSaveExaminationDebug('B', 'backend/services/saveExaminationService.js:saveExamination', '[DEBUG] save examination validation failed', {
          no_rawat: no_rawat || null,
          status_rawat: status_rawat || null,
          tgl_perawatan: tgl_perawatan || null,
          jam_rawat: jam_rawat || null,
          nip: nip || null
        });
        // #endregion
        throw new Error('Missing required fields: no_rawat, status_rawat, tgl_perawatan, jam_rawat, nip');
      }

      let result;
      let tableName;

      if (status_rawat === 'Ralan') {
        // Insert into pemeriksaan_ralan table
        tableName = 'pemeriksaan_ralan';
        
        const query = `
          INSERT INTO pemeriksaan_ralan (
            no_rawat, tgl_perawatan, jam_rawat, suhu_tubuh, tensi, nadi, respirasi,
            tinggi, berat, gcs, keluhan, pemeriksaan, alergi, imun_ke, rtl, penilaian, nip, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE
          suhu_tubuh = VALUES(suhu_tubuh),
          tensi = VALUES(tensi),
          nadi = VALUES(nadi),
          respirasi = VALUES(respirasi),
          tinggi = VALUES(tinggi),
          berat = VALUES(berat),
          gcs = VALUES(gcs),
          keluhan = VALUES(keluhan),
          pemeriksaan = VALUES(pemeriksaan),
          alergi = VALUES(alergi),
          imun_ke = VALUES(imun_ke),
          rtl = VALUES(rtl),
          penilaian = VALUES(penilaian),
          nip = VALUES(nip),
          created_at = NOW()
        `;
        
        const values = [
          no_rawat, tgl_perawatan, jam_rawat, suhu, tensi, nadi, respirasi,
          tinggi, berat, gcs, keluhan, pemeriksaan, 'tidak ada', '-', rtl, penilaian, nip
        ];
        // #region debug-point C:save-exam-before-ralan-query
        reportSaveExaminationDebug('C', 'backend/services/saveExaminationService.js:saveExamination', '[DEBUG] executing ralan save examination query', {
          tableName,
          valuesPreview: {
            no_rawat,
            spo2: spo2 ?? null,
            tgl_perawatan,
            jam_rawat,
            nip
          }
        });
        // #endregion
        [result] = await connection.execute(query, values);
        
      } else {
        // Insert into pemeriksaan_ranap table
        tableName = 'pemeriksaan_ranap';

        const [existingRows] = await connection.execute(
          `
            SELECT verified_at
            FROM pemeriksaan_ranap
            WHERE no_rawat = ? AND tgl_perawatan = ? AND jam_rawat = ?
            LIMIT 1
          `,
          [no_rawat, tgl_perawatan, jam_rawat]
        );

        if (existingRows.length > 0 && existingRows[0]?.verified_at) {
          throw new Error('SOAP harian rawat inap yang sudah diverifikasi tidak dapat diubah');
        }
        
        const query = `
          INSERT INTO pemeriksaan_ranap (
            no_rawat, tgl_perawatan, jam_rawat, suhu_tubuh, tensi, nadi, respirasi,
            tinggi, berat, spo2, gcs, keluhan, pemeriksaan, alergi, rtl, penilaian, instruksi, evaluasi, nip
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
          suhu_tubuh = VALUES(suhu_tubuh),
          tensi = VALUES(tensi),
          nadi = VALUES(nadi),
          respirasi = VALUES(respirasi),
          tinggi = VALUES(tinggi),
          berat = VALUES(berat),
          spo2 = VALUES(spo2),
          gcs = VALUES(gcs),
          keluhan = VALUES(keluhan),
          pemeriksaan = VALUES(pemeriksaan),
          alergi = VALUES(alergi),
          rtl = VALUES(rtl),
          penilaian = VALUES(penilaian),
          instruksi = VALUES(instruksi),
          evaluasi = VALUES(evaluasi),
          nip = VALUES(nip)
        `;
        
        const values = [
          no_rawat, tgl_perawatan, jam_rawat, suhu, tensi, nadi, respirasi,
          tinggi, berat, spo2, gcs, keluhan, pemeriksaan, '', rtl, penilaian, instruksi, evaluasi, nip
        ];
        // #region debug-point C:save-exam-before-ranap-query
        reportSaveExaminationDebug('C', 'backend/services/saveExaminationService.js:saveExamination', '[DEBUG] executing ranap save examination query', {
          tableName,
          valuesPreview: {
            no_rawat,
            spo2: spo2 ?? null,
            tgl_perawatan,
            jam_rawat,
            nip
          }
        });
        // #endregion
        [result] = await connection.execute(query, values);
      }

      // #region debug-point C:save-exam-query-success
      reportSaveExaminationDebug('C', 'backend/services/saveExaminationService.js:saveExamination', '[DEBUG] examination query success', {
        tableName,
        affectedRows: result?.affectedRows ?? null,
        insertId: result?.insertId ?? null
      });
      // #endregion
      // #region debug-point D:save-exam-post-query-readback
      try {
        const [databaseRows] = await connection.execute('SELECT DATABASE() AS active_database');
        const [readbackRows] = await connection.execute(
          `
            SELECT no_rawat, tgl_perawatan, jam_rawat, spo2, nip
            FROM ${tableName}
            WHERE no_rawat = ? AND tgl_perawatan = ? AND jam_rawat = ?
            LIMIT 1
          `,
          [no_rawat, tgl_perawatan, jam_rawat]
        );
        reportSaveExaminationDebug('D', 'backend/services/saveExaminationService.js:saveExamination', '[DEBUG] post-query readback after save', {
          tableName,
          activeDatabase: databaseRows?.[0]?.active_database || null,
          readbackCount: Array.isArray(readbackRows) ? readbackRows.length : null,
          readbackRow: Array.isArray(readbackRows) && readbackRows.length > 0
            ? {
                no_rawat: readbackRows[0]?.no_rawat || null,
                tgl_perawatan: readbackRows[0]?.tgl_perawatan || null,
                jam_rawat: readbackRows[0]?.jam_rawat || null,
                spo2: readbackRows[0]?.spo2 ?? null,
                nip: readbackRows[0]?.nip || null
              }
            : null
        });
      } catch (readbackError) {
        reportSaveExaminationDebug('D', 'backend/services/saveExaminationService.js:saveExamination', '[DEBUG] post-query readback failed', {
          tableName,
          name: readbackError?.name || 'Error',
          message: readbackError?.message || 'Unknown error'
        });
      }
      // #endregion
      console.log(`Examination saved to ${tableName}:`, {
        affectedRows: result.affectedRows,
        insertId: result.insertId
      });

      return {
        success: true,
        message: 'Examination saved successfully',
        table: tableName,
        data: {
          no_rawat,
          tgl_perawatan,
          jam_rawat,
          affectedRows: result.affectedRows,
          action: result.affectedRows === 1 ? 'created' : 'updated'
        }
      };

    } catch (error) {
      // #region debug-point D:save-exam-service-error
      reportSaveExaminationDebug('D', 'backend/services/saveExaminationService.js:saveExamination', '[DEBUG] save examination service error', {
        name: error?.name || 'Error',
        message: error?.message || 'Unknown error',
        stack: error?.stack || null
      });
      // #endregion
      console.error('Error saving examination:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Get examination data by no_rawat and date
   * @param {string} no_rawat - Patient admission number
   * @param {string} tgl_perawatan - Treatment date
   * @param {string} status_rawat - Treatment status (Ralan/Ranap)
   * @returns {Promise<Object>} Examination data
   */
  static async getExamination(no_rawat, tgl_perawatan, status_rawat) {
    const connection = await pool.getConnection();
    
    try {
      const tableName = status_rawat === 'Ralan' ? 'pemeriksaan_ralan' : 'pemeriksaan_ranap';
      
      let query;
      if (status_rawat === 'Ralan') {
        query = `
          SELECT 
            no_rawat, tgl_perawatan, jam_rawat, suhu_tubuh as suhu, tensi, nadi, respirasi,
            tinggi, berat, gcs, keluhan, pemeriksaan, rtl, penilaian, nip
          FROM pemeriksaan_ralan 
          WHERE no_rawat = ? AND tgl_perawatan = ?
          ORDER BY jam_rawat DESC
        `;
      } else {
        query = `
          SELECT 
            no_rawat, tgl_perawatan, jam_rawat, suhu_tubuh as suhu, tensi, nadi, respirasi,
            tinggi, berat, spo2, gcs, NULL as kesadaran, keluhan, pemeriksaan, rtl, penilaian, instruksi, evaluasi, nip
          FROM pemeriksaan_ranap 
          WHERE no_rawat = ? AND tgl_perawatan = ?
          ORDER BY jam_rawat DESC
        `;
      }
      
      const [rows] = await connection.execute(query, [no_rawat, tgl_perawatan]);
      
      return {
        success: true,
        data: rows,
        table: tableName
      };
      
    } catch (error) {
      console.error('Error getting examination:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Delete examination data
   * @param {string} no_rawat - Patient admission number
   * @param {string} tgl_perawatan - Treatment date
   * @param {string} jam_rawat - Treatment time
   * @param {string} status_rawat - Treatment status (Ralan/Ranap)
   * @returns {Promise<Object>} Result object
   */
  static async deleteExamination(no_rawat, tgl_perawatan, jam_rawat, status_rawat) {
    const connection = await pool.getConnection();
    
    try {
      const tableName = status_rawat === 'Ralan' ? 'pemeriksaan_ralan' : 'pemeriksaan_ranap';
      
      const query = `
        DELETE FROM ${tableName} 
        WHERE no_rawat = ? AND tgl_perawatan = ? AND jam_rawat = ?
      `;
      
      const [result] = await connection.execute(query, [no_rawat, tgl_perawatan, jam_rawat]);
      
      if (result.affectedRows === 0) {
        throw new Error('Examination not found');
      }
      
      return {
        success: true,
        message: 'Examination deleted successfully',
        table: tableName,
        affectedRows: result.affectedRows
      };
      
    } catch (error) {
      console.error('Error deleting examination:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Get examination history for a patient
   * @param {string} no_rawat - Patient admission number
   * @param {string} status_rawat - Treatment status (Ralan/Ranap)
   * @param {number} limit - Number of records to return
   * @returns {Promise<Object>} Examination history
   */
  static async getExaminationHistory(no_rawat, status_rawat, limit = 10) {
    const connection = await pool.getConnection();
    
    try {
      const tableName = status_rawat === 'Ralan' ? 'pemeriksaan_ralan' : 'pemeriksaan_ranap';
      
      let query;
      if (status_rawat === 'Ralan') {
        query = `
          SELECT 
            no_rawat, tgl_perawatan, jam_rawat, suhu_tubuh as suhu, tensi, nadi, respirasi,
            tinggi, berat, gcs, keluhan, pemeriksaan, rtl, penilaian, nip
          FROM pemeriksaan_ralan 
          WHERE no_rawat = ?
          ORDER BY tgl_perawatan DESC, jam_rawat DESC
          LIMIT ?
        `;
      } else {
        query = `
          SELECT 
            no_rawat, tgl_perawatan, jam_rawat, suhu_tubuh as suhu, tensi, nadi, respirasi,
            tinggi, berat, spo2, gcs, NULL as kesadaran, keluhan, pemeriksaan, rtl, penilaian, instruksi, evaluasi, nip
          FROM pemeriksaan_ranap 
          WHERE no_rawat = ?
          ORDER BY tgl_perawatan DESC, jam_rawat DESC
          LIMIT ?
        `;
      }
      
      const [rows] = await connection.execute(query, [no_rawat, limit]);
      
      return {
        success: true,
        data: rows,
        table: tableName,
        count: rows.length
      };
      
    } catch (error) {
      console.error('Error getting examination history:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
}

export default SaveExaminationService;
