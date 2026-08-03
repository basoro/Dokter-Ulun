import db, { executeQuery } from '../config/database.js';

class IcdDataService {
  static normalizeStatusLayanan(status) {
    return String(status || '').trim().toLowerCase() === 'ranap' ? 'Ranap' : 'Ralan';
  }

  static normalizePrioritas(prioritas) {
    if (Number(prioritas) === 1) return 1;
    return String(prioritas || '').trim().toLowerCase() === 'utama' ? 1 : 2;
  }

  static mapPrioritasLabel(prioritas) {
    return Number(prioritas) === 1 ? 'Utama' : 'Sekunder';
  }

  static async getIcdData(page = 1, itemsPerPage = 10, search = '', icdType = 'icd10', relatedIcdCode = '', relatedIcdType = 'icd10') {
    try {
      console.log('ICD data request:', { page, itemsPerPage, search, icdType });

      // Pagination parameters
      const limit = parseInt(itemsPerPage) === -1 || parseInt(itemsPerPage) > 1000 ? 10000 : Math.min(parseInt(itemsPerPage), 1000);
      const offset = (parseInt(page) - 1) * (limit === 10000 ? 0 : limit);
      
      console.log('Pagination - Page:', page, 'Items per page:', limit, 'Offset:', offset);

      let countSql = '';
      let dataSql = '';
      let params = [];

      if (icdType === 'snomed') {
        console.log('Fetching SNOMED-CT diagnosis data');

        const normalizedSearch = String(search || '').trim();
        const normalizedRelatedIcdCode = String(relatedIcdCode || '').trim();
        const normalizedRelatedIcdType = String(relatedIcdType || 'icd10').trim().toLowerCase();
        const mappingTable = normalizedRelatedIcdType === 'icd9' ? 'mlite_mapping_snomed_icd9' : 'mlite_mapping_snomed_icd';
        const mappingField = normalizedRelatedIcdType === 'icd9' ? 'kd_tindakan' : 'kd_penyakit';

        countSql = `
          SELECT COUNT(*) as total
          FROM (
            SELECT s.kode
            FROM mlite_snomed s
            LEFT JOIN ${mappingTable} m ON CAST(m.snomed_concept_id AS CHAR) = s.kode
            WHERE (
              (? <> '' AND m.${mappingField} = ?)
              OR (? <> '' AND (s.kode LIKE ? OR s.istilah LIKE ?))
              OR (? = '' AND ? = '')
            )
            GROUP BY s.kode, s.istilah
          ) snomed_results
        `;

        dataSql = `
          SELECT
            s.kode,
            s.istilah,
            MAX(CASE WHEN m.${mappingField} = ? THEN 1 ELSE 0 END) AS is_direct_map,
            GROUP_CONCAT(DISTINCT m.${mappingField} ORDER BY m.${mappingField} SEPARATOR ', ') AS related_icd_codes
          FROM mlite_snomed s
          LEFT JOIN ${mappingTable} m ON CAST(m.snomed_concept_id AS CHAR) = s.kode
          WHERE (
            (? <> '' AND m.${mappingField} = ?)
            OR (? <> '' AND (s.kode LIKE ? OR s.istilah LIKE ?))
            OR (? = '' AND ? = '')
          )
          GROUP BY s.kode, s.istilah
          ORDER BY
            is_direct_map DESC,
            CASE
              WHEN s.kode = ? THEN 0
              WHEN s.kode LIKE ? THEN 1
              WHEN s.istilah LIKE ? THEN 2
              ELSE 3
            END,
            s.istilah ASC
          ${limit === 10000 ? '' : 'LIMIT ? OFFSET ?'}
        `;

        const searchExact = normalizedSearch;
        const searchPrefix = `${normalizedSearch}%`;
        const searchLike = `%${normalizedSearch}%`;

        params = [
          normalizedRelatedIcdCode,
          normalizedRelatedIcdCode,
          normalizedSearch,
          searchLike,
          searchLike,
          normalizedRelatedIcdCode,
          normalizedSearch
        ];

        var dataParams = [
          normalizedRelatedIcdCode,
          normalizedRelatedIcdCode,
          normalizedRelatedIcdCode,
          normalizedSearch,
          searchLike,
          searchLike,
          normalizedRelatedIcdCode,
          normalizedSearch,
          searchExact,
          searchPrefix,
          searchLike
        ];
      } else if (icdType === 'loinc') {
        console.log('Fetching LOINC data');

        const loincBaseSql = `
          SELECT
            'Laboratorium' AS sumber,
            Code AS kode,
            Display AS display,
            NamaPemeriksaan AS nama_pemeriksaan,
            Kategori AS kategori,
            PermintaanHasil AS permintaan_hasil,
            Component AS component,
            Property AS property,
            Timing AS timing,
            System AS system,
            Scale AS scale,
            Method AS method,
            UnitOfMeasure AS unit_of_measure,
            CodeSystem AS code_system,
            '' AS body_site_display
          FROM mlite_loinc_lab
          UNION ALL
          SELECT
            'Radiologi' AS sumber,
            Code AS kode,
            Display AS display,
            NamaPemeriksaan AS nama_pemeriksaan,
            Kategori AS kategori,
            PermintaanHasil AS permintaan_hasil,
            Component AS component,
            Property AS property,
            Timing AS timing,
            System AS system,
            Scale AS scale,
            Method AS method,
            UnitOfMeasure AS unit_of_measure,
            CodeSystem AS code_system,
            BodySiteDisplay AS body_site_display
          FROM mlite_loinc_radiologi
        `;

        if (search && search.trim()) {
          countSql = `
            SELECT COUNT(*) as total
            FROM (${loincBaseSql}) lo
            WHERE lo.kode LIKE ?
              OR lo.display LIKE ?
              OR lo.nama_pemeriksaan LIKE ?
              OR lo.kategori LIKE ?
              OR lo.component LIKE ?
          `;

          dataSql = `
            SELECT *
            FROM (${loincBaseSql}) lo
            WHERE lo.kode LIKE ?
              OR lo.display LIKE ?
              OR lo.nama_pemeriksaan LIKE ?
              OR lo.kategori LIKE ?
              OR lo.component LIKE ?
            ORDER BY lo.kode ASC
            ${limit === 10000 ? '' : 'LIMIT ? OFFSET ?'}
          `;

          const searchTerm = `%${search}%`;
          params = [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm];
        } else {
          countSql = `
            SELECT COUNT(*) as total
            FROM (${loincBaseSql}) lo
          `;

          dataSql = `
            SELECT *
            FROM (${loincBaseSql}) lo
            ORDER BY lo.kode ASC
            ${limit === 10000 ? '' : 'LIMIT ? OFFSET ?'}
          `;

          params = [];
        }
      } else if (icdType === 'icd9') {
        // ICD-9-CM queries
        console.log('Fetching ICD-9-CM data');
        
        if (search && search.trim()) {
          countSql = `
            SELECT COUNT(*) as total
            FROM icd9
            WHERE kode LIKE ? OR deskripsi_panjang LIKE ? OR deskripsi_pendek LIKE ?
          `;
          
          dataSql = `
            SELECT 
              kode,
              deskripsi_panjang,
              deskripsi_pendek
            FROM icd9
            WHERE kode LIKE ? OR deskripsi_panjang LIKE ? OR deskripsi_pendek LIKE ?
            ORDER BY kode ASC
            ${limit === 10000 ? '' : 'LIMIT ? OFFSET ?'}
          `;
          
          const searchTerm = `%${search}%`;
          params = [searchTerm, searchTerm, searchTerm];
        } else {
          countSql = `
            SELECT COUNT(*) as total
            FROM icd9
          `;
          
          dataSql = `
            SELECT 
              kode,
              deskripsi_panjang,
              deskripsi_pendek
            FROM icd9
            ORDER BY kode ASC
            ${limit === 10000 ? '' : 'LIMIT ? OFFSET ?'}
          `;
          
          params = [];
        }
      } else {
        // ICD-10 queries (penyakit table)
        console.log('Fetching ICD-10 data');
        
        if (search && search.trim()) {
          countSql = `
            SELECT COUNT(*) as total
            FROM penyakit p
            LEFT JOIN kategori_penyakit kp ON p.kd_ktg = kp.kd_ktg
            WHERE p.kd_penyakit LIKE ? OR p.nm_penyakit LIKE ? OR p.ciri_ciri LIKE ? OR p.keterangan LIKE ?
          `;
          
          dataSql = `
            SELECT 
              p.kd_penyakit,
              p.nm_penyakit,
              p.ciri_ciri,
              p.keterangan,
              p.kd_ktg,
              p.status,
              COALESCE(kp.nm_kategori, 'Tidak Ada Kategori') as nm_kategori
            FROM penyakit p
            LEFT JOIN kategori_penyakit kp ON p.kd_ktg = kp.kd_ktg
            WHERE p.kd_penyakit LIKE ? OR p.nm_penyakit LIKE ? OR p.ciri_ciri LIKE ? OR p.keterangan LIKE ?
            ORDER BY p.kd_penyakit ASC
            ${limit === 10000 ? '' : 'LIMIT ? OFFSET ?'}
          `;
          
          const searchTerm = `%${search}%`;
          params = [searchTerm, searchTerm, searchTerm, searchTerm];
        } else {
          countSql = `
            SELECT COUNT(*) as total
            FROM penyakit p
            LEFT JOIN kategori_penyakit kp ON p.kd_ktg = kp.kd_ktg
          `;
          
          dataSql = `
            SELECT 
              p.kd_penyakit,
              p.nm_penyakit,
              p.ciri_ciri,
              p.keterangan,
              p.kd_ktg,
              p.status,
              COALESCE(kp.nm_kategori, 'Tidak Ada Kategori') as nm_kategori
            FROM penyakit p
            LEFT JOIN kategori_penyakit kp ON p.kd_ktg = kp.kd_ktg
            ORDER BY p.kd_penyakit ASC
            ${limit === 10000 ? '' : 'LIMIT ? OFFSET ?'}
          `;
          
          params = [];
        }
      }

      console.log('Executing count SQL:', countSql);
      console.log('Count parameters:', params);
      
      // Execute count query
      const [countResult] = await db.execute(countSql, params);
      const total = countResult[0]?.total || 0;
      
      console.log('Total count result:', total);
      
      const queryParams2 = limit === 10000
        ? (icdType === 'snomed' ? dataParams : params)
        : [...(icdType === 'snomed' ? dataParams : params), limit, offset];
      console.log('Executing data SQL:', dataSql);
      console.log('Data parameters:', queryParams2);
      
      const [result] = await db.execute(dataSql, queryParams2);
      
      console.log('Query executed, rows found:', result?.length || 0);

      const icdData = result?.map(row => {
        if (icdType === 'icd9') {
          return {
            kode: row.kode,
            deskripsi_panjang: row.deskripsi_panjang,
            deskripsi_pendek: row.deskripsi_pendek
          };
        } else if (icdType === 'loinc') {
          return {
            sumber: row.sumber,
            kode: row.kode,
            display: row.display,
            nama_pemeriksaan: row.nama_pemeriksaan,
            kategori: row.kategori,
            permintaan_hasil: row.permintaan_hasil,
            component: row.component,
            property: row.property,
            timing: row.timing,
            system: row.system,
            scale: row.scale,
            method: row.method,
            unit_of_measure: row.unit_of_measure,
            code_system: row.code_system,
            body_site_display: row.body_site_display
          };
        } else if (icdType === 'snomed') {
          return {
            kode: row.kode,
            istilah: row.istilah,
            is_direct_map: Boolean(row.is_direct_map),
            related_icd_codes: row.related_icd_codes || ''
          };
        } else {
          return {
            kd_penyakit: row.kd_penyakit,
            nm_penyakit: row.nm_penyakit,
            ciri_ciri: row.ciri_ciri,
            keterangan: row.keterangan,
            kd_ktg: row.kd_ktg,
            status: row.status,
            nm_kategori: row.nm_kategori
          };
        }
      }) || [];

      const totalPages = Math.ceil(total / limit);

      console.log('ICD data processed:', {
        total,
        page: parseInt(page),
        limit,
        totalPages,
        icdDataCount: icdData.length,
        icdType
      });

      return {
        success: true,
        data: icdData,
        total,
        limit,
        offset,
        page: parseInt(page),
        totalPages,
        icdType
      };

    } catch (error) {
      console.error('Error in ICD data service:', error);
      throw error;
    }
  }

  static async getPatientIcdData(noRawat, statusLayanan) {
    try {
      const normalizedNoRawat = String(noRawat || '').trim();
      const normalizedStatusLayanan = statusLayanan ? this.normalizeStatusLayanan(statusLayanan) : '';
      if (!normalizedNoRawat) {
        throw new Error('no_rawat wajib diisi');
      }

      const icd10Query = `
        SELECT
          CONCAT(dp.no_rawat, '|', dp.kd_penyakit, '|', dp.status, '|', dp.prioritas) AS id,
          dp.kd_penyakit,
          COALESCE(p.nm_penyakit, '') AS nm_penyakit,
          COALESCE(p.ciri_ciri, '') AS ciri_ciri,
          COALESCE(p.keterangan, '') AS keterangan,
          COALESCE(p.status, 'Tidak Menular') AS status,
          dp.status AS status_layanan,
          dp.prioritas,
          CAST(COALESCE(sm.snomed_concept_id, '') AS CHAR) AS snomed_concept_id,
          COALESCE(sm.snomed_term, '') AS snomed_term
        FROM diagnosa_pasien dp
        LEFT JOIN penyakit p ON p.kd_penyakit = dp.kd_penyakit
        LEFT JOIN (
          SELECT m.no_rawat, m.kd_penyakit, m.snomed_concept_id, m.snomed_term
          FROM mlite_mapping_snomed_icd m
          INNER JOIN (
            SELECT no_rawat, kd_penyakit, MAX(id) AS latest_id
            FROM mlite_mapping_snomed_icd
            WHERE no_rawat = ?
            GROUP BY no_rawat, kd_penyakit
          ) latest ON latest.latest_id = m.id
        ) sm ON sm.no_rawat = dp.no_rawat AND sm.kd_penyakit = dp.kd_penyakit
        WHERE dp.no_rawat = ?
        ${normalizedStatusLayanan ? 'AND dp.status = ?' : ''}
        ORDER BY dp.prioritas ASC, dp.kd_penyakit ASC
      `;

      const icd9Query = `
        SELECT
          CONCAT(pp.no_rawat, '|', pp.kode, '|', pp.status, '|', pp.prioritas) AS id,
          pp.kode,
          COALESCE(i9.deskripsi_panjang, '') AS deskripsi_panjang,
          COALESCE(i9.deskripsi_pendek, '') AS deskripsi_pendek,
          pp.status AS status_layanan,
          pp.prioritas,
          CAST(COALESCE(sm9.snomed_concept_id, '') AS CHAR) AS snomed_concept_id,
          COALESCE(sm9.snomed_term, '') AS snomed_term
        FROM prosedur_pasien pp
        LEFT JOIN icd9 i9 ON i9.kode = pp.kode
        LEFT JOIN (
          SELECT m.no_rawat, m.kd_tindakan, m.snomed_concept_id, m.snomed_term
          FROM mlite_mapping_snomed_icd9 m
          INNER JOIN (
            SELECT no_rawat, kd_tindakan, MAX(id) AS latest_id
            FROM mlite_mapping_snomed_icd9
            WHERE no_rawat = ?
            GROUP BY no_rawat, kd_tindakan
          ) latest ON latest.latest_id = m.id
        ) sm9 ON sm9.no_rawat = pp.no_rawat AND sm9.kd_tindakan = pp.kode
        WHERE pp.no_rawat = ?
        ${normalizedStatusLayanan ? 'AND pp.status = ?' : ''}
        ORDER BY pp.prioritas ASC, pp.kode ASC
      `;

      const icd10Params = normalizedStatusLayanan
        ? [normalizedNoRawat, normalizedNoRawat, normalizedStatusLayanan]
        : [normalizedNoRawat, normalizedNoRawat];
      const icd9Params = normalizedStatusLayanan
        ? [normalizedNoRawat, normalizedNoRawat, normalizedStatusLayanan]
        : [normalizedNoRawat, normalizedNoRawat];

      const [icd10Rows] = await db.execute(icd10Query, icd10Params);
      const [icd9Rows] = await db.execute(icd9Query, icd9Params);

      return {
        success: true,
        data: {
          icd10: (icd10Rows || []).map((row) => ({
            id: row.id,
            kd_penyakit: row.kd_penyakit,
            nm_penyakit: row.nm_penyakit,
            ciri_ciri: row.ciri_ciri,
            keterangan: row.keterangan,
            status: row.status,
            prioritas: this.mapPrioritasLabel(row.prioritas),
            status_layanan: this.normalizeStatusLayanan(row.status_layanan),
            snomed_concept_id: row.snomed_concept_id,
            snomed_term: row.snomed_term
          })),
          icd9: (icd9Rows || []).map((row) => ({
            id: row.id,
            kode: row.kode,
            deskripsi_panjang: row.deskripsi_panjang,
            deskripsi_pendek: row.deskripsi_pendek,
            prioritas: this.mapPrioritasLabel(row.prioritas),
            status_layanan: this.normalizeStatusLayanan(row.status_layanan),
            snomed_concept_id: row.snomed_concept_id,
            snomed_term: row.snomed_term
          }))
        }
      };
    } catch (error) {
      console.error('Error loading patient ICD data:', error);
      throw error;
    }
  }

  static async getPreviousVisitIcdData(noRkmMedis, excludeNoRawat = '', statusLayanan = '') {
    try {
      const normalizedNoRkmMedis = String(noRkmMedis || '').trim();
      const normalizedExcludeNoRawat = String(excludeNoRawat || '').trim();
      const normalizedStatusLayanan = statusLayanan ? this.normalizeStatusLayanan(statusLayanan) : '';

      if (!normalizedNoRkmMedis) {
        throw new Error('no_rkm_medis wajib diisi');
      }

      const icd10Query = `
        SELECT
          rp.no_rawat,
          rp.no_rkm_medis,
          DATE_FORMAT(rp.tgl_registrasi, '%Y-%m-%d') AS tgl_registrasi,
          TIME_FORMAT(rp.jam_reg, '%H:%i') AS jam_registrasi,
          COALESCE(rp.status_lanjut, '') AS status_lanjut,
          COALESCE(pol.nm_poli, '') AS nm_poli,
          COALESCE(dok.nm_dokter, '') AS nm_dokter,
          CONCAT(dp.no_rawat, '|', dp.kd_penyakit, '|', dp.status, '|', dp.prioritas) AS id,
          dp.kd_penyakit,
          COALESCE(p.nm_penyakit, '') AS nm_penyakit,
          COALESCE(p.ciri_ciri, '') AS ciri_ciri,
          COALESCE(p.keterangan, '') AS keterangan,
          COALESCE(p.status, 'Tidak Menular') AS status,
          dp.status AS status_layanan,
          dp.prioritas,
          CAST(COALESCE(sm.snomed_concept_id, '') AS CHAR) AS snomed_concept_id,
          COALESCE(sm.snomed_term, '') AS snomed_term
        FROM reg_periksa rp
        INNER JOIN diagnosa_pasien dp ON dp.no_rawat = rp.no_rawat
        LEFT JOIN penyakit p ON p.kd_penyakit = dp.kd_penyakit
        LEFT JOIN poliklinik pol ON pol.kd_poli = rp.kd_poli
        LEFT JOIN dokter dok ON dok.kd_dokter = rp.kd_dokter
        LEFT JOIN (
          SELECT m.no_rawat, m.kd_penyakit, m.snomed_concept_id, m.snomed_term
          FROM mlite_mapping_snomed_icd m
          INNER JOIN (
            SELECT no_rawat, kd_penyakit, MAX(id) AS latest_id
            FROM mlite_mapping_snomed_icd
            GROUP BY no_rawat, kd_penyakit
          ) latest ON latest.latest_id = m.id
        ) sm ON sm.no_rawat = dp.no_rawat AND sm.kd_penyakit = dp.kd_penyakit
        WHERE rp.no_rkm_medis = ?
          AND (? = '' OR rp.no_rawat <> ?)
          AND (? = '' OR dp.status = ?)
        ORDER BY rp.tgl_registrasi DESC, rp.jam_reg DESC, dp.prioritas ASC, dp.kd_penyakit ASC
      `;

      const icd9Query = `
        SELECT
          rp.no_rawat,
          rp.no_rkm_medis,
          DATE_FORMAT(rp.tgl_registrasi, '%Y-%m-%d') AS tgl_registrasi,
          TIME_FORMAT(rp.jam_reg, '%H:%i') AS jam_registrasi,
          COALESCE(rp.status_lanjut, '') AS status_lanjut,
          COALESCE(pol.nm_poli, '') AS nm_poli,
          COALESCE(dok.nm_dokter, '') AS nm_dokter,
          CONCAT(pp.no_rawat, '|', pp.kode, '|', pp.status, '|', pp.prioritas) AS id,
          pp.kode,
          COALESCE(i9.deskripsi_panjang, '') AS deskripsi_panjang,
          COALESCE(i9.deskripsi_pendek, '') AS deskripsi_pendek,
          pp.status AS status_layanan,
          pp.prioritas,
          CAST(COALESCE(sm9.snomed_concept_id, '') AS CHAR) AS snomed_concept_id,
          COALESCE(sm9.snomed_term, '') AS snomed_term
        FROM reg_periksa rp
        INNER JOIN prosedur_pasien pp ON pp.no_rawat = rp.no_rawat
        LEFT JOIN icd9 i9 ON i9.kode = pp.kode
        LEFT JOIN poliklinik pol ON pol.kd_poli = rp.kd_poli
        LEFT JOIN dokter dok ON dok.kd_dokter = rp.kd_dokter
        LEFT JOIN (
          SELECT m.no_rawat, m.kd_tindakan, m.snomed_concept_id, m.snomed_term
          FROM mlite_mapping_snomed_icd9 m
          INNER JOIN (
            SELECT no_rawat, kd_tindakan, MAX(id) AS latest_id
            FROM mlite_mapping_snomed_icd9
            GROUP BY no_rawat, kd_tindakan
          ) latest ON latest.latest_id = m.id
        ) sm9 ON sm9.no_rawat = pp.no_rawat AND sm9.kd_tindakan = pp.kode
        WHERE rp.no_rkm_medis = ?
          AND (? = '' OR rp.no_rawat <> ?)
          AND (? = '' OR pp.status = ?)
        ORDER BY rp.tgl_registrasi DESC, rp.jam_reg DESC, pp.prioritas ASC, pp.kode ASC
      `;

      const params = [
        normalizedNoRkmMedis,
        normalizedExcludeNoRawat,
        normalizedExcludeNoRawat,
        normalizedStatusLayanan,
        normalizedStatusLayanan
      ];

      const [icd10Rows, icd9Rows] = await Promise.all([
        executeQuery(icd10Query, params),
        executeQuery(icd9Query, params)
      ]);

      const historyMap = new Map();

      const getEntry = (row) => {
        const visitKey = String(row?.no_rawat || '').trim();
        if (!historyMap.has(visitKey)) {
          historyMap.set(visitKey, {
            no_rawat: visitKey,
            no_rkm_medis: String(row?.no_rkm_medis || '').trim(),
            tgl_registrasi: String(row?.tgl_registrasi || '').trim(),
            jam_registrasi: String(row?.jam_registrasi || '').trim(),
            status_lanjut: String(row?.status_lanjut || '').trim(),
            nm_poli: String(row?.nm_poli || '').trim(),
            nm_dokter: String(row?.nm_dokter || '').trim(),
            icd10: [],
            icd9: []
          });
        }

        return historyMap.get(visitKey);
      };

      (Array.isArray(icd10Rows) ? icd10Rows : []).forEach((row) => {
        const entry = getEntry(row);
        entry.icd10.push({
          id: row.id,
          kd_penyakit: row.kd_penyakit,
          nm_penyakit: row.nm_penyakit,
          ciri_ciri: row.ciri_ciri,
          keterangan: row.keterangan,
          status: row.status,
          prioritas: this.mapPrioritasLabel(row.prioritas),
          status_layanan: this.normalizeStatusLayanan(row.status_layanan),
          snomed_concept_id: row.snomed_concept_id,
          snomed_term: row.snomed_term
        });
      });

      (Array.isArray(icd9Rows) ? icd9Rows : []).forEach((row) => {
        const entry = getEntry(row);
        entry.icd9.push({
          id: row.id,
          kode: row.kode,
          deskripsi_panjang: row.deskripsi_panjang,
          deskripsi_pendek: row.deskripsi_pendek,
          prioritas: this.mapPrioritasLabel(row.prioritas),
          status_layanan: this.normalizeStatusLayanan(row.status_layanan),
          snomed_concept_id: row.snomed_concept_id,
          snomed_term: row.snomed_term
        });
      });

      return {
        success: true,
        data: Array.from(historyMap.values())
      };
    } catch (error) {
      console.error('Error loading previous visit ICD data:', error);
      throw error;
    }
  }

  static async savePatientIcdData(payload = {}) {
    const connection = await db.getConnection();
    let hasCommitted = false;

    try {
      const normalizedNoRawat = String(payload.no_rawat || '').trim();
      const normalizedIcdType = String(payload.icdType || 'icd10').trim().toLowerCase();
      const items = Array.isArray(payload.items) ? payload.items : [];
      const contextStatusLayanan = this.normalizeStatusLayanan(payload.status_layanan);

      if (!normalizedNoRawat) {
        throw new Error('no_rawat wajib diisi');
      }

      if (!['icd10', 'icd9'].includes(normalizedIcdType)) {
        throw new Error('Tipe ICD tidak valid');
      }

      await connection.beginTransaction();

      if (normalizedIcdType === 'icd10') {
        await connection.execute(
          'DELETE FROM diagnosa_pasien WHERE no_rawat = ? AND status = ?',
          [normalizedNoRawat, contextStatusLayanan]
        );

        const validItems = items.filter((item) => String(item?.kd_penyakit || '').trim());

        for (const item of validItems) {
          const kdPenyakit = String(item.kd_penyakit || '').trim();
          const statusLayanan = contextStatusLayanan;
          const prioritas = this.normalizePrioritas(item.prioritas);
          const statusPenyakit = String(item.status_penyakit || 'Baru').trim() || 'Baru';
          const snomedConceptId = String(item.snomed_concept_id || '').trim();
          const snomedTerm = String(item.snomed_term || '').trim();

          await connection.execute(
            `INSERT INTO diagnosa_pasien (no_rawat, kd_penyakit, status, prioritas, status_penyakit)
             VALUES (?, ?, ?, ?, ?)`,
            [normalizedNoRawat, kdPenyakit, statusLayanan, prioritas, statusPenyakit]
          );

          if (snomedConceptId) {
            await connection.execute(
              `INSERT INTO mlite_mapping_snomed_icd (no_rawat, kd_penyakit, snomed_concept_id, snomed_term, status_penyakit)
               VALUES (?, ?, ?, ?, ?)`,
              [normalizedNoRawat, kdPenyakit, snomedConceptId, snomedTerm || '-', statusPenyakit]
            );
          }
        }
      } else {
        await connection.execute(
          'DELETE FROM prosedur_pasien WHERE no_rawat = ? AND status = ?',
          [normalizedNoRawat, contextStatusLayanan]
        );

        const validItems = items.filter((item) => String(item?.kode || '').trim());

        for (const item of validItems) {
          const kode = String(item.kode || '').trim();
          const statusLayanan = contextStatusLayanan;
          const prioritas = this.normalizePrioritas(item.prioritas);
          const snomedConceptId = String(item.snomed_concept_id || '').trim();
          const snomedTerm = String(item.snomed_term || '').trim();

          await connection.execute(
            `INSERT INTO prosedur_pasien (no_rawat, kode, status, prioritas)
             VALUES (?, ?, ?, ?)`,
            [normalizedNoRawat, kode, statusLayanan, prioritas]
          );

          if (snomedConceptId) {
            await connection.execute(
              `INSERT INTO mlite_mapping_snomed_icd9 (no_rawat, kd_tindakan, snomed_concept_id, snomed_term)
               VALUES (?, ?, ?, ?)`,
              [normalizedNoRawat, kode, snomedConceptId, snomedTerm || '-']
            );
          }
        }
      }

      await connection.commit();
      hasCommitted = true;
      return await this.getPatientIcdData(normalizedNoRawat, contextStatusLayanan);
    } catch (error) {
      if (!hasCommitted) {
        await connection.rollback();
      }
      console.error('Error saving patient ICD data:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  static async deletePatientIcdItem(payload = {}) {
    const connection = await db.getConnection();
    let hasCommitted = false;

    try {
      const normalizedNoRawat = String(payload.no_rawat || '').trim();
      const normalizedIcdType = String(payload.icdType || 'icd10').trim().toLowerCase();
      const normalizedStatus = this.normalizeStatusLayanan(payload.status_layanan);
      const normalizedPrioritas = this.normalizePrioritas(payload.prioritas);

      if (!normalizedNoRawat) {
        throw new Error('no_rawat wajib diisi');
      }

      await connection.beginTransaction();

      if (normalizedIcdType === 'icd10') {
        const kdPenyakit = String(payload.kd_penyakit || '').trim();
        if (!kdPenyakit) {
          throw new Error('kd_penyakit wajib diisi');
        }

        await connection.execute(
          'DELETE FROM diagnosa_pasien WHERE no_rawat = ? AND kd_penyakit = ? AND status = ? AND prioritas = ?',
          [normalizedNoRawat, kdPenyakit, normalizedStatus, normalizedPrioritas]
        );
        await connection.execute(
          'DELETE FROM mlite_mapping_snomed_icd WHERE no_rawat = ? AND kd_penyakit = ?',
          [normalizedNoRawat, kdPenyakit]
        );
      } else {
        const kode = String(payload.kode || '').trim();
        if (!kode) {
          throw new Error('kode wajib diisi');
        }

        await connection.execute(
          'DELETE FROM prosedur_pasien WHERE no_rawat = ? AND kode = ? AND status = ? AND prioritas = ?',
          [normalizedNoRawat, kode, normalizedStatus, normalizedPrioritas]
        );
        await connection.execute(
          'DELETE FROM mlite_mapping_snomed_icd9 WHERE no_rawat = ? AND kd_tindakan = ?',
          [normalizedNoRawat, kode]
        );
      }

      await connection.commit();
      hasCommitted = true;
      return await this.getPatientIcdData(normalizedNoRawat);
    } catch (error) {
      if (!hasCommitted) {
        await connection.rollback();
      }
      console.error('Error deleting patient ICD data:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
}

export default IcdDataService;
