import db from '../config/database.js';

const CATEGORY_ORDER = ['Assessment', 'Monitoring', 'Tindakan', 'Obat', 'Laboratorium', 'Radiologi', 'Nutrisi', 'Edukasi', 'Outcome'];
const DEFAULT_MASTER_CP_PRESETS = [
  { kode_cp: 'CP-HERNIA', nama_cp: 'Hernia' },
  { kode_cp: 'CP-SC', nama_cp: 'SC' },
  { kode_cp: 'CP-LUNGTB', nama_cp: 'Lung TB' },
  { kode_cp: 'CP-HIPERTENSI', nama_cp: 'Hipertensi' },
  { kode_cp: 'CP-PNEUMONIA', nama_cp: 'Pneumonia' },
  { kode_cp: 'CP-HIPEREMESIS', nama_cp: 'Hiperemesis gravid' },
  { kode_cp: 'CP-KLW', nama_cp: 'Kehamilan lewat waktu' },
  { kode_cp: 'CP-APP', nama_cp: 'APP' },
  { kode_cp: 'CP-TUMOR-MAMAE', nama_cp: 'Tumor Mamae' },
  { kode_cp: 'CP-GEA', nama_cp: 'GEA' },
  { kode_cp: 'CP-ABORTUS-INKOMPLIT', nama_cp: 'Abortus Inkomplit' },
  { kode_cp: 'CP-PEB', nama_cp: 'PEB' },
  { kode_cp: 'CP-PERSALINAN-NORMAL', nama_cp: 'Persalinan Normal' },
  { kode_cp: 'CP-CHF', nama_cp: 'CHF' },
  { kode_cp: 'CP-TONSILITIS', nama_cp: 'Tonsilitis' }
];

class ClinicalPathwayService {
  normalizeNoRawat(noRawat) {
    const value = String(noRawat || '').trim();
    if (!value) {
      return '';
    }

    if (value.includes('/')) {
      return value;
    }

    if (value.length >= 8) {
      return `${value.substring(0, 4)}/${value.substring(4, 6)}/${value.substring(6, 8)}/${value.substring(8)}`;
    }

    return value;
  }

  normalizeStatusLanjut(statusLanjut) {
    return String(statusLanjut || '').trim() === 'Ralan' ? 'Ralan' : 'Ranap';
  }

  formatDateOnly(value) {
    if (!value) {
      return '';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toISOString().slice(0, 10);
  }

  calculateDayOffset(startDate, actionDate) {
    const start = new Date(startDate);
    const action = new Date(actionDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(action.getTime())) {
      return null;
    }

    const diffMs = action.getTime() - start.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays < 1) {
      return 1;
    }

    return diffDays > 14 ? 14 : diffDays;
  }

  combineDateTime(dateValue, timeValue = '00:00:00') {
    const datePart = String(dateValue || '').trim();
    const timePart = String(timeValue || '').trim() || '00:00:00';
    if (!datePart) {
      return new Date().toISOString().slice(0, 19).replace('T', ' ');
    }

    const combined = new Date(`${datePart}T${timePart}`);
    if (Number.isNaN(combined.getTime())) {
      return new Date().toISOString().slice(0, 19).replace('T', ' ');
    }

    return combined.toISOString().slice(0, 19).replace('T', ' ');
  }

  complianceLabel(value) {
    if (value >= 80) return 'Sangat Patuh';
    if (value >= 60) return 'Patuh';
    if (value >= 40) return 'Kurang Patuh';
    return 'Tidak Patuh';
  }

  sanitizeLabel(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  getDefaultMasterPathwayPresets() {
    return DEFAULT_MASTER_CP_PRESETS.map((item, index) => ({
      kode_cp: item.kode_cp,
      nama_cp: item.nama_cp,
      jenis_layanan: 'Ranap',
      target_los: 3,
      target_tarif: 0,
      confidence_score: Math.max(1, 100 - index),
      evidence_note: 'Preset default Clinical Pathway',
      guideline_note: 'Seed default master clinical pathway',
      aktif: 'Ya'
    }));
  }

  async ensureMasterCodeUniqueConstraint(connection) {
    const [duplicateRows] = await connection.execute(
      `SELECT kode_cp, COUNT(*) AS total
       FROM mlite_clinical_pathway
       WHERE kode_cp IS NOT NULL AND TRIM(kode_cp) <> ''
       GROUP BY kode_cp
       HAVING COUNT(*) > 1
       LIMIT 5`
    );

    if (duplicateRows.length) {
      const duplicateCodes = duplicateRows.map((row) => String(row.kode_cp || '').trim()).filter(Boolean);
      throw new Error(`Tidak bisa membuat unique index kode_cp karena masih ada duplikasi: ${duplicateCodes.join(', ')}`);
    }

    const [indexRows] = await connection.execute(
      `SELECT INDEX_NAME
       FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'mlite_clinical_pathway'
         AND COLUMN_NAME = 'kode_cp'
         AND NON_UNIQUE = 0`
    );

    const hasUniqueIndex = Array.isArray(indexRows) && indexRows.some((row) => String(row?.INDEX_NAME || '').trim());
    if (!hasUniqueIndex) {
      await connection.execute(
        'ALTER TABLE mlite_clinical_pathway ADD CONSTRAINT uq_mlite_clinical_pathway_kode_cp UNIQUE (kode_cp)'
      );
    }
  }

  inferUraianKegiatan(kategori, aktivitas) {
    const category = this.sanitizeLabel(kategori);
    const activity = this.sanitizeLabel(aktivitas).toLowerCase();

    if (category === 'Assessment') {
      if (activity.includes('monitor')) return 'Monitoring dan Evaluasi';
      return 'Asesmen Awal';
    }
    if (category === 'Laboratorium') return 'Pemeriksaan Laboratorium';
    if (category === 'Radiologi') return 'Pemeriksaan Radiologi';
    if (category === 'Obat') return 'Farmasi';
    if (category === 'Tindakan') return 'Tatalaksana / Intervensi';
    if (category === 'Monitoring') return 'Monitoring dan Evaluasi';
    return category || 'Monitoring';
  }

  buildInClause(values) {
    const cleanValues = values.filter(Boolean);
    return {
      placeholders: cleanValues.map(() => '?').join(','),
      params: cleanValues
    };
  }

  async getRegistration(noRkmMedis, noRawat) {
    const [rows] = await db.execute(
      `SELECT
        p.no_rkm_medis,
        p.nm_pasien,
        p.jk,
        p.tgl_lahir,
        p.alamat,
        p.no_tlp,
        r.no_rawat,
        r.tgl_registrasi,
        r.jam_reg,
        r.kd_dokter,
        d.nm_dokter,
        r.kd_poli,
        po.nm_poli,
        r.no_reg,
        r.kd_pj,
        pj.png_jawab,
        r.status_lanjut,
        TIMESTAMPDIFF(YEAR, p.tgl_lahir, CURDATE()) AS umur
      FROM pasien p
      INNER JOIN reg_periksa r ON p.no_rkm_medis = r.no_rkm_medis
      LEFT JOIN dokter d ON r.kd_dokter = d.kd_dokter
      LEFT JOIN poliklinik po ON r.kd_poli = po.kd_poli
      LEFT JOIN penjab pj ON r.kd_pj = pj.kd_pj
      WHERE p.no_rkm_medis = ? AND r.no_rawat = ?
      LIMIT 1`,
      [noRkmMedis, noRawat]
    );

    return rows[0] || null;
  }

  async getDiagnoses(noRawat, statusLanjut) {
    const [rows] = await db.execute(
      `SELECT dp.kd_penyakit, COALESCE(py.nm_penyakit, '') AS nm_penyakit, dp.prioritas, dp.status
       FROM diagnosa_pasien dp
       LEFT JOIN penyakit py ON py.kd_penyakit = dp.kd_penyakit
       WHERE dp.no_rawat = ? AND dp.status = ?
       ORDER BY dp.prioritas ASC, dp.kd_penyakit ASC`,
      [noRawat, statusLanjut]
    );

    if (rows.length) {
      return rows;
    }

    const [fallbackRows] = await db.execute(
      `SELECT dp.kd_penyakit, COALESCE(py.nm_penyakit, '') AS nm_penyakit, dp.prioritas, dp.status
       FROM diagnosa_pasien dp
       LEFT JOIN penyakit py ON py.kd_penyakit = dp.kd_penyakit
       WHERE dp.no_rawat = ?
       ORDER BY dp.prioritas ASC, dp.kd_penyakit ASC`,
      [noRawat]
    );
    return fallbackRows;
  }

  async getExistingPatientPathway(noRawat) {
    const [rows] = await db.execute(
      `SELECT
        p.id,
        p.no_rawat,
        p.clinical_pathway_id,
        p.kd_penyakit,
        p.tanggal_mulai,
        p.tanggal_selesai,
        p.status AS status_cp,
        c.kode_cp,
        c.nama_cp,
        c.jenis_layanan AS status_layanan,
        c.target_los,
        COALESCE(comp.compliance_percentage, 0) AS compliance_percentage
      FROM mlite_clinical_pathway_patient p
      INNER JOIN mlite_clinical_pathway c ON c.id = p.clinical_pathway_id
      LEFT JOIN mlite_clinical_pathway_compliance comp ON comp.clinical_pathway_patient_id = p.id
      WHERE p.no_rawat = ?
      LIMIT 1`,
      [noRawat]
    );

    return rows[0] || null;
  }

  async getMasterRecommendations(diagnosisCodes, statusLanjut) {
    if (!diagnosisCodes.length) {
      return [];
    }

    const { placeholders, params } = this.buildInClause(diagnosisCodes);
    const baseQuery = `
      SELECT
        c.id,
        c.kode_cp,
        c.nama_cp,
        c.jenis_layanan AS status_layanan,
        c.target_los,
        c.confidence_score,
        COUNT(DISTINCT d.kd_penyakit) AS matched_icd_count,
        MIN(d.prioritas) AS min_prioritas,
        GROUP_CONCAT(DISTINCT CONCAT(d.kd_penyakit, '::', COALESCE(py.nm_penyakit, '')) ORDER BY d.prioritas ASC SEPARATOR '||') AS matched_icd_labels
      FROM mlite_clinical_pathway c
      INNER JOIN mlite_clinical_pathway_diagnosis d ON d.clinical_pathway_id = c.id
      LEFT JOIN penyakit py ON py.kd_penyakit = d.kd_penyakit
      WHERE d.kd_penyakit IN (${placeholders})
        AND c.aktif = 'Ya'
        %STATUS_FILTER%
      GROUP BY c.id, c.kode_cp, c.nama_cp, c.jenis_layanan, c.target_los, c.confidence_score
      ORDER BY matched_icd_count DESC, min_prioritas ASC, c.confidence_score DESC, c.nama_cp ASC
      LIMIT 10
    `;

    const [withStatus] = await db.execute(
      baseQuery.replace('%STATUS_FILTER%', 'AND c.jenis_layanan = ?'),
      [...params, statusLanjut]
    );
    let rows = withStatus;
    if (!rows.length) {
      const [fallbackRows] = await db.execute(
        baseQuery.replace('%STATUS_FILTER%', ''),
        params
      );
      rows = fallbackRows;
    }

    return rows.map((row) => ({
      ...row,
      matched_diagnoses: String(row.matched_icd_labels || '')
        .split('||')
        .filter(Boolean)
        .map((item) => {
          const [kd_penyakit, nm_penyakit = ''] = item.split('::');
          return { kd_penyakit, nm_penyakit };
        })
    }));
  }

  async getMasterRecommendationById(clinicalPathwayId, diagnosisCodes = []) {
    const id = Number(clinicalPathwayId || 0);
    if (!id) {
      return null;
    }

    const [masterRows] = await db.execute(
      `SELECT
        c.id,
        c.kode_cp,
        c.nama_cp,
        c.jenis_layanan AS status_layanan,
        c.target_los,
        c.confidence_score
      FROM mlite_clinical_pathway c
      WHERE c.id = ?
      LIMIT 1`,
      [id]
    );

    const master = masterRows[0];
    if (!master) {
      return null;
    }

    const [diagnosisRows] = await db.execute(
      `SELECT
        d.kd_penyakit,
        COALESCE(py.nm_penyakit, '') AS nm_penyakit,
        d.prioritas
      FROM mlite_clinical_pathway_diagnosis d
      LEFT JOIN penyakit py ON py.kd_penyakit = d.kd_penyakit
      WHERE d.clinical_pathway_id = ?
      ORDER BY d.prioritas ASC, d.id ASC`,
      [id]
    );

    const selectedDiagnosisCodes = new Set(
      Array.isArray(diagnosisCodes)
        ? diagnosisCodes.map((item) => String(item || '').trim()).filter(Boolean)
        : []
    );

    const matchedDiagnoses = diagnosisRows
      .filter((row) => selectedDiagnosisCodes.has(String(row.kd_penyakit || '').trim()))
      .map((row) => ({
        kd_penyakit: row.kd_penyakit,
        nm_penyakit: row.nm_penyakit || ''
      }));

    const minPrioritas = diagnosisRows.reduce((lowest, row) => {
      const current = Number(row.prioritas || 0);
      if (!current) {
        return lowest;
      }

      return lowest === null ? current : Math.min(lowest, current);
    }, null);

    return {
      ...master,
      matched_icd_count: matchedDiagnoses.length,
      min_prioritas: minPrioritas || 9999,
      matched_diagnoses: matchedDiagnoses
    };
  }

  async getMasterTemplate(clinicalPathwayId) {
    if (!clinicalPathwayId) {
      return [];
    }

    const [rows] = await db.execute(
      `SELECT
        d.hari_ke,
        COALESCE(d.label_hari, CONCAT('Hari ', d.hari_ke)) AS label_hari,
        a.kategori,
        COALESCE(a.uraian_kegiatan, '') AS uraian_kegiatan,
        a.item_nama,
        COALESCE(a.keterangan, '') AS keterangan,
        a.evidence_frequency,
        a.evidence_percentage
      FROM mlite_clinical_pathway_activity a
      INNER JOIN mlite_clinical_pathway_day d ON d.id = a.clinical_pathway_day_id
      WHERE d.clinical_pathway_id = ?
      ORDER BY d.hari_ke ASC, a.urutan ASC, a.id ASC`,
      [clinicalPathwayId]
    );

    return this.groupTemplateRows(rows, { sourceCaseCount: 0, generatedFromHistory: false });
  }

  groupTemplateRows(rows, options = {}) {
    const grouped = new Map();

    rows.forEach((row) => {
      const hariKe = Number(row.hari_ke || 1);
      if (!grouped.has(hariKe)) {
        grouped.set(hariKe, {
          hari_ke: hariKe,
          label_hari: row.label_hari || `Hari ${hariKe}`,
          activities: []
        });
      }

      grouped.get(hariKe).activities.push({
        kategori: row.kategori,
        uraian_kegiatan: row.uraian_kegiatan || this.inferUraianKegiatan(row.kategori, row.item_nama),
        item_nama: row.item_nama,
        keterangan: row.keterangan || '',
        frequency: Number(row.evidence_frequency || 0),
        coverage_percentage: Number(row.evidence_percentage || 0)
      });
    });

    return {
      source_case_count: Number(options.sourceCaseCount || 0),
      generated_from_history: Boolean(options.generatedFromHistory),
      days: Array.from(grouped.values()).sort((a, b) => a.hari_ke - b.hari_ke)
    };
  }

  addHistoricalAggregate(aggregateMap, caseCount, payload) {
    const {
      noRawat,
      startDate,
      actionDate,
      kategori,
      itemNama,
      keterangan = '',
      sourceType = ''
    } = payload;

    const dayOffset = this.calculateDayOffset(startDate, actionDate);
    const cleanItem = this.sanitizeLabel(itemNama);
    if (!dayOffset || !cleanItem) {
      return;
    }

    const category = kategori;
    const key = `${dayOffset}|${category}|${cleanItem}`;
    if (!aggregateMap.has(key)) {
      aggregateMap.set(key, {
        hari_ke: dayOffset,
        label_hari: `Hari ${dayOffset}`,
        kategori: category,
        uraian_kegiatan: this.inferUraianKegiatan(category, cleanItem),
        item_nama: cleanItem,
        keterangan: this.sanitizeLabel(keterangan),
        frequency: 0,
        cases: new Set(),
        source_type: sourceType
      });
    }

    const entry = aggregateMap.get(key);
    entry.frequency += 1;
    entry.cases.add(noRawat);
    entry.coverage_percentage = caseCount > 0
      ? Number(((entry.cases.size / caseCount) * 100).toFixed(2))
      : 0;
  }

  async buildHistoricalTemplate({ diagnosisCodes, statusLanjut }) {
    if (!diagnosisCodes.length) {
      return { source_case_count: 0, generated_from_history: true, days: [] };
    }

    const { placeholders, params } = this.buildInClause(diagnosisCodes);
    const [caseRows] = await db.execute(
      `SELECT DISTINCT
        rp.no_rawat,
        COALESCE(ki.tgl_masuk, rp.tgl_registrasi) AS start_date
      FROM reg_periksa rp
      INNER JOIN diagnosa_pasien dp ON dp.no_rawat = rp.no_rawat AND dp.status = rp.status_lanjut
      LEFT JOIN (
        SELECT no_rawat, MIN(tgl_masuk) AS tgl_masuk
        FROM kamar_inap
        GROUP BY no_rawat
      ) ki ON ki.no_rawat = rp.no_rawat
      WHERE dp.kd_penyakit IN (${placeholders})
        AND rp.status_lanjut = ?
        AND rp.tgl_registrasi >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)
      ORDER BY rp.tgl_registrasi DESC
      LIMIT 120`,
      [...params, statusLanjut]
    );

    if (!caseRows.length) {
      return { source_case_count: 0, generated_from_history: true, days: [] };
    }

    const caseCount = caseRows.length;
    const caseStartMap = new Map(caseRows.map((row) => [row.no_rawat, this.formatDateOnly(row.start_date)]));
    const caseNoRawat = caseRows.map((row) => row.no_rawat);
    const caseClause = this.buildInClause(caseNoRawat);
    const aggregateMap = new Map();
    const examTable = statusLanjut === 'Ranap' ? 'pemeriksaan_ranap' : 'pemeriksaan_ralan';
    const procedurePrefix = statusLanjut === 'Ranap' ? 'rawat_inap' : 'rawat_jl';
    const procedureReferenceTable = statusLanjut === 'Ranap' ? 'jns_perawatan_inap' : 'jns_perawatan';

    const [examRows, procedureRows, medicationRows, labRows, radiologyRows] = await Promise.all([
      db.execute(
        `SELECT no_rawat, tgl_perawatan
         FROM ${examTable}
         WHERE no_rawat IN (${caseClause.placeholders})
         GROUP BY no_rawat, tgl_perawatan`,
        caseClause.params
      ),
      db.execute(
        `SELECT tindakan.no_rawat, tindakan.tgl_perawatan, jp.nm_perawatan
         FROM (
           SELECT no_rawat, kd_jenis_prw, tgl_perawatan FROM ${procedurePrefix}_dr WHERE no_rawat IN (${caseClause.placeholders})
           UNION ALL
           SELECT no_rawat, kd_jenis_prw, tgl_perawatan FROM ${procedurePrefix}_pr WHERE no_rawat IN (${caseClause.placeholders})
           UNION ALL
           SELECT no_rawat, kd_jenis_prw, tgl_perawatan FROM ${procedurePrefix}_drpr WHERE no_rawat IN (${caseClause.placeholders})
         ) tindakan
         LEFT JOIN ${procedureReferenceTable} jp ON jp.kd_jenis_prw = tindakan.kd_jenis_prw
         WHERE COALESCE(jp.nm_perawatan, '') <> ''`,
        [...caseClause.params, ...caseClause.params, ...caseClause.params]
      ),
      db.execute(
        `SELECT ro.no_rawat, ro.tgl_peresepan, db.nama_brng
         FROM resep_obat ro
         INNER JOIN resep_dokter rd ON rd.no_resep = ro.no_resep
         LEFT JOIN databarang db ON db.kode_brng = rd.kode_brng
         WHERE ro.no_rawat IN (${caseClause.placeholders})
           AND ro.status = ?
           AND COALESCE(db.nama_brng, '') <> ''`,
        [...caseClause.params, statusLanjut]
      ),
      db.execute(
        `SELECT pl.no_rawat, pl.tgl_permintaan, jpl.nm_perawatan
         FROM permintaan_lab pl
         INNER JOIN permintaan_pemeriksaan_lab ppl ON ppl.noorder = pl.noorder
         LEFT JOIN jns_perawatan_lab jpl ON jpl.kd_jenis_prw = ppl.kd_jenis_prw
         WHERE pl.no_rawat IN (${caseClause.placeholders})
           AND pl.status = ?
           AND COALESCE(jpl.nm_perawatan, '') <> ''`,
        [...caseClause.params, statusLanjut]
      ),
      db.execute(
        `SELECT pr.no_rawat, pr.tgl_permintaan, jpr.nm_perawatan
         FROM permintaan_radiologi pr
         INNER JOIN permintaan_pemeriksaan_radiologi ppr ON ppr.noorder = pr.noorder
         LEFT JOIN jns_perawatan_radiologi jpr ON jpr.kd_jenis_prw = ppr.kd_jenis_prw
         WHERE pr.no_rawat IN (${caseClause.placeholders})
           AND pr.status = ?
           AND COALESCE(jpr.nm_perawatan, '') <> ''`,
        [...caseClause.params, statusLanjut]
      )
    ]);

    examRows.forEach((row) => {
      const startDate = caseStartMap.get(row.no_rawat);
      const dayOffset = this.calculateDayOffset(startDate, row.tgl_perawatan);
      if (!dayOffset) return;

      this.addHistoricalAggregate(aggregateMap, caseCount, {
        noRawat: row.no_rawat,
        startDate,
        actionDate: row.tgl_perawatan,
        kategori: dayOffset === 1 ? 'Assessment' : 'Monitoring',
        itemNama: dayOffset === 1 ? 'Asesmen awal medis dan keperawatan' : 'Monitoring klinis harian',
        sourceType: 'examination'
      });
    });

    procedureRows.forEach((row) => {
      this.addHistoricalAggregate(aggregateMap, caseCount, {
        noRawat: row.no_rawat,
        startDate: caseStartMap.get(row.no_rawat),
        actionDate: row.tgl_perawatan,
        kategori: 'Tindakan',
        itemNama: row.nm_perawatan,
        sourceType: 'procedure'
      });
    });

    medicationRows.forEach((row) => {
      this.addHistoricalAggregate(aggregateMap, caseCount, {
        noRawat: row.no_rawat,
        startDate: caseStartMap.get(row.no_rawat),
        actionDate: row.tgl_peresepan,
        kategori: 'Obat',
        itemNama: row.nama_brng,
        sourceType: 'medication'
      });
    });

    labRows.forEach((row) => {
      this.addHistoricalAggregate(aggregateMap, caseCount, {
        noRawat: row.no_rawat,
        startDate: caseStartMap.get(row.no_rawat),
        actionDate: row.tgl_permintaan,
        kategori: 'Laboratorium',
        itemNama: row.nm_perawatan,
        sourceType: 'laboratory'
      });
    });

    radiologyRows.forEach((row) => {
      this.addHistoricalAggregate(aggregateMap, caseCount, {
        noRawat: row.no_rawat,
        startDate: caseStartMap.get(row.no_rawat),
        actionDate: row.tgl_permintaan,
        kategori: 'Radiologi',
        itemNama: row.nm_perawatan,
        sourceType: 'radiology'
      });
    });

    const minimumFrequency = caseCount >= 10 ? 2 : 1;
    const groupedDays = new Map();

    Array.from(aggregateMap.values())
      .filter((item) => item.frequency >= minimumFrequency)
      .sort((a, b) => {
        if (a.hari_ke !== b.hari_ke) return a.hari_ke - b.hari_ke;
        const categoryOrder = CATEGORY_ORDER.indexOf(a.kategori) - CATEGORY_ORDER.indexOf(b.kategori);
        if (categoryOrder !== 0) return categoryOrder;
        if (b.frequency !== a.frequency) return b.frequency - a.frequency;
        return a.item_nama.localeCompare(b.item_nama);
      })
      .forEach((item) => {
        if (!groupedDays.has(item.hari_ke)) {
          groupedDays.set(item.hari_ke, {
            hari_ke: item.hari_ke,
            label_hari: item.label_hari,
            activities: []
          });
        }

        const dayEntry = groupedDays.get(item.hari_ke);
        const sameCategoryCount = dayEntry.activities.filter((activity) => activity.kategori === item.kategori).length;
        if (sameCategoryCount >= 5) {
          return;
        }

        dayEntry.activities.push({
          kategori: item.kategori,
          uraian_kegiatan: item.uraian_kegiatan,
          item_nama: item.item_nama,
          keterangan: item.keterangan,
          frequency: item.frequency,
          coverage_percentage: item.coverage_percentage,
          source_type: item.source_type
        });
      });

    return {
      source_case_count: caseCount,
      generated_from_history: true,
      days: Array.from(groupedDays.values()).sort((a, b) => a.hari_ke - b.hari_ke)
    };
  }

  async ensureMasterTemplateFromHistory(connection, clinicalPathwayId, historicalTemplate) {
    if (!historicalTemplate?.days?.length) {
      return;
    }

    const [existing] = await connection.execute(
      `SELECT COUNT(*) AS total
       FROM mlite_clinical_pathway_activity a
       INNER JOIN mlite_clinical_pathway_day d ON d.id = a.clinical_pathway_day_id
       WHERE d.clinical_pathway_id = ?`,
      [clinicalPathwayId]
    );
    const existingCount = Number(existing[0]?.total || 0);
    if (existingCount > 0) {
      return;
    }

    for (const day of historicalTemplate.days) {
      await connection.execute(
        `INSERT INTO mlite_clinical_pathway_day (clinical_pathway_id, hari_ke, label_hari, tujuan_harian)
         VALUES (?, ?, ?, '')
         ON DUPLICATE KEY UPDATE label_hari = VALUES(label_hari)`,
        [clinicalPathwayId, day.hari_ke, day.label_hari || `Hari ${day.hari_ke}`]
      );

      const [dayRows] = await connection.execute(
        `SELECT id FROM mlite_clinical_pathway_day WHERE clinical_pathway_id = ? AND hari_ke = ? LIMIT 1`,
        [clinicalPathwayId, day.hari_ke]
      );
      const dayId = dayRows[0]?.id;
      if (!dayId) {
        continue;
      }

      let order = 0;
      for (const activity of day.activities) {
        order += 1;
        await connection.execute(
          `INSERT INTO mlite_clinical_pathway_activity
            (clinical_pathway_day_id, kategori, uraian_kegiatan, sumber_tabel, item_kode, item_nama, keterangan, evidence_frequency, evidence_percentage, evidence_status, wajib, urutan)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Direkomendasikan', 'Ya', ?)` ,
          [
            dayId,
            activity.kategori,
            activity.uraian_kegiatan || this.inferUraianKegiatan(activity.kategori, activity.item_nama),
            activity.source_type || 'history',
            null,
            activity.item_nama,
            activity.keterangan || '',
            Number(activity.frequency || 0),
            Number(activity.coverage_percentage || 0),
            order
          ]
        );
      }
    }
  }

  async syncCompliance(connection, patientId) {
    const [rows] = await connection.execute(
      `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS done_total,
        SUM(CASE WHEN status = 'Missed' THEN 1 ELSE 0 END) AS missed_total
      FROM mlite_clinical_pathway_execution
      WHERE clinical_pathway_patient_id = ?`,
      [patientId]
    );

    const totals = rows[0] || {};
    const planned = Number(totals.total || 0);
    const done = Number(totals.done_total || 0);
    const missed = Number(totals.missed_total || 0);
    const percentage = planned > 0 ? Number(((done / planned) * 100).toFixed(2)) : 0;

    await connection.execute(
      `INSERT INTO mlite_clinical_pathway_compliance
        (clinical_pathway_patient_id, planned_activity, completed_activity, missed_activity, compliance_percentage, kategori_kepatuhan, last_calculated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         planned_activity = VALUES(planned_activity),
         completed_activity = VALUES(completed_activity),
         missed_activity = VALUES(missed_activity),
         compliance_percentage = VALUES(compliance_percentage),
         kategori_kepatuhan = VALUES(kategori_kepatuhan),
         last_calculated_at = VALUES(last_calculated_at)`,
      [patientId, planned, done, missed, percentage, this.complianceLabel(percentage)]
    );
  }

  normalizePatientStatus(status) {
    const value = String(status || '').trim().toLowerCase();
    if (value === 'selesai') return 'Selesai';
    if (value === 'drop') return 'Drop';
    if (value === 'draft') return 'Draft';
    return 'Aktif';
  }

  normalizeExecutionStatus(status) {
    const value = String(status || '').trim().toLowerCase();
    if (value === 'completed' || value === 'selesai') return 'Completed';
    if (value === 'missed' || value === 'terlewat') return 'Missed';
    if (value === 'variance') return 'Variance';
    return 'Planned';
  }

  async refreshPatientMonitoring(connection, patientId) {
    const [patientRows] = await connection.execute(
      `SELECT
        p.id,
        p.tanggal_mulai,
        p.tanggal_selesai,
        c.nama_cp,
        c.target_los
      FROM mlite_clinical_pathway_patient p
      INNER JOIN mlite_clinical_pathway c ON c.id = p.clinical_pathway_id
      WHERE p.id = ?
      LIMIT 1`,
      [patientId]
    );
    const patient = patientRows[0];
    if (!patient) {
      throw new Error('Data pasien Clinical Pathway tidak ditemukan.');
    }

    await connection.execute(
      `DELETE FROM mlite_clinical_pathway_variance
       WHERE clinical_pathway_patient_id = ?
         AND kategori_variance IN ('Administrasi', 'LOS')`,
      [patientId]
    );

    const [executionRows] = await connection.execute(
      `SELECT
        e.id,
        e.status,
        a.wajib,
        a.item_nama AS aktivitas
      FROM mlite_clinical_pathway_execution e
      INNER JOIN mlite_clinical_pathway_activity a ON a.id = e.clinical_pathway_activity_id
      WHERE e.clinical_pathway_patient_id = ?`,
      [patientId]
    );

    for (const row of executionRows) {
      if (String(row.wajib || 'Ya') === 'Ya' && String(row.status || 'Planned') === 'Planned') {
        await connection.execute(
          `UPDATE mlite_clinical_pathway_execution
           SET status = 'Missed', catatan = 'Ditandai otomatis saat refresh monitoring.'
           WHERE id = ?`,
          [row.id]
        );
        await connection.execute(
          `INSERT INTO mlite_clinical_pathway_variance
            (clinical_pathway_patient_id, clinical_pathway_execution_id, kategori_variance, penyebab, deskripsi, severity, tanggal_variance, status_tindak_lanjut)
           VALUES (?, ?, 'Administrasi', 'Aktivitas wajib terlewat', ?, 'Sedang', NOW(), 'Open')`,
          [patientId, row.id, `Aktivitas wajib belum direalisasikan: ${row.aktivitas}`]
        );
      }
    }

    const startDate = new Date(patient.tanggal_mulai);
    if (!Number.isNaN(startDate.getTime()) && Number(patient.target_los || 0) > 0) {
      const endDate = patient.tanggal_selesai ? new Date(patient.tanggal_selesai) : new Date();
      const losActual = Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      if (losActual > Number(patient.target_los)) {
        await connection.execute(
          `INSERT INTO mlite_clinical_pathway_variance
            (clinical_pathway_patient_id, kategori_variance, penyebab, deskripsi, severity, tanggal_variance, status_tindak_lanjut)
           VALUES (?, 'LOS', 'Melebihi target lama rawat', ?, 'Sedang', NOW(), 'Open')`,
          [patientId, `LOS aktual melebihi target untuk ${patient.nama_cp}`]
        );
      }
    }

    await this.syncCompliance(connection, patientId);
  }

  async getMonitoringDetail(patientId) {
    const [patientRows] = await db.execute(
      `SELECT
        p.id,
        p.no_rawat,
        p.kd_penyakit,
        p.status AS status_cp,
        p.tanggal_mulai,
        p.tanggal_selesai,
        c.kode_cp,
        c.nama_cp,
        c.target_los,
        c.jenis_layanan AS status_layanan,
        rp.no_rkm_medis,
        pa.nm_pasien,
        pa.jk,
        pa.tgl_lahir,
        rp.tgl_registrasi,
        rp.jam_reg,
        ki.tgl_masuk,
        ki.tgl_keluar,
        py.nm_penyakit,
        COALESCE(comp.compliance_percentage, 0) AS compliance_percentage,
        (
          SELECT COUNT(*)
          FROM mlite_clinical_pathway_variance v
          WHERE v.clinical_pathway_patient_id = p.id AND v.status_tindak_lanjut = 'Open'
        ) AS variance_count
      FROM mlite_clinical_pathway_patient p
      INNER JOIN mlite_clinical_pathway c ON c.id = p.clinical_pathway_id
      LEFT JOIN reg_periksa rp ON rp.no_rawat = p.no_rawat
      LEFT JOIN pasien pa ON pa.no_rkm_medis = rp.no_rkm_medis
      LEFT JOIN (
        SELECT
          no_rawat,
          MIN(CONCAT(tgl_masuk, ' ', jam_masuk)) AS tgl_masuk,
          MAX(
            CASE
              WHEN tgl_keluar IS NULL OR tgl_keluar = '0000-00-00' THEN NULL
              ELSE CONCAT(tgl_keluar, ' ', COALESCE(jam_keluar, '00:00:00'))
            END
          ) AS tgl_keluar
        FROM kamar_inap
        GROUP BY no_rawat
      ) ki ON ki.no_rawat = p.no_rawat
      LEFT JOIN penyakit py ON py.kd_penyakit = p.kd_penyakit
      LEFT JOIN mlite_clinical_pathway_compliance comp ON comp.clinical_pathway_patient_id = p.id
      WHERE p.id = ?
      LIMIT 1`,
      [patientId]
    );

    const patient = patientRows[0] || null;
    if (!patient) {
      return {
        success: false,
        message: 'Data monitoring Clinical Pathway tidak ditemukan',
        data: null
      };
    }

    const [executionRows] = await db.execute(
      `SELECT
        e.id,
        e.clinical_pathway_patient_id AS cp_patient_id,
        e.hari_ke,
        e.status,
        e.tanggal_rencana,
        e.tanggal_realisasi,
        COALESCE(e.catatan, '') AS catatan,
        a.kategori,
        COALESCE(d.label_hari, CONCAT('Hari ', e.hari_ke)) AS kegiatan,
        COALESCE(a.uraian_kegiatan, '') AS uraian_kegiatan,
        a.item_nama AS aktivitas,
        COALESCE(a.keterangan, '') AS keterangan
      FROM mlite_clinical_pathway_execution e
      INNER JOIN mlite_clinical_pathway_activity a ON a.id = e.clinical_pathway_activity_id
      INNER JOIN mlite_clinical_pathway_day d ON d.id = a.clinical_pathway_day_id
      WHERE e.clinical_pathway_patient_id = ?
      ORDER BY e.hari_ke ASC, a.urutan ASC, e.id ASC`,
      [patientId]
    );

    const [varianceRows] = await db.execute(
      `SELECT
        v.id,
        COALESCE(ex.hari_ke, 0) AS hari_ke,
        v.kategori_variance,
        v.deskripsi,
        v.status_tindak_lanjut AS status,
        v.severity,
        v.tanggal_variance
      FROM mlite_clinical_pathway_variance v
      LEFT JOIN mlite_clinical_pathway_execution ex ON ex.id = v.clinical_pathway_execution_id
      WHERE v.clinical_pathway_patient_id = ?
      ORDER BY hari_ke ASC, v.id ASC`,
      [patientId]
    );

    return {
      success: true,
      message: 'Detail monitoring Clinical Pathway berhasil diambil',
      data: {
        patient,
        execution: executionRows,
        variance: varianceRows
      }
    };
  }

  async getMonitoringDetailByNoRawat(noRawat) {
    const normalizedNoRawat = this.normalizeNoRawat(noRawat);
    const [rows] = await db.execute(
      `SELECT id FROM mlite_clinical_pathway_patient WHERE no_rawat = ? LIMIT 1`,
      [normalizedNoRawat]
    );

    const patientId = Number(rows[0]?.id || 0);
    if (!patientId) {
      return {
        success: false,
        message: 'Clinical Pathway pasien belum digenerate, monitoring belum tersedia.',
        data: null
      };
    }

    return this.getMonitoringDetail(patientId);
  }

  async updateExecutionStatus(patientId, executionId, status) {
    let connection;
    try {
      connection = await db.getConnection();

      const normalizedStatus = this.normalizeExecutionStatus(status);
      await connection.execute(
        `UPDATE mlite_clinical_pathway_execution
         SET status = ?, tanggal_realisasi = ?, sumber_data = 'manual'
         WHERE id = ? AND clinical_pathway_patient_id = ?`,
        [
          normalizedStatus,
          normalizedStatus === 'Completed' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null,
          executionId,
          patientId
        ]
      );

      await this.refreshPatientMonitoring(connection, patientId);
      await connection.commit();
      connection.release();
      connection = null;

      return this.getMonitoringDetail(patientId);
    } catch (error) {
      if (connection) {
        await connection.rollback();
        connection.release();
      }

      return {
        success: false,
        message: 'Terjadi kesalahan saat mengubah status aktivitas monitoring',
        error: error.message
      };
    }
  }

  async updatePatientStatus(patientId, status) {
    let connection;
    try {
      connection = await db.getConnection();
      await connection.beginTransaction();

      const normalizedStatus = this.normalizePatientStatus(status);
      await connection.execute(
        `UPDATE mlite_clinical_pathway_patient
         SET status = ?, tanggal_selesai = ?
         WHERE id = ?`,
        [
          normalizedStatus,
          normalizedStatus === 'Selesai' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null,
          patientId
        ]
      );

      await this.refreshPatientMonitoring(connection, patientId);
      await connection.commit();
      connection.release();
      connection = null;

      return this.getMonitoringDetail(patientId);
    } catch (error) {
      if (connection) {
        await connection.rollback();
        connection.release();
      }

      return {
        success: false,
        message: 'Terjadi kesalahan saat mengubah status pasien Clinical Pathway',
        error: error.message
      };
    }
  }

  async refreshMonitoring(patientId) {
    let connection;
    try {
      connection = await db.getConnection();
      await connection.beginTransaction();
      await this.refreshPatientMonitoring(connection, patientId);
      await connection.commit();
      connection.release();
      connection = null;

      return this.getMonitoringDetail(patientId);
    } catch (error) {
      if (connection) {
        await connection.rollback();
        connection.release();
      }

      return {
        success: false,
        message: 'Terjadi kesalahan saat refresh monitoring Clinical Pathway',
        error: error.message
      };
    }
  }

  async getPatientData(noRkmMedis, noRawat, preferredClinicalPathwayId = null) {
    try {
      const normalizedNoRawat = this.normalizeNoRawat(noRawat);
      const registration = await this.getRegistration(noRkmMedis, normalizedNoRawat);
      if (!registration) {
        return {
          success: false,
          message: 'Data pasien tidak ditemukan',
          data: null
        };
      }

      const statusLanjut = this.normalizeStatusLanjut(registration.status_lanjut);
      const diagnoses = await this.getDiagnoses(normalizedNoRawat, statusLanjut);
      const diagnosisCodes = diagnoses.map((item) => String(item.kd_penyakit || '').trim()).filter(Boolean);
      const existing = await this.getExistingPatientPathway(normalizedNoRawat);
      const masterRecommendations = await this.getMasterRecommendations(diagnosisCodes, statusLanjut);
      const requestedClinicalPathwayId = Number(preferredClinicalPathwayId || 0);
      const preferredSelectionId = Number(existing?.clinical_pathway_id || requestedClinicalPathwayId || 0);
      const selectedMasterRecommendation = preferredSelectionId
        ? await this.getMasterRecommendationById(preferredSelectionId, diagnosisCodes)
        : null;
      const mergedRecommendations = [...masterRecommendations];

      if (
        selectedMasterRecommendation
        && !mergedRecommendations.some((item) => Number(item.id) === Number(selectedMasterRecommendation.id))
      ) {
        mergedRecommendations.unshift(selectedMasterRecommendation);
      }

      const availableClinicalPathwayIds = new Set(mergedRecommendations.map((item) => Number(item.id)));
      const selectedClinicalPathwayId = Number(
        existing?.clinical_pathway_id ||
        (requestedClinicalPathwayId && availableClinicalPathwayIds.has(requestedClinicalPathwayId) ? requestedClinicalPathwayId : 0) ||
        mergedRecommendations[0]?.id ||
        0
      );
      const masterTemplate = selectedClinicalPathwayId
        ? await this.getMasterTemplate(selectedClinicalPathwayId)
        : { source_case_count: 0, generated_from_history: false, days: [] };
      const historicalTemplate = await this.buildHistoricalTemplate({
        diagnosisCodes,
        statusLanjut
      });

      return {
        success: true,
        message: 'Data Clinical Pathway berhasil diambil',
        data: {
          registration: {
            ...registration,
            status_lanjut: statusLanjut
          },
          diagnoses,
          existing,
          master_recommendations: mergedRecommendations,
          selected_clinical_pathway_id: selectedClinicalPathwayId || null,
          master_template: masterTemplate,
          historical_template: historicalTemplate
        }
      };
    } catch (error) {
      console.error('Error in getPatientData:', error);
      return {
        success: false,
        message: 'Terjadi kesalahan saat mengambil data Clinical Pathway',
        error: error.message,
        data: null
      };
    }
  }

  async generatePatientClinicalPathway(payload) {
    let connection;
    try {
      const normalizedNoRawat = this.normalizeNoRawat(payload.no_rawat);
      const normalizedNoRkmMedis = String(payload.no_rkm_medis || '').trim();
      const preview = await this.getPatientData(normalizedNoRkmMedis, normalizedNoRawat);
      if (!preview.success || !preview.data) {
        return {
          success: false,
          message: preview.message || 'Preview Clinical Pathway tidak ditemukan'
        };
      }

      const registration = preview.data.registration;
      const diagnoses = preview.data.diagnoses || [];
      const selectedClinicalPathwayId = Number(
        payload.clinical_pathway_id ||
        preview.data.existing?.clinical_pathway_id ||
        preview.data.master_recommendations?.[0]?.id ||
        0
      );

      if (!selectedClinicalPathwayId) {
        return {
          success: false,
          message: 'Belum ada master Clinical Pathway yang cocok untuk diagnosis pasien ini.'
        };
      }

      connection = await db.getConnection();
      await connection.beginTransaction();

      await this.ensureMasterTemplateFromHistory(
        connection,
        selectedClinicalPathwayId,
        preview.data.historical_template
      );

      const [templateRows] = await connection.execute(
        `SELECT
          a.id AS activity_id,
          d.hari_ke
        FROM mlite_clinical_pathway_activity a
        INNER JOIN mlite_clinical_pathway_day d ON d.id = a.clinical_pathway_day_id
        WHERE d.clinical_pathway_id = ?
        ORDER BY d.hari_ke ASC, a.urutan ASC, a.id ASC`,
        [selectedClinicalPathwayId]
      );

      if (!templateRows.length) {
        throw new Error('Template harian Clinical Pathway masih kosong, termasuk dari histori 1 tahun terakhir.');
      }

      const primaryDiagnosis = diagnoses[0] || {};
      const tanggalMulai = this.combineDateTime(registration.tgl_registrasi, registration.jam_reg);
      const [existingRows] = await connection.execute(
        `SELECT id FROM mlite_clinical_pathway_patient WHERE no_rawat = ? LIMIT 1`,
        [normalizedNoRawat]
      );
      let patientId = Number(existingRows[0]?.id || 0);

      if (patientId) {
        await connection.execute(
          `UPDATE mlite_clinical_pathway_patient
           SET clinical_pathway_id = ?, kd_penyakit = ?, tanggal_mulai = ?, tanggal_selesai = NULL, status = 'Aktif', auto_generated = 'Ya'
           WHERE id = ?`,
          [selectedClinicalPathwayId, primaryDiagnosis.kd_penyakit || null, tanggalMulai, patientId]
        );
        await connection.execute(`DELETE FROM mlite_clinical_pathway_execution WHERE clinical_pathway_patient_id = ?`, [patientId]);
        await connection.execute(`DELETE FROM mlite_clinical_pathway_variance WHERE clinical_pathway_patient_id = ?`, [patientId]);
        await connection.execute(`DELETE FROM mlite_clinical_pathway_compliance WHERE clinical_pathway_patient_id = ?`, [patientId]);
      } else {
        const [insertResult] = await connection.execute(
          `INSERT INTO mlite_clinical_pathway_patient
            (no_rawat, clinical_pathway_id, kd_penyakit, tanggal_mulai, tanggal_selesai, status, auto_generated)
           VALUES (?, ?, ?, ?, NULL, 'Aktif', 'Ya')`,
          [normalizedNoRawat, selectedClinicalPathwayId, primaryDiagnosis.kd_penyakit || null, tanggalMulai]
        );
        patientId = Number(insertResult.insertId);
      }

      for (const templateRow of templateRows) {
        const plannedDate = new Date(tanggalMulai.replace(' ', 'T'));
        plannedDate.setDate(plannedDate.getDate() + (Number(templateRow.hari_ke || 1) - 1));

        await connection.execute(
          `INSERT INTO mlite_clinical_pathway_execution
            (clinical_pathway_patient_id, clinical_pathway_activity_id, hari_ke, tanggal_rencana, status, sumber_data)
           VALUES (?, ?, ?, ?, 'Planned', 'generator')`,
          [
            patientId,
            Number(templateRow.activity_id),
            Number(templateRow.hari_ke || 1),
            plannedDate.toISOString().slice(0, 10)
          ]
        );
      }

      await this.syncCompliance(connection, patientId);
      await connection.commit();
      connection.release();
      connection = null;

      const refreshed = await this.getPatientData(normalizedNoRkmMedis, normalizedNoRawat);
      return {
        success: true,
        message: 'Clinical Pathway pasien berhasil digenerate',
        data: {
          patient_id: patientId,
          no_rawat: normalizedNoRawat,
          clinical_pathway_id: selectedClinicalPathwayId,
          diagnosis_code: primaryDiagnosis.kd_penyakit || null,
          generated_activity_count: templateRows.length,
          preview: refreshed.data || null
        }
      };
    } catch (error) {
      if (connection) {
        await connection.rollback();
        connection.release();
      }

      console.error('Error in generatePatientClinicalPathway:', error);
      return {
        success: false,
        message: 'Terjadi kesalahan saat generate Clinical Pathway pasien',
        error: error.message
      };
    }
  }

  normalizeMasterManagementPayload(payload = {}) {
    const kodeCp = this.sanitizeLabel(payload.kode_cp).toUpperCase();
    const namaCp = this.sanitizeLabel(payload.nama_cp);
    const jenisLayanan = this.normalizeStatusLanjut(payload.jenis_layanan);
    const targetLos = Math.max(1, Number(payload.target_los || 1));
    const targetTarif = Math.max(0, Number(payload.target_tarif || 0));
    const confidenceScore = Math.max(0, Math.min(100, Number(payload.confidence_score || 0)));
    const evidenceNote = String(payload.evidence_note || '').trim();
    const guidelineNote = String(payload.guideline_note || payload.kategori || '').trim();
    const aktif = String(payload.aktif || 'Ya').trim() === 'Tidak' ? 'Tidak' : 'Ya';

    const hasDiagnoses = Array.isArray(payload.diagnoses);
    const diagnoses = hasDiagnoses
      ? payload.diagnoses
          .map((item, index) => ({
            kd_penyakit: this.sanitizeLabel(item?.kd_penyakit).toUpperCase(),
            prioritas: Math.max(1, Number(item?.prioritas || index + 1)),
            tipe: String(item?.tipe || 'Utama').trim() === 'Sekunder' ? 'Sekunder' : 'Utama'
          }))
          .filter((item) => item.kd_penyakit)
      : null;

    const hasDays = Array.isArray(payload.days);
    const days = hasDays
      ? payload.days
          .map((day, dayIndex) => ({
            hari_ke: Math.max(1, Number(day?.hari_ke || dayIndex + 1)),
            label_hari: this.sanitizeLabel(day?.label_hari) || `Hari ${Math.max(1, Number(day?.hari_ke || dayIndex + 1))}`,
            tujuan_harian: String(day?.tujuan_harian || '').trim(),
            activities: Array.isArray(day?.activities)
              ? day.activities
                  .map((activity, activityIndex) => ({
                    kategori: this.sanitizeLabel(activity?.kategori),
                    uraian_kegiatan: this.sanitizeLabel(activity?.uraian_kegiatan),
                    sumber_tabel: this.sanitizeLabel(activity?.sumber_tabel) || 'manual',
                    item_kode: this.sanitizeLabel(activity?.item_kode) || null,
                    item_nama: this.sanitizeLabel(activity?.item_nama),
                    keterangan: String(activity?.keterangan || '').trim(),
                    evidence_frequency: Math.max(0, Number(activity?.evidence_frequency || 0)),
                    evidence_percentage: Math.max(0, Math.min(100, Number(activity?.evidence_percentage || 0))),
                    evidence_status: this.sanitizeLabel(activity?.evidence_status) || 'Direkomendasikan',
                    wajib: String(activity?.wajib || 'Ya').trim() === 'Tidak' ? 'Tidak' : 'Ya',
                    urutan: Math.max(1, Number(activity?.urutan || activityIndex + 1))
                  }))
                  .filter((activity) => activity.kategori && activity.item_nama)
              : []
          }))
          .filter((day) => day.hari_ke > 0)
      : null;

    return {
      kode_cp: kodeCp,
      nama_cp: namaCp,
      jenis_layanan: jenisLayanan,
      target_los: targetLos,
      target_tarif: targetTarif,
      confidence_score: confidenceScore,
      evidence_note: evidenceNote,
      guideline_note: guidelineNote,
      aktif,
      has_diagnoses: hasDiagnoses,
      diagnoses,
      has_days: hasDays,
      days
    };
  }

  validateMasterManagementPayload(payload) {
    if (!payload.kode_cp) {
      throw new Error('Kode Master CP harus diisi.');
    }

    if (!payload.nama_cp) {
      throw new Error('Nama Master CP harus diisi.');
    }

    if (payload.has_days && Array.isArray(payload.days) && payload.days.length) {
      const emptyDay = payload.days.find((day) => !day.activities.length);
      if (emptyDay) {
        throw new Error(`Aktivitas pada ${emptyDay.label_hari || `Hari ${emptyDay.hari_ke}`} masih kosong.`);
      }
    }
  }

  async getMasterManagementSummary() {
    const [masterRows, templateRows, mappingRows, patientRows, activeRows, avgRows] = await Promise.all([
      db.execute('SELECT COUNT(*) AS total FROM mlite_clinical_pathway'),
      db.execute('SELECT COUNT(*) AS total FROM mlite_clinical_pathway_activity'),
      db.execute('SELECT COUNT(*) AS total FROM mlite_clinical_pathway_diagnosis'),
      db.execute('SELECT COUNT(*) AS total FROM mlite_clinical_pathway_patient'),
      db.execute("SELECT COUNT(*) AS total FROM mlite_clinical_pathway_patient WHERE status = 'Aktif'"),
      db.execute('SELECT COALESCE(AVG(compliance_percentage), 0) AS total FROM mlite_clinical_pathway_compliance')
    ]);

    return {
      success: true,
      data: {
        master_count: Number(masterRows[0]?.[0]?.total || 0),
        template_count: Number(templateRows[0]?.[0]?.total || 0),
        mapping_count: Number(mappingRows[0]?.[0]?.total || 0),
        patient_count: Number(patientRows[0]?.[0]?.total || 0),
        active_patient_count: Number(activeRows[0]?.[0]?.total || 0),
        average_compliance_percentage: Number(avgRows[0]?.[0]?.total || 0)
      }
    };
  }

  async getDashboardOverview(limit = 5) {
    const summary = await this.getMasterManagementSummary();
    const [latestRows] = await db.execute(
      `SELECT
        p.id,
        p.no_rawat,
        rp.no_rkm_medis,
        pa.nm_pasien,
        c.kode_cp,
        c.nama_cp,
        COALESCE(comp.compliance_percentage, 0) AS compliance_percentage,
        p.status AS status_cp,
        p.tanggal_mulai
      FROM mlite_clinical_pathway_patient p
      INNER JOIN mlite_clinical_pathway c ON c.id = p.clinical_pathway_id
      LEFT JOIN mlite_clinical_pathway_compliance comp ON comp.clinical_pathway_patient_id = p.id
      LEFT JOIN reg_periksa rp ON rp.no_rawat = p.no_rawat
      LEFT JOIN pasien pa ON pa.no_rkm_medis = rp.no_rkm_medis
      ORDER BY p.id DESC
      LIMIT ?`,
      [Math.max(1, Math.min(20, Number(limit || 5)))]
    );

    return {
      success: true,
      data: {
        summary: summary.data,
        latest_patients: latestRows
      }
    };
  }

  async getTemplateDayList(filters = {}) {
    const clinicalPathwayId = Number(filters.clinical_pathway_id || 0);
    const page = Math.max(1, Number(filters.page || 1));
    const limit = Math.max(1, Math.min(100, Number(filters.limit || 50)));
    const offset = (page - 1) * limit;
    const search = this.sanitizeLabel(filters.search);

    const whereClauses = ['1 = 1'];
    const params = [];

    if (clinicalPathwayId) {
      whereClauses.push('d.clinical_pathway_id = ?');
      params.push(clinicalPathwayId);
    }
    if (search) {
      whereClauses.push(`(
        c.kode_cp LIKE ?
        OR c.nama_cp LIKE ?
        OR CAST(d.hari_ke AS CHAR) LIKE ?
        OR COALESCE(d.label_hari, CONCAT('Hari ', d.hari_ke)) LIKE ?
        OR a.kategori LIKE ?
        OR COALESCE(a.uraian_kegiatan, '') LIKE ?
        OR COALESCE(a.item_nama, '') LIKE ?
        OR COALESCE(a.keterangan, '') LIKE ?
        OR COALESCE(a.wajib, '') LIKE ?
        OR CAST(a.urutan AS CHAR) LIKE ?
      )`);
      const searchTerm = `%${search}%`;
      params.push(
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm
      );
    }

    const whereSql = whereClauses.join(' AND ');

    const [rows] = await db.execute(
      `SELECT
        a.id,
        d.clinical_pathway_id,
        c.kode_cp,
        c.nama_cp,
        d.id AS clinical_pathway_day_id,
        d.hari_ke,
        COALESCE(d.label_hari, CONCAT('Hari ', d.hari_ke)) AS kegiatan,
        COALESCE(d.tujuan_harian, '') AS tujuan_harian,
        a.kategori,
        COALESCE(a.uraian_kegiatan, '') AS uraian_kegiatan,
        a.item_nama AS aktivitas,
        COALESCE(a.keterangan, '') AS keterangan,
        a.wajib,
        a.urutan
      FROM mlite_clinical_pathway_activity a
      INNER JOIN mlite_clinical_pathway_day d ON d.id = a.clinical_pathway_day_id
      INNER JOIN mlite_clinical_pathway c ON c.id = d.clinical_pathway_id
      WHERE ${whereSql}
      ORDER BY c.kode_cp ASC, d.hari_ke ASC, a.urutan ASC, a.id ASC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [countRows] = await db.execute(
      `SELECT COUNT(*) AS total
       FROM mlite_clinical_pathway_activity a
       INNER JOIN mlite_clinical_pathway_day d ON d.id = a.clinical_pathway_day_id
       INNER JOIN mlite_clinical_pathway c ON c.id = d.clinical_pathway_id
       WHERE ${whereSql}`,
      params
    );

    return {
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total: Number(countRows[0]?.total || 0),
        totalPages: Math.max(1, Math.ceil(Number(countRows[0]?.total || 0) / limit))
      }
    };
  }

  async getTemplateDayDetail(activityId) {
    const id = Number(activityId || 0);
    if (!id) {
      return { success: false, message: 'Template harian tidak valid', data: null };
    }

    const [rows] = await db.execute(
      `SELECT
        a.id,
        d.clinical_pathway_id,
        c.kode_cp,
        c.nama_cp,
        d.id AS clinical_pathway_day_id,
        d.hari_ke,
        COALESCE(d.label_hari, CONCAT('Hari ', d.hari_ke)) AS kegiatan,
        COALESCE(d.tujuan_harian, '') AS tujuan_harian,
        a.kategori,
        COALESCE(a.uraian_kegiatan, '') AS uraian_kegiatan,
        a.item_nama AS aktivitas,
        COALESCE(a.keterangan, '') AS keterangan,
        a.wajib,
        a.urutan
      FROM mlite_clinical_pathway_activity a
      INNER JOIN mlite_clinical_pathway_day d ON d.id = a.clinical_pathway_day_id
      INNER JOIN mlite_clinical_pathway c ON c.id = d.clinical_pathway_id
      WHERE a.id = ?
      LIMIT 1`,
      [id]
    );

    if (!rows.length) {
      return { success: false, message: 'Template harian tidak ditemukan', data: null };
    }

    return { success: true, data: rows[0] };
  }

  async saveTemplateDayItem(payload, activityId = null) {
    let connection;
    try {
      const clinicalPathwayId = Number(payload.clinical_pathway_id || 0);
      const hariKe = Math.max(1, Number(payload.hari_ke || 1));
      const urutan = Math.max(0, Number(payload.urutan || 0));
      const kategori = this.sanitizeLabel(payload.kategori);
      const kegiatan = this.sanitizeLabel(payload.kegiatan) || `Hari ${hariKe}`;
      const uraianKegiatan = this.sanitizeLabel(payload.uraian_kegiatan);
      const aktivitas = this.sanitizeLabel(payload.aktivitas);
      const keterangan = String(payload.keterangan || '').trim();
      const wajib = String(payload.wajib || 'Ya').trim() === 'Tidak' ? 'Tidak' : 'Ya';

      if (!clinicalPathwayId) throw new Error('Master CP harus dipilih.');
      if (!kategori) throw new Error('Kategori harus diisi.');
      if (!aktivitas) throw new Error('Aktivitas harus diisi.');

      connection = await db.getConnection();
      await connection.beginTransaction();

      const [masterRows] = await connection.execute(
        'SELECT id FROM mlite_clinical_pathway WHERE id = ? LIMIT 1',
        [clinicalPathwayId]
      );
      if (!masterRows.length) {
        throw new Error('Master CP tidak ditemukan.');
      }

      let targetDayId = Number(payload.clinical_pathway_day_id || 0);
      if (targetDayId) {
        const [dayRows] = await connection.execute(
          'SELECT id, hari_ke FROM mlite_clinical_pathway_day WHERE id = ? AND clinical_pathway_id = ? LIMIT 1',
          [targetDayId, clinicalPathwayId]
        );
        const existingDay = dayRows[0] || null;
        if (!existingDay) {
          targetDayId = 0;
        } else if (Number(existingDay.hari_ke || 0) !== hariKe) {
          // Editing one activity may move it to another day group; do not force it to stay on the old day id.
          targetDayId = 0;
        }
      }

      if (!targetDayId) {
        const [existingDayRows] = await connection.execute(
          'SELECT id FROM mlite_clinical_pathway_day WHERE clinical_pathway_id = ? AND hari_ke = ? LIMIT 1',
          [clinicalPathwayId, hariKe]
        );

        if (existingDayRows.length) {
          targetDayId = Number(existingDayRows[0].id);
          await connection.execute(
            'UPDATE mlite_clinical_pathway_day SET label_hari = ?, tujuan_harian = ? WHERE id = ?',
            [kegiatan, String(payload.tujuan_harian || '').trim(), targetDayId]
          );
        } else {
          const [insertDay] = await connection.execute(
            `INSERT INTO mlite_clinical_pathway_day
              (clinical_pathway_id, hari_ke, label_hari, tujuan_harian)
             VALUES (?, ?, ?, ?)`,
            [clinicalPathwayId, hariKe, kegiatan, String(payload.tujuan_harian || '').trim()]
          );
          targetDayId = Number(insertDay.insertId);
        }
      } else {
        await connection.execute(
          'UPDATE mlite_clinical_pathway_day SET label_hari = ?, tujuan_harian = ? WHERE id = ?',
          [kegiatan, String(payload.tujuan_harian || '').trim(), targetDayId]
        );
      }

      const currentActivityId = Number(activityId || 0);
      if (currentActivityId) {
        await connection.execute(
          `UPDATE mlite_clinical_pathway_activity
           SET clinical_pathway_day_id = ?, kategori = ?, uraian_kegiatan = ?, item_nama = ?, keterangan = ?, wajib = ?, urutan = ?
           WHERE id = ?`,
          [targetDayId, kategori, uraianKegiatan, aktivitas, keterangan, wajib, urutan, currentActivityId]
        );
      } else {
        const [insertActivity] = await connection.execute(
          `INSERT INTO mlite_clinical_pathway_activity
            (clinical_pathway_day_id, kategori, uraian_kegiatan, sumber_tabel, item_kode, item_nama, keterangan, evidence_frequency, evidence_percentage, evidence_status, wajib, urutan)
           VALUES (?, ?, ?, 'manual', NULL, ?, ?, 0, 0, 'Direkomendasikan', ?, ?)`,
          [targetDayId, kategori, uraianKegiatan, aktivitas, keterangan, wajib, urutan]
        );
        activityId = Number(insertActivity.insertId);
      }

      await connection.commit();
      connection.release();
      connection = null;

      return {
        success: true,
        message: currentActivityId ? 'Template harian berhasil diperbarui' : 'Template harian berhasil dibuat',
        data: (await this.getTemplateDayDetail(activityId)).data
      };
    } catch (error) {
      if (connection) {
        await connection.rollback();
        connection.release();
      }

      return {
        success: false,
        message: error.message || 'Gagal menyimpan template harian',
        data: null
      };
    }
  }

  async deleteTemplateDayItem(activityId) {
    const id = Number(activityId || 0);
    if (!id) {
      return { success: false, message: 'Template harian tidak valid' };
    }

    let connection;
    try {
      connection = await db.getConnection();
      await connection.beginTransaction();

      const [rows] = await connection.execute(
        'SELECT clinical_pathway_day_id FROM mlite_clinical_pathway_activity WHERE id = ? LIMIT 1',
        [id]
      );
      if (!rows.length) {
        throw new Error('Template harian tidak ditemukan.');
      }

      const dayId = Number(rows[0].clinical_pathway_day_id || 0);
      await connection.execute('DELETE FROM mlite_clinical_pathway_activity WHERE id = ?', [id]);

      if (dayId) {
        const [remainingRows] = await connection.execute(
          'SELECT COUNT(*) AS total FROM mlite_clinical_pathway_activity WHERE clinical_pathway_day_id = ?',
          [dayId]
        );
        if (Number(remainingRows[0]?.total || 0) === 0) {
          await connection.execute('DELETE FROM mlite_clinical_pathway_day WHERE id = ?', [dayId]);
        }
      }

      await connection.commit();
      connection.release();
      connection = null;
      return { success: true, message: 'Template harian berhasil dihapus' };
    } catch (error) {
      if (connection) {
        await connection.rollback();
        connection.release();
      }

      return { success: false, message: error.message || 'Gagal menghapus template harian' };
    }
  }

  async getDiagnosisMappingList(filters = {}) {
    const clinicalPathwayId = Number(filters.clinical_pathway_id || 0);
    const page = Math.max(1, Number(filters.page || 1));
    const limit = Math.max(1, Math.min(100, Number(filters.limit || 50)));
    const offset = (page - 1) * limit;
    const search = this.sanitizeLabel(filters.search);

    const whereClauses = ['1 = 1'];
    const params = [];

    if (clinicalPathwayId) {
      whereClauses.push('d.clinical_pathway_id = ?');
      params.push(clinicalPathwayId);
    }
    if (search) {
      whereClauses.push('(d.kd_penyakit LIKE ? OR py.nm_penyakit LIKE ? OR c.kode_cp LIKE ? OR c.nama_cp LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereSql = whereClauses.join(' AND ');

    const [rows] = await db.execute(
      `SELECT
        d.id,
        d.clinical_pathway_id,
        c.kode_cp,
        c.nama_cp,
        d.kd_penyakit,
        COALESCE(py.nm_penyakit, '') AS nm_penyakit,
        c.confidence_score,
        d.prioritas,
        COALESCE(d.tipe, 'Utama') AS tipe
      FROM mlite_clinical_pathway_diagnosis d
      INNER JOIN mlite_clinical_pathway c ON c.id = d.clinical_pathway_id
      LEFT JOIN penyakit py ON py.kd_penyakit = d.kd_penyakit
      WHERE ${whereSql}
      ORDER BY d.prioritas ASC, d.id ASC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [countRows] = await db.execute(
      `SELECT COUNT(*) AS total
       FROM mlite_clinical_pathway_diagnosis d
       INNER JOIN mlite_clinical_pathway c ON c.id = d.clinical_pathway_id
       LEFT JOIN penyakit py ON py.kd_penyakit = d.kd_penyakit
       WHERE ${whereSql}`,
      params
    );

    return {
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total: Number(countRows[0]?.total || 0),
        totalPages: Math.max(1, Math.ceil(Number(countRows[0]?.total || 0) / limit))
      }
    };
  }

  async getDiagnosisMappingDetail(mappingId) {
    const id = Number(mappingId || 0);
    if (!id) {
      return { success: false, message: 'Mapping ICD tidak valid', data: null };
    }

    const [rows] = await db.execute(
      `SELECT
        d.id,
        d.clinical_pathway_id,
        c.kode_cp,
        c.nama_cp,
        d.kd_penyakit,
        COALESCE(py.nm_penyakit, '') AS nm_penyakit,
        c.confidence_score,
        d.prioritas,
        COALESCE(d.tipe, 'Utama') AS tipe
      FROM mlite_clinical_pathway_diagnosis d
      INNER JOIN mlite_clinical_pathway c ON c.id = d.clinical_pathway_id
      LEFT JOIN penyakit py ON py.kd_penyakit = d.kd_penyakit
      WHERE d.id = ?
      LIMIT 1`,
      [id]
    );

    if (!rows.length) {
      return { success: false, message: 'Mapping ICD tidak ditemukan', data: null };
    }

    return { success: true, data: rows[0] };
  }

  async saveDiagnosisMapping(payload, mappingId = null) {
    try {
      const clinicalPathwayId = Number(payload.clinical_pathway_id || 0);
      const kdPenyakit = this.sanitizeLabel(payload.kd_penyakit).toUpperCase();
      const prioritas = Math.max(1, Number(payload.prioritas || 1));
      const tipe = String(payload.tipe || 'Utama').trim() === 'Sekunder' ? 'Sekunder' : 'Utama';
      const confidenceScore = payload.confidence_score === undefined
        ? null
        : Math.max(0, Math.min(100, Number(payload.confidence_score || 0)));

      if (!clinicalPathwayId) throw new Error('Master CP harus dipilih.');
      if (!kdPenyakit) throw new Error('Kode ICD harus diisi.');

      if (confidenceScore !== null) {
        await db.execute(
          'UPDATE mlite_clinical_pathway SET confidence_score = ? WHERE id = ?',
          [confidenceScore, clinicalPathwayId]
        );
      }

      const currentMappingId = Number(mappingId || 0);
      if (currentMappingId) {
        await db.execute(
          `UPDATE mlite_clinical_pathway_diagnosis
           SET clinical_pathway_id = ?, kd_penyakit = ?, prioritas = ?, tipe = ?
           WHERE id = ?`,
          [clinicalPathwayId, kdPenyakit, prioritas, tipe, currentMappingId]
        );
      } else {
        const [insertResult] = await db.execute(
          `INSERT INTO mlite_clinical_pathway_diagnosis
            (clinical_pathway_id, kd_penyakit, prioritas, tipe)
           VALUES (?, ?, ?, ?)`,
          [clinicalPathwayId, kdPenyakit, prioritas, tipe]
        );
        mappingId = Number(insertResult.insertId);
      }

      return {
        success: true,
        message: currentMappingId ? 'Mapping ICD berhasil diperbarui' : 'Mapping ICD berhasil dibuat',
        data: (await this.getDiagnosisMappingDetail(mappingId)).data
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Gagal menyimpan mapping ICD',
        data: null
      };
    }
  }

  async deleteDiagnosisMapping(mappingId) {
    const id = Number(mappingId || 0);
    if (!id) {
      return { success: false, message: 'Mapping ICD tidak valid' };
    }

    try {
      await db.execute('DELETE FROM mlite_clinical_pathway_diagnosis WHERE id = ?', [id]);
      return { success: true, message: 'Mapping ICD berhasil dihapus' };
    } catch (error) {
      return { success: false, message: error.message || 'Gagal menghapus mapping ICD' };
    }
  }

  async getMonitoringList(filters = {}) {
    const page = Math.max(1, Number(filters.page || 1));
    const limit = Math.max(1, Math.min(100, Number(filters.limit || 20)));
    const offset = (page - 1) * limit;
    const search = this.sanitizeLabel(filters.search);
    const status = this.sanitizeLabel(filters.status);

    const whereClauses = ['1 = 1'];
    const params = [];

    if (search) {
      whereClauses.push('(p.no_rawat LIKE ? OR pa.nm_pasien LIKE ? OR c.nama_cp LIKE ? OR c.kode_cp LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (status) {
      whereClauses.push('p.status = ?');
      params.push(status);
    }

    const whereSql = whereClauses.join(' AND ');

    const [rows] = await db.execute(
      `SELECT
        p.id,
        p.no_rawat,
        rp.no_rkm_medis,
        pa.nm_pasien,
        c.kode_cp,
        c.nama_cp,
        COALESCE(py.nm_penyakit, '') AS nm_penyakit,
        p.status AS status_cp,
        COALESCE(comp.compliance_percentage, 0) AS compliance_percentage,
        p.tanggal_mulai
      FROM mlite_clinical_pathway_patient p
      INNER JOIN mlite_clinical_pathway c ON c.id = p.clinical_pathway_id
      LEFT JOIN mlite_clinical_pathway_compliance comp ON comp.clinical_pathway_patient_id = p.id
      LEFT JOIN reg_periksa rp ON rp.no_rawat = p.no_rawat
      LEFT JOIN pasien pa ON pa.no_rkm_medis = rp.no_rkm_medis
      LEFT JOIN penyakit py ON py.kd_penyakit = p.kd_penyakit
      WHERE ${whereSql}
      ORDER BY p.id DESC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [countRows] = await db.execute(
      `SELECT COUNT(*) AS total
       FROM mlite_clinical_pathway_patient p
       INNER JOIN mlite_clinical_pathway c ON c.id = p.clinical_pathway_id
       LEFT JOIN reg_periksa rp ON rp.no_rawat = p.no_rawat
       LEFT JOIN pasien pa ON pa.no_rkm_medis = rp.no_rkm_medis
       WHERE ${whereSql}`,
      params
    );

    return {
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total: Number(countRows[0]?.total || 0),
        totalPages: Math.max(1, Math.ceil(Number(countRows[0]?.total || 0) / limit))
      }
    };
  }

  async getGeneratorCandidateList(filters = {}) {
    const page = Math.max(1, Number(filters.page || 1));
    const limit = Math.max(1, Math.min(100, Number(filters.limit || 20)));
    const offset = (page - 1) * limit;
    const search = this.sanitizeLabel(filters.search);
    const clinicalPathwayId = Number(filters.clinical_pathway_id || 0);
    const bangsal = this.sanitizeLabel(filters.bangsal);
    const kamar = this.sanitizeLabel(filters.kamar);
    const tanggalMasukAwal = this.formatDateOnly(filters.tanggal_masuk_awal);
    const tanggalMasukAkhir = this.formatDateOnly(filters.tanggal_masuk_akhir);

    const whereClauses = ['1 = 1'];
    const whereParams = [];
    const havingClauses = [];
    const havingParams = [];

    if (search) {
      whereClauses.push(`(
        rp.no_rawat LIKE ?
        OR rp.no_rkm_medis LIKE ?
        OR pa.nm_pasien LIKE ?
        OR dp.kd_penyakit LIKE ?
        OR py.nm_penyakit LIKE ?
        OR cp.kode_cp LIKE ?
        OR cp.nama_cp LIKE ?
      )`);
      whereParams.push(
        `%${search}%`,
        `%${search}%`,
        `%${search}%`,
        `%${search}%`,
        `%${search}%`,
        `%${search}%`,
        `%${search}%`
      );
    }

    if (clinicalPathwayId > 0) {
      whereClauses.push(`cp.id = ?`);
      whereParams.push(clinicalPathwayId);
    }

    if (bangsal) {
      whereClauses.push(`COALESCE(b.nm_bangsal, '') LIKE ?`);
      whereParams.push(`%${bangsal}%`);
    }

    if (kamar) {
      whereClauses.push(`COALESCE(k.kd_kamar, '') LIKE ?`);
      whereParams.push(`%${kamar}%`);
    }

    if (tanggalMasukAwal) {
      havingClauses.push(`DATE(MIN(ki.tgl_masuk)) >= ?`);
      havingParams.push(tanggalMasukAwal);
    }

    if (tanggalMasukAkhir) {
      havingClauses.push(`DATE(MIN(ki.tgl_masuk)) <= ?`);
      havingParams.push(tanggalMasukAkhir);
    }

    const fromClause = `
      FROM kamar_inap ki
      INNER JOIN reg_periksa rp ON rp.no_rawat = ki.no_rawat
      INNER JOIN pasien pa ON pa.no_rkm_medis = rp.no_rkm_medis
      LEFT JOIN kamar k ON k.kd_kamar = ki.kd_kamar
      LEFT JOIN bangsal b ON b.kd_bangsal = k.kd_bangsal
      INNER JOIN diagnosa_pasien dp ON dp.no_rawat = rp.no_rawat AND dp.status = rp.status_lanjut
      INNER JOIN mlite_clinical_pathway_diagnosis cpd ON cpd.kd_penyakit = dp.kd_penyakit
      INNER JOIN mlite_clinical_pathway cp ON cp.id = cpd.clinical_pathway_id AND cp.aktif = 'Ya' AND cp.jenis_layanan = 'Ranap'
      LEFT JOIN penyakit py ON py.kd_penyakit = dp.kd_penyakit
      LEFT JOIN mlite_clinical_pathway_patient cpp ON cpp.no_rawat = rp.no_rawat
      LEFT JOIN mlite_clinical_pathway existing_cp ON existing_cp.id = cpp.clinical_pathway_id
    `;
    const whereSql = `WHERE ${whereClauses.join(' AND ')}`;
    const havingSql = havingClauses.length ? `HAVING ${havingClauses.join(' AND ')}` : '';

    const [countRows] = await db.execute(
      `SELECT COUNT(*) AS total
       FROM (
         SELECT rp.no_rawat
         ${fromClause}
         ${whereSql}
         GROUP BY rp.no_rawat
         ${havingSql}
       ) matched_patients`,
      [...whereParams, ...havingParams]
    );

    const [rows] = await db.execute(
      `SELECT
        rp.no_rawat,
        rp.no_rkm_medis,
        pa.nm_pasien,
        MIN(CONCAT(ki.tgl_masuk, ' ', COALESCE(ki.jam_masuk, '00:00:00'))) AS tgl_masuk,
        GROUP_CONCAT(DISTINCT COALESCE(b.nm_bangsal, '') ORDER BY b.nm_bangsal ASC SEPARATOR '||') AS bangsal_labels,
        GROUP_CONCAT(DISTINCT COALESCE(k.kd_kamar, '') ORDER BY k.kd_kamar ASC SEPARATOR '||') AS kamar_labels,
        GROUP_CONCAT(
          DISTINCT CONCAT(dp.kd_penyakit, ' - ', COALESCE(py.nm_penyakit, ''))
          ORDER BY dp.prioritas ASC, dp.kd_penyakit ASC
          SEPARATOR '||'
        ) AS matched_icd_labels,
        COUNT(DISTINCT dp.kd_penyakit) AS matched_icd_count,
        GROUP_CONCAT(
          DISTINCT CONCAT(cp.kode_cp, ' - ', cp.nama_cp)
          ORDER BY cp.confidence_score DESC, cp.nama_cp ASC
          SEPARATOR '||'
        ) AS matched_clinical_pathway_labels,
        COUNT(DISTINCT cp.id) AS matched_clinical_pathway_count,
        MAX(cpp.id) AS existing_patient_id,
        MAX(COALESCE(existing_cp.kode_cp, '')) AS existing_kode_cp,
        MAX(COALESCE(existing_cp.nama_cp, '')) AS existing_nama_cp,
        MAX(COALESCE(cpp.status, '')) AS existing_status_cp
       ${fromClause}
       ${whereSql}
       GROUP BY rp.no_rawat, rp.no_rkm_medis, pa.nm_pasien
       ${havingSql}
       ORDER BY MIN(ki.tgl_masuk) DESC, rp.no_rawat DESC
       LIMIT ? OFFSET ?`,
      [...whereParams, ...havingParams, limit, offset]
    );

    const data = rows.map((row) => ({
      no_rawat: row.no_rawat,
      no_rkm_medis: row.no_rkm_medis,
      nm_pasien: row.nm_pasien,
      tgl_masuk: row.tgl_masuk,
      bangsal_labels: String(row.bangsal_labels || '')
        .split('||')
        .map((item) => item.trim())
        .filter(Boolean),
      kamar_labels: String(row.kamar_labels || '')
        .split('||')
        .map((item) => item.trim())
        .filter(Boolean),
      matched_icd_count: Number(row.matched_icd_count || 0),
      matched_icd_labels: String(row.matched_icd_labels || '')
        .split('||')
        .map((item) => item.trim())
        .filter(Boolean),
      matched_clinical_pathway_count: Number(row.matched_clinical_pathway_count || 0),
      matched_clinical_pathway_labels: String(row.matched_clinical_pathway_labels || '')
        .split('||')
        .map((item) => item.trim())
        .filter(Boolean),
      existing: Number(row.existing_patient_id || 0)
        ? {
            patient_id: Number(row.existing_patient_id || 0),
            kode_cp: String(row.existing_kode_cp || '').trim(),
            nama_cp: String(row.existing_nama_cp || '').trim(),
            status_cp: String(row.existing_status_cp || '').trim()
          }
        : null
    }));

    return {
      success: true,
      data,
      pagination: {
        page,
        limit,
        total: Number(countRows[0]?.total || 0),
        totalPages: Math.max(1, Math.ceil(Number(countRows[0]?.total || 0) / limit))
      }
    };
  }

  async getGeneratorCandidateFilterOptions() {
    const fromClause = `
      FROM kamar_inap ki
      INNER JOIN reg_periksa rp ON rp.no_rawat = ki.no_rawat
      LEFT JOIN kamar k ON k.kd_kamar = ki.kd_kamar
      LEFT JOIN bangsal b ON b.kd_bangsal = k.kd_bangsal
      INNER JOIN diagnosa_pasien dp ON dp.no_rawat = rp.no_rawat AND dp.status = rp.status_lanjut
      INNER JOIN mlite_clinical_pathway_diagnosis cpd ON cpd.kd_penyakit = dp.kd_penyakit
      INNER JOIN mlite_clinical_pathway cp ON cp.id = cpd.clinical_pathway_id AND cp.aktif = 'Ya' AND cp.jenis_layanan = 'Ranap'
      WHERE 1 = 1
    `;

    const [bangsalRows, kamarRows] = await Promise.all([
      db.execute(
        `SELECT DISTINCT COALESCE(b.nm_bangsal, '') AS label
         ${fromClause}
         AND COALESCE(b.nm_bangsal, '') <> ''
         ORDER BY b.nm_bangsal ASC`
      ),
      db.execute(
        `SELECT DISTINCT COALESCE(k.kd_kamar, '') AS label
         ${fromClause}
         AND COALESCE(k.kd_kamar, '') <> ''
         ORDER BY k.kd_kamar ASC`
      )
    ]);

    return {
      success: true,
      data: {
        bangsal_options: (bangsalRows[0] || []).map((row) => String(row.label || '').trim()).filter(Boolean),
        kamar_options: (kamarRows[0] || []).map((row) => String(row.label || '').trim()).filter(Boolean)
      }
    };
  }

  async getGeneratorPreviewByNoRawat(noRawat, preferredClinicalPathwayId = null) {
    const normalizedNoRawat = this.normalizeNoRawat(noRawat);
    const [rows] = await db.execute(
      `SELECT no_rkm_medis
       FROM reg_periksa
       WHERE no_rawat = ?
       LIMIT 1`,
      [normalizedNoRawat]
    );

    const noRkmMedis = String(rows[0]?.no_rkm_medis || '').trim();
    if (!noRkmMedis) {
      return {
        success: false,
        message: 'No. rawat tidak ditemukan pada registrasi pasien',
        data: null
      };
    }

    return this.getPatientData(noRkmMedis, normalizedNoRawat, preferredClinicalPathwayId);
  }

  async getMasterPathwayList(filters = {}) {
    const page = Math.max(1, Number(filters.page || 1));
    const limit = Math.max(1, Math.min(100, Number(filters.limit || 20)));
    const offset = (page - 1) * limit;
    const search = this.sanitizeLabel(filters.search);
    const jenisLayanan = String(filters.jenis_layanan || '').trim();
    const aktifFilter = String(filters.aktif || '').trim();

    const whereClauses = ['1 = 1'];
    const params = [];

    if (search) {
      whereClauses.push('(c.kode_cp LIKE ? OR c.nama_cp LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (jenisLayanan === 'Ralan' || jenisLayanan === 'Ranap') {
      whereClauses.push('c.jenis_layanan = ?');
      params.push(jenisLayanan);
    }

    if (aktifFilter === 'Ya' || aktifFilter === 'Tidak') {
      whereClauses.push('c.aktif = ?');
      params.push(aktifFilter);
    }

    const whereSql = whereClauses.join(' AND ');

    const [rows] = await db.execute(
      `SELECT
        c.id,
        c.kode_cp,
        c.nama_cp,
        c.jenis_layanan,
        c.target_los,
        COALESCE(c.target_tarif, 0) AS target_tarif,
        c.confidence_score,
        COALESCE(c.guideline_note, '') AS guideline_note,
        c.aktif,
        COUNT(DISTINCT d.id) AS diagnosis_count,
        COUNT(DISTINCT day.id) AS day_count,
        COUNT(DISTINCT act.id) AS activity_count
      FROM mlite_clinical_pathway c
      LEFT JOIN mlite_clinical_pathway_diagnosis d ON d.clinical_pathway_id = c.id
      LEFT JOIN mlite_clinical_pathway_day day ON day.clinical_pathway_id = c.id
      LEFT JOIN mlite_clinical_pathway_activity act ON act.clinical_pathway_day_id = day.id
      WHERE ${whereSql}
      GROUP BY c.id, c.kode_cp, c.nama_cp, c.jenis_layanan, c.target_los, c.target_tarif, c.confidence_score, c.guideline_note, c.aktif
      ORDER BY c.aktif DESC, c.nama_cp ASC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [countRows] = await db.execute(
      `SELECT COUNT(*) AS total
       FROM mlite_clinical_pathway c
       WHERE ${whereSql}`,
      params
    );

    return {
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total: Number(countRows[0]?.total || 0),
        totalPages: Math.max(1, Math.ceil(Number(countRows[0]?.total || 0) / limit))
      }
    };
  }

  async getMasterPathwayDetail(clinicalPathwayId) {
    const id = Number(clinicalPathwayId || 0);
    if (!id) {
      return {
        success: false,
        message: 'Master CP tidak valid',
        data: null
      };
    }

    const [masterRows] = await db.execute(
      `SELECT id, kode_cp, nama_cp, jenis_layanan, target_los, COALESCE(target_tarif, 0) AS target_tarif, confidence_score, COALESCE(evidence_note, '') AS evidence_note, COALESCE(guideline_note, '') AS guideline_note, aktif
       FROM mlite_clinical_pathway
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    const master = masterRows[0];
    if (!master) {
      return {
        success: false,
        message: 'Master CP tidak ditemukan',
        data: null
      };
    }

    const [diagnosisRows] = await db.execute(
      `SELECT
        d.id,
        d.kd_penyakit,
        COALESCE(py.nm_penyakit, '') AS nm_penyakit,
        d.prioritas,
        COALESCE(d.tipe, 'Utama') AS tipe
      FROM mlite_clinical_pathway_diagnosis d
      LEFT JOIN penyakit py ON py.kd_penyakit = d.kd_penyakit
      WHERE d.clinical_pathway_id = ?
      ORDER BY d.prioritas ASC, d.id ASC`,
      [id]
    );

    const [activityRows] = await db.execute(
      `SELECT
        day.id AS day_id,
        day.hari_ke,
        COALESCE(day.label_hari, CONCAT('Hari ', day.hari_ke)) AS label_hari,
        COALESCE(day.tujuan_harian, '') AS tujuan_harian,
        act.id,
        act.kategori,
        COALESCE(act.uraian_kegiatan, '') AS uraian_kegiatan,
        COALESCE(act.sumber_tabel, '') AS sumber_tabel,
        COALESCE(act.item_kode, '') AS item_kode,
        COALESCE(act.item_nama, '') AS item_nama,
        COALESCE(act.keterangan, '') AS keterangan,
        COALESCE(act.evidence_frequency, 0) AS evidence_frequency,
        COALESCE(act.evidence_percentage, 0) AS evidence_percentage,
        COALESCE(act.evidence_status, '') AS evidence_status,
        COALESCE(act.wajib, 'Ya') AS wajib,
        COALESCE(act.urutan, 0) AS urutan
      FROM mlite_clinical_pathway_day day
      LEFT JOIN mlite_clinical_pathway_activity act ON act.clinical_pathway_day_id = day.id
      WHERE day.clinical_pathway_id = ?
      ORDER BY day.hari_ke ASC, act.urutan ASC, act.id ASC`,
      [id]
    );

    const dayMap = new Map();
    for (const row of activityRows) {
      if (!dayMap.has(row.day_id)) {
        dayMap.set(row.day_id, {
          id: Number(row.day_id),
          hari_ke: Number(row.hari_ke || 1),
          label_hari: row.label_hari || `Hari ${row.hari_ke || 1}`,
          tujuan_harian: row.tujuan_harian || '',
          activities: []
        });
      }

      if (row.id) {
        dayMap.get(row.day_id).activities.push({
          id: Number(row.id),
          kategori: row.kategori || '',
          uraian_kegiatan: row.uraian_kegiatan || '',
          sumber_tabel: row.sumber_tabel || '',
          item_kode: row.item_kode || '',
          item_nama: row.item_nama || '',
          keterangan: row.keterangan || '',
          evidence_frequency: Number(row.evidence_frequency || 0),
          evidence_percentage: Number(row.evidence_percentage || 0),
          evidence_status: row.evidence_status || '',
          wajib: row.wajib || 'Ya',
          urutan: Number(row.urutan || 0)
        });
      }
    }

    return {
      success: true,
      data: {
        ...master,
        diagnoses: diagnosisRows.map((row) => ({
          id: Number(row.id),
          kd_penyakit: row.kd_penyakit,
          nm_penyakit: row.nm_penyakit || '',
          prioritas: Number(row.prioritas || 1),
          tipe: row.tipe === 'Sekunder' ? 'Sekunder' : 'Utama'
        })),
        days: Array.from(dayMap.values()).sort((left, right) => left.hari_ke - right.hari_ke)
      }
    };
  }

  async saveMasterPathway(payload, clinicalPathwayId = null) {
    let connection;
    try {
      const normalized = this.normalizeMasterManagementPayload(payload);
      this.validateMasterManagementPayload(normalized);

      connection = await db.getConnection();
      await connection.beginTransaction();

      const currentId = Number(clinicalPathwayId || 0);
      if (currentId) {
        const [existingRows] = await connection.execute(
          'SELECT id FROM mlite_clinical_pathway WHERE id = ? LIMIT 1',
          [currentId]
        );
        if (!existingRows.length) {
          throw new Error('Master CP tidak ditemukan.');
        }

        const [duplicateRows] = await connection.execute(
          'SELECT id FROM mlite_clinical_pathway WHERE kode_cp = ? AND id <> ? LIMIT 1',
          [normalized.kode_cp, currentId]
        );
        if (duplicateRows.length) {
          throw new Error('Kode Master CP sudah digunakan.');
        }

        await connection.execute(
          `UPDATE mlite_clinical_pathway
           SET kode_cp = ?, nama_cp = ?, jenis_layanan = ?, target_los = ?, target_tarif = ?, confidence_score = ?, evidence_note = ?, guideline_note = ?, aktif = ?
           WHERE id = ?`,
          [
            normalized.kode_cp,
            normalized.nama_cp,
            normalized.jenis_layanan,
            normalized.target_los,
            normalized.target_tarif,
            normalized.confidence_score,
            normalized.evidence_note,
            normalized.guideline_note,
            normalized.aktif,
            currentId
          ]
        );

        if (normalized.has_days) {
          const [dayRows] = await connection.execute(
            'SELECT id FROM mlite_clinical_pathway_day WHERE clinical_pathway_id = ?',
            [currentId]
          );
          const dayIds = dayRows.map((row) => Number(row.id)).filter(Boolean);
          if (dayIds.length) {
            const placeholders = dayIds.map(() => '?').join(',');
            await connection.execute(
              `DELETE FROM mlite_clinical_pathway_activity WHERE clinical_pathway_day_id IN (${placeholders})`,
              dayIds
            );
          }
          await connection.execute('DELETE FROM mlite_clinical_pathway_day WHERE clinical_pathway_id = ?', [currentId]);
        }

        if (normalized.has_diagnoses) {
          await connection.execute('DELETE FROM mlite_clinical_pathway_diagnosis WHERE clinical_pathway_id = ?', [currentId]);
        }
      } else {
        const [duplicateRows] = await connection.execute(
          'SELECT id FROM mlite_clinical_pathway WHERE kode_cp = ? LIMIT 1',
          [normalized.kode_cp]
        );
        if (duplicateRows.length) {
          throw new Error('Kode Master CP sudah digunakan.');
        }
      }

      let targetId = currentId;
      if (!targetId) {
        const [insertMaster] = await connection.execute(
          `INSERT INTO mlite_clinical_pathway
            (kode_cp, nama_cp, jenis_layanan, target_los, target_tarif, confidence_score, evidence_note, guideline_note, aktif)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            normalized.kode_cp,
            normalized.nama_cp,
            normalized.jenis_layanan,
            normalized.target_los,
            normalized.target_tarif,
            normalized.confidence_score,
            normalized.evidence_note,
            normalized.guideline_note,
            normalized.aktif
          ]
        );
        targetId = Number(insertMaster.insertId);
      }

      if (normalized.has_diagnoses) {
        for (const diagnosis of (normalized.diagnoses || [])) {
          await connection.execute(
            `INSERT INTO mlite_clinical_pathway_diagnosis
              (clinical_pathway_id, kd_penyakit, prioritas, tipe)
             VALUES (?, ?, ?, ?)`,
            [targetId, diagnosis.kd_penyakit, diagnosis.prioritas, diagnosis.tipe]
          );
        }
      }

      if (normalized.has_days) {
        const sortedDays = [...(normalized.days || [])].sort((left, right) => left.hari_ke - right.hari_ke);
        for (const day of sortedDays) {
          const [insertDay] = await connection.execute(
            `INSERT INTO mlite_clinical_pathway_day
              (clinical_pathway_id, hari_ke, label_hari, tujuan_harian)
             VALUES (?, ?, ?, ?)`,
            [targetId, day.hari_ke, day.label_hari, day.tujuan_harian || '']
          );

          const dayId = Number(insertDay.insertId);
          const sortedActivities = [...day.activities].sort((left, right) => left.urutan - right.urutan);

          for (const activity of sortedActivities) {
            await connection.execute(
              `INSERT INTO mlite_clinical_pathway_activity
                (clinical_pathway_day_id, kategori, uraian_kegiatan, sumber_tabel, item_kode, item_nama, keterangan, evidence_frequency, evidence_percentage, evidence_status, wajib, urutan)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                dayId,
                activity.kategori,
                activity.uraian_kegiatan || this.inferUraianKegiatan(activity.kategori, activity.item_nama),
                activity.sumber_tabel || 'manual',
                activity.item_kode || null,
                activity.item_nama,
                activity.keterangan || '',
                activity.evidence_frequency,
                activity.evidence_percentage,
                activity.evidence_status || 'Direkomendasikan',
                activity.wajib || 'Ya',
                activity.urutan
              ]
            );
          }
        }
      }

      await connection.commit();
      connection.release();
      connection = null;

      const detail = await this.getMasterPathwayDetail(targetId);
      return {
        success: true,
        message: currentId ? 'Master CP berhasil diperbarui' : 'Master CP berhasil dibuat',
        data: detail.data
      };
    } catch (error) {
      if (connection) {
        await connection.rollback();
        connection.release();
      }

      return {
        success: false,
        message: error.message || 'Gagal menyimpan Master CP',
        data: null
      };
    }
  }

  async seedDefaultMasterPathways() {
    let connection;
    try {
      const presets = this.getDefaultMasterPathwayPresets();
      connection = await db.getConnection();
      await connection.beginTransaction();

      const presetCodes = presets.map((item) => item.kode_cp);
      const codePlaceholders = presetCodes.map(() => '?').join(',');

      const [existingRows] = await connection.execute(
        `SELECT id, kode_cp, nama_cp
         FROM mlite_clinical_pathway
         WHERE kode_cp IN (${codePlaceholders})`,
        presetCodes
      );
      const existingMap = new Map(
        (Array.isArray(existingRows) ? existingRows : []).map((row) => [String(row.kode_cp || '').trim(), row])
      );

      let insertedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      for (const preset of presets) {
        const existing = existingMap.get(preset.kode_cp);
        if (existing) {
          if (String(existing.nama_cp || '').trim() !== preset.nama_cp) {
            await connection.execute(
              `UPDATE mlite_clinical_pathway
               SET nama_cp = ?, aktif = 'Ya'
               WHERE id = ?`,
              [preset.nama_cp, existing.id]
            );
            updatedCount += 1;
          } else {
            skippedCount += 1;
          }
          continue;
        }

        await connection.execute(
          `INSERT INTO mlite_clinical_pathway
            (kode_cp, nama_cp, jenis_layanan, target_los, target_tarif, confidence_score, evidence_note, guideline_note, aktif)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            preset.kode_cp,
            preset.nama_cp,
            preset.jenis_layanan,
            preset.target_los,
            preset.target_tarif,
            preset.confidence_score,
            preset.evidence_note,
            preset.guideline_note,
            preset.aktif
          ]
        );
        insertedCount += 1;
      }

      await this.ensureMasterCodeUniqueConstraint(connection);

      await connection.commit();
      connection.release();
      connection = null;

      return {
        success: true,
        message: 'Seed Master CP default berhasil dijalankan',
        data: {
          inserted_count: insertedCount,
          updated_count: updatedCount,
          skipped_count: skippedCount,
          presets: presets.map((item) => ({
            kode_cp: item.kode_cp,
            nama_cp: item.nama_cp
          }))
        }
      };
    } catch (error) {
      if (connection) {
        await connection.rollback();
        connection.release();
      }

      return {
        success: false,
        message: error.message || 'Gagal menyiapkan Master CP default',
        data: null
      };
    }
  }

  async deleteMasterPathway(clinicalPathwayId) {
    let connection;
    try {
      const id = Number(clinicalPathwayId || 0);
      if (!id) {
        return {
          success: false,
          message: 'Master CP tidak valid'
        };
      }

      connection = await db.getConnection();
      await connection.beginTransaction();

      const [usageRows] = await connection.execute(
        'SELECT COUNT(*) AS total FROM mlite_clinical_pathway_patient WHERE clinical_pathway_id = ?',
        [id]
      );
      if (Number(usageRows[0]?.total || 0) > 0) {
        throw new Error('Master CP sudah dipakai pada Inisiasi/Monitoring pasien. Nonaktifkan saja jika tidak ingin digunakan lagi.');
      }

      const [dayRows] = await connection.execute(
        'SELECT id FROM mlite_clinical_pathway_day WHERE clinical_pathway_id = ?',
        [id]
      );
      const dayIds = dayRows.map((row) => Number(row.id)).filter(Boolean);
      if (dayIds.length) {
        const placeholders = dayIds.map(() => '?').join(',');
        await connection.execute(
          `DELETE FROM mlite_clinical_pathway_activity WHERE clinical_pathway_day_id IN (${placeholders})`,
          dayIds
        );
      }

      await connection.execute('DELETE FROM mlite_clinical_pathway_day WHERE clinical_pathway_id = ?', [id]);
      await connection.execute('DELETE FROM mlite_clinical_pathway_diagnosis WHERE clinical_pathway_id = ?', [id]);
      await connection.execute('DELETE FROM mlite_clinical_pathway WHERE id = ?', [id]);

      await connection.commit();
      connection.release();
      connection = null;

      return {
        success: true,
        message: 'Master CP berhasil dihapus'
      };
    } catch (error) {
      if (connection) {
        await connection.rollback();
        connection.release();
      }

      return {
        success: false,
        message: error.message || 'Gagal menghapus Master CP'
      };
    }
  }

  async saveClinicalPathway(pathwayData) {
    return this.generatePatientClinicalPathway(pathwayData);
  }
}

export { ClinicalPathwayService };
