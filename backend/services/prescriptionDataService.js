import { executeQuery, getConnection } from '../config/database.js';

class PrescriptionDataService {
  getEnvValue(key) {
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

  parseMedicineQty(value) {
    const parsed = Number(String(value ?? '').replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 0;
    }
    return parsed;
  }

  normalizeText(value) {
    return String(value ?? '').trim();
  }

  normalizeBooleanFlag(value) {
    if (typeof value === 'boolean') {
      return value;
    }

    const normalizedValue = String(value ?? '').trim().toLowerCase();
    return ['1', 'true', 'ya', 'yes', 'on'].includes(normalizedValue);
  }

  roundToThree(value) {
    return Math.round((Number(value) || 0) * 1000) / 1000;
  }

  async generatePrescriptionNumber(connection, normalizedPrescriptionDate, mode = 'regular') {
    const datePrefix = normalizedPrescriptionDate.replace(/-/g, '');
    const normalizedMode = String(mode || '').trim().toLowerCase();
    const prefix = normalizedMode === 'pulang' ? `4${datePrefix}` : datePrefix;
    const tableName = normalizedMode === 'pulang' ? 'resep_dokter_pulang' : 'resep_obat';
    const [sequenceRows] = await connection.execute(
      `
        SELECT MAX(no_resep) AS last_no_resep
        FROM ${tableName}
        WHERE no_resep LIKE ?
      `,
      [`${prefix}%`]
    );
    const lastNoResep = sequenceRows[0]?.last_no_resep || '';
    const lastSequence = Number(String(lastNoResep).slice(prefix.length)) || 0;
    const nextSequence = String(lastSequence + 1).padStart(5, '0');
    return `${prefix}${nextSequence}`;
  }

  async findReusablePrescription(
    connection,
    no_rawat,
    kd_dokter,
    normalizedPrescriptionDate,
    mode = 'regular'
  ) {
    const normalizedMode = String(mode || '').trim().toLowerCase();
    const query = normalizedMode === 'pulang'
      ? `
          SELECT
            rdp.no_resep,
            IF(rdp.jam_peresepan = rdp.jam_perawatan, 'Belum Terlayani', 'Sudah Terlayani') AS status_layanan
          FROM resep_dokter_pulang rdp
          INNER JOIN resep_pulang rp ON rp.no_resep = rdp.no_resep
          WHERE rp.no_rawat = ?
            AND rdp.kd_dokter = ?
            AND rdp.tgl_peresepan = ?
          GROUP BY rdp.no_resep, rdp.jam_peresepan, rdp.jam_perawatan
          ORDER BY rdp.tgl_peresepan DESC, rdp.jam_peresepan DESC
          LIMIT 1
        `
      : `
          SELECT
            no_resep,
            IF(jam_peresepan = jam, 'Belum Terlayani', 'Sudah Terlayani') AS status_layanan
          FROM resep_obat
          WHERE no_rawat = ?
            AND kd_dokter = ?
            AND tgl_peresepan = ?
          ORDER BY tgl_peresepan DESC, jam_peresepan DESC
          LIMIT 1
        `;
    const [rows] = await connection.execute(query, [no_rawat, kd_dokter, normalizedPrescriptionDate]);

    const row = rows[0];
    if (!row) {
      return null;
    }

    if (String(row.status_layanan || '').trim() !== 'Belum Terlayani') {
      return null;
    }

    return String(row.no_resep || '').trim() || null;
  }

  async getNextCompoundNumber(connection, no_resep) {
    const [rows] = await connection.execute(
      `
        SELECT COALESCE(MAX(no_racik), 0) AS max_no_racik
        FROM resep_dokter_racikan
        WHERE no_resep = ?
      `,
      [no_resep]
    );

    return (Number(rows?.[0]?.max_no_racik) || 0) + 1;
  }

  async getPrescriptionServiceStatus(connection, no_resep) {
    const normalizedNoResep = String(no_resep || '').trim();

    if (!normalizedNoResep) {
      return null;
    }

    const [regularRows] = await connection.execute(
      `
        SELECT
          IF(jam_peresepan = jam, 'Belum Terlayani', 'Sudah Terlayani') AS status_layanan
        FROM resep_obat
        WHERE no_resep = ?
        LIMIT 1
      `,
      [normalizedNoResep]
    );

    if (regularRows?.[0]?.status_layanan) {
      return String(regularRows[0].status_layanan).trim();
    }

    const [pulangRows] = await connection.execute(
      `
        SELECT
          IF(jam_peresepan = jam_perawatan, 'Belum Terlayani', 'Sudah Terlayani') AS status_layanan
        FROM resep_dokter_pulang
        WHERE no_resep = ?
        LIMIT 1
      `,
      [normalizedNoResep]
    );

    if (pulangRows?.[0]?.status_layanan) {
      return String(pulangRows[0].status_layanan).trim();
    }

    return null;
  }

  normalizeCompoundDose(rawValue, kapasitas) {
    const normalizedRaw = String(rawValue ?? '')
      .toLowerCase()
      .replace(/tab/g, '')
      .replace(/mg/g, '')
      .replace(/\s+/g, '')
      .replace(/,/g, '.')
      .trim();

    if (!normalizedRaw) {
      return 0;
    }

    const fractionMatch = normalizedRaw.match(/^(\d+)\/(\d+)$/);
    if (fractionMatch) {
      const numerator = Number(fractionMatch[1]);
      const denominator = Number(fractionMatch[2]);
      if (numerator > 0 && denominator > 0 && kapasitas > 0) {
        return this.roundToThree((kapasitas * numerator) / denominator);
      }
    }

    const parsed = Number(normalizedRaw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 0;
    }

    return this.roundToThree(parsed);
  }

  async normalizeMedicines(medicines) {
    return (Array.isArray(medicines) ? medicines : [])
      .map((medicine) => ({
        kode_brng: this.normalizeText(medicine?.kode_brng),
        jml: this.normalizeText(medicine?.jml),
        aturan_pakai: this.normalizeText(medicine?.aturan_pakai)
      }))
      .filter((medicine) => medicine.kode_brng && this.parseMedicineQty(medicine.jml) > 0);
  }

  async normalizeCompounds(connection, compounds) {
    const normalizedCompounds = (Array.isArray(compounds) ? compounds : [])
      .map((compound) => ({
        nama_racik: this.normalizeText(compound?.nama_racik),
        kd_racik: this.normalizeText(compound?.kd_racik),
        jml_dr: this.normalizeText(compound?.jml_dr ?? compound?.jumlah),
        aturan_pakai: this.normalizeText(compound?.aturan_pakai),
        keterangan: this.normalizeText(compound?.keterangan),
        details: (Array.isArray(compound?.details) ? compound.details : [])
          .map((detail) => ({
            kode_brng: this.normalizeText(detail?.kode_brng),
            kandungan_input: this.normalizeText(detail?.kandungan ?? detail?.jumlah)
          }))
          .filter((detail) => detail.kode_brng && detail.kandungan_input)
      }))
      .filter((compound) => compound.nama_racik && this.parseMedicineQty(compound.jml_dr) > 0 && compound.details.length > 0);

    if (!normalizedCompounds.length) {
      return [];
    }

    const uniqueCodes = Array.from(
      new Set(
        normalizedCompounds.flatMap((compound) => compound.details.map((detail) => detail.kode_brng))
      )
    );

    const placeholders = uniqueCodes.map(() => '?').join(', ');
    const [rows] = await connection.execute(
      `
        SELECT kode_brng, kapasitas
        FROM databarang
        WHERE kode_brng IN (${placeholders})
      `,
      uniqueCodes
    );

    const capacityByCode = new Map(
      rows.map((row) => [String(row.kode_brng || '').trim(), Number(row.kapasitas) || 0])
    );

    return normalizedCompounds.map((compound) => {
      const racikanQty = this.parseMedicineQty(compound.jml_dr);
      const details = compound.details.map((detail) => {
        const kapasitas = capacityByCode.get(detail.kode_brng) || 0;
        const kandungan = this.normalizeCompoundDose(detail.kandungan_input, kapasitas);
        if (kandungan <= 0) {
          throw new Error(`Kandungan racikan untuk obat ${detail.kode_brng} tidak valid`);
        }

        if (kapasitas <= 0) {
          throw new Error(`Kapasitas obat ${detail.kode_brng} tidak ditemukan`);
        }

        return {
          kode_brng: detail.kode_brng,
          kandungan,
          jml: this.roundToThree((racikanQty * kandungan) / kapasitas)
        };
      }).filter((detail) => detail.jml > 0);

      if (!details.length) {
        throw new Error(`Komposisi racikan ${compound.nama_racik} tidak valid`);
      }

      return {
        ...compound,
        jml_dr: String(racikanQty),
        details
      };
    });
  }

  async resolveStockBangsalCode(connection, no_rawat, resolvedPrescriptionStatus) {
    const normalizedStatus = String(resolvedPrescriptionStatus || '').trim().toLowerCase();

    if (normalizedStatus === 'ibs') {
      const value = this.getEnvValue('STOK_RESEP_IBS');
      if (!value) {
        throw new Error('Konfigurasi STOK_RESEP_IBS belum diisi');
      }
      return value;
    }

    if (normalizedStatus === 'pulang') {
      const value = this.getEnvValue('STOK_RESEP_RANAP');
      if (!value) {
        throw new Error('Konfigurasi STOK_RESEP_RANAP belum diisi');
      }
      return value;
    }

    if (normalizedStatus === 'ranap') {
      const value = this.getEnvValue('STOK_RESEP_RANAP');
      if (!value) {
        throw new Error('Konfigurasi STOK_RESEP_RANAP belum diisi');
      }
      return value;
    }

    const [rows] = await connection.execute(
      `
        SELECT kd_poli
        FROM reg_periksa
        WHERE no_rawat = ?
        LIMIT 1
      `,
      [no_rawat]
    );

    const kdPoli = String(rows?.[0]?.kd_poli || '').trim();

    if (['B0054', 'IGDK', 'IGD01'].includes(kdPoli)) {
      const value = this.getEnvValue('STOK_RESEP_IGD');
      if (!value) {
        throw new Error('Konfigurasi STOK_RESEP_IGD belum diisi');
      }
      return value;
    }

    const value = this.getEnvValue('STOK_RESEP_RAJAL');
    if (!value) {
      throw new Error('Konfigurasi STOK_RESEP_RAJAL belum diisi');
    }
    return value;
  }

  async resolvePulangStorageBangsalCode(connection, no_rawat, kd_dokter) {
    const [rows] = await connection.execute(
      `
        SELECT bangsal.kd_bangsal
        FROM kamar_inap
        INNER JOIN reg_periksa ON reg_periksa.no_rawat = kamar_inap.no_rawat
        INNER JOIN kamar ON kamar.kd_kamar = kamar_inap.kd_kamar
        INNER JOIN bangsal ON bangsal.kd_bangsal = kamar.kd_bangsal
        INNER JOIN dpjp_ranap ON dpjp_ranap.no_rawat = reg_periksa.no_rawat
        WHERE reg_periksa.no_rawat = ?
          AND dpjp_ranap.kd_dokter = ?
        LIMIT 1
      `,
      [no_rawat, kd_dokter]
    );

    const kdBangsal = String(rows?.[0]?.kd_bangsal || '').trim();
    if (kdBangsal) {
      return kdBangsal;
    }

    const fallback = this.getEnvValue('STOK_RESEP_RANAP');
    if (!fallback) {
      throw new Error('Kode bangsal resep pulang tidak ditemukan');
    }

    return fallback;
  }

  async validateMedicineStock(connection, kdBangsal, medicines) {
    if (!kdBangsal) {
      throw new Error('Kode bangsal stok resep tidak ditemukan');
    }

    const [bangsalRows] = await connection.execute(
      `
        SELECT COALESCE(nm_bangsal, '') AS nm_bangsal
        FROM bangsal
        WHERE kd_bangsal = ?
        LIMIT 1
      `,
      [kdBangsal]
    );
    const namaBangsal = String(bangsalRows?.[0]?.nm_bangsal || '').trim() || kdBangsal;

    const requestedByCode = new Map();
    for (const item of Array.isArray(medicines) ? medicines : []) {
      const code = String(item?.kode_brng || '').trim();
      if (!code) {
        continue;
      }
      const qty = this.parseMedicineQty(item?.jml);
      if (!qty) {
        continue;
      }
      requestedByCode.set(code, (requestedByCode.get(code) || 0) + qty);
    }

    const codes = Array.from(requestedByCode.keys());
    if (!codes.length) {
      return;
    }

    const placeholders = codes.map(() => '?').join(', ');
    const [rows] = await connection.execute(
      `
        SELECT
          gb.kode_brng,
          COALESCE(db.nama_brng, '') AS nama_brng,
          COALESCE(b.nm_bangsal, '') AS nm_bangsal,
          SUM(COALESCE(gb.stok, 0)) AS stok
        FROM gudangbarang gb
        LEFT JOIN databarang db ON db.kode_brng = gb.kode_brng
        LEFT JOIN bangsal b ON b.kd_bangsal = gb.kd_bangsal
        WHERE gb.kd_bangsal = ?
          AND gb.kode_brng IN (${placeholders})
        GROUP BY gb.kode_brng, db.nama_brng, b.nm_bangsal
      `,
      [kdBangsal, ...codes]
    );

    const stockByCode = new Map();
    for (const row of rows) {
      const code = String(row?.kode_brng || '').trim();
      const stok = Number(row?.stok) || 0;
      stockByCode.set(code, stok);
    }

    const shortages = [];
    for (const code of codes) {
      const requested = requestedByCode.get(code) || 0;
      const available = stockByCode.get(code) || 0;
      if (requested > available) {
        const name = String(rows.find((r) => String(r?.kode_brng || '').trim() === code)?.nama_brng || '').trim();
        shortages.push(`${code}${name ? ` (${name})` : ''} butuh ${requested}, stok ${available}`);
      }
    }

    if (shortages.length) {
      const resolvedBangsalName = String(rows?.[0]?.nm_bangsal || '').trim() || namaBangsal;
      throw new Error(`Stok tidak mencukupi di ${resolvedBangsalName} : ${shortages.join('; ')}`);
    }
  }

  async getPrescriptionBpjsMeta(connection, no_rawat) {
    const [rows] = await connection.execute(
      `
        SELECT
          rp.no_rkm_medis,
          COALESCE(bs.no_sep, '') AS no_sep
        FROM reg_periksa rp
        LEFT JOIN bridging_sep bs ON bs.no_rawat = rp.no_rawat
        WHERE rp.no_rawat = ?
        LIMIT 1
      `,
      [no_rawat]
    );

    return {
      no_rkm_medis: String(rows?.[0]?.no_rkm_medis || '').trim(),
      no_sep: String(rows?.[0]?.no_sep || '').trim()
    };
  }

  async insertLegacyPrescriptionFlags(connection, {
    no_rawat,
    kd_dokter,
    prescriptionDate,
    setKronis = false,
    setPrb = false
  }) {
    if (!setKronis && !setPrb) {
      return;
    }

    const bpjsMeta = await this.getPrescriptionBpjsMeta(connection, no_rawat);
    if (!bpjsMeta.no_rkm_medis) {
      return;
    }

    if (setKronis) {
      await connection.execute(
        `
          INSERT INTO mlite_veronisa
          VALUES (NULL, ?, ?, ?, ?, ?, 'Belum', ?)
        `,
        [
          prescriptionDate,
          bpjsMeta.no_rkm_medis,
          no_rawat,
          prescriptionDate,
          bpjsMeta.no_sep,
          kd_dokter
        ]
      );
    }

    if (setPrb) {
      await connection.execute(
        `
          INSERT INTO mlite_srb
          VALUES (NULL, ?, ?, ?, ?, ?, 'Belum', ?)
        `,
        [
          prescriptionDate,
          bpjsMeta.no_rkm_medis,
          no_rawat,
          prescriptionDate,
          bpjsMeta.no_sep,
          kd_dokter
        ]
      );
    }
  }

  normalizePrescriptionStatus(value) {
    const normalizedValue = String(value || '').trim().toLowerCase();

    if (
      normalizedValue === 'ralan' ||
      normalizedValue === 'ranap' ||
      normalizedValue === 'pulang' ||
      normalizedValue === 'ibs'
    ) {
      return normalizedValue;
    }

    if (normalizedValue === 'rawat jalan') {
      return 'ralan';
    }

    if (normalizedValue === 'rawat inap') {
      return 'ranap';
    }

    if (normalizedValue === 'obat pulang') {
      return 'pulang';
    }

    if (normalizedValue === 'ibs') {
      return 'ibs';
    }

    return null;
  }

  async resolvePrescriptionStatus(connection, no_rawat, requestedStatus) {
    const normalizedRequestedStatus = this.normalizePrescriptionStatus(requestedStatus);

    if (normalizedRequestedStatus) {
      return normalizedRequestedStatus;
    }

    const [registrationRows] = await connection.execute(
      `
        SELECT status_lanjut
        FROM reg_periksa
        WHERE no_rawat = ?
        LIMIT 1
      `,
      [no_rawat]
    );

    const registration = registrationRows[0];

    if (!registration?.status_lanjut) {
      return 'ralan';
    }

    return registration.status_lanjut === 'Ranap' ? 'ranap' : 'ralan';
  }

  normalizePrescriptionDate(value) {
    if (!value) {
      return null;
    }

    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
      return value.trim();
    }

    const parsedDate = new Date(value);

    if (Number.isNaN(parsedDate.getTime())) {
      throw new Error('Tanggal resep tidak valid');
    }

    const year = parsedDate.getFullYear();
    const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const day = String(parsedDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  normalizePrescriptionTime(value) {
    const normalizedValue = String(value || '').trim();
    if (!normalizedValue) {
      return null;
    }

    const fullTimeMatch = normalizedValue.match(/^(\d{2}):(\d{2}):(\d{2})$/);
    if (fullTimeMatch) {
      return `${fullTimeMatch[1]}:${fullTimeMatch[2]}:${fullTimeMatch[3]}`;
    }

    const shortTimeMatch = normalizedValue.match(/^(\d{2}):(\d{2})$/);
    if (shortTimeMatch) {
      return `${shortTimeMatch[1]}:${shortTimeMatch[2]}:00`;
    }

    throw new Error('Jam resep tidak valid');
  }

  getCurrentSystemDateTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return {
      date: `${year}-${month}-${day}`,
      time: `${hours}:${minutes}:${seconds}`
    };
  }

  formatDateToLocalYmd(value) {
    const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatTimeToLocalHms(value) {
    const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  formatTimeStringToHm(value) {
    const normalizedValue = String(value || '').trim();
    if (!normalizedValue) {
      return '';
    }

    const match = normalizedValue.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
    if (!match) {
      return normalizedValue;
    }

    return `${match[1]}:${match[2]}`;
  }

  parseMysqlDateTimeAsLocal(value) {
    const normalizedValue = String(value || '').trim();
    if (!normalizedValue) {
      return null;
    }

    const match = normalizedValue.match(
      /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/
    );

    if (!match) {
      const fallbackDate = new Date(normalizedValue);
      return Number.isNaN(fallbackDate.getTime()) ? null : fallbackDate;
    }

    const [, year, month, day, hour = '00', minute = '00', second = '00'] = match;
    const parsedDate = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    );

    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  // Get prescriptions for a patient
  async getPrescriptions(no_rawat) {
    if (!no_rawat) {
      throw new Error('no_rawat is required');
    }

    const query = `
      SELECT ro.*, d.nm_dokter 
      FROM resep_obat ro
      LEFT JOIN dokter d ON ro.kd_dokter = d.kd_dokter
      WHERE ro.no_rawat = ?
      ORDER BY ro.tgl_peresepan DESC, ro.jam_peresepan DESC
    `;
    
    try {
      const result = await executeQuery(query, [no_rawat]);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('Error getting prescriptions:', error);
      throw error;
    }
  }

  // Get prescription details (medicines and compounds)
  async getPrescriptionDetails(no_resep) {
    if (!no_resep) {
      throw new Error('no_resep is required');
    }

    try {
      const regularHeaderRows = await executeQuery(
        `
          SELECT no_rawat, status, kd_dokter
          FROM resep_obat
          WHERE no_resep = ?
          LIMIT 1
        `,
        [no_resep]
      );
      let prescriptionHeader = Array.isArray(regularHeaderRows) ? regularHeaderRows[0] : null;
      let isPulangPrescription = false;

      if (!prescriptionHeader?.no_rawat) {
        const pulangHeaderRows = await executeQuery(
          `
            SELECT
              rp.no_rawat,
              'pulang' AS status,
              rdp.kd_dokter
            FROM resep_dokter_pulang rdp
            INNER JOIN resep_pulang rp ON rp.no_resep = rdp.no_resep
            WHERE rdp.no_resep = ?
            LIMIT 1
          `,
          [no_resep]
        );
        prescriptionHeader = Array.isArray(pulangHeaderRows) ? pulangHeaderRows[0] : null;
        isPulangPrescription = Boolean(prescriptionHeader?.no_rawat);
      }

      if (!prescriptionHeader?.no_rawat) {
        throw new Error('Header resep tidak ditemukan');
      }

      const connection = await getConnection();

      let stockBangsalCode = '';
      try {
        const resolvedPrescriptionStatus = await this.resolvePrescriptionStatus(
          connection,
          prescriptionHeader.no_rawat,
          prescriptionHeader.status
        );
        stockBangsalCode = await this.resolveStockBangsalCode(
          connection,
          prescriptionHeader.no_rawat,
          resolvedPrescriptionStatus
        );
      } finally {
        connection.release();
      }

      // Get prescription medicines
      const medicineQuery = isPulangPrescription
        ? `
            SELECT
              rp.no_resep,
              rp.kode_brng,
              rp.jml_barang AS jml,
              rp.dosis AS aturan_pakai,
              db.nama_brng,
              db.kode_sat AS satuan,
              db.kelas3 AS harga,
              COALESCE(SUM(gb.stok), 0) AS stok
            FROM resep_pulang rp
            LEFT JOIN databarang db ON rp.kode_brng = db.kode_brng
            LEFT JOIN gudangbarang gb ON gb.kode_brng = rp.kode_brng AND gb.kd_bangsal = ?
            WHERE rp.no_resep = ?
            GROUP BY
              rp.no_resep,
              rp.kode_brng,
              rp.jml_barang,
              rp.dosis,
              db.nama_brng,
              db.kode_sat,
              db.kelas3
          `
        : `
            SELECT
              rd.*,
              db.nama_brng,
              db.kode_sat AS satuan,
              db.kelas1 AS harga,
              COALESCE(SUM(gb.stok), 0) AS stok
            FROM resep_dokter rd
            LEFT JOIN databarang db ON rd.kode_brng = db.kode_brng
            LEFT JOIN gudangbarang gb ON gb.kode_brng = rd.kode_brng AND gb.kd_bangsal = ?
            WHERE rd.no_resep = ?
            GROUP BY
              rd.no_resep,
              rd.kode_brng,
              rd.jml,
              rd.aturan_pakai,
              db.nama_brng,
              db.kode_sat,
              db.kelas1
          `;
      
      // Get prescription compounds
      const compoundQuery = `
        SELECT rdr.*, mr.nm_racik
        FROM resep_dokter_racikan rdr
        LEFT JOIN metode_racik mr ON rdr.kd_racik = mr.kd_racik
        WHERE rdr.no_resep = ?
        ORDER BY rdr.no_racik ASC
      `;
      
      const [medicines, compounds] = await Promise.all([
        executeQuery(medicineQuery, [stockBangsalCode, no_resep]),
        isPulangPrescription ? Promise.resolve([]) : executeQuery(compoundQuery, [no_resep])
      ]);
      
      const compoundRows = Array.isArray(compounds) ? compounds : [];
      const compoundDetails = await Promise.all(
        compoundRows.map(async (compound) => {
          const detailRows = await executeQuery(
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
              GROUP BY
                rdrd.kode_brng,
                rdrd.kandungan,
                rdrd.jml,
                db.nama_brng,
                db.kode_sat
              ORDER BY db.nama_brng ASC
            `,
            [stockBangsalCode, no_resep, compound.no_racik]
          );

          return {
            ...compound,
            details: detailRows
          };
        })
      );

      return {
        success: true,
        medicines,
        compounds: compoundDetails
      };
    } catch (error) {
      console.error('Error getting prescription details:', error);
      throw error;
    }
  }

  // Get available medicines
  async getMedicines() {
    const query = `
      SELECT kode_brng, nama_brng, kode_sat as satuan, kelas1 as harga
      FROM databarang
      WHERE status = '1'
      ORDER BY nama_brng
      LIMIT 100
    `;
    
    try {
      const result = await executeQuery(query);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('Error getting medicines:', error);
      throw error;
    }
  }

  async searchMedicines(search = '', limit = 20, no_rawat = '', prescriptionStatus = '') {
    const keyword = String(search || '').trim();
    const effectiveLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
    const normalizedNoRawat = String(no_rawat || '').trim();

    const connection = await getConnection();

    try {
      let stockBangsalCode = '';

      if (normalizedNoRawat) {
        const resolvedPrescriptionStatus = await this.resolvePrescriptionStatus(
          connection,
          normalizedNoRawat,
          prescriptionStatus
        );
        stockBangsalCode = await this.resolveStockBangsalCode(connection, normalizedNoRawat, resolvedPrescriptionStatus);
      }

      const query = `
        SELECT
          db.kode_brng,
          db.nama_brng,
          db.kode_sat AS satuan,
          db.ralan AS harga,
          COALESCE(modd.kategori, '') AS kategori_ddd,
          SUM(COALESCE(gb.stok, 0)) AS stok
        FROM gudangbarang gb
        INNER JOIN databarang db ON db.kode_brng = gb.kode_brng
        LEFT JOIN master_obat_ddd modd ON modd.kode_brng = db.kode_brng
        WHERE db.status = '1'
          ${stockBangsalCode ? 'AND gb.kd_bangsal = ?' : ''}
          AND (
            ? = ''
            OR db.kode_brng LIKE ?
            OR db.nama_brng LIKE ?
          )
        GROUP BY db.kode_brng, db.nama_brng, db.kode_sat, db.ralan, modd.kategori
        HAVING stok > 0
        ORDER BY
          CASE
            WHEN db.kode_brng = ? THEN 0
            WHEN db.kode_brng LIKE ? THEN 1
            WHEN db.nama_brng LIKE ? THEN 2
            ELSE 3
          END,
          db.nama_brng ASC
        LIMIT ?
      `;

      const params = [];
      if (stockBangsalCode) {
        params.push(stockBangsalCode);
      }
      params.push(
        keyword,
        `%${keyword}%`,
        `%${keyword}%`,
        keyword,
        `${keyword}%`,
        `${keyword}%`,
        effectiveLimit
      );

      const [rows] = await connection.execute(query, params);

      return {
        success: true,
        data: rows
      };
    } catch (error) {
      console.error('Error searching medicines from gudangbarang:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  async searchPackages(search = '', limit = 20) {
    const keyword = String(search || '').trim();
    const effectiveLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
    const query = `
      SELECT id, kd_paket, nama_paket
      FROM eresep_paket_operasi
      WHERE status = '1'
        AND (
          ? = ''
          OR kd_paket LIKE ?
          OR nama_paket LIKE ?
        )
      ORDER BY nama_paket ASC
      LIMIT ?
    `;

    try {
      const result = await executeQuery(query, [
        keyword,
        `%${keyword}%`,
        `%${keyword}%`,
        effectiveLimit
      ]);

      return {
        success: true,
        data: result.map((row) => ({
          id: row.id,
          kd_paket: row.kd_paket,
          nama_paket: row.nama_paket,
          text: `${row.kd_paket} - ${row.nama_paket}`
        }))
      };
    } catch (error) {
      console.error('Error searching packages:', error);
      throw error;
    }
  }

  async getPackageItems(packageId, no_rawat, prescriptionStatus = '') {
    const normalizedPackageId = String(packageId || '').trim();
    const normalizedNoRawat = String(no_rawat || '').trim();

    if (!normalizedPackageId) {
      throw new Error('package_id is required');
    }

    if (!normalizedNoRawat) {
      throw new Error('no_rawat is required');
    }

    const connection = await getConnection();

    try {
      const resolvedPrescriptionStatus = await this.resolvePrescriptionStatus(
        connection,
        normalizedNoRawat,
        prescriptionStatus
      );
      const stockBangsalCode = await this.resolveStockBangsalCode(connection, normalizedNoRawat, resolvedPrescriptionStatus);

      const [rows] = await connection.execute(
        `
          SELECT
            ept.kd_obat AS kode_brng,
            db.nama_brng,
            db.kode_sat AS satuan,
            ept.jumlah,
            ept.aturan_pakai,
            SUM(COALESCE(gb.stok, 0)) AS stok
          FROM eresep_paket_operasi_template ept
          LEFT JOIN databarang db ON db.kode_brng = ept.kd_obat
          LEFT JOIN gudangbarang gb ON gb.kode_brng = ept.kd_obat AND gb.kd_bangsal = ?
          WHERE ept.id_paket = ?
          GROUP BY ept.kd_obat, db.nama_brng, db.kode_sat, ept.jumlah, ept.aturan_pakai
          ORDER BY db.nama_brng ASC
        `,
        [stockBangsalCode, normalizedPackageId]
      );

      return {
        success: true,
        kd_bangsal: stockBangsalCode,
        data: rows.map((row) => ({
          kode_brng: row.kode_brng,
          nama_brng: row.nama_brng,
          satuan: row.satuan,
          jumlah: row.jumlah,
          aturan_pakai: row.aturan_pakai,
          stok: Number(row.stok) || 0
        }))
      };
    } catch (error) {
      console.error('Error getting package items:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  // Get compound methods
  async getCompoundMethods() {
    const query = `SELECT * FROM metode_racik ORDER BY nm_racik`;
    
    try {
      const result = await executeQuery(query);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('Error getting compound methods:', error);
      throw error;
    }
  }

  // Create new prescription
  async createPrescription(no_rawat, kd_dokter, medicines, compounds, prescriptionDate, prescriptionStatus, prescriptionTime, options = {}) {
    if (!no_rawat || !kd_dokter) {
      throw new Error('no_rawat and kd_dokter are required');
    }

    const connection = await getConnection();
    
    try {
      await connection.beginTransaction();
      const currentSystemDateTime = this.getCurrentSystemDateTime();
      // Always use backend server date/time so saved prescriptions do not depend on browser/device clocks.
      const normalizedPrescriptionDate = currentSystemDateTime.date;
      const normalizedPrescriptionTime = currentSystemDateTime.time;
      const resolvedPrescriptionStatus = await this.resolvePrescriptionStatus(connection, no_rawat, prescriptionStatus);
      const setKronis = this.normalizeBooleanFlag(options?.set_kronis);
      const setPrb = this.normalizeBooleanFlag(options?.set_prb);
      const normalizedMedicines = await this.normalizeMedicines(medicines);
      const normalizedCompounds = await this.normalizeCompounds(connection, compounds);

      if (!normalizedMedicines.length && !normalizedCompounds.length) {
        throw new Error('Minimal satu obat atau satu racikan harus diisi');
      }

      const stockBangsalCode = await this.resolveStockBangsalCode(connection, no_rawat, resolvedPrescriptionStatus);
      const compoundMedicineRequests = normalizedCompounds.flatMap((compound) => (
        compound.details.map((detail) => ({
          kode_brng: detail.kode_brng,
          jml: detail.jml
        }))
      ));
      await this.validateMedicineStock(connection, stockBangsalCode, [
        ...normalizedMedicines,
        ...compoundMedicineRequests
      ]);

      if (resolvedPrescriptionStatus === 'pulang') {
        if (normalizedCompounds.length > 0) {
          throw new Error('Resep obat pulang belum mendukung racikan');
        }

        const storageBangsalCode = await this.resolvePulangStorageBangsalCode(connection, no_rawat, kd_dokter);
        const medicineCodes = Array.from(new Set(normalizedMedicines.map((medicine) => medicine.kode_brng)));
        const placeholders = medicineCodes.map(() => '?').join(', ');
        const [catalogRows] = medicineCodes.length
          ? await connection.execute(
              `
                SELECT kode_brng, kelas3
                FROM databarang
                WHERE kode_brng IN (${placeholders})
              `,
              medicineCodes
            )
          : [[]];
        const priceByCode = new Map(
          (Array.isArray(catalogRows) ? catalogRows : []).map((row) => [
            String(row.kode_brng || '').trim(),
            Number(row.kelas3) || 0
          ])
        );

        let no_resep = await this.findReusablePrescription(
          connection,
          no_rawat,
          kd_dokter,
          normalizedPrescriptionDate,
          'pulang'
        );
        let reusedExisting = true;

        if (!no_resep) {
          reusedExisting = false;
          no_resep = await this.generatePrescriptionNumber(connection, normalizedPrescriptionDate, 'pulang');
          await connection.execute(
            `
              INSERT INTO resep_dokter_pulang
              VALUES (?, ?, ?, ?, ?, ?)
            `,
            [
              no_resep,
              kd_dokter,
              normalizedPrescriptionDate,
              normalizedPrescriptionTime,
              normalizedPrescriptionDate,
              normalizedPrescriptionTime
            ]
          );
        }

        for (const medicine of normalizedMedicines) {
          const qty = this.parseMedicineQty(medicine.jml);
          const unitPrice = priceByCode.get(medicine.kode_brng) || 0;
          const totalPrice = this.roundToThree(unitPrice * qty);

          await connection.execute(
            `
              INSERT INTO resep_pulang
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
            `,
            [
              no_rawat,
              medicine.kode_brng,
              medicine.jml,
              unitPrice,
              totalPrice,
              medicine.aturan_pakai,
              normalizedPrescriptionDate,
              normalizedPrescriptionTime,
              storageBangsalCode,
              no_resep
            ]
          );
        }

        await connection.commit();

        return {
          success: true,
          no_resep,
          reused_existing: reusedExisting
        };
      }

      let no_resep = await this.findReusablePrescription(connection, no_rawat, kd_dokter, normalizedPrescriptionDate);
      let reusedExisting = true;

      if (!no_resep) {
        reusedExisting = false;
        no_resep = await this.generatePrescriptionNumber(connection, normalizedPrescriptionDate);

        await connection.execute(
          `
            INSERT INTO resep_obat (
              no_resep, tgl_perawatan, jam, no_rawat, kd_dokter, tgl_peresepan, jam_peresepan, status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            no_resep,
            normalizedPrescriptionDate,
            normalizedPrescriptionTime,
            no_rawat,
            kd_dokter,
            normalizedPrescriptionDate,
            normalizedPrescriptionTime,
            resolvedPrescriptionStatus
          ]
        );
      }

      if (normalizedMedicines.length > 0) {
        for (const medicine of normalizedMedicines) {
          const insertMedicineQuery = `
            INSERT INTO resep_dokter (no_resep, kode_brng, jml, aturan_pakai)
            VALUES (?, ?, ?, ?)
          `;
          await connection.execute(insertMedicineQuery, [no_resep, medicine.kode_brng, medicine.jml, medicine.aturan_pakai]);
        }
      }

      if (normalizedCompounds.length > 0) {
        let nextCompoundNumber = await this.getNextCompoundNumber(connection, no_resep);

        for (const compound of normalizedCompounds) {
          const compoundNo = nextCompoundNumber++;
          const insertCompoundQuery = `
            INSERT INTO resep_dokter_racikan (no_resep, no_racik, nama_racik, kd_racik, jml_dr, aturan_pakai, keterangan)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `;
          await connection.execute(insertCompoundQuery, [no_resep, compoundNo, compound.nama_racik, compound.kd_racik, compound.jml_dr, compound.aturan_pakai, compound.keterangan]);

          for (const detail of compound.details) {
            await connection.execute(
              `
                INSERT INTO resep_dokter_racikan_detail
                  (no_resep, no_racik, kode_brng, p1, p2, kandungan, jml)
                VALUES (?, ?, ?, '1', '1', ?, ?)
              `,
              [no_resep, compoundNo, detail.kode_brng, detail.kandungan, detail.jml]
            );
          }
        }
      }

      if (resolvedPrescriptionStatus === 'ralan' || resolvedPrescriptionStatus === 'ranap') {
        await this.insertLegacyPrescriptionFlags(connection, {
          no_rawat,
          kd_dokter,
          prescriptionDate: normalizedPrescriptionDate,
          setKronis,
          setPrb
        });
      }
      
      await connection.commit();
      
      return {
        success: true,
        no_resep,
        reused_existing: reusedExisting
      };
    } catch (error) {
      await connection.rollback();
      console.error('Error creating prescription:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  // Update existing prescription
  async updatePrescription(no_resep, medicines, compounds, prescriptionDate, prescriptionStatus, username = '', prescriptionTime) {
    if (!no_resep) {
      throw new Error('no_resep is required');
    }

    const connection = await getConnection();
    
    try {
      await connection.beginTransaction();
      const normalizedUsername = String(username || '').trim();
      const currentSystemDateTime = this.getCurrentSystemDateTime();
      // Always use backend server date/time so edits stay consistent with server-side prescription timestamps.
      const normalizedPrescriptionDate = currentSystemDateTime.date;
      const normalizedPrescriptionTime = currentSystemDateTime.time;
      const normalizedPrescriptionStatus = this.normalizePrescriptionStatus(prescriptionStatus);
      const normalizedMedicines = await this.normalizeMedicines(medicines);
      const normalizedCompounds = await this.normalizeCompounds(connection, compounds);

      const [regularHeaderRows] = await connection.execute(
        `
          SELECT no_rawat, status, kd_dokter
          FROM resep_obat
          WHERE no_resep = ?
          LIMIT 1
        `,
        [no_resep]
      );
      let header = regularHeaderRows[0] || null;
      let isPulangPrescription = false;

      if (!header) {
        const [pulangHeaderRows] = await connection.execute(
          `
            SELECT
              rp.no_rawat,
              'pulang' AS status,
              rdp.kd_dokter
            FROM resep_dokter_pulang rdp
            INNER JOIN resep_pulang rp ON rp.no_resep = rdp.no_resep
            WHERE rdp.no_resep = ?
            LIMIT 1
          `,
          [no_resep]
        );
        header = pulangHeaderRows[0] || null;
        isPulangPrescription = Boolean(header);
      }

      if (!header) {
        throw new Error('Resep tidak ditemukan atau sudah dihapus');
      }

      if (normalizedUsername && String(header.kd_dokter || '').trim() !== normalizedUsername) {
        throw new Error('Anda tidak berhak mengedit resep ini');
      }

      const serviceStatus = await this.getPrescriptionServiceStatus(connection, no_resep);
      if (serviceStatus && serviceStatus !== 'Belum Terlayani') {
        throw new Error('Resep yang sudah tervalidasi/terlayani tidak dapat diedit');
      }

      const noRawatHeader = String(header.no_rawat || '').trim();
      const headerStatus = String(header.status || '').trim();
      const resolvedStatus = normalizedPrescriptionStatus || (await this.resolvePrescriptionStatus(connection, noRawatHeader, headerStatus));
      const stockBangsalCode = await this.resolveStockBangsalCode(connection, noRawatHeader, resolvedStatus);
      const compoundMedicineRequests = normalizedCompounds.flatMap((compound) => (
        compound.details.map((detail) => ({
          kode_brng: detail.kode_brng,
          jml: detail.jml
        }))
      ));
      await this.validateMedicineStock(connection, stockBangsalCode, [
        ...normalizedMedicines,
        ...compoundMedicineRequests
      ]);

      if (isPulangPrescription) {
        if (normalizedPrescriptionStatus && normalizedPrescriptionStatus !== 'pulang') {
          throw new Error('Status resep obat pulang tidak dapat diubah ke tipe lain');
        }

        if (normalizedCompounds.length > 0) {
          throw new Error('Resep obat pulang belum mendukung racikan');
        }

        const storageBangsalCode = await this.resolvePulangStorageBangsalCode(
          connection,
          noRawatHeader,
          String(header.kd_dokter || '').trim()
        );
        const medicineCodes = Array.from(new Set(normalizedMedicines.map((medicine) => medicine.kode_brng)));
        const placeholders = medicineCodes.map(() => '?').join(', ');
        const [catalogRows] = medicineCodes.length
          ? await connection.execute(
              `
                SELECT kode_brng, kelas3
                FROM databarang
                WHERE kode_brng IN (${placeholders})
              `,
              medicineCodes
            )
          : [[]];
        const priceByCode = new Map(
          (Array.isArray(catalogRows) ? catalogRows : []).map((row) => [
            String(row.kode_brng || '').trim(),
            Number(row.kelas3) || 0
          ])
        );

        await connection.execute(
          `
            UPDATE resep_dokter_pulang
            SET
              tgl_perawatan = ?,
              jam_perawatan = ?,
              tgl_peresepan = ?,
              jam_peresepan = ?
            WHERE no_resep = ?
          `,
          [
            normalizedPrescriptionDate,
            normalizedPrescriptionTime,
            normalizedPrescriptionDate,
            normalizedPrescriptionTime,
            no_resep
          ]
        );

        await connection.execute('DELETE FROM resep_pulang WHERE no_resep = ?', [no_resep]);

        for (const medicine of normalizedMedicines) {
          const qty = this.parseMedicineQty(medicine.jml);
          const unitPrice = priceByCode.get(medicine.kode_brng) || 0;
          const totalPrice = this.roundToThree(unitPrice * qty);

          await connection.execute(
            `
              INSERT INTO resep_pulang
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
            `,
            [
              noRawatHeader,
              medicine.kode_brng,
              medicine.jml,
              unitPrice,
              totalPrice,
              medicine.aturan_pakai,
              normalizedPrescriptionDate || currentSystemDateTime.date,
              normalizedPrescriptionTime,
              storageBangsalCode,
              no_resep
            ]
          );
        }

        await connection.commit();

        return {
          success: true
        };
      }

      const headerUpdates = [
        'tgl_perawatan = ?',
        'jam = ?',
        'tgl_peresepan = ?',
        'jam_peresepan = ?'
      ];
      const headerParams = [
        normalizedPrescriptionDate,
        normalizedPrescriptionTime,
        normalizedPrescriptionDate,
        normalizedPrescriptionTime
      ];

      if (normalizedPrescriptionStatus) {
        headerUpdates.push('status = ?');
        headerParams.push(normalizedPrescriptionStatus);
      }

      if (headerUpdates.length > 0) {
        await connection.execute(
          `UPDATE resep_obat SET ${headerUpdates.join(', ')} WHERE no_resep = ?`,
          [...headerParams, no_resep]
        );
      }
      
      await connection.execute('DELETE FROM resep_dokter_racikan_detail WHERE no_resep = ?', [no_resep]);
      await connection.execute('DELETE FROM resep_dokter WHERE no_resep = ?', [no_resep]);
      await connection.execute('DELETE FROM resep_dokter_racikan WHERE no_resep = ?', [no_resep]);

      if (normalizedMedicines.length > 0) {
        for (const medicine of normalizedMedicines) {
          const insertMedicineQuery = `
            INSERT INTO resep_dokter (no_resep, kode_brng, jml, aturan_pakai)
            VALUES (?, ?, ?, ?)
          `;
          await connection.execute(insertMedicineQuery, [no_resep, medicine.kode_brng, medicine.jml, medicine.aturan_pakai]);
        }
      }

      if (normalizedCompounds.length > 0) {
        let nextCompoundNumber = 1;
        for (const compound of normalizedCompounds) {
          const insertCompoundQuery = `
            INSERT INTO resep_dokter_racikan (no_resep, no_racik, nama_racik, kd_racik, jml_dr, aturan_pakai, keterangan)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `;
          await connection.execute(insertCompoundQuery, [no_resep, nextCompoundNumber, compound.nama_racik, compound.kd_racik, compound.jml_dr, compound.aturan_pakai, compound.keterangan]);

          for (const detail of compound.details) {
            await connection.execute(
              `
                INSERT INTO resep_dokter_racikan_detail
                  (no_resep, no_racik, kode_brng, p1, p2, kandungan, jml)
                VALUES (?, ?, ?, '1', '1', ?, ?)
              `,
              [no_resep, nextCompoundNumber, detail.kode_brng, detail.kandungan, detail.jml]
            );
          }

          nextCompoundNumber += 1;
        }
      }
      
      await connection.commit();
      
      return {
        success: true
      };
    } catch (error) {
      await connection.rollback();
      console.error('Error updating prescription:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  // Delete prescription
  async deletePrescription(no_resep, username = '') {
    if (!no_resep) {
      throw new Error('no_resep is required');
    }

    const connection = await getConnection();
    
    try {
      await connection.beginTransaction();
      const normalizedUsername = String(username || '').trim();

      const [regularHeaderRows] = await connection.execute(
        'SELECT kd_dokter FROM resep_obat WHERE no_resep = ? LIMIT 1',
        [no_resep]
      );
      let ownerDoctor = String(regularHeaderRows?.[0]?.kd_dokter || '').trim();
      let isPulangPrescription = false;

      if (!ownerDoctor) {
        const [pulangHeaderRows] = await connection.execute(
          'SELECT kd_dokter FROM resep_dokter_pulang WHERE no_resep = ? LIMIT 1',
          [no_resep]
        );
        ownerDoctor = String(pulangHeaderRows?.[0]?.kd_dokter || '').trim();
        isPulangPrescription = Boolean(ownerDoctor);
      }

      if (!ownerDoctor) {
        throw new Error('Resep tidak ditemukan atau sudah dihapus');
      }

      if (normalizedUsername && ownerDoctor !== normalizedUsername) {
        throw new Error('Anda tidak berhak menghapus resep ini');
      }

      const serviceStatus = await this.getPrescriptionServiceStatus(connection, no_resep);
      if (serviceStatus && serviceStatus !== 'Belum Terlayani') {
        throw new Error('Resep yang sudah tervalidasi/terlayani tidak dapat dihapus');
      }

      if (isPulangPrescription) {
        await connection.execute('DELETE FROM resep_pulang WHERE no_resep = ?', [no_resep]);
        await connection.execute('DELETE FROM resep_dokter_pulang WHERE no_resep = ?', [no_resep]);
        await connection.commit();

        return {
          success: true
        };
      }
      
      await connection.execute('DELETE FROM resep_dokter_racikan_detail WHERE no_resep = ?', [no_resep]);
      await connection.execute('DELETE FROM resep_dokter WHERE no_resep = ?', [no_resep]);
      await connection.execute('DELETE FROM resep_dokter_racikan WHERE no_resep = ?', [no_resep]);
      
      // Delete main prescription
      await connection.execute('DELETE FROM resep_obat WHERE no_resep = ?', [no_resep]);
      
      await connection.commit();
      
      return {
        success: true
      };
    } catch (error) {
      await connection.rollback();
      console.error('Error deleting prescription:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  async checkChronicPrescriptionWarning(no_rkm_medis = '') {
    const normalizedNoRm = String(no_rkm_medis || '').trim();
    if (!normalizedNoRm) {
      return {
        success: true,
        data: { status: 'tidak' }
      };
    }

    const kronisRows = await executeQuery(
      `
        SELECT
          DATE_FORMAT(tgl_registrasi, '%Y-%m-%d %H:%i:%s') AS tgl_registrasi,
          no_rawat
        FROM mlite_veronisa
        WHERE no_rkm_medis = ?
          AND DATE(tgl_registrasi) < CURDATE()
        ORDER BY tgl_registrasi DESC
        LIMIT 1
      `,
      [normalizedNoRm]
    );

    const kronis = kronisRows?.[0];
    if (!kronis) {
      return {
        success: true,
        data: { status: 'tidak' }
      };
    }

    const kronisTimestamp = this.parseMysqlDateTimeAsLocal(kronis.tgl_registrasi);
    if (!kronisTimestamp || Number.isNaN(kronisTimestamp.getTime())) {
      return {
        success: true,
        data: { status: 'tidak' }
      };
    }

    const noRawat = String(kronis.no_rawat || '').trim();
    if (!noRawat) {
      return {
        success: true,
        data: { status: 'tidak' }
      };
    }

    const resepHeaderRows = await executeQuery(
      `
        SELECT
          DATE_FORMAT(ro.tgl_peresepan, '%Y-%m-%d') AS tanggal_resep,
          TIME_FORMAT(ro.jam, '%H:%i:%s') AS jam_resep
        FROM resep_obat ro
        WHERE ro.no_rawat = ?
        ORDER BY ro.tgl_peresepan DESC, ro.jam DESC, ro.no_resep DESC
        LIMIT 1
      `,
      [noRawat]
    );

    const resepHeader = resepHeaderRows?.[0] || {};
    const tanggalKronis = String(resepHeader.tanggal_resep || '').trim() || this.formatDateToLocalYmd(kronisTimestamp);
    const jamKronisRaw = String(resepHeader.jam_resep || '').trim() || '00:00:00';
    const jamKronis = this.formatTimeStringToHm(jamKronisRaw);
    const tanggalBerikutnyaBase = this.parseMysqlDateTimeAsLocal(`${tanggalKronis} ${jamKronisRaw}`) || new Date(kronisTimestamp.getTime());
    tanggalBerikutnyaBase.setDate(tanggalBerikutnyaBase.getDate() + 30);
    const hariSebelumnya = Math.floor((Date.now() - kronisTimestamp.getTime()) / 86400000);
    if (!Number.isFinite(hariSebelumnya) || Date.now() >= tanggalBerikutnyaBase.getTime()) {
      return {
        success: true,
        data: { status: 'tidak' }
      };
    }

    const tanggalBerikutnya = this.formatDateToLocalYmd(tanggalBerikutnyaBase);
    const jamBerikutnya = this.formatTimeStringToHm(jamKronisRaw);

    const detailRows = await executeQuery(
      `
        SELECT
          ro.no_resep,
          db.nama_brng,
          dpo.jml,
          COALESCE(ap.aturan, '-') AS aturan_pakai
        FROM resep_obat ro
        INNER JOIN detail_pemberian_obat dpo
          ON dpo.no_rawat = ro.no_rawat
         AND dpo.tgl_perawatan = ro.tgl_perawatan
         AND dpo.jam = ro.jam
        INNER JOIN databarang db ON db.kode_brng = dpo.kode_brng
        LEFT JOIN aturan_pakai ap
          ON ap.no_rawat = dpo.no_rawat
         AND ap.tgl_perawatan = dpo.tgl_perawatan
         AND ap.jam = dpo.jam
         AND ap.kode_brng = dpo.kode_brng
        WHERE ro.no_rawat = ?
        ORDER BY ro.no_resep DESC
      `,
      [noRawat]
    );

    const resepGroup = new Map();
    for (const row of detailRows || []) {
      const noResep = String(row.no_resep || '').trim();
      if (!noResep) {
        continue;
      }

      if (!resepGroup.has(noResep)) {
        resepGroup.set(noResep, []);
      }

      resepGroup.get(noResep).push(
        `- ${String(row.nama_brng || '').trim()} | Jumlah: ${row.jml ?? ''} | Aturan: ${String(row.aturan_pakai || '-').trim() || '-'}`
      );
    }

    const dataObat = [];
    for (const [noResep, items] of resepGroup.entries()) {
      dataObat.push(`=== No Resep: ${noResep} ===`);
      dataObat.push(items.join('\n'));
    }

    return {
      success: true,
      data: {
        status: 'ada',
        data: dataObat.join('\n\n'),
        tanggal_kronis: tanggalKronis,
        jam_kronis: jamKronis,
        hari_sebelumnya: hariSebelumnya,
        tanggal_berikutnya: tanggalBerikutnya,
        jam_berikutnya: jamBerikutnya
      }
    };
  }
}

export default new PrescriptionDataService();
