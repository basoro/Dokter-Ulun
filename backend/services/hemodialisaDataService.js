import db from '../config/database.js';

class HemodialisaDataService {
  static async getHemodialisaData({
    startDate,
    endDate,
    search = '',
    status = 'all',
    statusBayar = 'all',
    page = 1,
    itemsPerPage = 10
  }) {
    try {
      // Build the query for hemodialisa patients (search for HD/Hemodialisa/Hemodialisis/Cuci Darah in name)
      // Since we don't know the exact kd_poli, we'll filter by poli name
      let query = `
        SELECT 
          rp.no_reg,
          rp.no_rawat,
          rp.tgl_registrasi,
          rp.jam_reg,
          rp.no_rkm_medis,
          p.nm_pasien,
          p.jk,
          p.tgl_lahir,
          p.alamat,
          p.no_tlp,
          d.nm_dokter,
          pol.nm_poli,
          pj.png_jawab,
          rp.status_lanjut,
          rp.stts as status,
          rp.status_bayar as payment_status
        FROM reg_periksa rp
        LEFT JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
        LEFT JOIN dokter d ON rp.kd_dokter = d.kd_dokter
        LEFT JOIN poliklinik pol ON rp.kd_poli = pol.kd_poli
        LEFT JOIN penjab pj ON rp.kd_pj = pj.kd_pj
        WHERE (
          pol.nm_poli LIKE '%Hemodialisa%' OR 
          pol.nm_poli LIKE '%Hemodialisis%' OR 
          pol.nm_poli LIKE '%Cuci Darah%' OR
          pol.nm_poli LIKE '%HD%'
        )
          AND DATE(rp.tgl_registrasi) BETWEEN ? AND ?
      `;

      const params = [startDate, endDate];
      const normalizedSearch = String(search || '').trim();

      if (normalizedSearch) {
        query += `
          AND (
            rp.no_reg LIKE ? OR
            rp.no_rawat LIKE ? OR
            rp.no_rkm_medis LIKE ? OR
            p.nm_pasien LIKE ? OR
            d.nm_dokter LIKE ? OR
            pol.nm_poli LIKE ? OR
            pj.png_jawab LIKE ?
          )
        `;
        const searchPattern = `%${normalizedSearch}%`;
        params.push(
          searchPattern,
          searchPattern,
          searchPattern,
          searchPattern,
          searchPattern,
          searchPattern,
          searchPattern
        );
      }

      // Add status filter if specified
      if (status && status !== 'all') {
        query += ` AND rp.stts = ?`;
        params.push(status);
      }

      // Add status bayar filter if specified
      if (statusBayar && statusBayar !== 'all') {
        query += ` AND rp.status_bayar = ?`;
        params.push(statusBayar);
      }

      // Add ordering
      query += ` ORDER BY rp.tgl_registrasi DESC, rp.jam_reg DESC`;

      // Calculate pagination
      const pageNum = parseInt(page);
      const itemsPerPageNum = parseInt(itemsPerPage);
      const offset = (pageNum - 1) * itemsPerPageNum;

      // If itemsPerPage is very large (like 999999), don't apply LIMIT
      if (itemsPerPageNum < 999999) {
        query += ` LIMIT ${itemsPerPageNum} OFFSET ${offset}`;
      }

      console.log('Executing hemodialisa query:', query);
      console.log('Query params:', params);

      // Execute query
      const [rows] = await db.execute(query, params);

      // Remove duplicates based on no_rawat (unique identifier)
      const uniqueData = rows.filter((item, index, self) => 
        index === self.findIndex(t => t.no_rawat === item.no_rawat)
      );

      console.log('Data after deduplication:', {
        originalCount: rows.length,
        uniqueCount: uniqueData.length
      });

      // Get total count for pagination
      let countQuery = `
        SELECT COUNT(DISTINCT rp.no_rawat) as total
        FROM reg_periksa rp
        LEFT JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
        LEFT JOIN dokter d ON rp.kd_dokter = d.kd_dokter
        LEFT JOIN poliklinik pol ON rp.kd_poli = pol.kd_poli
        LEFT JOIN penjab pj ON rp.kd_pj = pj.kd_pj
        WHERE (
          pol.nm_poli LIKE '%Hemodialisa%' OR 
          pol.nm_poli LIKE '%Hemodialisis%' OR 
          pol.nm_poli LIKE '%Cuci Darah%' OR
          pol.nm_poli LIKE '%HD%'
        )
          AND DATE(rp.tgl_registrasi) BETWEEN ? AND ?
      `;

      const countParams = [startDate, endDate];

      if (normalizedSearch) {
        countQuery += `
          AND (
            rp.no_reg LIKE ? OR
            rp.no_rawat LIKE ? OR
            rp.no_rkm_medis LIKE ? OR
            p.nm_pasien LIKE ? OR
            d.nm_dokter LIKE ? OR
            pol.nm_poli LIKE ? OR
            pj.png_jawab LIKE ?
          )
        `;
        const searchPattern = `%${normalizedSearch}%`;
        countParams.push(
          searchPattern,
          searchPattern,
          searchPattern,
          searchPattern,
          searchPattern,
          searchPattern,
          searchPattern
        );
      }

      if (status && status !== 'all') {
        countQuery += ` AND rp.stts = ?`;
        countParams.push(status);
      }

      if (statusBayar && statusBayar !== 'all') {
        countQuery += ` AND rp.status_bayar = ?`;
        countParams.push(statusBayar);
      }

      console.log('Executing count query:', countQuery);
      
      const [countRows] = await db.execute(countQuery, countParams);
      const total = countRows[0]?.total || 0;

      console.log('Hemodialisa query executed successfully');
      console.log('Final data count:', uniqueData.length);
      console.log('Total records:', total);

      return {
        success: true,
        data: uniqueData,
        total,
        page: pageNum,
        itemsPerPage: itemsPerPageNum,
        totalPages: Math.ceil(total / itemsPerPageNum)
      };

    } catch (error) {
      console.error('Error in hemodialisa data service:', error);
      throw error;
    }
  }
}

export default HemodialisaDataService;
