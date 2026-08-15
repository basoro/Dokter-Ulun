import db from '../config/database.js';

class GetMedicalRecordService {
  static DEFAULT_LIMIT = 5;
  static ORTHANC_CACHE_TTL_MS = 5 * 60 * 1000;
  static ORTHANC_PAYLOAD_CACHE_TTL_MS = 2 * 60 * 1000;
  static ORTHANC_REQUEST_TIMEOUT_MS = 15000;
  static ORTHANC_REQUEST_RETRY_COUNT = 1;
  static ORTHANC_INSTANCE_SORT_CONCURRENCY = 8;
  static orthancStudyCache = new Map();
  static orthancStudyInFlight = new Map();
  static radiologyPacsPayloadCache = new Map();
  static radiologyPacsPayloadInFlight = new Map();
  static orthancInstanceMetaCache = new Map();
  static orthancInstanceMetaInFlight = new Map();

  static getCacheEntry(cacheStore, cacheKey) {
    const cached = cacheStore.get(cacheKey);
    if (!cached) {
      return null;
    }

    if (cached.expiresAt <= Date.now()) {
      cacheStore.delete(cacheKey);
      return null;
    }

    return cached.value;
  }

  static setCacheEntry(cacheStore, cacheKey, value, ttlMs) {
    cacheStore.set(cacheKey, {
      value,
      expiresAt: Date.now() + ttlMs
    });
    return value;
  }

  static async withPromiseCache({ cacheStore, inFlightStore, cacheKey, ttlMs, factory }) {
    const cachedValue = this.getCacheEntry(cacheStore, cacheKey);
    if (cachedValue !== null) {
      return cachedValue;
    }

    const existingPromise = inFlightStore.get(cacheKey);
    if (existingPromise) {
      return existingPromise;
    }

    const nextPromise = (async () => {
      try {
        const result = await factory();
        return this.setCacheEntry(cacheStore, cacheKey, result, ttlMs);
      } finally {
        inFlightStore.delete(cacheKey);
      }
    })();

    inFlightStore.set(cacheKey, nextPromise);
    return nextPromise;
  }

  static getPositiveIntegerEnvValue(key, fallbackValue) {
    const rawValue = Number.parseInt(String(process.env[key] || '').trim(), 10);
    return Number.isFinite(rawValue) && rawValue > 0 ? rawValue : fallbackValue;
  }

  static wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  static isOrthancRetriableError(error) {
    if (!error) {
      return false;
    }

    if (error.name === 'AbortError') {
      return true;
    }

    const errorCode = String(error.code || error.cause?.code || '').trim().toUpperCase();
    return ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH'].includes(errorCode);
  }

  static async mapWithConcurrency(items, concurrency, mapper) {
    const normalizedItems = Array.isArray(items) ? items : [];
    const normalizedConcurrency = Math.max(1, Number(concurrency) || 1);
    const results = new Array(normalizedItems.length);
    let currentIndex = 0;

    const worker = async () => {
      while (currentIndex < normalizedItems.length) {
        const index = currentIndex++;
        results[index] = await mapper(normalizedItems[index], index);
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(normalizedConcurrency, normalizedItems.length) }, () => worker())
    );

    return results;
  }

  static buildRadiologyPacsPayloadCacheKey(noRawat, examDate, examName, mode) {
    return [
      String(noRawat || '').trim(),
      this.formatDateOnly(examDate),
      this.normalizeSearchText(examName),
      String(mode || 'summary').trim().toLowerCase()
    ].join('|');
  }

  static getIgdPoliCodes() {
    const rawValue = String(process.env.IGD_POLI_CODES || '').trim();
    const parsedCodes = rawValue
      .split(',')
      .map((code) => code.trim())
      .filter(Boolean);

    return parsedCodes.length ? parsedCodes : ['B0054', 'IGDK', 'IGD01'];
  }

  static isIgdVisitByKdPoli(kdPoli) {
    return this.getIgdPoliCodes().includes(String(kdPoli || '').trim());
  }

  static getEnvValue(key) {
    const upper = String(key || '').trim();
    if (!upper) {
      return '';
    }

    const aliasKeys = {
      STOK_RESEP_RAJAL: ['STOK_RESEP_RALAN']
    };

    const aliases = Array.isArray(aliasKeys[upper]) ? aliasKeys[upper] : [];
    return (
      String(process.env[upper] || '').trim() ||
      String(process.env[upper.toLowerCase()] || '').trim() ||
      aliases
        .map((alias) => String(process.env[alias] || '').trim() || String(process.env[alias.toLowerCase()] || '').trim())
        .find(Boolean) ||
      ''
    );
  }

  static async getLaboratoryResponsibleDoctor() {
    const query = `
      SELECT
        TRIM(ms.value) AS kd_dokter,
        COALESCE(TRIM(d.nm_dokter), '') AS nm_dokter
      FROM mlite_settings ms
      LEFT JOIN dokter d ON TRIM(d.kd_dokter) = TRIM(ms.value)
      WHERE ms.module = 'settings' AND ms.field = 'pj_Laboratorium'
      LIMIT 1
    `;

    const [rows] = await db.execute(query);
    return {
      kd_dokter: String(rows?.[0]?.kd_dokter || '').trim(),
      nm_dokter: String(rows?.[0]?.nm_dokter || '').trim()
    };
  }

  // Utility function to format date only (no time conversion)
  static formatDateOnly(dateStr) {
    if (!dateStr) return '';
    
    // Handle MySQL DATE format (YYYY-MM-DD)
    if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateStr;
    }
    
    // Handle Date object or ISO string
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '';
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      return `${year}-${month}-${day}`;
    } catch (error) {
      console.error('Error formatting date:', dateStr, error);
      return '';
    }
  }

  static normalizeSearchText(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  static normalizePacsDate(dateStr) {
    if (!dateStr) {
      return '';
    }

    const rawValue = String(dateStr).trim();
    if (/^\d{8}$/.test(rawValue)) {
      return `${rawValue.slice(0, 4)}-${rawValue.slice(4, 6)}-${rawValue.slice(6, 8)}`;
    }

    return this.formatDateOnly(rawValue);
  }

  static formatIcd10DiagnosesSummary(rows = []) {
    const items = Array.isArray(rows) ? rows : [];
    const normalizedItems = items
      .filter(Boolean)
      .map((row) => ({
        code: String(row?.code || '').trim(),
        description: String(row?.description || '').trim(),
        prioritas: Number(row?.prioritas || 0)
      }))
      .filter((row) => row.code || row.description);

    const primary = normalizedItems.find((row) => row.prioritas === 1) || normalizedItems[0];
    if (!primary) {
      return '';
    }

    if (!primary.description) {
      return primary.code;
    }
    if (!primary.code) {
      return primary.description;
    }
    return `${primary.code} - ${primary.description}`;
  }

  static buildPatientNoteSummary(note) {
    if (!note) {
      return null;
    }

    const catatan = String(note.catatan || '').trim();
    if (!catatan) {
      return null;
    }

    return {
      tanggal: String(note.tanggal || '').trim(),
      jam: String(note.jam || '').trim(),
      catatan,
      petugas: String(note.petugas || '').trim()
    };
  }

  static async fetchPatientNotesSummaryMap(noRawats = []) {
    const normalizedNoRawats = Array.from(
      new Set((Array.isArray(noRawats) ? noRawats : [])
        .map((item) => String(item || '').trim())
        .filter(Boolean))
    );

    if (!normalizedNoRawats.length) {
      return new Map();
    }

    const placeholders = normalizedNoRawats.map(() => '?').join(', ');
    const query = `
      SELECT
        cp.no_rawat,
        DATE_FORMAT(cp.tanggal, '%Y-%m-%d') AS tanggal,
        TIME_FORMAT(cp.jam, '%H:%i') AS jam,
        TRIM(cp.catatan) AS catatan,
        COALESCE(d.nm_dokter, cp.kd_dokter, '') AS petugas
      FROM catatan_perawatan cp
      LEFT JOIN dokter d ON d.kd_dokter = cp.kd_dokter
      INNER JOIN (
        SELECT
          no_rawat,
          MAX(CONCAT(
            DATE_FORMAT(tanggal, '%Y-%m-%d'),
            ' ',
            TIME_FORMAT(jam, '%H:%i:%s')
          )) AS latest_at
        FROM catatan_perawatan
        WHERE no_rawat IN (${placeholders})
        GROUP BY no_rawat
      ) latest_note
        ON latest_note.no_rawat = cp.no_rawat
       AND CONCAT(
         DATE_FORMAT(cp.tanggal, '%Y-%m-%d'),
         ' ',
         TIME_FORMAT(cp.jam, '%H:%i:%s')
       ) = latest_note.latest_at
      WHERE cp.no_rawat IN (${placeholders})
      ORDER BY cp.no_rawat ASC
    `;

    const [rows] = await db.execute(query, [...normalizedNoRawats, ...normalizedNoRawats]);
    const noteMap = new Map();

    rows.forEach((row) => {
      const noRawat = String(row?.no_rawat || '').trim();
      if (!noRawat || noteMap.has(noRawat)) {
        return;
      }

      noteMap.set(noRawat, this.buildPatientNoteSummary(row));
    });

    return noteMap;
  }

  static async fetchIcdDetailsByNoRawat(noRawat, statusLanjut) {
    const normalizedNoRawat = String(noRawat || '').trim();
    if (!normalizedNoRawat) {
      return { icd10: [], icd9: [], snomed: [] };
    }

    const normalizedStatus = String(statusLanjut || '').trim() === 'Ranap' ? 'Ranap' : 'Ralan';

    const [icd10Rows, icd9Rows, snomedRows] = await Promise.all([
      db.execute(
        `
          SELECT
            dp.kd_penyakit,
            COALESCE(p.nm_penyakit, '') AS nm_penyakit,
            dp.prioritas,
            COALESCE(dp.status_penyakit, '') AS status_penyakit,
            COALESCE(msi.snomed_concept_id, '') AS snomed_concept_id,
            COALESCE(msi.snomed_term, '') AS snomed_term
          FROM diagnosa_pasien dp
          LEFT JOIN penyakit p ON p.kd_penyakit = dp.kd_penyakit
          LEFT JOIN mlite_mapping_snomed_icd msi
            ON msi.no_rawat = dp.no_rawat
            AND msi.kd_penyakit = dp.kd_penyakit
          WHERE dp.no_rawat = ?
            AND dp.status = ?
          ORDER BY dp.prioritas ASC, dp.kd_penyakit ASC
        `,
        [normalizedNoRawat, normalizedStatus]
      ),
      db.execute(
        `
          SELECT
            pp.kode,
            COALESCE(i.deskripsi_panjang, '') AS deskripsi_panjang,
            COALESCE(i.deskripsi_pendek, '') AS deskripsi_pendek,
            pp.prioritas,
            COALESCE(msi9.snomed_concept_id, '') AS snomed_concept_id,
            COALESCE(msi9.snomed_term, '') AS snomed_term
          FROM prosedur_pasien pp
          LEFT JOIN icd9 i ON i.kode = pp.kode
          LEFT JOIN mlite_mapping_snomed_icd9 msi9
            ON msi9.no_rawat = pp.no_rawat
            AND msi9.kd_tindakan = pp.kode
          WHERE pp.no_rawat = ?
            AND pp.status = ?
          ORDER BY pp.prioritas ASC, pp.kode ASC
        `,
        [normalizedNoRawat, normalizedStatus]
      ),
      db.execute(
        `
          SELECT DISTINCT
            x.snomed_concept_id,
            x.snomed_term
          FROM (
            SELECT snomed_concept_id, snomed_term
            FROM mlite_mapping_snomed_icd
            WHERE no_rawat = ?
            UNION ALL
            SELECT snomed_concept_id, snomed_term
            FROM mlite_mapping_snomed_icd9
            WHERE no_rawat = ?
          ) x
          WHERE COALESCE(TRIM(x.snomed_concept_id), '') <> ''
             OR COALESCE(TRIM(x.snomed_term), '') <> ''
          ORDER BY COALESCE(x.snomed_term, ''), COALESCE(x.snomed_concept_id, '')
        `,
        [normalizedNoRawat, normalizedNoRawat]
      )
    ]);

    const icd10 = (Array.isArray(icd10Rows?.[0]) ? icd10Rows[0] : []).map((row) => ({
      kd_penyakit: String(row?.kd_penyakit || '').trim(),
      nm_penyakit: String(row?.nm_penyakit || '').trim(),
      prioritas: Number(row?.prioritas || 0),
      status_penyakit: String(row?.status_penyakit || '').trim(),
      snomed_concept_id: String(row?.snomed_concept_id || '').trim(),
      snomed_term: String(row?.snomed_term || '').trim()
    }));

    const icd9 = (Array.isArray(icd9Rows?.[0]) ? icd9Rows[0] : []).map((row) => ({
      kode: String(row?.kode || '').trim(),
      deskripsi_panjang: String(row?.deskripsi_panjang || '').trim(),
      deskripsi_pendek: String(row?.deskripsi_pendek || '').trim(),
      prioritas: Number(row?.prioritas || 0),
      snomed_concept_id: String(row?.snomed_concept_id || '').trim(),
      snomed_term: String(row?.snomed_term || '').trim()
    }));

    const snomed = (Array.isArray(snomedRows?.[0]) ? snomedRows[0] : []).map((row) => ({
      snomed_concept_id: String(row?.snomed_concept_id || '').trim(),
      snomed_term: String(row?.snomed_term || '').trim()
    }));

    return { icd10, icd9, snomed };
  }

  static async fetchIcd10DiagnosesMap(noRawats = [], statusLanjut) {
    if (!Array.isArray(noRawats) || noRawats.length === 0) {
      return new Map();
    }

    const normalizedStatus = String(statusLanjut || '').trim() === 'Ranap' ? 'Ranap' : 'Ralan';
    const placeholders = noRawats.map(() => '?').join(',');

    const [rows] = await db.execute(
      `
        SELECT
          dp.no_rawat,
          dp.kd_penyakit AS code,
          COALESCE(p.nm_penyakit, '') AS description,
          dp.prioritas
        FROM diagnosa_pasien dp
        LEFT JOIN penyakit p ON p.kd_penyakit = dp.kd_penyakit
        WHERE dp.no_rawat IN (${placeholders})
          AND dp.status = ?
        ORDER BY dp.no_rawat ASC, dp.prioritas ASC, dp.kd_penyakit ASC
      `,
      [...noRawats, normalizedStatus]
    );

    const map = new Map();
    rows.forEach((row) => {
      const key = String(row?.no_rawat || '').trim();
      if (!key) {
        return;
      }
      const existing = map.get(key) || [];
      existing.push(row);
      map.set(key, existing);
    });

    const summaryMap = new Map();
    map.forEach((value, key) => {
      summaryMap.set(key, this.formatIcd10DiagnosesSummary(value));
    });

    return summaryMap;
  }

  static async resolveMedicationStockBangsalCode(noRawat, status) {
    const normalizedStatus = String(status || '').trim().toLowerCase();

    if (normalizedStatus === 'ibs') {
      return this.getEnvValue('STOK_RESEP_IBS');
    }

    if (normalizedStatus === 'pulang') {
      return this.getEnvValue('STOK_RESEP_RANAP');
    }

    if (normalizedStatus === 'ranap') {
      return this.getEnvValue('STOK_RESEP_RANAP');
    }

    if (normalizedStatus === 'ralan') {
      const [rows] = await db.execute(
        `
          SELECT kd_poli
          FROM reg_periksa
          WHERE no_rawat = ?
          LIMIT 1
        `,
        [noRawat]
      );

      const kdPoli = String(rows?.[0]?.kd_poli || '').trim();
      if (['B0054', 'IGDK', 'IGD01'].includes(kdPoli)) {
        return this.getEnvValue('STOK_RESEP_IGD');
      }

      return this.getEnvValue('STOK_RESEP_RAJAL');
    }

    return '';
  }

  static async findMatchingMedicationPackage(prescriptionItems = []) {
    const normalizedItems = (Array.isArray(prescriptionItems) ? prescriptionItems : [])
      .map((item) => ({
        kode_brng: String(item?.kode_brng || '').trim(),
        jumlah: String(item?.jumlah ?? item?.jml ?? '').trim(),
        aturan_pakai: String(item?.aturan_pakai || '').trim()
      }))
      .filter((item) => item.kode_brng);

    if (!normalizedItems.length) {
      return null;
    }

    const uniqueCodes = Array.from(new Set(normalizedItems.map((item) => item.kode_brng)));
    const placeholders = uniqueCodes.map(() => '?').join(', ');
    const [rows] = await db.execute(
      `
        SELECT
          ept.id_paket,
          ept.kd_obat,
          ept.jumlah,
          ept.aturan_pakai,
          epo.kd_paket,
          epo.nama_paket
        FROM eresep_paket_operasi_template ept
        INNER JOIN eresep_paket_operasi epo ON epo.id = ept.id_paket
        WHERE epo.status = '1'
          AND ept.kd_obat IN (${placeholders})
      `,
      uniqueCodes
    );

    const packageMap = new Map();
    rows.forEach((row) => {
      const key = String(row?.id_paket || '').trim();
      if (!key) {
        return;
      }
      const existing = packageMap.get(key) || {
        id_paket: key,
        kd_paket: String(row?.kd_paket || '').trim(),
        nama_paket: String(row?.nama_paket || '').trim(),
        items: []
      };
      existing.items.push({
        kode_brng: String(row?.kd_obat || '').trim(),
        jumlah: String(row?.jumlah ?? '').trim(),
        aturan_pakai: String(row?.aturan_pakai || '').trim()
      });
      packageMap.set(key, existing);
    });

    const prescriptionSignature = normalizedItems
      .map((item) => `${item.kode_brng}::${item.jumlah}::${item.aturan_pakai}`)
      .sort()
      .join('|');

    for (const packageItem of packageMap.values()) {
      const packageSignature = (Array.isArray(packageItem.items) ? packageItem.items : [])
        .map((item) => `${item.kode_brng}::${item.jumlah}::${item.aturan_pakai}`)
        .sort()
        .join('|');

      if (packageSignature && packageSignature === prescriptionSignature) {
        return {
          id_paket: packageItem.id_paket,
          kd_paket: packageItem.kd_paket,
          nama_paket: packageItem.nama_paket
        };
      }
    }

    return null;
  }

  static async getOrthancConfig() {
    const server = String(process.env.ORTHANC_SERVER || '').trim();
    const username = String(process.env.ORTHANC_USERNAME || 'orthanc').trim();
    const password = String(process.env.ORTHANC_PASSWORD || 'orthanc').trim();

    return {
      server,
      username,
      password
    };
  }

  static async requestOrthanc(pathname, init = {}) {
    const orthancConfig = await this.getOrthancConfig();
    if (!orthancConfig.server) {
      throw new Error('Konfigurasi server Orthanc belum tersedia');
    }

    const baseUrl = orthancConfig.server.replace(/\/+$/, '');
    const authToken = Buffer.from(`${orthancConfig.username}:${orthancConfig.password}`).toString('base64');
    const timeoutMs = this.getPositiveIntegerEnvValue('ORTHANC_REQUEST_TIMEOUT_MS', this.ORTHANC_REQUEST_TIMEOUT_MS);
    const retryCount = this.getPositiveIntegerEnvValue('ORTHANC_REQUEST_RETRY_COUNT', this.ORTHANC_REQUEST_RETRY_COUNT);
    let lastError = null;

    for (let attempt = 0; attempt <= retryCount; attempt += 1) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(`${baseUrl}${pathname}`, {
          ...init,
          signal: controller.signal,
          headers: {
            Authorization: `Basic ${authToken}`,
            ...(init.headers || {})
          }
        });

        if (!response.ok) {
          const orthancError = new Error(`Orthanc request failed with status ${response.status}`);
          orthancError.status = response.status;

          if (attempt < retryCount && response.status >= 500) {
            lastError = orthancError;
            await this.wait(250 * (attempt + 1));
            continue;
          }

          throw orthancError;
        }

        return response;
      } catch (error) {
        lastError = error;
        if (attempt < retryCount && this.isOrthancRetriableError(error)) {
          await this.wait(250 * (attempt + 1));
          continue;
        }

        throw error;
      } finally {
        clearTimeout(timeoutId);
      }
    }

    throw lastError || new Error('Orthanc request failed');
  }

  static async fetchRadiologyPacsSeries(noRawat) {
    const registrationQuery = `
      SELECT no_rkm_medis, tgl_registrasi
      FROM reg_periksa
      WHERE no_rawat = ?
      LIMIT 1
    `;
    const dateRangeQuery = `
      SELECT
        MIN(tgl_periksa) AS first_exam_date,
        MAX(tgl_periksa) AS last_exam_date
      FROM periksa_radiologi
      WHERE no_rawat = ?
    `;

    const [[registrationRows], [dateRangeRows]] = await Promise.all([
      db.execute(registrationQuery, [noRawat]),
      db.execute(dateRangeQuery, [noRawat])
    ]);

    const registration = registrationRows[0];
    const dateRange = dateRangeRows[0];
    const patientId = String(registration?.no_rkm_medis || '').trim();
    const studyStartDate = String(this.formatDateOnly(registration?.tgl_registrasi || '')).replace(/-/g, '');
    const studyEndDate = String(this.formatDateOnly(dateRange?.last_exam_date || '')).replace(/-/g, '');

    if (!patientId || !studyStartDate || !studyEndDate) {
      return [];
    }

    const cacheKey = `${String(noRawat || '').trim()}|${patientId}|${studyStartDate}|${studyEndDate}`;

    try {
      return await this.withPromiseCache({
        cacheStore: this.orthancStudyCache,
        inFlightStore: this.orthancStudyInFlight,
        cacheKey,
        ttlMs: this.ORTHANC_CACHE_TTL_MS,
        factory: async () => {
          const findResponse = await this.requestOrthanc('/tools/find', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              Level: 'Study',
              Expand: true,
              Query: {
                StudyDate: `${studyStartDate}-${studyEndDate}`,
                PatientID: patientId
              }
            })
          });

          const studies = await findResponse.json();
          if (!Array.isArray(studies) || studies.length === 0) {
            return [];
          }

          const seriesIds = studies.flatMap((study) => Array.isArray(study?.Series) ? study.Series : []);
          if (seriesIds.length === 0) {
            return [];
          }

          const seriesResults = await Promise.all(
            seriesIds.map(async (seriesId) => {
              try {
                const seriesResponse = await this.requestOrthanc(`/series/${seriesId}`);
                const seriesData = await seriesResponse.json();
                const seriesDate = this.normalizePacsDate(
                  seriesData?.MainDicomTags?.SeriesDate || seriesData?.MainDicomTags?.StudyDate || ''
                );
                const description =
                  seriesData?.MainDicomTags?.AcquisitionDeviceProcessingDescription ||
                  seriesData?.MainDicomTags?.SeriesDescription ||
                  '';
                const modality = String(
                  seriesData?.MainDicomTags?.Modality ||
                  seriesData?.RequestedTags?.Modality ||
                  ''
                ).trim().toUpperCase();
                const instances = Array.isArray(seriesData?.Instances) ? seriesData.Instances : [];

                return {
                  series_id: seriesId,
                  series_date: seriesDate,
                  description,
                  modality,
                  images: instances.map((instanceId) => ({
                    instance_id: instanceId,
                    series_id: seriesId
                  }))
                };
              } catch (error) {
                console.error(`Error loading Orthanc series ${seriesId}:`, error);
                return null;
              }
            })
          );

          return seriesResults.filter(Boolean);
        }
      });
    } catch (error) {
      console.error(`Error fetching PACS radiology series for ${noRawat}:`, error);
      return [];
    }
  }

  static matchRadiologyPacsSeries(seriesList, examDate, examName) {
    const normalizedDate = this.formatDateOnly(examDate);
    const datedSeries = (seriesList || []).filter((series) => series?.series_date === normalizedDate);

    if (!datedSeries.length) {
      return [];
    }

    const normalizedExam = this.normalizeSearchText(examName);
    if (!normalizedExam) {
      return datedSeries;
    }

    const matchedSeries = datedSeries.filter((series) => {
      const normalizedDescription = this.normalizeSearchText(series?.description);
      return normalizedDescription && (
        normalizedDescription.includes(normalizedExam) ||
        normalizedExam.includes(normalizedDescription)
      );
    });

    return matchedSeries.length ? matchedSeries : datedSeries;
  }

  static parseNumberTag(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const normalized = Number(String(value).trim());
    return Number.isFinite(normalized) ? normalized : null;
  }

  static parseImagePositionZ(value) {
    if (Array.isArray(value) && value.length >= 3) {
      const z = Number(value[2]);
      return Number.isFinite(z) ? z : null;
    }

    const normalized = String(value || '').trim();
    if (!normalized) {
      return null;
    }

    const parts = normalized.split('\\').map((entry) => Number(String(entry).trim()));
    if (parts.length >= 3 && Number.isFinite(parts[2])) {
      return parts[2];
    }

    return null;
  }

  static async getOrthancInstanceSortMetadata(instanceId) {
    const normalizedInstanceId = String(instanceId || '').trim();
    if (!normalizedInstanceId) {
      return null;
    }

    return this.withPromiseCache({
      cacheStore: this.orthancInstanceMetaCache,
      inFlightStore: this.orthancInstanceMetaInFlight,
      cacheKey: normalizedInstanceId,
      ttlMs: this.ORTHANC_CACHE_TTL_MS,
      factory: async () => {
        const response = await this.requestOrthanc(`/instances/${encodeURIComponent(normalizedInstanceId)}`);
        const instanceData = await response.json();
        const tags = instanceData?.MainDicomTags || instanceData?.SimplifiedTags || instanceData?.RequestedTags || {};

        return {
          instance_number: this.parseNumberTag(tags?.InstanceNumber),
          acquisition_number: this.parseNumberTag(tags?.AcquisitionNumber),
          slice_location: this.parseNumberTag(tags?.SliceLocation),
          image_position_z: this.parseImagePositionZ(tags?.ImagePositionPatient)
        };
      }
    });
  }

  static compareRadiologyPacsImageOrder(left, right) {
    const pairComparisons = [
      [left?.instance_number, right?.instance_number],
      [left?.image_position_z, right?.image_position_z],
      [left?.slice_location, right?.slice_location],
      [left?.acquisition_number, right?.acquisition_number]
    ];

    for (const [leftValue, rightValue] of pairComparisons) {
      if (leftValue !== null && rightValue !== null && leftValue !== rightValue) {
        return leftValue - rightValue;
      }
    }

    return (left?.original_index || 0) - (right?.original_index || 0);
  }

  static async sortMatchedRadiologySeries(matchedSeries) {
    const normalizedSeries = Array.isArray(matchedSeries) ? matchedSeries.filter(Boolean) : [];
    const instanceSortConcurrency = this.getPositiveIntegerEnvValue(
      'ORTHANC_INSTANCE_SORT_CONCURRENCY',
      this.ORTHANC_INSTANCE_SORT_CONCURRENCY
    );

    const sortedSeries = await Promise.all(
      normalizedSeries.map(async (series) => {
        const images = Array.isArray(series?.images) ? series.images.filter(Boolean) : [];
        if (images.length <= 1) {
          return series;
        }

        const enrichedImages = await this.mapWithConcurrency(
          images,
          instanceSortConcurrency,
          async (image, index) => {
            try {
              const sortMetadata = await this.getOrthancInstanceSortMetadata(image?.instance_id);
              return {
                ...image,
                ...sortMetadata,
                original_index: index
              };
            } catch (error) {
              console.error(`Error loading Orthanc instance sort metadata ${image?.instance_id || ''}:`, error);
              return {
                ...image,
                instance_number: null,
                acquisition_number: null,
                slice_location: null,
                image_position_z: null,
                original_index: index
              };
            }
          }
        );

        enrichedImages.sort((left, right) => this.compareRadiologyPacsImageOrder(left, right));

        return {
          ...series,
          images: enrichedImages.map(({ original_index, ...image }) => image)
        };
      })
    );

    return sortedSeries;
  }

  static serializeRadiologyPacsImage(image, series = {}) {
    return {
      ...image,
      series_date: series.series_date || '',
      description: series.description || '',
      modality: series.modality || ''
    };
  }

  static buildRadiologyPacsPayload(matchedSeries, options = {}) {
    const {
      limitCtToThumbnail = false,
      mode = 'summary',
      nonCtPreviewLimit = 6
    } = options;
    const normalizedMode = String(mode || 'summary').trim().toLowerCase() === 'full' ? 'full' : 'summary';
    const pacsModality = matchedSeries.find((series) => series?.modality)?.modality || '';
    const allImages = matchedSeries.flatMap((series) =>
      (series.images || []).map((image) => this.serializeRadiologyPacsImage(image, series))
    );
    const totalImages = allImages.length;
    const shouldLimitCtImages = (limitCtToThumbnail || normalizedMode === 'summary') && pacsModality === 'CT' && totalImages > 0;
    const normalizedNonCtPreviewLimit = Math.max(1, Number(nonCtPreviewLimit) || 6);

    const limitImagesForResponse = (images, modality) => {
      if (normalizedMode === 'full') {
        return images;
      }

      if (modality === 'CT') {
        return images.slice(0, 1);
      }

      return images.slice(0, normalizedNonCtPreviewLimit);
    };

    const responseImages = shouldLimitCtImages
      ? allImages.slice(0, 1)
      : limitImagesForResponse(allImages, pacsModality);

    return {
      pacs_modality: pacsModality,
      pacs_total_images: totalImages,
      pacs_metadata_only: normalizedMode !== 'full',
      pacs_full_loaded: responseImages.length >= totalImages,
      pacs_series: matchedSeries.map((series) => {
        const seriesImages = (series.images || []).map((image) => this.serializeRadiologyPacsImage(image, series));
        const responseSeriesImages = shouldLimitCtImages && series.modality === 'CT'
          ? seriesImages.slice(0, 1)
          : limitImagesForResponse(seriesImages, series.modality);

        return {
          series_id: series.series_id || '',
          series_date: series.series_date || '',
          description: series.description || '',
          modality: series.modality || '',
          image_count: seriesImages.length,
          thumbnail_instance_id: seriesImages.length > 0 ? seriesImages[0].instance_id : '',
          images: responseSeriesImages
        };
      }),
      pacs_images: responseImages
    };
  }

  static async getRadiologyPacsImages(noRawat, examDate, examName, options = {}) {
    const mode = String(options?.mode || 'summary').trim().toLowerCase() === 'full' ? 'full' : 'summary';
    const cacheKey = this.buildRadiologyPacsPayloadCacheKey(noRawat, examDate, examName, mode);

    return this.withPromiseCache({
      cacheStore: this.radiologyPacsPayloadCache,
      inFlightStore: this.radiologyPacsPayloadInFlight,
      cacheKey,
      ttlMs: this.ORTHANC_PAYLOAD_CACHE_TTL_MS,
      factory: async () => {
        const pacsSeries = await this.fetchRadiologyPacsSeries(noRawat);
        const matchedSeries = this.matchRadiologyPacsSeries(pacsSeries, examDate, examName);
        const orderedSeries = mode === 'full'
          ? await this.sortMatchedRadiologySeries(matchedSeries)
          : matchedSeries;

        return this.buildRadiologyPacsPayload(orderedSeries, { mode });
      }
    });
  }

  static async getOrthancRenderedImage(instanceId, width = 500) {
    const normalizedWidth = Math.min(Math.max(parseInt(width, 10) || 500, 100), 2000);
    const response = await this.requestOrthanc(`/instances/${encodeURIComponent(instanceId)}/rendered/?width=${normalizedWidth}`);
    const contentType = response.headers.get('content-type') || 'image/png';
    const arrayBuffer = await response.arrayBuffer();

    return {
      contentType,
      buffer: Buffer.from(arrayBuffer)
    };
  }

  static async getOrthancPreviewImage(instanceId, width = 500) {
    try {
      const response = await this.requestOrthanc(`/instances/${encodeURIComponent(instanceId)}/preview`);
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const arrayBuffer = await response.arrayBuffer();

      return {
        contentType,
        buffer: Buffer.from(arrayBuffer)
      };
    } catch (error) {
      console.warn(`Orthanc preview unavailable for instance ${instanceId}, fallback to rendered:`, error.message);
      return this.getOrthancRenderedImage(instanceId, width);
    }
  }

  // Helper function to fetch examinations
  static async fetchExaminations(noRawat, type) {
    const table = type === 'ralan' ? 'pemeriksaan_ralan' : 'pemeriksaan_ranap';
    const examQuery = `
      SELECT
        p1.*,
        p2.nama,
        CASE
          WHEN LOWER(COALESCE(TRIM(mu.role), '')) = 'paramedis'
            AND LOWER(COALESCE(TRIM(p3.bidang), '')) = 'irsyad' THEN 'terapis'
          WHEN COALESCE(TRIM(mu.role), '') <> '' THEN TRIM(mu.role)
          WHEN LOWER(COALESCE(p2.nama, '')) LIKE '%dr.%' THEN 'medis'
          ELSE ''
        END AS role
      FROM ${table} p1
      LEFT JOIN pegawai p2 ON p2.nik = p1.nip
      LEFT JOIN mlite_users mu ON TRIM(mu.username) = TRIM(p1.nip)
      LEFT JOIN pegawai p3 ON TRIM(p3.nik) = TRIM(mu.username)
      WHERE p1.no_rawat = ?
      ORDER BY p1.tgl_perawatan DESC, p1.jam_rawat DESC
    `;
    const [rows] = await db.execute(examQuery, [noRawat]);
    
    return rows.map(row => ({
      tanggal: this.formatDateOnly(row.tgl_perawatan) + ' ' + row.jam_rawat,
      tgl_perawatan: this.formatDateOnly(row.tgl_perawatan),
      jam_rawat: row.jam_rawat,
      nip: row.nip || '',
      role: row.role || '',
      tekanan_darah: row.tensi || '',
      nadi: row.nadi || '',
      respirasi: row.respirasi || '',
      suhu: row.suhu_tubuh || '',
      tinggi: row.tinggi || '',
      berat: row.berat || '',
      spo2: row.spo2 || '',
      gcs: row.gcs || '',
      s: row.keluhan || '',
      o: row.pemeriksaan || '',
      a: row.penilaian || '',
      p: row.rtl || '',
      i: row.instruksi || '',
      e: row.evaluasi || '',
      pegawai: row.nama || '',
      verified_at: row.verified_at || null
    }));
  }

  static async fetchTriageIgd(noRawat) {
    const [rows] = await db.execute(
      `
        SELECT *
        FROM data_triase_igd
        WHERE no_rawat = ?
        LIMIT 1
      `,
      [noRawat]
    );

    const triage = rows[0];
    if (!triage) {
      return null;
    }

    const [detailRows] = await db.execute(
      `
        SELECT
          dpt.kd_tindakan,
          COALESCE(mti.nm_tindakan, '') AS nm_tindakan,
          COALESCE(mti.kd_level, '') AS kd_level,
          COALESCE(mti.nm_level, '') AS nm_level
        FROM detail_pemeriksaan_triase dpt
        LEFT JOIN master_triase_igd mti ON mti.kd_tindakan = dpt.kd_tindakan
        WHERE dpt.no_rawat = ?
        ORDER BY mti.kd_level ASC, mti.nm_tindakan ASC
      `,
      [noRawat]
    );

    const primaryLevel = detailRows[0] || {};

    return {
      tanggal: triage.tanggal ? `${this.formatDateOnly(triage.tanggal)} ${triage.jam || ''}`.trim() : '',
      namakasus: triage.namakasus || '',
      stts_diantar: triage.stts_diantar || '',
      transportasi: triage.transportasi || '',
      stts_fungsional: triage.stts_fungsional || '',
      psikologis: triage.psikologis || '',
      stts_tinggal: triage.stts_tinggal || '',
      keluhan_utama: triage.keluhan_utama || '',
      riwayat_penyakit: triage.riwayat_penyakit || '',
      saturasi: triage.saturasi || '',
      periksafisik: triage.periksafisik || '',
      skala_nyeri: triage.skala_nyeri || '',
      resiko_jatuh: triage.resiko_jatuh || '',
      diagnosis: triage.diagnosis || '',
      tindakan: triage.tindakan || '',
      keterangan: triage.keterangan || '',
      kd_level: primaryLevel.kd_level || '',
      nm_level: primaryLevel.nm_level || '',
      tindakan_triase: detailRows.map((item) => ({
        kd_tindakan: item.kd_tindakan || '',
        nm_tindakan: item.nm_tindakan || ''
      }))
    };
  }

  static async fetchEkstrapiramidal(noRawat) {
    const [rows] = await db.execute(
      `
        SELECT *
        FROM mlite_ekstrapiramidal
        WHERE no_rawat = ?
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `,
      [noRawat]
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    let hasil = null;
    try {
      hasil = row?.hasil ? JSON.parse(row.hasil) : null;
    } catch (error) {
      hasil = null;
    }

    return {
      no_rawat: String(row?.no_rawat || '').trim(),
      dokter: String(row?.dokter || row?.nm_dokter || '').trim(),
      hasil: hasil && typeof hasil === 'object' ? hasil : {},
      created_at: String(row?.created_at || row?.tanggal || '').trim(),
      updated_at: String(row?.updated_at || '').trim()
    };
  }

  static async fetchProcedures(noRawat, type) {
    const tablePrefix = type === 'ralan' ? 'rawat_jl' : 'rawat_inap';
    const procedureReferenceTable = type === 'ralan' ? 'jns_perawatan' : 'jns_perawatan_inap';
    const statusRawat = type === 'ralan' ? 'Ralan' : 'Ranap';
    const proceduresQuery = `
      SELECT
        tindakan.tgl_perawatan,
        tindakan.jam_rawat,
        tindakan.kd_jenis_prw,
        tindakan.biaya_rawat,
        tindakan.record_type,
        tindakan.kd_dokter,
        tindakan.nip,
        tindakan.nama_pelaksana,
        jp.nm_perawatan
      FROM (
        SELECT
          tindakan.no_rawat,
          tindakan.kd_jenis_prw,
          tindakan.tgl_perawatan,
          tindakan.jam_rawat,
          tindakan.biaya_rawat,
          'dr' AS record_type,
          tindakan.kd_dokter,
          NULL AS nip,
          COALESCE(d.nm_dokter, 'Dokter') AS nama_pelaksana
        FROM ${tablePrefix}_dr tindakan
        LEFT JOIN dokter d ON tindakan.kd_dokter = d.kd_dokter
        WHERE no_rawat = ?
        UNION ALL
        SELECT
          tindakan.no_rawat,
          tindakan.kd_jenis_prw,
          tindakan.tgl_perawatan,
          tindakan.jam_rawat,
          tindakan.biaya_rawat,
          'pr' AS record_type,
          NULL AS kd_dokter,
          tindakan.nip,
          COALESCE(p.nama, 'Perawat') AS nama_pelaksana
        FROM ${tablePrefix}_pr tindakan
        LEFT JOIN pegawai p ON tindakan.nip = p.nik
        WHERE no_rawat = ?
        UNION ALL
        SELECT
          tindakan.no_rawat,
          tindakan.kd_jenis_prw,
          tindakan.tgl_perawatan,
          tindakan.jam_rawat,
          tindakan.biaya_rawat,
          'drpr' AS record_type,
          tindakan.kd_dokter,
          tindakan.nip,
          CONCAT_WS(' & ', d.nm_dokter, p.nama) AS nama_pelaksana
        FROM ${tablePrefix}_drpr tindakan
        LEFT JOIN dokter d ON tindakan.kd_dokter = d.kd_dokter
        LEFT JOIN pegawai p ON tindakan.nip = p.nik
        WHERE no_rawat = ?
      ) tindakan
      LEFT JOIN ${procedureReferenceTable} jp ON tindakan.kd_jenis_prw = jp.kd_jenis_prw
      ORDER BY tindakan.tgl_perawatan DESC, tindakan.jam_rawat DESC, jp.nm_perawatan ASC
    `;
    const [rows] = await db.execute(proceduresQuery, [noRawat, noRawat, noRawat]);

    return rows.map((row) => ({
      tanggal: this.formatDateOnly(row.tgl_perawatan) + ' ' + row.jam_rawat,
      tgl_perawatan: this.formatDateOnly(row.tgl_perawatan),
      jam_rawat: row.jam_rawat,
      kd_jenis_prw: row.kd_jenis_prw,
      nm_perawatan: row.nm_perawatan || row.kd_jenis_prw || '-',
      nama: row.nm_perawatan || row.kd_jenis_prw || '-',
      nama_pelaksana: row.nama_pelaksana || '-',
      hasil: row.nama_pelaksana || '-',
      biaya_rawat: row.biaya_rawat || 0,
      record_type: row.record_type || 'dr',
      kd_dokter: row.kd_dokter || '',
      nip: row.nip || '',
      status_rawat: statusRawat
    }));
  }

  // Helper function to fetch medications using 2-step approach
  static async fetchMedications(noRawat, status) {
    // Step 1: Get list of unique prescriptions
    const prescQuery = `
      SELECT DISTINCT
        ro.no_resep,
        ro.tgl_perawatan,
        ro.jam,
        ro.kd_dokter,
        COALESCE(d.nm_dokter, '') AS nm_dokter
      FROM resep_obat ro
      LEFT JOIN dokter d ON d.kd_dokter = ro.kd_dokter
      WHERE ro.no_rawat = ? AND ro.status = ?
      ORDER BY tgl_perawatan, jam
    `;
    const [prescRows] = await db.execute(prescQuery, [noRawat, status]);
    const medications = [];
    
    // Step 2: For each prescription, fetch detailed medications
    for (const prescRow of prescRows) {
      // Skip if tgl_perawatan or jam is NULL
      if (!prescRow.tgl_perawatan || !prescRow.jam) {
        continue;
      }
      
      const detailQuery = `
        SELECT dro.kode_brng, dro.jml, ap.aturan, ob.nama_brng
        FROM detail_pemberian_obat dro
        LEFT JOIN databarang ob ON dro.kode_brng = ob.kode_brng
        LEFT JOIN aturan_pakai ap ON dro.no_rawat = ap.no_rawat AND dro.kode_brng = ap.kode_brng AND ap.tgl_perawatan = ? AND ap.jam = ? 
        WHERE dro.no_rawat = ?
        AND dro.tgl_perawatan = ?
        AND dro.jam = ?
        ORDER BY ob.nama_brng
      `;
      const [detailRows] = await db.execute(detailQuery, [
        prescRow.tgl_perawatan,
        prescRow.jam,
        noRawat,
        prescRow.tgl_perawatan,
        prescRow.jam
      ]);
      
      const obatList = detailRows.map(row => ({
        kode_brng: row.kode_brng || '',
        nama: row.nama_brng || '-',
        jumlah: row.jml || '-',
        aturan_pakai: row.aturan || '-'
      }));
      
      if (obatList.length > 0) {
        medications.push({
          tanggal: this.formatDateOnly(prescRow.tgl_perawatan) + ' ' + prescRow.jam,
          no_resep: prescRow.no_resep,
          no_rawat: String(noRawat || '').trim(),
          kd_dokter: prescRow.kd_dokter || '',
          nm_dokter: prescRow.nm_dokter || '',
          obat: obatList
        });
      }
    }
    
    return medications;
  }

  // Helper function to fetch medications request using 2-step approach
  static async fetchMedicationsRequest(noRawat, status) {
    const normalizedStatus = String(status || '').trim().toLowerCase();
    const stockBangsalCode = await this.resolveMedicationStockBangsalCode(noRawat, normalizedStatus);

    const prescRequestQuery = normalizedStatus === 'pulang'
      ? `
          SELECT
            rdp.no_resep,
            rdp.tgl_peresepan,
            rdp.jam_peresepan,
            IF(rdp.jam_peresepan = rdp.jam_perawatan, 'Belum Terlayani', 'Sudah Terlayani') AS status_layanan,
            rdp.kd_dokter,
            COALESCE(d.nm_dokter, '') AS nm_dokter
          FROM resep_dokter_pulang rdp
          INNER JOIN resep_pulang rp ON rp.no_resep = rdp.no_resep
          LEFT JOIN dokter d ON d.kd_dokter = rdp.kd_dokter
          WHERE rp.no_rawat = ?
          GROUP BY rdp.no_resep, rdp.tgl_peresepan, rdp.jam_peresepan, rdp.kd_dokter, d.nm_dokter
          ORDER BY rdp.tgl_peresepan, rdp.jam_peresepan
        `
      : `
          SELECT DISTINCT ro.no_resep, ro.tgl_peresepan, ro.jam_peresepan, IF(ro.jam_peresepan = ro.jam, 'Belum Terlayani', 'Sudah Terlayani') AS status_layanan, ro.kd_dokter, COALESCE(d.nm_dokter, '') AS nm_dokter,
            EXISTS(
              SELECT 1
              FROM mlite_veronisa mv
              WHERE mv.no_rawat = ro.no_rawat
                AND DATE(mv.tgl_registrasi) = DATE(ro.tgl_peresepan)
            ) AS is_kronis
          FROM resep_obat ro
          LEFT JOIN dokter d ON d.kd_dokter = ro.kd_dokter
          WHERE ro.no_rawat = ? AND ro.status = ?
          ORDER BY ro.tgl_peresepan, ro.jam_peresepan
        `;
    const [prescRequestRows] = await db.execute(
      prescRequestQuery,
      normalizedStatus === 'pulang' ? [noRawat] : [noRawat, normalizedStatus]
    );
    const medicationsRequest = [];
    
    // Step 2: For each prescription request, fetch detailed medications request
    for (const prescRequestRow of prescRequestRows) {
      // Skip if tgl_peresepan or jam_peresepan is NULL
      if (!prescRequestRow.tgl_peresepan || !prescRequestRow.jam_peresepan) {
        continue;
      }
      
      const detailRequestQuery = normalizedStatus === 'pulang'
        ? `
            SELECT
              rp.kode_brng,
              rp.jml_barang AS jml,
              rp.dosis AS aturan_pakai,
              ob.nama_brng,
              ob.kode_sat AS satuan,
              COALESCE(SUM(gb.stok), 0) AS stok
            FROM resep_pulang rp
            LEFT JOIN databarang ob ON rp.kode_brng = ob.kode_brng
            LEFT JOIN gudangbarang gb ON gb.kode_brng = rp.kode_brng AND gb.kd_bangsal = ?
            WHERE rp.no_resep = ?
            GROUP BY rp.kode_brng, rp.jml_barang, rp.dosis, ob.nama_brng, ob.kode_sat
            ORDER BY ob.nama_brng
          `
        : `
            SELECT
              dro.kode_brng,
              dro.jml,
              dro.aturan_pakai,
              ob.nama_brng,
              ob.kode_sat AS satuan,
              COALESCE(SUM(gb.stok), 0) AS stok
            FROM resep_dokter dro
            LEFT JOIN databarang ob ON dro.kode_brng = ob.kode_brng
            LEFT JOIN gudangbarang gb ON gb.kode_brng = dro.kode_brng AND gb.kd_bangsal = ?
            WHERE dro.no_resep = ?
            GROUP BY dro.kode_brng, dro.jml, dro.aturan_pakai, ob.nama_brng, ob.kode_sat
            ORDER BY ob.nama_brng
          `;
      const compoundQuery = `
        SELECT
          rdr.no_racik,
          rdr.nama_racik,
          rdr.kd_racik,
          rdr.jml_dr,
          rdr.aturan_pakai,
          rdr.keterangan,
          mr.nm_racik
        FROM resep_dokter_racikan rdr
        LEFT JOIN metode_racik mr ON mr.kd_racik = rdr.kd_racik
        WHERE rdr.no_resep = ?
        ORDER BY rdr.no_racik ASC
      `;
      const [detailRequestRows, compoundRows] = await Promise.all([
        db.execute(detailRequestQuery, [stockBangsalCode, prescRequestRow.no_resep]).then(([rows]) => rows),
        normalizedStatus === 'pulang'
          ? Promise.resolve([])
          : db.execute(compoundQuery, [prescRequestRow.no_resep]).then(([rows]) => rows)
      ]);
      
      const obatList = detailRequestRows.map(row => ({
        kode_brng: row.kode_brng || '',
        nama: row.nama_brng || '-',
        jumlah: row.jml || '-',
        aturan_pakai: row.aturan_pakai || '-',
        satuan: row.satuan || '',
        stok: Number(row.stok) || 0
      }));

      const compounds = [];
      for (const compoundRow of compoundRows) {
        const [compoundDetailRows] = await db.execute(
          `
            SELECT
              rdrd.kode_brng,
              rdrd.kandungan,
              rdrd.jml,
              db.nama_brng,
              db.kode_sat AS satuan,
              COALESCE(SUM(gb.stok), 0) AS stok
            FROM resep_dokter_racikan_detail rdrd
            LEFT JOIN databarang db ON db.kode_brng = rdrd.kode_brng
            LEFT JOIN gudangbarang gb ON gb.kode_brng = rdrd.kode_brng AND gb.kd_bangsal = ?
            WHERE rdrd.no_resep = ? AND rdrd.no_racik = ?
            GROUP BY rdrd.kode_brng, rdrd.kandungan, rdrd.jml, db.nama_brng, db.kode_sat
            ORDER BY db.nama_brng ASC
          `,
          [stockBangsalCode, prescRequestRow.no_resep, compoundRow.no_racik]
        );

        compounds.push({
          no_racik: compoundRow.no_racik,
          nama_racik: compoundRow.nama_racik || '',
          kd_racik: compoundRow.kd_racik || '',
          nm_racik: compoundRow.nm_racik || '',
          jml_dr: compoundRow.jml_dr || '',
          aturan_pakai: compoundRow.aturan_pakai || '',
          keterangan: compoundRow.keterangan || '',
          details: compoundDetailRows.map((detailRow) => ({
            kode_brng: detailRow.kode_brng || '',
            nama_brng: detailRow.nama_brng || '-',
            kandungan: detailRow.kandungan || '',
            jml: detailRow.jml || '',
            satuan: detailRow.satuan || '',
            stok: Number(detailRow.stok) || 0
          }))
        });
      }
      
      const packageMatch = compounds.length === 0
        ? await this.findMatchingMedicationPackage(obatList)
        : null;

      if (obatList.length > 0 || compounds.length > 0) {
        medicationsRequest.push({
          tanggal: this.formatDateOnly(prescRequestRow.tgl_peresepan) + ' ' + prescRequestRow.jam_peresepan,
          no_resep: prescRequestRow.no_resep,
          no_rawat: noRawat,
          status_layanan: String(prescRequestRow.status_layanan || '').trim() || 'Belum Terlayani',
          kd_dokter: prescRequestRow.kd_dokter || '',
          nm_dokter: prescRequestRow.nm_dokter || '',
          is_kronis: Boolean(Number(prescRequestRow.is_kronis) || prescRequestRow.is_kronis === true),
          obat: obatList,
          compounds,
          is_package: Boolean(packageMatch),
          package_id: packageMatch?.id_paket || '',
          package_name: packageMatch?.nama_paket || '',
          package_code: packageMatch?.kd_paket || ''
        });
      }
    }
    
    return medicationsRequest;
  }

  static async fetchMedicationRequestsByNoRm(noRm, status = 'ralan', options = {}) {
    const normalizedNoRm = String(noRm || '').trim();
    const normalizedStatus = String(status || '').trim().toLowerCase();
    const historyMode = String(options.historyMode || '').trim().toLowerCase() === 'all' ? 'all' : 'latest';
    if (!normalizedNoRm) {
      return {
        items: [],
        hasMore: false,
        compoundHasMore: false,
        nonCompoundHasMore: false,
        compoundTotal: 0,
        nonCompoundTotal: 0
      };
    }

    const compoundCountQuery = ['ralan', 'ranap'].includes(normalizedStatus)
      ? normalizedStatus === 'ralan'
        ? `
            SELECT COUNT(DISTINCT ro.no_resep) AS total
            FROM reg_periksa rp
            INNER JOIN resep_obat ro ON ro.no_rawat = rp.no_rawat
            INNER JOIN resep_dokter_racikan rdr ON rdr.no_resep = ro.no_resep
            WHERE rp.no_rkm_medis = ?
              AND LOWER(COALESCE(ro.status, '')) = ?
              AND rp.status_lanjut IN ('Ralan', 'Ranap')
          `
        : `
            SELECT COUNT(DISTINCT ro.no_resep) AS total
            FROM reg_periksa rp
            INNER JOIN resep_obat ro ON ro.no_rawat = rp.no_rawat
            INNER JOIN resep_dokter_racikan rdr ON rdr.no_resep = ro.no_resep
            WHERE rp.no_rkm_medis = ?
              AND LOWER(COALESCE(ro.status, '')) = ?
          `
      : '';

    const nonCompoundCountQuery = ['ralan', 'ranap'].includes(normalizedStatus)
      ? normalizedStatus === 'ralan'
        ? `
            SELECT COUNT(DISTINCT ro.no_resep) AS total
            FROM reg_periksa rp
            INNER JOIN resep_obat ro ON ro.no_rawat = rp.no_rawat
            INNER JOIN resep_dokter rd ON rd.no_resep = ro.no_resep
            WHERE rp.no_rkm_medis = ?
              AND LOWER(COALESCE(ro.status, '')) = ?
              AND rp.status_lanjut IN ('Ralan', 'Ranap')
          `
        : `
            SELECT COUNT(DISTINCT ro.no_resep) AS total
            FROM reg_periksa rp
            INNER JOIN resep_obat ro ON ro.no_rawat = rp.no_rawat
            INNER JOIN resep_dokter rd ON rd.no_resep = ro.no_resep
            WHERE rp.no_rkm_medis = ?
              AND LOWER(COALESCE(ro.status, '')) = ?
          `
      : '';

    const countQuery = normalizedStatus === 'pulang'
      ? `
          SELECT COUNT(DISTINCT rdp.no_resep) AS total
          FROM reg_periksa reg
          INNER JOIN resep_pulang rp ON rp.no_rawat = reg.no_rawat
          INNER JOIN resep_dokter_pulang rdp ON rdp.no_resep = rp.no_resep
          WHERE reg.no_rkm_medis = ?
        `
      : normalizedStatus === 'ralan'
        ? `
            SELECT COUNT(DISTINCT ro.no_resep) AS total
            FROM reg_periksa rp
            INNER JOIN resep_obat ro ON ro.no_rawat = rp.no_rawat
            WHERE rp.no_rkm_medis = ?
              AND LOWER(COALESCE(ro.status, '')) = ?
              AND rp.status_lanjut IN ('Ralan', 'Ranap')
          `
      : `
          SELECT COUNT(DISTINCT ro.no_resep) AS total
          FROM reg_periksa rp
          INNER JOIN resep_obat ro ON ro.no_rawat = rp.no_rawat
          WHERE rp.no_rkm_medis = ?
            AND LOWER(COALESCE(ro.status, '')) = ?
        `;

    const prescRequestQuery = normalizedStatus === 'pulang'
      ? `
          SELECT DISTINCT
            rdp.no_resep,
            rp.no_rawat,
            rdp.tgl_peresepan,
            rdp.jam_peresepan,
            IF(rdp.jam_peresepan = rdp.jam_perawatan, 'Belum Terlayani', 'Sudah Terlayani') AS status_layanan,
            rdp.kd_dokter,
            COALESCE(d.nm_dokter, '') AS nm_dokter
          FROM reg_periksa reg
          INNER JOIN resep_pulang rp ON rp.no_rawat = reg.no_rawat
          INNER JOIN resep_dokter_pulang rdp ON rdp.no_resep = rp.no_resep
          LEFT JOIN dokter d ON d.kd_dokter = rdp.kd_dokter
          WHERE reg.no_rkm_medis = ?
          ORDER BY rdp.tgl_peresepan DESC, rdp.jam_peresepan DESC
          ${historyMode === 'latest' ? 'LIMIT 1' : ''}
        `
      : normalizedStatus === 'ralan'
        ? `
            SELECT DISTINCT
              ro.no_resep,
              ro.no_rawat,
              ro.tgl_peresepan,
              ro.jam_peresepan,
              IF(ro.jam_peresepan = ro.jam, 'Belum Terlayani', 'Sudah Terlayani') AS status_layanan,
              ro.kd_dokter,
              COALESCE(d.nm_dokter, '') AS nm_dokter,
              EXISTS(
                SELECT 1
                FROM mlite_veronisa mv
                WHERE mv.no_rawat = ro.no_rawat
                  AND DATE(mv.tgl_registrasi) = DATE(ro.tgl_peresepan)
              ) AS is_kronis
            FROM reg_periksa rp
            INNER JOIN resep_obat ro ON ro.no_rawat = rp.no_rawat
            LEFT JOIN dokter d ON d.kd_dokter = ro.kd_dokter
            WHERE rp.no_rkm_medis = ?
              AND LOWER(COALESCE(ro.status, '')) = ?
              AND rp.status_lanjut IN ('Ralan', 'Ranap')
            ORDER BY ro.tgl_peresepan DESC, ro.jam_peresepan DESC
            ${historyMode === 'latest' ? 'LIMIT 1' : ''}
          `
      : `
          SELECT DISTINCT
            ro.no_resep,
            ro.no_rawat,
            ro.tgl_peresepan,
            ro.jam_peresepan,
            IF(ro.jam_peresepan = ro.jam, 'Belum Terlayani', 'Sudah Terlayani') AS status_layanan,
            ro.kd_dokter,
            COALESCE(d.nm_dokter, '') AS nm_dokter,              EXISTS(
                SELECT 1
                FROM mlite_veronisa mv
                WHERE mv.no_rawat = ro.no_rawat
                  AND DATE(mv.tgl_registrasi) = DATE(ro.tgl_peresepan)
              ) AS is_kronis
            FROM reg_periksa rp
            INNER JOIN resep_obat ro ON ro.no_rawat = rp.no_rawat
            LEFT JOIN dokter d ON d.kd_dokter = ro.kd_dokter
            WHERE rp.no_rkm_medis = ?
              AND LOWER(COALESCE(ro.status, '')) = ?
          ORDER BY ro.tgl_peresepan DESC, ro.jam_peresepan DESC
          ${historyMode === 'latest' ? 'LIMIT 1' : ''}
        `;

    const [[countRows], [prescRequestRows], [compoundCountRows], [nonCompoundCountRows]] = await Promise.all([
      db.execute(
        countQuery,
        normalizedStatus === 'pulang' ? [normalizedNoRm] : [normalizedNoRm, normalizedStatus]
      ),
      db.execute(
        prescRequestQuery,
        normalizedStatus === 'pulang' ? [normalizedNoRm] : [normalizedNoRm, normalizedStatus]
      ),
      compoundCountQuery
        ? db.execute(compoundCountQuery, [normalizedNoRm, normalizedStatus])
        : Promise.resolve([[{ total: 0 }]]),
      nonCompoundCountQuery
        ? db.execute(nonCompoundCountQuery, [normalizedNoRm, normalizedStatus])
        : Promise.resolve([[{ total: 0 }]])
    ]);
    const total = Number(countRows?.[0]?.total) || 0;
    const compoundTotal = Number(compoundCountRows?.[0]?.total) || 0;
    const nonCompoundTotal = Number(nonCompoundCountRows?.[0]?.total) || 0;
    const medicationsRequest = [];

    for (const prescRequestRow of prescRequestRows) {
      if (!prescRequestRow.tgl_peresepan || !prescRequestRow.jam_peresepan) {
        continue;
      }

      const stockBangsalCode = await this.resolveMedicationStockBangsalCode(
        String(prescRequestRow.no_rawat || '').trim(),
        normalizedStatus
      );

      const detailRequestQuery = normalizedStatus === 'pulang'
        ? `
            SELECT
              rp.kode_brng,
              rp.jml_barang AS jml,
              rp.dosis AS aturan_pakai,
              ob.nama_brng,
              ob.kode_sat AS satuan,
              COALESCE(SUM(gb.stok), 0) AS stok
            FROM resep_pulang rp
            LEFT JOIN databarang ob ON rp.kode_brng = ob.kode_brng
            LEFT JOIN gudangbarang gb ON gb.kode_brng = rp.kode_brng AND gb.kd_bangsal = ?
            WHERE rp.no_resep = ?
            GROUP BY rp.kode_brng, rp.jml_barang, rp.dosis, ob.nama_brng, ob.kode_sat
            ORDER BY ob.nama_brng
          `
        : `
            SELECT
              dro.kode_brng,
              dro.jml,
              dro.aturan_pakai,
              ob.nama_brng,
              ob.kode_sat AS satuan,
              COALESCE(SUM(gb.stok), 0) AS stok
            FROM resep_dokter dro
            LEFT JOIN databarang ob ON dro.kode_brng = ob.kode_brng
            LEFT JOIN gudangbarang gb ON gb.kode_brng = dro.kode_brng AND gb.kd_bangsal = ?
            WHERE dro.no_resep = ?
            GROUP BY dro.kode_brng, dro.jml, dro.aturan_pakai, ob.nama_brng, ob.kode_sat
            ORDER BY ob.nama_brng
          `;
      const compoundQuery = `
        SELECT
          rdr.no_racik,
          rdr.nama_racik,
          rdr.kd_racik,
          rdr.jml_dr,
          rdr.aturan_pakai,
          rdr.keterangan,
          mr.nm_racik
        FROM resep_dokter_racikan rdr
        LEFT JOIN metode_racik mr ON mr.kd_racik = rdr.kd_racik
        WHERE rdr.no_resep = ?
        ORDER BY rdr.no_racik ASC
      `;

      const [detailRequestRows, compoundRows] = await Promise.all([
        db.execute(detailRequestQuery, [stockBangsalCode, prescRequestRow.no_resep]).then(([rows]) => rows),
        normalizedStatus === 'pulang'
          ? Promise.resolve([])
          : db.execute(compoundQuery, [prescRequestRow.no_resep]).then(([rows]) => rows)
      ]);

      const obatList = detailRequestRows.map((row) => ({
        kode_brng: row.kode_brng || '',
        nama: row.nama_brng || '-',
        jumlah: row.jml || '-',
        aturan_pakai: row.aturan_pakai || '-',
        satuan: row.satuan || '',
        stok: Number(row.stok) || 0
      }));

      const compounds = [];
      for (const compoundRow of compoundRows) {
        const [compoundDetailRows] = await db.execute(
          `
            SELECT
              rdrd.kode_brng,
              rdrd.kandungan,
              rdrd.jml,
              db.nama_brng,
              db.kode_sat AS satuan,
              COALESCE(SUM(gb.stok), 0) AS stok
            FROM resep_dokter_racikan_detail rdrd
            LEFT JOIN databarang db ON db.kode_brng = rdrd.kode_brng
            LEFT JOIN gudangbarang gb ON gb.kode_brng = rdrd.kode_brng AND gb.kd_bangsal = ?
            WHERE rdrd.no_resep = ? AND rdrd.no_racik = ?
            GROUP BY rdrd.kode_brng, rdrd.kandungan, rdrd.jml, db.nama_brng, db.kode_sat
            ORDER BY db.nama_brng ASC
          `,
          [stockBangsalCode, prescRequestRow.no_resep, compoundRow.no_racik]
        );

        compounds.push({
          no_racik: compoundRow.no_racik,
          nama_racik: compoundRow.nama_racik || '',
          kd_racik: compoundRow.kd_racik || '',
          nm_racik: compoundRow.nm_racik || '',
          jml_dr: compoundRow.jml_dr || '',
          aturan_pakai: compoundRow.aturan_pakai || '',
          keterangan: compoundRow.keterangan || '',
          details: compoundDetailRows.map((detailRow) => ({
            kode_brng: detailRow.kode_brng || '',
            nama_brng: detailRow.nama_brng || '-',
            kandungan: detailRow.kandungan || '',
            jml: detailRow.jml || '',
            satuan: detailRow.satuan || '',
            stok: Number(detailRow.stok) || 0
          }))
        });
      }

      const packageMatch = compounds.length === 0
        ? await this.findMatchingMedicationPackage(obatList)
        : null;

      if (obatList.length > 0 || compounds.length > 0) {
        medicationsRequest.push({
          tanggal: this.formatDateOnly(prescRequestRow.tgl_peresepan) + ' ' + prescRequestRow.jam_peresepan,
          no_resep: prescRequestRow.no_resep,
          no_rawat: String(prescRequestRow.no_rawat || '').trim(),
          status_layanan: String(prescRequestRow.status_layanan || '').trim() || 'Belum Terlayani',
          kd_dokter: prescRequestRow.kd_dokter || '',
          nm_dokter: prescRequestRow.nm_dokter || '',
          is_kronis: Boolean(Number(prescRequestRow.is_kronis) || prescRequestRow.is_kronis === true),
          obat: obatList,
          compounds,
          is_package: Boolean(packageMatch),
          package_id: packageMatch?.id_paket || '',
          package_name: packageMatch?.nama_paket || '',
          package_code: packageMatch?.kd_paket || ''
        });
      }
    }

    return {
      items: medicationsRequest,
      hasMore: total > medicationsRequest.length,
      compoundHasMore: historyMode === 'latest' ? compoundTotal > 1 : false,
      nonCompoundHasMore: historyMode === 'latest' ? nonCompoundTotal > 1 : false,
      compoundTotal,
      nonCompoundTotal
    };
  }

  // Helper function to fetch lab results request
  static async fetchLaboratoryRequest(noRawat, status) {
    const labRequestQuery = `
      SELECT
        pl.noorder,
        pl.tgl_permintaan,
        pl.jam_permintaan,
        pl.dokter_perujuk,
        dpk.klinis,
        ppl.kd_jenis_prw,
        jpl.nm_perawatan,
        tl.id_template,
        tl.Pemeriksaan AS template_name,
        tl.satuan,
        tl.nilai_rujukan_ld,
        tl.nilai_rujukan_la,
        tl.nilai_rujukan_pd,
        tl.nilai_rujukan_pa
      FROM permintaan_lab pl 
      LEFT JOIN permintaan_pemeriksaan_lab ppl ON ppl.noorder = pl.noorder 
      LEFT JOIN jns_perawatan_lab jpl ON jpl.kd_jenis_prw = ppl.kd_jenis_prw
      LEFT JOIN diagnosa_pasien_klinis dpk ON dpk.noorder = pl.noorder
      LEFT JOIN template_laboratorium tl ON tl.kd_jenis_prw = ppl.kd_jenis_prw
      WHERE pl.no_rawat = ? AND pl.status = ? 
      ORDER BY pl.tgl_permintaan, pl.jam_permintaan, ppl.kd_jenis_prw, tl.Pemeriksaan
    `;
    const [rows] = await db.execute(labRequestQuery, [noRawat, status]);

    const requestsByOrder = new Map();

    rows.forEach((row) => {
      const requestKey = row.noorder || `${this.formatDateOnly(row.tgl_permintaan)} ${row.jam_permintaan}`;

      if (!requestsByOrder.has(requestKey)) {
        requestsByOrder.set(requestKey, {
          noorder: row.noorder || '',
          tanggal: this.formatDateOnly(row.tgl_permintaan) + ' ' + row.jam_permintaan,
          dokter_perujuk: row.dokter_perujuk || '',
          klinis: row.klinis || '',
          pemeriksaanMap: new Map()
        });
      }

      const requestEntry = requestsByOrder.get(requestKey);
      const examKey = row.kd_jenis_prw || row.nm_perawatan || '';

      if (row.nm_perawatan && !requestEntry.pemeriksaanMap.has(examKey)) {
        requestEntry.pemeriksaanMap.set(examKey, {
          kode: row.kd_jenis_prw || '',
          nama: row.nm_perawatan,
          templates: []
        });
      }

      if (row.id_template && requestEntry.pemeriksaanMap.has(examKey)) {
        const examEntry = requestEntry.pemeriksaanMap.get(examKey);
        const alreadyExists = examEntry.templates.some((template) => template.id_template === row.id_template);

        if (!alreadyExists) {
          examEntry.templates.push({
            id_template: row.id_template,
            nama: row.template_name || '',
            satuan: row.satuan || '',
            nilai_rujukan_ld: row.nilai_rujukan_ld || '',
            nilai_rujukan_la: row.nilai_rujukan_la || '',
            nilai_rujukan_pd: row.nilai_rujukan_pd || '',
            nilai_rujukan_pa: row.nilai_rujukan_pa || ''
          });
        }
      }
    });

    return Array.from(requestsByOrder.values()).map((requestEntry) => ({
      noorder: requestEntry.noorder,
      tanggal: requestEntry.tanggal,
      dokter_perujuk: requestEntry.dokter_perujuk,
      klinis: requestEntry.klinis,
      pemeriksaan: Array.from(requestEntry.pemeriksaanMap.values())
    }));
  }

  // Helper function to fetch lab results
  static async fetchLaboratory(noRawat, status = null) {
    const headerQuery = `      SELECT
        pl.no_rawat,
        pl.kd_jenis_prw,
        pl.tgl_periksa,
        pl.jam,
        jp.nm_perawatan,
        dokter.nm_dokter,
        petugas.nama AS nama_petugas,
        COALESCE(d2.nm_dokter, '') AS nm_dokter_penanggung_jawab
      FROM periksa_lab pl 
        LEFT JOIN jns_perawatan_lab jp ON pl.kd_jenis_prw = jp.kd_jenis_prw 
        LEFT JOIN dokter ON pl.dokter_perujuk = dokter.kd_dokter
        LEFT JOIN dokter d2 ON pl.kd_dokter = d2.kd_dokter
        LEFT JOIN petugas ON pl.nip = petugas.nip
        WHERE pl.no_rawat = ?
          AND (? IS NULL OR LOWER(pl.status) = LOWER(?))
          AND (jp.nm_perawatan IS NULL OR LOWER(jp.nm_perawatan) NOT LIKE '%mikrobiologi%')
        ORDER BY pl.tgl_periksa DESC, pl.jam ASC
      `;
      const [headerRows] = await db.execute(headerQuery, [noRawat, status, status]);

      const normalizedHeaders = Array.isArray(headerRows) ? headerRows : [];
      if (normalizedHeaders.length === 0) {
        return [];
      }

      const detailQuery = `
        SELECT
          dpl.kd_jenis_prw,
          dpl.tgl_periksa,
          dpl.jam,
        dpl.nilai,
        dpl.nilai_rujukan,
        dpl.keterangan,
        tl.Pemeriksaan AS pemeriksaan,
        tl.satuan,
        dpl.id_template
      FROM detail_periksa_lab dpl
      LEFT JOIN template_laboratorium tl ON dpl.id_template = tl.id_template
      WHERE dpl.no_rawat = ?
      ORDER BY dpl.tgl_periksa DESC, dpl.jam ASC, dpl.kd_jenis_prw ASC, dpl.id_template ASC
    `;
    const [detailRows] = await db.execute(detailQuery, [noRawat]);

    const detailsByKey = new Map();
    (Array.isArray(detailRows) ? detailRows : []).forEach((row) => {
      const key = [
        this.formatDateOnly(row.tgl_periksa),
        String(row.jam || '').trim(),
        String(row.kd_jenis_prw || '').trim()
      ].join('|');

      if (!detailsByKey.has(key)) {
        detailsByKey.set(key, []);
      }

      detailsByKey.get(key).push({
        pemeriksaan: row.pemeriksaan || '',
        hasil: row.nilai || '',
        rujukan: row.nilai_rujukan || '',
        satuan: row.satuan || '',
        keterangan: row.keterangan || ''
      });
    });

    return normalizedHeaders.map((row) => {
      const formattedDate = this.formatDateOnly(row.tgl_periksa);
      const time = String(row.jam || '').trim();
      const kdJenis = String(row.kd_jenis_prw || '').trim();
      const key = [formattedDate, time, kdJenis].join('|');

      return {
        tanggal: `${formattedDate} ${time}`.trim(),
        no_rawat: row.no_rawat || noRawat,
        kd_jenis_prw: kdJenis,
        nm_perawatan: row.nm_perawatan || '',
        dokter: row.nm_dokter || '',
        petugas: row.nama_petugas || '',
        pemeriksaan: detailsByKey.get(key) || [],
        lab_type: 'pk',
        lab_responsible_doctor_name: String(row.nm_dokter_penanggung_jawab || '').trim()
      };
    });
  }

  static async fetchLaboratoryMicro(noRawat, status = null) {
    const headerQuery = `
      SELECT
        pl.no_rawat,
        pl.kd_jenis_prw,
        pl.tgl_periksa,
        pl.jam,
        jp.nm_perawatan,
        dokter.nm_dokter,
        petugas.nama AS nama_petugas,
        COALESCE(d2.nm_dokter, '') AS nm_dokter_penanggung_jawab
      FROM periksa_lab pl
      LEFT JOIN jns_perawatan_lab jp ON pl.kd_jenis_prw = jp.kd_jenis_prw        LEFT JOIN dokter ON pl.dokter_perujuk = dokter.kd_dokter
      LEFT JOIN dokter d2 ON pl.kd_dokter = d2.kd_dokter
      LEFT JOIN petugas ON pl.nip = petugas.nip
      WHERE pl.no_rawat = ?
        AND (? IS NULL OR LOWER(pl.status) = LOWER(?))
        AND LOWER(COALESCE(jp.kategori, '')) = 'pk'
        AND LOWER(COALESCE(jp.nm_perawatan, '')) LIKE '%mikrobiologi%'
      ORDER BY pl.tgl_periksa DESC, pl.jam ASC
    `;
    const [headerRows] = await db.execute(headerQuery, [noRawat, status, status]);

    const normalizedHeaders = Array.isArray(headerRows) ? headerRows : [];
    if (normalizedHeaders.length === 0) {
      return [];
    }

    const detailQuery = `
      SELECT
        dpl.kd_jenis_prw,
        dpl.tgl_periksa,
        dpl.jam,
        dpl.nilai,
        dpl.nilai_rujukan,
        dpl.keterangan,
        tl.Pemeriksaan AS pemeriksaan,
        tl.satuan,
        dpl.id_template
      FROM detail_periksa_lab dpl
      LEFT JOIN template_laboratorium tl ON dpl.id_template = tl.id_template
      WHERE dpl.no_rawat = ?
      ORDER BY dpl.tgl_periksa DESC, dpl.jam ASC, dpl.kd_jenis_prw ASC
    `;
    const [detailRows] = await db.execute(detailQuery, [noRawat]);

    const detailsByKey = new Map();
    (Array.isArray(detailRows) ? detailRows : []).forEach((row) => {
      const key = [
        this.formatDateOnly(row.tgl_periksa),
        String(row.jam || '').trim(),
        String(row.kd_jenis_prw || '').trim()
      ].join('|');

      if (!detailsByKey.has(key)) {
        detailsByKey.set(key, []);
      }

      detailsByKey.get(key).push({
        pemeriksaan: row.pemeriksaan || '',
        hasil: row.nilai || '',
        rujukan: row.nilai_rujukan || '',
        satuan: row.satuan || '',
        keterangan: row.keterangan || ''
      });
    });

    return normalizedHeaders.map((row) => {
      const formattedDate = this.formatDateOnly(row.tgl_periksa);
      const time = String(row.jam || '').trim();
      const kdJenis = String(row.kd_jenis_prw || '').trim();
      const key = [formattedDate, time, kdJenis].join('|');

      return {
        tanggal: `${formattedDate} ${time}`.trim(),
        no_rawat: row.no_rawat || noRawat,
        kd_jenis_prw: kdJenis,
        nm_perawatan: row.nm_perawatan || '',
        dokter: row.nm_dokter || '',
        petugas: row.nama_petugas || '',
        pemeriksaan: detailsByKey.get(key) || [],
        lab_type: 'mikro',
        lab_responsible_doctor_name: String(row.nm_dokter_penanggung_jawab || '').trim()
      };
    });
  }

  static async fetchLaboratoryPa(noRawat) {
    const labPaQuery = `
      SELECT
        pa.no_rawat,
        pa.tgl_periksa,
        pa.jam,
        pa.makroskopik,
        pa.mikroskopik,
        pa.kesimpulan,
        skl.saran
      FROM detail_periksa_lab_pa pa
      LEFT JOIN saran_kesan_lab skl
        ON skl.no_rawat = pa.no_rawat
        AND skl.tgl_periksa = pa.tgl_periksa
        AND skl.jam = pa.jam
      WHERE pa.no_rawat = ?
      ORDER BY pa.tgl_periksa DESC, pa.jam DESC
    `;
    const [rows] = await db.execute(labPaQuery, [noRawat]);

    const grouped = {};
    rows.forEach((row) => {
      const dateKey = this.formatDateOnly(row.tgl_periksa) + ' ' + row.jam;
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }

      const nilaiMakro = String(row.makroskopik || '').trim();
      const nilaiMikro = String(row.mikroskopik || '').trim();
      const nilaiKesimpulan = String(row.kesimpulan || '').trim();
      const nilaiSaran = String(row.saran || '').trim();

      if (nilaiMakro) {
        grouped[dateKey].push({
          nama: 'Lab PA',
          pemeriksaan: 'Makroskopik',
          hasil: nilaiMakro,
          rujukan: '',
          keterangan: ''
        });
      }

      if (nilaiMikro) {
        grouped[dateKey].push({
          nama: 'Lab PA',
          pemeriksaan: 'Mikroskopik',
          hasil: nilaiMikro,
          rujukan: '',
          keterangan: ''
        });
      }

      if (nilaiKesimpulan) {
        grouped[dateKey].push({
          nama: 'Lab PA',
          pemeriksaan: 'Kesimpulan',
          hasil: nilaiKesimpulan,
          rujukan: '',
          keterangan: ''
        });
      }

      if (nilaiSaran) {
        grouped[dateKey].push({
          nama: 'Lab PA',
          pemeriksaan: 'Saran',
          hasil: nilaiSaran,
          rujukan: '',
          keterangan: ''
        });
      }
    });

    return Object.entries(grouped).map(([tanggal, pemeriksaan]) => ({
      tanggal,
      pemeriksaan,
      lab_type: 'pa'
    }));
  }

  static async fetchLaboratoryAll(noRawat, status = null) {
    const [pk, mikro, pa] = await Promise.all([
      this.fetchLaboratory(noRawat, status),
      this.fetchLaboratoryMicro(noRawat, status),
      this.fetchLaboratoryPa(noRawat)
    ]);

    return [...(pk || []), ...(mikro || []), ...(pa || [])];
  }

  // Helper function to fetch radiology results
  static async fetchRadiology(noRawat, status = null, options = {}) {
    const includePacs = options.includePacs === true;
    const radQuery = `
      SELECT
        pr.*,
        jp.nm_perawatan,
        hpr.hasil,
        skr.judul,
        skr.saran,
        skr.kesan
      FROM periksa_radiologi pr 
      LEFT JOIN jns_perawatan_radiologi jp ON pr.kd_jenis_prw = jp.kd_jenis_prw 
      LEFT JOIN hasil_radiologi hpr
        ON pr.no_rawat = hpr.no_rawat
        AND pr.tgl_periksa = hpr.tgl_periksa
        AND pr.jam = hpr.jam
      LEFT JOIN saran_kesan_rad skr
        ON pr.no_rawat = skr.no_rawat
        AND pr.tgl_periksa = skr.tgl_periksa
        AND pr.jam = skr.jam
      WHERE pr.no_rawat = ?
        AND (? IS NULL OR LOWER(pr.status) = LOWER(?))
      ORDER BY pr.tgl_periksa, pr.jam
    `;
    const [[rows], pacsSeries] = await Promise.all([
      db.execute(radQuery, [noRawat, status, status]),
      includePacs ? this.fetchRadiologyPacsSeries(noRawat) : Promise.resolve([])
    ]);

    return rows.map(row => {
      const matchedSeries = this.matchRadiologyPacsSeries(
        pacsSeries,
        row.tgl_periksa,
        row.nm_perawatan
      );
      const pacsPayload = this.buildRadiologyPacsPayload(matchedSeries, {
        limitCtToThumbnail: true
      });

      return {
        no_rawat: row.no_rawat || '',
        tanggal: this.formatDateOnly(row.tgl_periksa) + ' ' + row.jam,
        tgl_periksa: this.formatDateOnly(row.tgl_periksa),
        pemeriksaan: row.nm_perawatan || row.judul || '',
        judul: row.judul || '',
        hasil: row.hasil || '',
        saran: row.saran || '',
        kesan: row.kesan || '',
        ...(includePacs ? pacsPayload : {})
      };
    });
  }

  static async fetchOperationReports(noRawat) {
    const operationQuery = `
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
    const [rows] = await db.execute(operationQuery, [noRawat]);

    return rows.map((row) => ({
      id: row.id,
      no_rawat: row.no_rawat,
      kd_dokter: row.kd_dokter || '',
      tanggal_op: row.tanggal_op || '',
      hasil_op: row.hasil_op || '',
      pre_op: row.pre_op || '',
      post_op: row.post_op || '',
      implan: row.implan || '',
      kirim_pa: row.kirim_pa || '',
      nm_op: row.nm_op || '',
      created_at: row.created_at || '',
      dokter_laporan: row.dokter_laporan || '',
      dokter_operator: row.dokter_operator || '',
      dokter_anestesi: row.dokter_anestesi || ''
    }));
  }

  static async fetchRadiologyRequest(noRawat, status) {
    const radiologyRequestQuery = `
      SELECT
        pr.noorder,
        pr.tgl_permintaan,
        pr.jam_permintaan,
        pr.dokter_perujuk,
        dpk.klinis,
        ppr.kd_jenis_prw,
        jpr.nm_perawatan
      FROM permintaan_radiologi pr
      LEFT JOIN diagnosa_pasien_klinis dpk ON dpk.noorder = pr.noorder
      LEFT JOIN permintaan_pemeriksaan_radiologi ppr ON ppr.noorder = pr.noorder
      LEFT JOIN jns_perawatan_radiologi jpr ON jpr.kd_jenis_prw = ppr.kd_jenis_prw
      WHERE pr.no_rawat = ? AND pr.status = ?
      ORDER BY pr.tgl_permintaan, pr.jam_permintaan, jpr.nm_perawatan
    `;
    const [rows] = await db.execute(radiologyRequestQuery, [noRawat, status]);

    const requestsByOrder = new Map();

    rows.forEach((row) => {
      const requestKey = row.noorder || `${this.formatDateOnly(row.tgl_permintaan)} ${row.jam_permintaan}`;

      if (!requestsByOrder.has(requestKey)) {
        requestsByOrder.set(requestKey, {
          noorder: row.noorder || '',
          tanggal: this.formatDateOnly(row.tgl_permintaan) + ' ' + row.jam_permintaan,
          dokter_perujuk: row.dokter_perujuk || '',
          klinis: row.klinis || '',
          pemeriksaan: []
        });
      }

      const requestEntry = requestsByOrder.get(requestKey);

      if (row.nm_perawatan) {
        const alreadyExists = requestEntry.pemeriksaan.some((item) => item.kode === row.kd_jenis_prw);

        if (!alreadyExists) {
          requestEntry.pemeriksaan.push({
            kode: row.kd_jenis_prw || '',
            nama: row.nm_perawatan
          });
        }
      }
    });

    return Array.from(requestsByOrder.values());
  }

  static parsePositiveInteger(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  static normalizeOptions(options = {}) {
    const focusedMedicationHistoryMode = String(options.focusedMedicationHistoryMode || '').trim().toLowerCase() === 'all'
      ? 'all'
      : 'latest';

    return {
      limit: Math.min(this.parsePositiveInteger(options.limit, this.DEFAULT_LIMIT), 20),
      outpatientPage: this.parsePositiveInteger(options.outpatientPage, 1),
      inpatientPage: this.parsePositiveInteger(options.inpatientPage, 1),
      includeOutpatient: options.includeOutpatient !== false,
      includeInpatient: options.includeInpatient !== false,
      includeVisitDetails: options.includeVisitDetails !== false,
      includeFocusedExaminations: options.includeFocusedExaminations === true,
      includeFocusedProcedures: options.includeFocusedProcedures === true,
      includeFocusedMedications: options.includeFocusedMedications === true,
      includeFocusedLaboratory: options.includeFocusedLaboratory === true,
      includeFocusedRadiology: options.includeFocusedRadiology === true,
      focusedMedicationHistoryMode,
      focusNoRawat: typeof options.focusNoRawat === 'string' && options.focusNoRawat.trim()
        ? options.focusNoRawat.trim()
        : null
    };
  }

  static async fetchVisitsPage(no_rm, statusLanjut, page, limit, focusNoRawat) {
    const offset = (page - 1) * limit;

    const [[countRow]] = await db.execute(
      `
        SELECT COUNT(*) AS total
        FROM reg_periksa
        WHERE no_rkm_medis = ? AND status_lanjut = ?
      `,
      [no_rm, statusLanjut]
    );

    const [rows] = await db.execute(
      `
        SELECT r.*, p.nm_poli, d.nm_dokter
        FROM reg_periksa r
        LEFT JOIN poliklinik p ON r.kd_poli = p.kd_poli
        LEFT JOIN dokter d ON r.kd_dokter = d.kd_dokter
        WHERE r.no_rkm_medis = ? AND r.status_lanjut = ?
        ORDER BY
          CASE
            WHEN ? IS NOT NULL AND ? <> '' AND r.no_rawat = ? THEN 0
            ELSE 1
          END,
          r.tgl_registrasi DESC,
          r.jam_reg DESC
        LIMIT ? OFFSET ?
      `,
      [no_rm, statusLanjut, focusNoRawat, focusNoRawat, focusNoRawat, limit, offset]
    );

    const total = countRow?.total || 0;

    return {
      rows,
      pagination: {
        page,
        limit,
        total,
        hasMore: offset + rows.length < total
      }
    };
  }

  static async fetchInpatientDetailsByNoRawats(noRawats = []) {
    if (!Array.isArray(noRawats) || noRawats.length === 0) {
      return [];
    }

    const inpatientQuery = `
      SELECT
        ki.*,
        b.nm_bangsal,
        CASE
          WHEN LOWER(TRIM(COALESCE(ki.stts_pulang, ''))) <> 'pindah kamar'
          THEN b.nm_bangsal
          ELSE NULL
        END AS display_nm_bangsal
      FROM kamar_inap ki
      LEFT JOIN kamar k ON ki.kd_kamar = k.kd_kamar
      LEFT JOIN bangsal b ON k.kd_bangsal = b.kd_bangsal
      WHERE ki.no_rawat IN (${noRawats.map(() => '?').join(',')})
      ORDER BY
        CASE
          WHEN LOWER(TRIM(COALESCE(ki.stts_pulang, ''))) <> 'pindah kamar' THEN 0
          ELSE 1
        END,
        ki.tgl_masuk DESC,
        ki.jam_masuk DESC
    `;
    const [inpatientRows] = await db.execute(inpatientQuery, noRawats);
    return inpatientRows;
  }

  static buildOutpatientVisitSummary(visit, patientNote = null) {
    const isIgdVisit = this.isIgdVisitByKdPoli(visit.kd_poli);
    return {
      no_rawat: visit.no_rawat,
      tanggal: this.formatDateOnly(visit.tgl_registrasi) + ' ' + visit.jam_reg,
      kd_poli: visit.kd_poli || '',
      poliklinik: visit.nm_poli || '',
      dokter: visit.nm_dokter || '',
      status: visit.stts || '',
      status_lanjut: visit.status_lanjut || 'Ralan',
      is_igd_visit: isIgdVisit,
      patient_note: this.buildPatientNoteSummary(patientNote),
      details_loaded: false
    };
  }

  static buildInpatientVisitSummary(visit, inpatientDetail, patientNote = null) {
    const isIgdVisit = this.isIgdVisitByKdPoli(visit.kd_poli);
    return {
      no_rawat: visit.no_rawat,
      tanggal_masuk: inpatientDetail ? this.formatDateOnly(inpatientDetail.tgl_masuk) + ' ' + inpatientDetail.jam_masuk : '',
      tanggal_keluar: inpatientDetail?.tgl_keluar ? this.formatDateOnly(inpatientDetail.tgl_keluar) + ' ' + inpatientDetail.jam_keluar : '',
      ruangan: inpatientDetail?.nm_bangsal || inpatientDetail?.kd_kamar || '',
      kamar: inpatientDetail?.kd_kamar || '',
      kd_poli: visit.kd_poli || '',
      poliklinik: inpatientDetail?.display_nm_bangsal || visit.nm_poli || '',
      dokter: visit.nm_dokter || '',
      status: visit.stts || '',
      status_lanjut: visit.status_lanjut || 'Ranap',
      is_igd_visit: isIgdVisit,
      cara_keluar: inpatientDetail?.stts_pulang || '',
      diagnosa_akhir: inpatientDetail?.diagnosa_akhir || '',
      patient_note: this.buildPatientNoteSummary(patientNote),
      details_loaded: false
    };
  }

  static async buildOutpatientVisit(visit, patientNote = null) {
    const isIgdVisit = this.isIgdVisitByKdPoli(visit.kd_poli) || String(visit.status_lanjut || '').trim() === 'IGD';
    const [
      examinations,
      procedures,
      medications,
      medicationsRequest,
      laboratory,
      laboratoryRequest,
      radiology,
      radiologyRequest,
      triaseIgd,
      icd10Map,
      icdDetails
    ] = await Promise.all([
      this.fetchExaminations(visit.no_rawat, 'ralan'),
      this.fetchProcedures(visit.no_rawat, 'ralan'),
      this.fetchMedications(visit.no_rawat, 'ralan'),
      this.fetchMedicationsRequest(visit.no_rawat, 'ralan'),
      this.fetchLaboratoryAll(visit.no_rawat),
      this.fetchLaboratoryRequest(visit.no_rawat, 'ralan'),
      this.fetchRadiology(visit.no_rawat),
      this.fetchRadiologyRequest(visit.no_rawat, 'ralan'),
      isIgdVisit ? this.fetchTriageIgd(visit.no_rawat) : Promise.resolve(null),
      this.fetchIcd10DiagnosesMap([visit.no_rawat], 'Ralan'),
      this.fetchIcdDetailsByNoRawat(visit.no_rawat, 'Ralan')
    ]);

    return {
      no_rawat: visit.no_rawat,
      tanggal: this.formatDateOnly(visit.tgl_registrasi) + ' ' + visit.jam_reg,
      kd_poli: visit.kd_poli || '',
      poliklinik: visit.nm_poli || '',
      diagnosa_icd10: String(icd10Map.get(visit.no_rawat) || ''),
      icd_details: icdDetails,
      dokter: visit.nm_dokter || '',
      status: visit.stts || '',
      status_lanjut: visit.status_lanjut || 'Ralan',
      is_igd_visit: isIgdVisit,
      patient_note: this.buildPatientNoteSummary(patientNote),
      examinations,
      procedures,
      medicationsRequest,
      medications,
      laboratoryRequest,
      laboratory,
      radiology,
      radiologyRequest,
      triase_igd: triaseIgd,
      details_loaded: true
    };
  }

  static async buildInpatientVisit(visit, inpatientDetail, patientNote = null) {
    const isIgdVisit = this.isIgdVisitByKdPoli(visit.kd_poli);
    const [
      examinations,
      procedures,
      medications,
      medicationsRequestRanap,
      medicationsRequestPulang,
      medicationsRequestIbs,
      laboratory,
      laboratoryRequest,
      radiology,
      radiologyRequest,
      operationReports,
      icd10Map,
      icdDetails
    ] = await Promise.all([
      this.fetchExaminations(visit.no_rawat, 'ranap'),
      this.fetchProcedures(visit.no_rawat, 'ranap'),
      this.fetchMedications(visit.no_rawat, 'ranap'),
      this.fetchMedicationsRequest(visit.no_rawat, 'ranap'),
      this.fetchMedicationsRequest(visit.no_rawat, 'pulang'),
      this.fetchMedicationsRequest(visit.no_rawat, 'ibs'),
      this.fetchLaboratoryAll(visit.no_rawat),
      this.fetchLaboratoryRequest(visit.no_rawat, 'ranap'),
      this.fetchRadiology(visit.no_rawat),
      this.fetchRadiologyRequest(visit.no_rawat, 'ranap'),
      this.fetchOperationReports(visit.no_rawat),
      this.fetchIcd10DiagnosesMap([visit.no_rawat], 'Ranap'),
      this.fetchIcdDetailsByNoRawat(visit.no_rawat, 'Ranap')
    ]);

    return {
      no_rawat: visit.no_rawat,
      tanggal_masuk: inpatientDetail ? this.formatDateOnly(inpatientDetail.tgl_masuk) + ' ' + inpatientDetail.jam_masuk : '',
      tanggal_keluar: inpatientDetail?.tgl_keluar ? this.formatDateOnly(inpatientDetail.tgl_keluar) + ' ' + inpatientDetail.jam_keluar : '',
      ruangan: inpatientDetail?.nm_bangsal || inpatientDetail?.kd_kamar || '',
      kamar: inpatientDetail?.kd_kamar || '',
      kd_poli: visit.kd_poli || '',
      poliklinik: inpatientDetail?.display_nm_bangsal || visit.nm_poli || '',
      diagnosa_icd10: String(icd10Map.get(visit.no_rawat) || ''),
      icd_details: icdDetails,
      dokter: visit.nm_dokter || '',
      status: visit.stts || '',
      status_lanjut: visit.status_lanjut || 'Ranap',
      is_igd_visit: isIgdVisit,
      cara_keluar: inpatientDetail?.stts_pulang || '',
      diagnosa_akhir: inpatientDetail?.diagnosa_akhir || '',
      patient_note: this.buildPatientNoteSummary(patientNote),
      examinations,
      procedures,
      medicationsRequest: medicationsRequestRanap,
      medicationsRequestRanap,
      medicationsRequestPulang,
      medicationsRequestIbs,
      medications,
      laboratoryRequest,
      laboratory,
      radiology,
      radiologyRequest,
      operationReports,
      details_loaded: true
    };
  }

  static async getVisitDetails(noRawat) {
    const [visitRows] = await db.execute(
      `
        SELECT r.*, p.nm_poli, d.nm_dokter
        FROM reg_periksa r
        LEFT JOIN poliklinik p ON r.kd_poli = p.kd_poli
        LEFT JOIN dokter d ON r.kd_dokter = d.kd_dokter
        WHERE r.no_rawat = ?
        LIMIT 1
      `,
      [noRawat]
    );

    const visit = visitRows[0];
    if (!visit) {
      throw new Error('Visit not found');
    }

    if (String(visit.status_lanjut || '').trim() === 'Ranap') {
      const inpatientDetails = await this.fetchInpatientDetailsByNoRawats([noRawat]);
      const inpatientDetail = inpatientDetails.find((detail) => detail.no_rawat === noRawat);
        const patientNoteMap = await this.fetchPatientNotesSummaryMap([noRawat]);
        return this.buildInpatientVisit(visit, inpatientDetail, patientNoteMap.get(noRawat) || null);
    }

      const patientNoteMap = await this.fetchPatientNotesSummaryMap([noRawat]);
      return this.buildOutpatientVisit(visit, patientNoteMap.get(noRawat) || null);
  }

  static async fetchExaminationsPage(no_rm, statusLanjut, page, limit, focusNoRawat) {
    const table = statusLanjut === 'Ranap' ? 'pemeriksaan_ranap' : 'pemeriksaan_ralan';
    const type = statusLanjut === 'Ranap' ? 'ranap' : 'ralan';
    const offset = (page - 1) * limit;
    const focusFilter = focusNoRawat ? ' AND r.no_rawat = ? ' : '';
    const params = focusNoRawat ? [no_rm, statusLanjut, focusNoRawat] : [no_rm, statusLanjut];

    const [[countRow]] = await db.execute(
      `
        SELECT COUNT(*) AS total
        FROM ${table} p1
        INNER JOIN reg_periksa r ON r.no_rawat = p1.no_rawat
        WHERE r.no_rkm_medis = ? AND r.status_lanjut = ? ${focusFilter}
      `,
      params
    );

    const [rows] = await db.execute(
      `
        SELECT
          p1.*,
          p2.nama,
          CASE
            WHEN LOWER(COALESCE(TRIM(mu.role), '')) = 'paramedis'
              AND LOWER(COALESCE(TRIM(p3.bidang), '')) = 'irsyad' THEN 'terapis'
            WHEN COALESCE(TRIM(mu.role), '') <> '' THEN TRIM(mu.role)
            WHEN LOWER(COALESCE(p2.nama, '')) LIKE '%dr.%' THEN 'medis'
            ELSE ''
          END AS role,
          r.no_rawat,
          r.status_lanjut
        FROM ${table} p1
        INNER JOIN reg_periksa r ON r.no_rawat = p1.no_rawat
        LEFT JOIN pegawai p2 ON p2.nik = p1.nip
        LEFT JOIN mlite_users mu ON TRIM(mu.username) = TRIM(p1.nip)
        LEFT JOIN pegawai p3 ON TRIM(p3.nik) = TRIM(mu.username)
        WHERE r.no_rkm_medis = ? AND r.status_lanjut = ? ${focusFilter}
        ORDER BY p1.tgl_perawatan DESC, p1.jam_rawat DESC
        LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    return {
      rows: rows.map((exam, examIndex) => {
        const examDate = String(exam.tgl_perawatan || exam.tanggal || '').trim();
        const examTime = String(exam.jam_rawat || '00:00').trim() || '00:00';
        const parsedDate = examDate
          ? new Date(`${examDate}T${examTime.length === 5 ? `${examTime}:00` : examTime}`).getTime()
          : 0;

        return {
          key: `${type}-${exam.no_rawat}-${examDate}-${examTime}-${examIndex}`,
          visit: { no_rawat: exam.no_rawat, status_lanjut: statusLanjut },
          exam,
          rawatType: statusLanjut,
          timestamp: Number.isNaN(parsedDate) ? 0 : parsedDate
        };
      }),
      pagination: {
        page,
        limit,
        total: countRow?.total || 0,
        hasMore: offset + rows.length < (countRow?.total || 0)
      }
    };
  }

  static async getExaminationHistory(no_rm, options = {}) {
    const { limit, outpatientPage, inpatientPage, includeOutpatient, includeInpatient, focusNoRawat } = this.normalizeOptions(options);
    const [outpatientResult, inpatientResult] = await Promise.all([
      includeOutpatient
        ? this.fetchExaminationsPage(no_rm, 'Ralan', outpatientPage, limit, focusNoRawat)
        : Promise.resolve(null),
      includeInpatient
        ? this.fetchExaminationsPage(no_rm, 'Ranap', inpatientPage, limit, focusNoRawat)
        : Promise.resolve(null)
    ]);

    return {
      data: {
        outpatient: outpatientResult?.rows || [],
        inpatient: inpatientResult?.rows || []
      },
      pagination: {
        ...(outpatientResult?.pagination ? { outpatient: outpatientResult.pagination } : {}),
        ...(inpatientResult?.pagination ? { inpatient: inpatientResult.pagination } : {})
      }
    };
  }

  static async getMedicalRecord(no_rm, options = {}) {
    try {
      console.log('Fetching medical record for no_rm:', no_rm);

      if (!no_rm) {
        throw new Error('no_rm parameter is required');
      }

      const {
        limit,
        outpatientPage,
        inpatientPage,
        includeOutpatient,
        includeInpatient,
        includeVisitDetails,
        includeFocusedExaminations,
        includeFocusedProcedures,
        includeFocusedMedications,
        includeFocusedLaboratory,
        includeFocusedRadiology,
        focusedMedicationHistoryMode,
        focusNoRawat
      } = this.normalizeOptions(options);

      const [
        patientRows,
        patientAllergyRows,
        patientPrbRows,
        patientPrbProgramRows,
        latestVisitRows,
        readmisiRows,
        focusedVisitPaymentRows,
        focusedVisitDpjpRows,
        outpatientPageResult,
        inpatientPageResult,
        focusedRalanExaminations,
        focusedRanapExaminations,
        focusedEkstrapiramidal,
        focusedRalanProcedures,
        focusedRanapProcedures,
        focusedRalanMedicationRequests,
        focusedRanapMedicationRequests,
        focusedPulangMedicationRequests,
        focusedIbsMedicationRequests,
        focusedRalanMedications,
        focusedRanapMedications,
        focusedRalanLaboratoryRequests,
        focusedRanapLaboratoryRequests,
        focusedRalanLaboratory,
        focusedRanapLaboratory,
        focusedRalanRadiologyRequests,
        focusedRanapRadiologyRequests,
        focusedRalanRadiology,
        focusedRanapRadiology,
        focusedOperationReports
      ] = await Promise.all([
        db.execute(
          "SELECT * FROM pasien WHERE no_rkm_medis = ?",
          [no_rm]
        ),
        db.execute(
          `
            SELECT GROUP_CONCAT(
              DISTINCT TRIM(
                CASE
                  WHEN ma.kategori = 'Obat' THEN COALESCE(db.nama_brng, '')
                  ELSE COALESCE(masterAlergi.nama, '')
                END
              )
              ORDER BY
                CASE
                  WHEN ma.kategori = 'Obat' THEN COALESCE(db.nama_brng, '')
                  ELSE COALESCE(masterAlergi.nama, '')
                END ASC
              SEPARATOR ', '
            ) AS alergi
            FROM mlite_alergi ma
            LEFT JOIN databarang db
              ON ma.kategori = 'Obat'
              AND ma.kode_brng = db.kode_brng
            LEFT JOIN master_alergi masterAlergi
              ON ma.kategori <> 'Obat'
              AND ma.kode_brng = masterAlergi.id
            WHERE ma.no_rkm_medis = ?
              AND COALESCE(ma.status, '1') = '1'
          `,
          [no_rm]
        ),
        focusNoRawat
          ? db.execute(
              `
                SELECT bp.prb
                FROM bpjs_prb bp
                INNER JOIN bridging_sep bs ON bs.no_sep = bp.no_sep
                WHERE bs.no_rawat = ?
                LIMIT 1
              `,
              [focusNoRawat]
            )
          : Promise.resolve([[]]),
        db.execute(
          `
            SELECT pp.nm_program
            FROM pasien p
            LEFT JOIN peserta_prb pp ON pp.no_peserta = p.no_peserta
            WHERE p.no_rkm_medis = ?
            LIMIT 1
          `,
          [no_rm]
        ),
        db.execute(
          `
            SELECT status_lanjut
            FROM reg_periksa
            WHERE no_rkm_medis = ?
            ORDER BY tgl_registrasi DESC, jam_reg DESC
            LIMIT 1
          `,
          [no_rm]
        ),
        focusNoRawat
          ? db.execute(
              `
                SELECT no_rawat
                FROM bridging_sep
                WHERE tglsep BETWEEN CURDATE() - INTERVAL 30 DAY AND CURDATE()
                  AND nomr = ?
                  AND no_rawat <> ?
                  AND jnspelayanan = '1'
                ORDER BY tglsep DESC
              `,
              [no_rm, focusNoRawat]
            )
          : Promise.resolve([[]]),
        focusNoRawat
          ? db.execute(
              `
                SELECT COALESCE(pj.png_jawab, '') AS cara_bayar
                FROM reg_periksa rp
                LEFT JOIN penjab pj ON pj.kd_pj = rp.kd_pj
                WHERE rp.no_rawat = ?
                LIMIT 1
              `,
              [focusNoRawat]
            )
          : Promise.resolve([[]]),
        focusNoRawat
          ? db.execute(
              `
                SELECT GROUP_CONCAT(
                  DISTINCT CONCAT(COALESCE(d.nm_dokter, ''), ' (', COALESCE(dr.jenis_dpjp, 'Tidak Diketahui'), ')')
                  SEPARATOR ', '
                ) AS dokter_dpjp
                FROM dpjp_ranap dr
                LEFT JOIN dokter d ON d.kd_dokter = dr.kd_dokter
                WHERE dr.no_rawat = ?
              `,
              [focusNoRawat]
            )
          : Promise.resolve([[]]),
        includeOutpatient
          ? this.fetchVisitsPage(no_rm, 'Ralan', outpatientPage, limit, focusNoRawat)
          : Promise.resolve(null),
        includeInpatient
          ? this.fetchVisitsPage(no_rm, 'Ranap', inpatientPage, limit, focusNoRawat)
          : Promise.resolve(null),
        focusNoRawat && includeFocusedExaminations ? this.fetchExaminations(focusNoRawat, 'ralan') : Promise.resolve([]),
        focusNoRawat && includeFocusedExaminations ? this.fetchExaminations(focusNoRawat, 'ranap') : Promise.resolve([]),
        focusNoRawat && includeFocusedExaminations ? this.fetchEkstrapiramidal(focusNoRawat) : Promise.resolve(null),
        focusNoRawat && includeFocusedProcedures ? this.fetchProcedures(focusNoRawat, 'ralan') : Promise.resolve([]),
        focusNoRawat && includeFocusedProcedures ? this.fetchProcedures(focusNoRawat, 'ranap') : Promise.resolve([]),
        focusNoRawat && includeFocusedMedications ? this.fetchMedicationRequestsByNoRm(no_rm, 'ralan', { historyMode: focusedMedicationHistoryMode }) : Promise.resolve({ items: [], hasMore: false }),
        focusNoRawat && includeFocusedMedications ? this.fetchMedicationRequestsByNoRm(no_rm, 'ranap', { historyMode: focusedMedicationHistoryMode }) : Promise.resolve({ items: [], hasMore: false }),
        focusNoRawat && includeFocusedMedications ? this.fetchMedicationRequestsByNoRm(no_rm, 'pulang', { historyMode: focusedMedicationHistoryMode }) : Promise.resolve({ items: [], hasMore: false }),
        focusNoRawat && includeFocusedMedications ? this.fetchMedicationRequestsByNoRm(no_rm, 'ibs', { historyMode: focusedMedicationHistoryMode }) : Promise.resolve({ items: [], hasMore: false }),
        focusNoRawat && includeFocusedMedications ? this.fetchMedications(focusNoRawat, 'ralan') : Promise.resolve([]),
        focusNoRawat && includeFocusedMedications ? this.fetchMedications(focusNoRawat, 'ranap') : Promise.resolve([]),
        focusNoRawat && includeFocusedLaboratory ? this.fetchLaboratoryRequest(focusNoRawat, 'ralan') : Promise.resolve([]),
        focusNoRawat && includeFocusedLaboratory ? this.fetchLaboratoryRequest(focusNoRawat, 'ranap') : Promise.resolve([]),
        focusNoRawat && includeFocusedLaboratory ? this.fetchLaboratoryAll(focusNoRawat, 'Ralan') : Promise.resolve([]),
        focusNoRawat && includeFocusedLaboratory ? this.fetchLaboratoryAll(focusNoRawat, 'Ranap') : Promise.resolve([]),
        focusNoRawat && includeFocusedRadiology ? this.fetchRadiologyRequest(focusNoRawat, 'ralan') : Promise.resolve([]),
        focusNoRawat && includeFocusedRadiology ? this.fetchRadiologyRequest(focusNoRawat, 'ranap') : Promise.resolve([]),
        focusNoRawat && includeFocusedRadiology ? this.fetchRadiology(focusNoRawat, 'Ralan') : Promise.resolve([]),
        focusNoRawat && includeFocusedRadiology ? this.fetchRadiology(focusNoRawat, 'Ranap') : Promise.resolve([]),
        focusNoRawat ? this.fetchOperationReports(focusNoRawat) : Promise.resolve([])
      ]);

      const patientList = patientRows[0];
      const patientAllergies = patientAllergyRows[0];
      const patientPrb = patientPrbRows[0];
      const patientPrbProgram = patientPrbProgramRows[0];
      const latestVisits = latestVisitRows[0];
      const readmisiList = Array.isArray(readmisiRows?.[0]) ? readmisiRows[0] : [];
      const readmisiNoRawats = readmisiList
        .map((row) => String(row?.no_rawat || '').trim())
        .filter(Boolean);
      const focusedVisitCaraBayar = String(focusedVisitPaymentRows?.[0]?.[0]?.cara_bayar || '').trim();
      const focusedVisitDokterDpjp = String(focusedVisitDpjpRows?.[0]?.[0]?.dokter_dpjp || '').trim();

      if (patientList.length === 0) {
        throw new Error('Patient not found');
      }

      const patient = patientList[0];
      const allergySummary = String(patientAllergies?.[0]?.alergi || '').trim();
      const prbLabel = String(patientPrb?.[0]?.prb || '').trim();
      const prbProgram = String(patientPrbProgram?.[0]?.nm_program || '').trim();
      const outpatientVisits = outpatientPageResult?.rows || [];
      const inpatientVisitRefs = inpatientPageResult?.rows || [];
      const [outpatientIcd10Map, inpatientIcd10Map, patientNotesSummaryMap] = await Promise.all([
        outpatientVisits.length ? this.fetchIcd10DiagnosesMap(outpatientVisits.map((visit) => visit.no_rawat), 'Ralan') : Promise.resolve(new Map()),
        inpatientVisitRefs.length ? this.fetchIcd10DiagnosesMap(inpatientVisitRefs.map((visit) => visit.no_rawat), 'Ranap') : Promise.resolve(new Map()),
        this.fetchPatientNotesSummaryMap([
          ...outpatientVisits.map((visit) => visit.no_rawat),
          ...inpatientVisitRefs.map((visit) => visit.no_rawat)
        ])
      ]);

      let inpatientDetails = [];
      if (inpatientVisitRefs.length > 0) {
        const inpatientNoRawats = inpatientVisitRefs.map(row => row.no_rawat);
        const inpatientQuery = `
          SELECT
            ki.*,
            b.nm_bangsal,
            CASE
              WHEN LOWER(TRIM(COALESCE(ki.stts_pulang, ''))) <> 'pindah kamar'
              THEN b.nm_bangsal
              ELSE NULL
            END AS display_nm_bangsal
          FROM kamar_inap ki 
          LEFT JOIN kamar k ON ki.kd_kamar = k.kd_kamar
          LEFT JOIN bangsal b ON k.kd_bangsal = b.kd_bangsal
          WHERE ki.no_rawat IN (${inpatientNoRawats.map(() => '?').join(',')})
          ORDER BY
            CASE
              WHEN LOWER(TRIM(COALESCE(ki.stts_pulang, ''))) <> 'pindah kamar' THEN 0
              ELSE 1
            END,
            ki.tgl_masuk DESC,
            ki.jam_masuk DESC
        `;
        const [inpatientRows] = await db.execute(inpatientQuery, inpatientNoRawats);
        inpatientDetails = inpatientRows;
      }

      const inpatientDetailsMap = new Map(
        inpatientDetails.map(detail => [detail.no_rawat, detail])
      );

      const focusedVisitStatusLanjut = String(
        outpatientVisits.find((visit) => String(visit?.no_rawat || '').trim() === String(focusNoRawat || '').trim())?.status_lanjut
        || inpatientVisitRefs.find((visit) => String(visit?.no_rawat || '').trim() === String(focusNoRawat || '').trim())?.status_lanjut
        || ''
      ).trim();

      const [finalOutpatientVisits, finalInpatientVisits] = await Promise.all([
        includeVisitDetails
            ? Promise.all(outpatientVisits.map((visit) => this.buildOutpatientVisit(
                visit,
                patientNotesSummaryMap.get(String(visit.no_rawat || '').trim()) || null
              )))
          : Promise.resolve(
              outpatientVisits.map((visit) => ({
                  ...this.buildOutpatientVisitSummary(
                    visit,
                    patientNotesSummaryMap.get(String(visit.no_rawat || '').trim()) || null
                  ),
                diagnosa_icd10: String(outpatientIcd10Map.get(visit.no_rawat) || '')
              }))
            ),
        includeVisitDetails
          ? Promise.all(
              inpatientVisitRefs.map((visit) =>
                  this.buildInpatientVisit(
                    visit,
                    inpatientDetailsMap.get(visit.no_rawat),
                    patientNotesSummaryMap.get(String(visit.no_rawat || '').trim()) || null
                  )
              )
            )
          : Promise.resolve(
              inpatientVisitRefs.map((visit) =>
                ({
                    ...this.buildInpatientVisitSummary(
                      visit,
                      inpatientDetailsMap.get(visit.no_rawat),
                      patientNotesSummaryMap.get(String(visit.no_rawat || '').trim()) || null
                    ),
                  diagnosa_icd10: String(inpatientIcd10Map.get(visit.no_rawat) || '')
                })
              )
            )
      ]);

      const medicalRecordData = {
        patient: {
          nama: patient.nm_pasien || '',
          no_rm: patient.no_rkm_medis || '',
          tanggal_lahir: this.formatDateOnly(patient.tgl_lahir),
          jenis_kelamin: patient.jk === 'L' ? 'Laki-laki' : 'Perempuan',
          alamat: patient.alamat || '',
          telepon: patient.no_tlp || '',
          golongan_darah: patient.gol_darah || '',
          alergi: allergySummary,
          prb: prbLabel,
          prb_program: prbProgram,
          status_lanjut: focusedVisitStatusLanjut || latestVisits[0]?.status_lanjut || 'Ralan'
        },
        readmisi: readmisiNoRawats.length > 0,
        readmisi_no_rawats: readmisiNoRawats,
        visit_meta: {
          cara_bayar: focusedVisitCaraBayar,
          dokter_dpjp: focusedVisitDokterDpjp
        },
        outpatient_visits: finalOutpatientVisits,
        inpatient_visits: finalInpatientVisits,
        ...(includeFocusedExaminations ? {
          focused_examinations: {
            ralan: focusedRalanExaminations,
            ranap: focusedRanapExaminations
          },
          focused_ekstrapiramidal: focusedEkstrapiramidal
        } : {}),
        ...(includeFocusedProcedures ? {
          focused_procedures: {
            ralan: focusedRalanProcedures,
            ranap: focusedRanapProcedures
          }
        } : {}),
        ...(includeFocusedMedications ? {
            focused_medications_request: {
              ralan: focusedRalanMedicationRequests.items,
            ranap: focusedRanapMedicationRequests.items,
              pulang: focusedPulangMedicationRequests.items,
              ibs: focusedIbsMedicationRequests.items
          },
            focused_medications_request_meta: {
              ralan_has_more: focusedRalanMedicationRequests.hasMore,
              ralan_racikan_has_more: focusedRalanMedicationRequests.compoundHasMore,
              ralan_umum_has_more: focusedRalanMedicationRequests.nonCompoundHasMore,
              ralan_racikan_total: focusedRalanMedicationRequests.compoundTotal,
              ralan_umum_total: focusedRalanMedicationRequests.nonCompoundTotal,
              ranap_has_more: focusedRanapMedicationRequests.hasMore,
              ranap_racikan_has_more: focusedRanapMedicationRequests.compoundHasMore,
              ranap_umum_has_more: focusedRanapMedicationRequests.nonCompoundHasMore,
              ranap_racikan_total: focusedRanapMedicationRequests.compoundTotal,
              ranap_umum_total: focusedRanapMedicationRequests.nonCompoundTotal,
              pulang_has_more: focusedPulangMedicationRequests.hasMore,
              ibs_has_more: focusedIbsMedicationRequests.hasMore
            },
          focused_medications: {
            ralan: focusedRalanMedications,
            ranap: focusedRanapMedications
          }
        } : {}),
        ...(includeFocusedLaboratory ? {
          focused_laboratory_request: {
            ralan: focusedRalanLaboratoryRequests,
            ranap: focusedRanapLaboratoryRequests
          },
          focused_laboratory: {
            ralan: focusedRalanLaboratory,
            ranap: focusedRanapLaboratory
          }
        } : {}),
        ...(includeFocusedRadiology ? {
          focused_radiology_request: {
            ralan: focusedRalanRadiologyRequests,
            ranap: focusedRanapRadiologyRequests
          },
          focused_radiology: {
            ralan: focusedRalanRadiology,
            ranap: focusedRanapRadiology
          }
        } : {}),
        focused_operation_reports: focusedOperationReports
      };

      return {
        data: medicalRecordData,
        pagination: {
          ...(outpatientPageResult?.pagination ? { outpatient: outpatientPageResult.pagination } : {}),
          ...(inpatientPageResult?.pagination ? { inpatient: inpatientPageResult.pagination } : {})
        }
      };

    } catch (error) {
      console.error('Error in get medical record service:', error);
      throw error;
    }
  }
}

export default GetMedicalRecordService;
