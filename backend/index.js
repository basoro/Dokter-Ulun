import express from 'express';
import multer from 'multer';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AuthService } from './services/authService.js';
import { DashboardService } from './services/dashboardService.js';
import { AttendanceService } from './services/attendanceService.js';
import AllergyDataService from './services/allergyDataService.js';
import AssesmenRehabMedikService from './services/assesmenRehabMedikService.js';
import { BookingOperasiService } from './services/bookingOperasiService.js';
import { BookingRegistrasiService } from './services/bookingRegistrasiService.js';
import RawatJalanPatientsService from './services/rawatJalanPatientsService.js';
import RawatInapDataService from './services/rawatInapDataService.js';
import HemodialisaDataService from './services/hemodialisaDataService.js';
import GetMedicalRecordService from './services/getMedicalRecordService.js';
import DigitalFilesService from './services/digitalFilesService.js';
import EchoCardiographyService from './services/echoCardiographyService.js';
import EkstrapiramidalService from './services/ekstrapiramidalService.js';
import DeleteExaminationService from './services/deleteExaminationService.js';
import DepoFarmasiService from './services/depoFarmasiService.js';
import DiagnosticAccessService from './services/diagnosticAccessService.js';
import DoctorAiAssistantService from './services/doctorAiAssistantService.js';
import DoctorNotificationService from './services/doctorNotificationService.js';
import IcdDataService from './services/icdDataService.js';
import IgdDataService from './services/igdDataService.js';
import InacbgSimulationService from './services/inacbgSimulationService.js';
import InternalReferralService from './services/internalReferralService.js';
import LaboratoryDataService from './services/laboratoryDataService.js';
import MedicalScribeService from './services/medicalScribeService.js';
import VoiceToSoapService from './services/voiceToSoapService.js';
import { MedicalService } from './services/medicalService.js';
import OperationReportService from './services/operationReportService.js';
import PatientNotesService from './services/patientNotesService.js';
import PatientContactService from './services/patientContactService.js';
import BalanceCairanService from './services/balanceCairanService.js';
import VentilatorService from './services/ventilatorService.js';
import ProcedureService from './services/procedureService.js';
import PrescriptionDataService from './services/prescriptionDataService.js';
import RadiologyDataService from './services/radiologyDataService.js';
import ResumePasienDataService from './services/resumePasienDataService.js';
import SaveExaminationService from './services/saveExaminationService.js';
import TriageIgdService from './services/triageIgdService.js';
import WhatsappOtpService from './services/whatsappOtpService.js';
import { getAuditHistory, getAuditHistoryAccessInfo, initCrudAuditStorage, logCrudActivity } from './services/crudAuditService.js';
import statisticsDataRoutes from './routes/statisticsData.js';
import updateExaminationRoute from './routes/updateExamination.js';
import clinicalPathwayRoutes from './routes/clinicalPathway.js';

import { executeQuery, testConnection } from './config/database.js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });
initCrudAuditStorage();

// #region debug-point A:save-exam-route-reporter
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

const app = express();
const PORT = process.env.PORT || 3000;
const DIGITAL_FILES_MAX_UPLOAD_SIZE = 5 * 1024 * 1024;
const DIGITAL_FILES_ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const digitalFilesUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: DIGITAL_FILES_MAX_UPLOAD_SIZE,
    files: 10
  },
  fileFilter: (_req, file, cb) => {
    if (!DIGITAL_FILES_ALLOWED_MIME_TYPES.has(String(file.mimetype || '').toLowerCase())) {
      cb(new Error('Tipe file tidak didukung. Hanya JPG, JPEG, PNG, dan PDF.'));
      return;
    }

    cb(null, true);
  }
});

const handleDigitalFilesUpload = (req, res, next) => {
  digitalFilesUpload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'files', maxCount: 10 }
  ])(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'Ukuran file maksimal 5 MB.'
      });
    }

    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Jumlah file yang diunggah melebihi batas.'
      });
    }

    return res.status(400).json({
      success: false,
      error: error.message || 'Upload berkas digital gagal'
    });
  });
};

// Middleware
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:8080',
    'http://localhost:8081',
    'http://localhost:5173', // Common Vite port
    'http://127.0.0.1:8081'
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global request logging
app.use((req, res, next) => {
  console.log(`🌐 ${req.method} ${req.originalUrl}`);
  next();
});

const auditCrudSuccess = async (req, entity, action, result, meta = {}) => {
  await logCrudActivity({
    req,
    entity,
    action,
    status: 'success',
    payload: req.body,
    result,
    meta
  });
};

const auditCrudFailure = async (req, entity, action, error, meta = {}) => {
  await logCrudActivity({
    req,
    entity,
    action,
    status: 'error',
    payload: req.body,
    error,
    meta
  });
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Dokter Ulun API is running',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/audit-history/access/:username', async (req, res) => {
  try {
    const result = await getAuditHistoryAccessInfo(req.params.username);
    res.json(result);
  } catch (error) {
    console.error('Audit history access error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Gagal memeriksa akses riwayat audit'
    });
  }
});

app.get('/api/clinical-pathway/access/:username', async (req, res) => {
  try {
    const result = await DiagnosticAccessService.getAccessInfo('clinical-pathway', req.params.username);
    res.json(result);
  } catch (error) {
    console.error('Clinical pathway access error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Gagal memeriksa akses clinical pathway'
    });
  }
});

app.get('/api/audit-history', async (req, res) => {
  try {
    const { username = '', page = '1', limit = '50', action = '', status = '', entity = '', search = '' } = req.query;
    const result = await getAuditHistory(username, { page, limit, action, status, entity, search });

    if (result?.success && Array.isArray(result?.data) && result.data.length > 0) {
      const actorIds = Array.from(
        new Set(
          result.data
            .map((entry) => String(entry?.actor_id || '').trim())
            .filter(Boolean)
        )
      );

      if (actorIds.length > 0) {
        const placeholders = actorIds.map(() => '?').join(',');
        const [doctorRows, userRows, employeeRows] = await Promise.all([
          executeQuery(
            `
              SELECT kd_dokter AS actor_id, nm_dokter AS actor_name
              FROM dokter
              WHERE kd_dokter IN (${placeholders})
            `,
            actorIds
          ),
          executeQuery(
            `
              SELECT username AS actor_id, fullname AS actor_name
              FROM mlite_users
              WHERE username IN (${placeholders})
            `,
            actorIds
          ),
          executeQuery(
            `
              SELECT nik AS actor_id, nama AS actor_name
              FROM pegawai
              WHERE nik IN (${placeholders})
            `,
            actorIds
          )
        ]);

        const actorNameMap = new Map();
        (Array.isArray(employeeRows) ? employeeRows : []).forEach((row) => {
          const id = String(row?.actor_id || '').trim();
          const name = String(row?.actor_name || '').trim();
          if (id && name) {
            actorNameMap.set(id, name);
          }
        });
        (Array.isArray(userRows) ? userRows : []).forEach((row) => {
          const id = String(row?.actor_id || '').trim();
          const name = String(row?.actor_name || '').trim();
          if (id && name) {
            actorNameMap.set(id, name);
          }
        });
        (Array.isArray(doctorRows) ? doctorRows : []).forEach((row) => {
          const id = String(row?.actor_id || '').trim();
          const name = String(row?.actor_name || '').trim();
          if (id && name) {
            actorNameMap.set(id, name);
          }
        });

        result.data = result.data.map((entry) => {
          const actorId = String(entry?.actor_id || '').trim();
          const resolvedName = actorId ? actorNameMap.get(actorId) : '';
          const currentName = String(entry?.actor_name || '').trim();

          return {
            ...entry,
            actor_name:
              resolvedName && (!currentName || currentName === actorId)
                ? resolvedName
                : entry.actor_name
          };
        });
      }
    }

    res.json(result);
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    console.error('Audit history error:', error);
    res.status(statusCode).json({
      success: false,
      error: error.message || 'Gagal mengambil riwayat audit'
    });
  }
});

app.get('/api/laboratory-data/access/:username', async (req, res) => {
  try {
    const result = await DiagnosticAccessService.getAccessInfo('laboratorium', req.params.username);
    res.json(result);
  } catch (error) {
    console.error('Laboratory access error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Gagal memeriksa akses laboratorium'
    });
  }
});

app.get('/api/radiology-data/access/:username', async (req, res) => {
  try {
    const result = await DiagnosticAccessService.getAccessInfo('radiologi', req.params.username);
    res.json(result);
  } catch (error) {
    console.error('Radiology access error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Gagal memeriksa akses radiologi'
    });
  }
});

// Register clinical pathway routes early to avoid conflicts
console.log('🏥 Registering clinical-pathway routes at /api/clinical-pathway');
app.use('/api/clinical-pathway', clinicalPathwayRoutes);
console.log('✅ Clinical-pathway routes registered successfully');

// Save Examination endpoints
app.post('/api/save-examination', async (req, res) => {
  try {
    const examinationData = req.body;
    // #region debug-point A:save-exam-route-entry
    reportSaveExaminationDebug('A', 'backend/index.js:/api/save-examination', '[DEBUG] save examination route hit', {
      method: req.method,
      hasBody: !!req.body,
      bodyKeys: Object.keys(req.body || {}),
      no_rawat: examinationData?.no_rawat || null,
      status_rawat: examinationData?.status_rawat || null,
      spo2: examinationData?.spo2 ?? null,
      tgl_perawatan: examinationData?.tgl_perawatan || null,
      jam_rawat: examinationData?.jam_rawat || null,
      nip: examinationData?.nip || null
    });
    // #endregion
    
    const result = await SaveExaminationService.saveExamination(examinationData);
    await auditCrudSuccess(req, 'examination', result?.data?.action || 'create', result);
    // #region debug-point A:save-exam-route-success
    reportSaveExaminationDebug('A', 'backend/index.js:/api/save-examination', '[DEBUG] save examination route success', {
      success: result?.success ?? null,
      table: result?.table || null,
      action: result?.data?.action || null
    });
    // #endregion
    res.json(result);
  } catch (error) {
    await auditCrudFailure(req, 'examination', 'upsert', error);
    // #region debug-point D:save-exam-route-error
    reportSaveExaminationDebug('D', 'backend/index.js:/api/save-examination', '[DEBUG] save examination route error', {
      name: error?.name || 'Error',
      message: error?.message || 'Unknown error',
      stack: error?.stack || null
    });
    // #endregion
    console.error('Save examination error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/triase-igd/master', async (_req, res) => {
  try {
    const result = await TriageIgdService.getMasterOptions();
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching triase IGD master:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Gagal mengambil master triase IGD'
    });
  }
});

app.get('/api/triase-igd/:no_rawat', async (req, res) => {
  try {
    const result = await TriageIgdService.getTriageByNoRawat(req.params.no_rawat);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching triase IGD detail:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Gagal mengambil detail triase IGD'
    });
  }
});

app.post('/api/triase-igd', async (req, res) => {
  try {
    const result = await TriageIgdService.saveTriage(req.body || {});
    await auditCrudSuccess(req, 'triase_igd', 'upsert', result);
    res.json(result);
  } catch (error) {
    await auditCrudFailure(req, 'triase_igd', 'upsert', error);
    console.error('Error saving triase IGD:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Gagal menyimpan triase IGD'
    });
  }
});

app.get('/api/examination/:no_rawat/:tgl_perawatan/:status_rawat', async (req, res) => {
  try {
    const { no_rawat, tgl_perawatan, status_rawat } = req.params;
    
    if (!no_rawat || !tgl_perawatan || !status_rawat) {
      return res.status(400).json({
        success: false,
        error: 'no_rawat, tgl_perawatan, and status_rawat are required'
      });
    }

    const result = await SaveExaminationService.getExamination(no_rawat, tgl_perawatan, status_rawat);
    res.json(result);
  } catch (error) {
    console.error('Get examination error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/examination-history/:no_rawat/:status_rawat', async (req, res) => {
  try {
    const { no_rawat, status_rawat } = req.params;
    const { limit = 10 } = req.query;
    
    if (!no_rawat || !status_rawat) {
      return res.status(400).json({
        success: false,
        error: 'no_rawat and status_rawat are required'
      });
    }

    const result = await SaveExaminationService.getExaminationHistory(no_rawat, status_rawat, parseInt(limit));
    res.json(result);
  } catch (error) {
    console.error('Get examination history error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.delete('/api/examination/:no_rawat/:tgl_perawatan/:jam_rawat/:status_rawat', async (req, res) => {
  try {
    const { no_rawat, tgl_perawatan, jam_rawat, status_rawat } = req.params;
    
    if (!no_rawat || !tgl_perawatan || !jam_rawat || !status_rawat) {
      return res.status(400).json({
        success: false,
        error: 'no_rawat, tgl_perawatan, jam_rawat, and status_rawat are required'
      });
    }

    const result = await SaveExaminationService.deleteExamination(no_rawat, tgl_perawatan, jam_rawat, status_rawat);
    await auditCrudSuccess(req, 'examination', 'delete', result, { no_rawat, reference_id: no_rawat });
    res.json(result);
  } catch (error) {
    await auditCrudFailure(req, 'examination', 'delete', error, { no_rawat: req.params.no_rawat, reference_id: req.params.no_rawat });
    console.error('Delete examination error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'API test endpoint working',
    port: PORT
  });
});

// Login endpoint (simplified)
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  // Simple validation
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: 'Username and password are required'
    });
  }
  
  try {
    // Use real database authentication
    const user = await AuthService.authenticateUser(username, password);
    
    // Generate token (in production, use JWT)
    const token = `backend_token_${Date.now()}_${username}`;
    
    res.json({
      success: true,
      message: 'Login successful',
      user: user,
      token: token,
      otp_required_by_server: WhatsappOtpService.isOtpLoginRequired()
    });
    
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(401).json({
      success: false,
      error: error.message
    });
  }
});

// WhatsApp OTP Service imported at top

// WhatsApp OTP endpoints
app.post('/api/auth/send-otp', async (req, res) => {
  const { phoneNumber, username } = req.body;
  
  if (!phoneNumber || !username) {
    return res.status(400).json({
      success: false,
      error: 'Phone number and username are required'
    });
  }
  
  try {
    const result = await WhatsappOtpService.sendOTP(phoneNumber, username);
    res.json(result);
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send OTP',
      details: error.message
    });
  }
});

app.post('/api/auth/verify-otp', async (req, res) => {
  const { phoneNumber, username, otp } = req.body;
  
  if (!phoneNumber || !username || !otp) {
    return res.status(400).json({
      success: false,
      error: 'Phone number, username, and OTP are required'
    });
  }
  
  try {
    const result = await WhatsappOtpService.verifyOTP(phoneNumber, username, otp);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify OTP',
      details: error.message
    });
  }
});

app.post('/api/auth/change-password', async (req, res) => {
  const { username, currentPassword, newPassword } = req.body;

  if (!username || !currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      error: 'Username, password lama, dan password baru wajib diisi'
    });
  }

  try {
    const result = await AuthService.changePassword(username, currentPassword, newPassword);
    await auditCrudSuccess(req, 'auth_password', 'update', result, { reference_id: username });
    res.json(result);
  } catch (error) {
    await auditCrudFailure(req, 'auth_password', 'update', error, { reference_id: username });
    console.error('Change password error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Gagal mengubah password'
    });
  }
});

// Dashboard data endpoint
app.post('/api/dashboard-data', async (req, res) => {
  const { username, kd_poli } = req.body;
  
  // Simple validation
  if (!username) {
    return res.status(400).json({
      success: false,
      error: 'Username is required'
    });
  }
  
  try {
    console.log('Dashboard data request:', { username, kd_poli });
    
    // Get dashboard data from database
    const dashboardData = await DashboardService.getDashboardData(username, kd_poli);
    
    res.json(dashboardData);
    
  } catch (error) {
    console.error('Dashboard data error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve dashboard data'
    });
  }
});

// Attendance data endpoint
app.post('/api/attendance-data', async (req, res) => {
  try {
    const { username, action, date, limit = 30, selectedShift, month } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: 'username (nik pegawai) is required' });
    }
    
    if (!action) {
      return res.status(400).json({ error: 'action is required' });
    }
    
    const result = await AttendanceService.getAttendanceData(username, action, {
      date,
      limit,
      selectedShift,
      month
    });
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Attendance data error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to process attendance request' 
    });
  }
});

// Booking operasi data endpoint
app.post('/api/booking-operasi-data', async (req, res) => {
  const { page, itemsPerPage, search, startDate, endDate, status } = req.body;
  
  try {
    const result = await BookingOperasiService.getBookingOperasiData({
      page,
      itemsPerPage,
      search,
      startDate,
      endDate,
      status
    });
    
    res.json(result);
  } catch (error) {
    console.error('Booking operasi data error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Booking Registrasi endpoint
app.post('/api/booking-registrasi', async (req, res) => {
  try {
    const { action, startDate, endDate, status, kd_dokter, sessionFilter, no_rkm_medis, tanggal_periksa, data, page, itemsPerPage } = req.body;
    
    let result;
    
    switch (action) {
      case 'getDoctors':
        result = await BookingRegistrasiService.getDoctors();
        break;
        
      case 'getAll':
        result = await BookingRegistrasiService.getAll({
          startDate,
          endDate,
          status,
          kd_dokter,
          sessionFilter,
          page,
          itemsPerPage
        });
        break;
        
      case 'getById':
        result = await BookingRegistrasiService.getById(no_rkm_medis, tanggal_periksa);
        break;
        
      case 'create':
        result = await BookingRegistrasiService.create(data);
        break;
        
      case 'update':
        result = await BookingRegistrasiService.update(no_rkm_medis, tanggal_periksa, data);
        break;
        
      default:
        return res.status(400).json({ success: false, error: 'Invalid action' });
    }
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error in booking-registrasi endpoint:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Rawat Jalan Patients endpoint
app.post('/api/rawat-jalan-patients', async (req, res) => {
  try {
    const result = await RawatJalanPatientsService.getRawatJalanPatients(req.body);
    res.json(result);
  } catch (error) {
    console.error('Rawat jalan patients error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rawat Inap Data endpoint
app.post('/api/rawat-inap-data', async (req, res) => {
  try {
    const result = await RawatInapDataService.getRawatInapData(req.body);
    res.json(result);
  } catch (error) {
    console.error('Rawat inap data error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rawat inap data'
    });
  }
});

// Hemodialisa Data endpoint
app.post('/api/hemodialisa-data', async (req, res) => {
  try {
    const result = await HemodialisaDataService.getHemodialisaData(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error in hemodialisa-data endpoint:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/api/depo-farmasi', async (req, res) => {
  try {
    const result = await DepoFarmasiService.getData({
      search: req.query.search
    });
    res.json(result);
  } catch (error) {
    console.error('Error in depo-farmasi endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch depo farmasi data'
    });
  }
});

// Get Medical Record endpoint
app.post('/api/get-medical-record', async (req, res) => {
  try {
    const {
      no_rm,
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
      focus_no_rawat
    } = req.body;

    const result = await GetMedicalRecordService.getMedicalRecord(no_rm, {
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
      focusNoRawat: focus_no_rawat
    });

    res.json(result);
  } catch (error) {
    console.error('Error in get-medical-record endpoint:', error);
    res.status(500).json({ 
      error: error.message 
    });
  }
});

app.post('/api/get-medical-record-visit-details', async (req, res) => {
  try {
    const { no_rawat } = req.body;
    const data = await GetMedicalRecordService.getVisitDetails(no_rawat);
    res.json({ data });
  } catch (error) {
    console.error('Error in get-medical-record-visit-details endpoint:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

app.post('/api/get-medical-record-examinations', async (req, res) => {
  try {
    const {
      no_rm,
      limit,
      outpatientPage,
      inpatientPage,
      includeOutpatient,
      includeInpatient,
      focus_no_rawat
    } = req.body;

    const result = await GetMedicalRecordService.getExaminationHistory(no_rm, {
      limit,
      outpatientPage,
      inpatientPage,
      includeOutpatient,
      includeInpatient,
      focusNoRawat: focus_no_rawat
    });

    res.json(result);
  } catch (error) {
    console.error('Error in get-medical-record-examinations endpoint:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

app.get('/api/search-medical-record-patients', async (req, res) => {
  try {
    const { q = '', page = 1, limit = 20 } = req.query;
    const normalizedQuery = String(q || '').trim();

    if (normalizedQuery.length < 2) {
      return res.status(400).json({
        error: 'Parameter q minimal 2 karakter'
      });
    }

    const result = await MedicalService.searchMedicalRecordPatients(
      normalizedQuery,
      Number(page),
      Number(limit)
    );

    res.json(result);
  } catch (error) {
    console.error('Error in search-medical-record-patients endpoint:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

app.get('/api/pacs/rendered/:instanceId', async (req, res) => {
  try {
    const { instanceId } = req.params;
    const { width } = req.query;
    const imageResult = await GetMedicalRecordService.getOrthancRenderedImage(instanceId, width);

    res.setHeader('Content-Type', imageResult.contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.send(imageResult.buffer);
  } catch (error) {
    console.error('Error proxying PACS rendered image:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Gagal memuat gambar PACS'
    });
  }
});

app.get('/api/pacs/preview/:instanceId', async (req, res) => {
  try {
    const { instanceId } = req.params;
    const { width } = req.query;
    const imageResult = await GetMedicalRecordService.getOrthancPreviewImage(instanceId, width);

    res.setHeader('Content-Type', imageResult.contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.send(imageResult.buffer);
  } catch (error) {
    console.error('Error proxying PACS preview image:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Gagal memuat preview PACS'
    });
  }
});

app.get('/api/pacs/radiology-images', async (req, res) => {
  try {
    const noRawat = String(req.query.no_rawat || '').trim();
    const examDate = String(req.query.exam_date || '').trim();
    const examName = String(req.query.exam_name || '').trim();
    const mode = String(req.query.mode || 'summary').trim().toLowerCase() === 'full' ? 'full' : 'summary';

    if (!noRawat || !examDate) {
      return res.status(400).json({
        success: false,
        error: 'Parameter no_rawat dan exam_date wajib diisi'
      });
    }

    const pacsResult = await GetMedicalRecordService.getRadiologyPacsImages(noRawat, examDate, examName, {
      mode
    });

    res.json({
      success: true,
      ...pacsResult
    });
  } catch (error) {
    console.error('Error fetching PACS radiology images:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Gagal memuat gambar PACS radiologi'
    });
  }
});

app.get('/api/operation-reports/:no_rawat', async (req, res) => {
  try {
    const { no_rawat } = req.params;
    const result = await OperationReportService.getReports(no_rawat);
    res.json(result);
  } catch (error) {
    console.error('Error getting operation reports:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Gagal memuat laporan operasi'
    });
  }
});

app.post('/api/operation-reports', async (req, res) => {
  try {
    const result = await OperationReportService.createReport(req.body);
    await auditCrudSuccess(req, 'operation_report', 'create', result);
    res.json(result);
  } catch (error) {
    await auditCrudFailure(req, 'operation_report', 'create', error);
    console.error('Error creating operation report:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Gagal menambahkan laporan operasi'
    });
  }
});

app.put('/api/operation-reports', async (req, res) => {
  try {
    const result = await OperationReportService.updateReport(req.body);
    await auditCrudSuccess(req, 'operation_report', 'update', result);
    res.json(result);
  } catch (error) {
    await auditCrudFailure(req, 'operation_report', 'update', error);
    console.error('Error updating operation report:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Gagal memperbarui laporan operasi'
    });
  }
});

app.delete('/api/operation-reports', async (req, res) => {
  try {
    const result = await OperationReportService.deleteReport(req.body);
    await auditCrudSuccess(req, 'operation_report', 'delete', result);
    res.json(result);
  } catch (error) {
    await auditCrudFailure(req, 'operation_report', 'delete', error);
    console.error('Error deleting operation report:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Gagal menghapus laporan operasi'
    });
  }
});

app.get('/api/operation-reports/:no_rawat/files', async (req, res) => {
  try {
    const { no_rawat } = req.params;
    const kdDokter = String(req.query.username || req.query.kd_dokter || '').trim();
    const result = await OperationReportService.getDigitalFiles(no_rawat, kdDokter);
    res.json(result);
  } catch (error) {
    console.error('Error getting operation report digital files:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Gagal memuat berkas digital laporan operasi'
    });
  }
});

app.post('/api/operation-reports/files/upload', handleDigitalFilesUpload, async (req, res) => {
  try {
    const uploadedFiles = [
      ...((req.files && Array.isArray(req.files.file)) ? req.files.file : []),
      ...((req.files && Array.isArray(req.files.files)) ? req.files.files : [])
    ];
    const { no_rawat } = req.body || {};

    const result = await OperationReportService.uploadDigitalFiles({
      noRawat: no_rawat,
      files: uploadedFiles
    });

    res.status(result.success ? 200 : 207).json(result);
  } catch (error) {
    console.error('Error uploading operation report digital files:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Gagal upload berkas digital laporan operasi'
    });
  }
});

app.delete('/api/operation-reports/files', async (req, res) => {
  try {
    const {
      no_rawat,
      lokasi_file,
      username,
      kd_dokter
    } = req.body || {};

    const result = await OperationReportService.deleteDigitalFile({
      noRawat: no_rawat,
      lokasiFile: lokasi_file,
      kdDokter: username || kd_dokter
    });

    res.json(result);
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    console.error('Error deleting operation report digital file:', error);
    res.status(statusCode).json({
      success: false,
      error: error.message || 'Gagal menghapus berkas digital laporan operasi'
    });
  }
});

app.get('/api/assesmen-rehab-medik/access/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const result = await AssesmenRehabMedikService.getAccessInfo(username);
    res.json(result);
  } catch (error) {
    console.error('Error in assesmen-rehab-medik access endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/assesmen-rehab-medik/:no_rawat', async (req, res) => {
  try {
    const { no_rawat } = req.params;
    const username = String(req.query.username || '').trim();
    const result = await AssesmenRehabMedikService.getAssessmentData(no_rawat, username);
    res.json(result);
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 400;
    console.error('Error in assesmen-rehab-medik GET endpoint:', error);
    res.status(statusCode).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/assesmen-rehab-medik', async (req, res) => {
  try {
    const result = await AssesmenRehabMedikService.saveAssessment(req.body);
    await auditCrudSuccess(
      req,
      'assesmen_rehab_medik',
      String(result?.message || '').toLowerCase().includes('diperbarui') ? 'update' : 'create',
      result
    );
    res.json(result);
  } catch (error) {
    await auditCrudFailure(req, 'assesmen_rehab_medik', 'upsert', error);
    const statusCode = Number(error?.statusCode) || 400;
    console.error('Error in assesmen-rehab-medik POST endpoint:', error);
    res.status(statusCode).json({
      success: false,
      error: error.message
    });
  }
});

app.delete('/api/assesmen-rehab-medik/:no_rawat', async (req, res) => {
  try {
    const { no_rawat } = req.params;
    const username = String(req.query.username || '').trim();
    const result = await AssesmenRehabMedikService.deleteAssessment(no_rawat, username);
    await auditCrudSuccess(req, 'assesmen_rehab_medik', 'delete', result, { no_rawat, reference_id: no_rawat });
    res.json(result);
  } catch (error) {
    await auditCrudFailure(req, 'assesmen_rehab_medik', 'delete', error, { no_rawat: req.params.no_rawat, reference_id: req.params.no_rawat });
    const statusCode = Number(error?.statusCode) || 400;
    console.error('Error in assesmen-rehab-medik DELETE endpoint:', error);
    res.status(statusCode).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/patient-notes/:no_rawat', async (req, res) => {
  try {
    const { no_rawat } = req.params;

    if (!no_rawat) {
      return res.status(400).json({
        success: false,
        error: 'no_rawat wajib diisi'
      });
    }

    const result = await PatientNotesService.getNotes(no_rawat);
    res.json(result);
  } catch (error) {
    console.error('Error in patient-notes GET endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/patient-notes-history/:no_rkm_medis', async (req, res) => {
  try {
    const { no_rkm_medis } = req.params;
    const { exclude_no_rawat = '' } = req.query;

    if (!no_rkm_medis) {
      return res.status(400).json({
        success: false,
        error: 'no_rkm_medis wajib diisi'
      });
    }

    const result = await PatientNotesService.getPreviousVisitNotes(no_rkm_medis, exclude_no_rawat);
    res.json(result);
  } catch (error) {
    console.error('Error in patient-notes-history GET endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/patient-notes', async (req, res) => {
  try {
    const result = await PatientNotesService.createNote(req.body);
    await auditCrudSuccess(req, 'patient_note', 'create', result);
    res.json(result);
  } catch (error) {
    await auditCrudFailure(req, 'patient_note', 'create', error);
    console.error('Error in patient-notes POST endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.put('/api/patient-notes', async (req, res) => {
  try {
    const result = await PatientNotesService.updateNote(req.body);
    await auditCrudSuccess(req, 'patient_note', 'update', result);
    res.json(result);
  } catch (error) {
    await auditCrudFailure(req, 'patient_note', 'update', error);
    console.error('Error in patient-notes PUT endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.delete('/api/patient-notes', async (req, res) => {
  try {
    const result = await PatientNotesService.deleteNote(req.body);
    await auditCrudSuccess(req, 'patient_note', 'delete', result);
    res.json(result);
  } catch (error) {
    await auditCrudFailure(req, 'patient_note', 'delete', error);
    console.error('Error in patient-notes DELETE endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.put('/api/patient-contact', async (req, res) => {
  try {
    const result = await PatientContactService.updatePatientWhatsapp(req.body);
    await auditCrudSuccess(req, 'patient_contact', 'update', result);
    res.json(result);
  } catch (error) {
    await auditCrudFailure(req, 'patient_contact', 'update', error);
    console.error('Error in patient-contact PUT endpoint:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/patient-contact/message', async (req, res) => {
  try {
    const result = await PatientContactService.sendWhatsappMessage(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error in patient-contact message POST endpoint:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/balance-cairan/:no_rawat', async (req, res) => {
  try {
    const result = await BalanceCairanService.listByNoRawat(req.params.no_rawat);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error in balance-cairan GET endpoint:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/balance-cairan', async (req, res) => {
  try {
    const result = await BalanceCairanService.createOuttake(req.body);
    await auditCrudSuccess(req, 'balance_cairan', 'create', result);
    res.json(result);
  } catch (error) {
    await auditCrudFailure(req, 'balance_cairan', 'create', error);
    console.error('Error in balance-cairan POST endpoint:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/ventilator/:no_rawat', async (req, res) => {
  try {
    const result = await VentilatorService.listByNoRawat(req.params.no_rawat);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error in ventilator GET endpoint:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/ekstrapiramidal', async (req, res) => {
  try {
    const result = await EkstrapiramidalService.save(req.body);
    await auditCrudSuccess(req, 'ekstrapiramidal', 'upsert', result);
    res.json(result);
  } catch (error) {
    await auditCrudFailure(req, 'ekstrapiramidal', 'upsert', error);
    console.error('Error in ekstrapiramidal POST endpoint:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/echocardiography/:no_rawat', async (req, res) => {
  try {
    const { no_rawat } = req.params;
    const username = String(req.query.username || '').trim();
    DiagnosticAccessService.ensureAccess('echocardiography', username);
    const data = await EchoCardiographyService.list(no_rawat);
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error in echocardiography GET endpoint:', error);
    res.status(error.statusCode || 400).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/echocardiography', async (req, res) => {
  try {
    const username = String(req.body?.username || req.body?.kd_dokter || '').trim();
    DiagnosticAccessService.ensureAccess('echocardiography', username);
    const result = await EchoCardiographyService.save(req.body);
    await auditCrudSuccess(req, 'echocardiography', 'upsert', result);
    res.json(result);
  } catch (error) {
    await auditCrudFailure(req, 'echocardiography', 'upsert', error);
    console.error('Error in echocardiography POST endpoint:', error);
    res.status(error.statusCode || 400).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/echocardiography/access/:username', async (req, res) => {
  try {
    const username = String(req.params.username || '').trim();
    const result = await DiagnosticAccessService.getAccessInfo('echocardiography', username);
    res.json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/internal-referrals/doctors', async (req, res) => {
  try {
    const kd_poli = String(req.query.kd_poli || '').trim();
    const date = String(req.query.date || '').trim();
    const result = await InternalReferralService.getDoctorsBySchedule({ kd_poli, date });
    res.json(result);
  } catch (error) {
    console.error('Error in internal-referrals doctors endpoint:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/internal-referrals/:no_rawat', async (req, res) => {
  try {
    const { no_rawat } = req.params;

    if (!no_rawat) {
      return res.status(400).json({
        success: false,
        error: 'no_rawat wajib diisi'
      });
    }

    const result = await InternalReferralService.getReferrals(no_rawat);
    res.json(result);
  } catch (error) {
    console.error('Error in internal-referrals GET endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/internal-referrals', async (req, res) => {
  try {
    const result = await InternalReferralService.createReferral(req.body);
    await auditCrudSuccess(req, 'internal_referral', 'create', result);
    res.json(result);
  } catch (error) {
    await auditCrudFailure(req, 'internal_referral', 'create', error);
    console.error('Error in internal-referrals POST endpoint:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

app.put('/api/internal-referrals', async (req, res) => {
  try {
    const result = await InternalReferralService.updateReferral(req.body);
    await auditCrudSuccess(req, 'internal_referral', 'update', result);
    res.json(result);
  } catch (error) {
    await auditCrudFailure(req, 'internal_referral', 'update', error);
    console.error('Error in internal-referrals PUT endpoint:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

app.delete('/api/internal-referrals', async (req, res) => {
  try {
    const result = await InternalReferralService.deleteReferral(req.body);
    await auditCrudSuccess(req, 'internal_referral', 'delete', result);
    res.json(result);
  } catch (error) {
    await auditCrudFailure(req, 'internal_referral', 'delete', error);
    console.error('Error in internal-referrals DELETE endpoint:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/procedure-options', async (req, res) => {
  try {
    const { no_rawat, search = '', limit = 20, status_rawat } = req.query;

    if (!no_rawat) {
      return res.status(400).json({
        success: false,
        error: 'no_rawat wajib diisi'
      });
    }

    const result = await ProcedureService.searchProcedureOptions(
      no_rawat,
      String(search || ''),
      Number(limit),
      status_rawat
    );

    res.json(result);
  } catch (error) {
    console.error('Error in procedure-options endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/save-procedures', async (req, res) => {
  try {
    const result = await ProcedureService.saveProcedures(req.body);
    await auditCrudSuccess(req, 'procedure', 'create', result);
    res.json(result);
  } catch (error) {
    await auditCrudFailure(req, 'procedure', 'create', error);
    console.error('Error in save-procedures endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/delete-procedure', async (req, res) => {
  try {
    const result = await ProcedureService.deleteProcedure(req.body);
    await auditCrudSuccess(req, 'procedure', 'delete', result);
    res.json(result);
  } catch (error) {
    await auditCrudFailure(req, 'procedure', 'delete', error);
    console.error('Error in delete-procedure endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete examination endpoint
app.post('/api/delete-examination', async (req, res) => {
  try {
    const { no_rawat, status_rawat, tgl_perawatan, jam_rawat, username } = req.body;
    const data = await DeleteExaminationService.deleteExamination(no_rawat, status_rawat, tgl_perawatan, jam_rawat, username);
    await auditCrudSuccess(req, 'examination', 'delete', data);
    res.json(data);
  } catch (error) {
    await auditCrudFailure(req, 'examination', 'delete', error);
    console.error('Delete examination error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ICD data endpoint
app.post('/api/icd-data', async (req, res) => {
  try {
    const { page, itemsPerPage, search, icdType, relatedIcdCode, relatedIcdType } = req.body;
    const data = await IcdDataService.getIcdData(page, itemsPerPage, search, icdType, relatedIcdCode, relatedIcdType);
    res.json(data);
  } catch (error) {
    console.error('ICD data error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/icd-management/history/:no_rkm_medis', async (req, res) => {
  try {
    const data = await IcdDataService.getPreviousVisitIcdData(
      req.params.no_rkm_medis,
      req.query.exclude_no_rawat,
      req.query.status_layanan
    );
    res.json(data);
  } catch (error) {
    console.error('ICD management history load error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/icd-management/:no_rawat', async (req, res) => {
  try {
    const data = await IcdDataService.getPatientIcdData(req.params.no_rawat, req.query.status_layanan);
    res.json(data);
  } catch (error) {
    console.error('ICD management load error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/icd-management', async (req, res) => {
  try {
    const data = await IcdDataService.savePatientIcdData(req.body);
    await auditCrudSuccess(req, 'icd_management', 'upsert', data);
    res.json(data);
  } catch (error) {
    await auditCrudFailure(req, 'icd_management', 'upsert', error);
    console.error('ICD management save error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/icd-management', async (req, res) => {
  try {
    const data = await IcdDataService.deletePatientIcdItem(req.body);
    await auditCrudSuccess(req, 'icd_management', 'delete', data);
    res.json(data);
  } catch (error) {
    await auditCrudFailure(req, 'icd_management', 'delete', error);
    console.error('ICD management delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/inacbg-simulation/:no_rawat/defaults', async (req, res) => {
  try {
    const data = await InacbgSimulationService.getDefaults(req.params.no_rawat);
    res.json({ success: true, data });
  } catch (error) {
    console.error('INACBG defaults error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/inacbg-simulation/defaults', async (_req, res) => {
  try {
    const data = await InacbgSimulationService.getDefaults('');
    res.json({ success: true, data });
  } catch (error) {
    console.error('INACBG global defaults error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/inacbg-simulation/search', async (req, res) => {
  try {
    const data = await InacbgSimulationService.searchCodes(req.query.q, req.query.type);
    res.json(data);
  } catch (error) {
    console.error('INACBG search error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/inacbg-simulation/code-info', async (req, res) => {
  try {
    const data = await InacbgSimulationService.getCodeInfo(req.query.code, req.query.type);
    res.json(data);
  } catch (error) {
    console.error('INACBG code info error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/inacbg-simulation/api-call', async (req, res) => {
  try {
    const { method, data, nomor_sep } = req.body;
    const result = await InacbgSimulationService.apiCall(method, data, nomor_sep);
    res.json(result);
  } catch (error) {
    console.error('INACBG api_call error:', error);
    res.status(500).json({ error: error.message });
  }
});

// IGD Data endpoint
app.get('/api/igd-data', async (req, res) => {
  try {
    const { 
      page = 1, 
      itemsPerPage = 10, 
      search = '', 
      status = '', 
      kd_dokter = '',
      triase_level = '', 
      date_from = '', 
      date_to = '', 
      tab = 'triase' 
    } = req.query;
    
    const result = await IgdDataService.getIgdData(
      page, 
      itemsPerPage, 
      search, 
      status, 
      kd_dokter,
      triase_level, 
      date_from, 
      date_to, 
      tab
    );
    res.json(result);
  } catch (error) {
    console.error('Error fetching IGD data:', error);
    res.status(500).json({ error: 'Failed to fetch IGD data' });
  }
});

// Laboratory Data endpoints
app.get('/api/laboratory-data', async (req, res) => {
  try {
    const { action, no_rawat, noorder, kd_jenis_prw, username = '', search = '' } = req.query;
    const restrictedLabActions = new Set(['get_daily_patients', 'get_patient_detail']);
    if (restrictedLabActions.has(String(action || '').trim())) {
      DiagnosticAccessService.ensureAccess('laboratorium', username);
    }
    
    let result;
    
    switch (action) {
      case 'get_lab_requests':
        if (!no_rawat) {
          return res.status(400).json({ error: 'no_rawat is required' });
        }
        result = await LaboratoryDataService.getLabRequests(no_rawat);
        break;
        
      case 'get_lab_request_details':
        if (!noorder) {
          return res.status(400).json({ error: 'noorder is required' });
        }
        result = await LaboratoryDataService.getLabRequestDetails(noorder);
        break;
        
      case 'get_lab_services':
        result = await LaboratoryDataService.getLabServices(search);
        break;
        
      case 'get_lab_templates':
        if (!kd_jenis_prw) {
          return res.status(400).json({ error: 'kd_jenis_prw is required' });
        }
        result = await LaboratoryDataService.getLabTemplates(kd_jenis_prw);
        break;

      case 'get_daily_patients':
        result = await LaboratoryDataService.getDailyLabPatients({
          page: req.query.page,
          itemsPerPage: req.query.itemsPerPage,
          search: req.query.search,
          date: req.query.date,
          startDate: req.query.startDate,
          endDate: req.query.endDate
        });
        break;

      case 'get_patient_detail':
        if (!no_rawat) {
          return res.status(400).json({ error: 'no_rawat is required' });
        }
        result = await LaboratoryDataService.getLabPatientDetail(no_rawat);
        break;
        
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
    
    res.json(result);
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    console.error('Laboratory data error:', error);
    res.status(statusCode).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/laboratory-data', async (req, res) => {
  try {
    const { action } = req.query;
    const { no_rawat, dokter_perujuk, examinations, details, noorder, status_rawat, username, klinis, request_date, request_time, review_date, review_time } = req.body;
    if (String(action || '').trim() === 'save_lab_review') {
      DiagnosticAccessService.ensureAccess('laboratorium', username);
    }
    
    let result;
    
    switch (action) {
      case 'create_lab_request':
        if (!no_rawat || !dokter_perujuk) {
          return res.status(400).json({ error: 'no_rawat and dokter_perujuk are required' });
        }
        result = await LaboratoryDataService.createLabRequest(
          no_rawat,
          dokter_perujuk,
          examinations,
          details,
          status_rawat,
          klinis,
          request_date,
          request_time
        );
        break;
        
      case 'update_lab_request':
        if (!noorder) {
          return res.status(400).json({ error: 'noorder is required' });
        }
        result = await LaboratoryDataService.updateLabRequest(noorder, examinations, details, status_rawat, username, klinis);
        break;

      case 'save_lab_review':
        if (!no_rawat) {
          return res.status(400).json({ error: 'no_rawat is required' });
        }
        result = await LaboratoryDataService.saveLabReview(
          no_rawat,
          req.body?.kesan,
          req.body?.saran,
          review_date,
          review_time
        );
        break;
        
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
    if (action === 'save_lab_review') {
      await auditCrudSuccess(req, 'laboratory_review', 'create', result, { reference_id: no_rawat });
    } else {
      await auditCrudSuccess(req, 'laboratory_request', action === 'update_lab_request' ? 'update' : 'create', result);
    }
    res.json(result);
  } catch (error) {
    const action = String(req.query?.action || '').trim();
    if (action === 'save_lab_review') {
      await auditCrudFailure(req, 'laboratory_review', 'create', error, { reference_id: req.body?.no_rawat });
    } else {
      const auditAction = action === 'update_lab_request' ? 'update' : 'create';
      await auditCrudFailure(req, 'laboratory_request', auditAction, error);
    }
    const statusCode = Number(error?.statusCode) || 500;
    console.error('Laboratory data error:', error);
    res.status(statusCode).json({
      success: false,
      error: error.message
    });
  }
});

app.delete('/api/laboratory-data', async (req, res) => {
  try {
    const { action, noorder, username } = req.query;
    
    if (action === 'delete_lab_request') {
      if (!noorder) {
        return res.status(400).json({ error: 'noorder is required' });
      }
      
      const result = await LaboratoryDataService.deleteLabRequest(noorder, username);
      await auditCrudSuccess(req, 'laboratory_request', 'delete', result, { reference_id: noorder });
      res.json(result);
    } else {
      res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    await auditCrudFailure(req, 'laboratory_request', 'delete', error, { reference_id: req.query?.noorder });
    const statusCode = Number(error?.statusCode) || 500;
    console.error('Laboratory data error:', error);
    res.status(statusCode).json({
      success: false,
      error: error.message
    });
  }
});

// Medical Scribe endpoint
app.get('/api/doctor-ai-assistant/logs', async (req, res) => {
  try {
    const { page = '1', limit = '50', username = '', status = '', search = '' } = req.query;
    const result = await DoctorAiAssistantService.getAiAssistantLogs({
      page,
      limit,
      username,
      status,
      search
    });

    res.json(result);
  } catch (error) {
    console.error('Doctor AI assistant logs error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Gagal memuat log AI assistant'
    });
  }
});

// Medical Scribe endpoint
app.post('/api/doctor-ai-assistant', async (req, res) => {
  try {
    const { message, username, doctorName, conversationHistory } = req.body;

    if (!message || !username) {
      return res.status(400).json({
        success: false,
        error: 'message and username are required'
      });
    }

    const result = await DoctorAiAssistantService.ask({
      message,
      username,
      doctorName,
      conversationHistory,
      requestMeta: {
        ipAddress: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '',
        userAgent: req.headers['user-agent'] || ''
      }
    });

    res.json(result);
  } catch (error) {
    console.error('Doctor AI assistant error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Gagal memproses AI assistant'
    });
  }
});

// Medical Scribe endpoint
app.post('/api/medical-scribe', async (req, res) => {
  try {
    const { text, no_rkm_medis, patient_name } = req.body;
    
    if (!text || !no_rkm_medis || !patient_name) {
      return res.status(400).json({ 
        error: 'Missing required parameters: text, no_rkm_medis, and patient_name are required' 
      });
    }
    
    const result = await MedicalScribeService.generateMedicalSuggestion(text, no_rkm_medis, patient_name);
    
    res.json(result);
  } catch (error) {
    console.error('Medical scribe error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/voice-to-soap', async (req, res) => {
  try {
    const { transcript, context } = req.body || {};
    const data = await VoiceToSoapService.generateSoap({ transcript, context });
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Voice-to-SOAP error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Prescription Data endpoints
app.get('/api/prescription-data', async (req, res) => {
  try {
    const { action, no_rawat, no_resep, search, limit, package_id, prescription_status, no_rkm_medis } = req.query;
    
    let result;
    
    switch (action) {
      case 'get_prescriptions':
        if (!no_rawat) {
          return res.status(400).json({
            success: false,
            error: 'no_rawat is required for get_prescriptions'
          });
        }
        result = await PrescriptionDataService.getPrescriptions(no_rawat);
        break;
        
      case 'get_prescription_details':
        if (!no_resep) {
          return res.status(400).json({
            success: false,
            error: 'no_resep is required for get_prescription_details'
          });
        }
        result = await PrescriptionDataService.getPrescriptionDetails(no_resep);
        break;
        
      case 'get_medicines':
        result = await PrescriptionDataService.getMedicines();
        break;

      case 'search_medicines':
        result = await PrescriptionDataService.searchMedicines(search, limit, no_rawat, prescription_status);
        break;

      case 'search_packages':
        result = await PrescriptionDataService.searchPackages(search, limit);
        break;

      case 'get_package_items':
        if (!package_id) {
          return res.status(400).json({
            success: false,
            error: 'package_id is required for get_package_items'
          });
        }
        if (!no_rawat) {
          return res.status(400).json({
            success: false,
            error: 'no_rawat is required for get_package_items'
          });
        }
        result = await PrescriptionDataService.getPackageItems(package_id, no_rawat, prescription_status);
        break;
        
      case 'get_compound_methods':
        result = await PrescriptionDataService.getCompoundMethods();
        break;

      case 'cek_obat_kronis':
        result = await PrescriptionDataService.checkChronicPrescriptionWarning(no_rkm_medis);
        break;
        
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid action. Supported actions: get_prescriptions, get_prescription_details, get_medicines, search_medicines, search_packages, get_package_items, get_compound_methods, cek_obat_kronis'
        });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Prescription data error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/doctor-notifications', async (req, res) => {
  try {
    const { doctorId, limit = 8 } = req.query;

    if (!doctorId) {
      return res.status(400).json({
        success: false,
        error: 'doctorId is required'
      });
    }

    const result = await DoctorNotificationService.getDoctorNotifications(doctorId, limit);
    res.json(result);
  } catch (error) {
    console.error('Doctor notifications error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/doctor-notifications/result', async (req, res) => {
  try {
    const { type, reference_id: referenceId } = req.query;

    if (!type) {
      return res.status(400).json({
        success: false,
        error: 'type is required'
      });
    }

    if (!referenceId) {
      return res.status(400).json({
        success: false,
        error: 'reference_id is required'
      });
    }

    const result = await DoctorNotificationService.getNotificationResult(type, referenceId);
    res.json(result);
  } catch (error) {
    console.error('Doctor notification result error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/allergy-data', async (req, res) => {
  try {
    const { action, no_rkm_medis, category, search, limit } = req.query;

    let result;

    switch (action) {
      case 'list':
        if (!no_rkm_medis) {
          return res.status(400).json({
            success: false,
            error: 'no_rkm_medis is required for list'
          });
        }
        result = await AllergyDataService.listAllergies(no_rkm_medis);
        break;
      case 'search_options':
        if (!category) {
          return res.status(400).json({
            success: false,
            error: 'category is required for search_options'
          });
        }
        result = await AllergyDataService.searchOptions(category, search, limit);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid action. Supported actions: list, search_options'
        });
    }

    res.json(result);
  } catch (error) {
    console.error('Allergy data error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/allergy-data', async (req, res) => {
  try {
    const result = await AllergyDataService.saveAllergy(req.body || {});
    await auditCrudSuccess(req, 'allergy', 'create', result);
    res.json(result);
  } catch (error) {
    await auditCrudFailure(req, 'allergy', 'create', error);
    console.error('Allergy save error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/radiology-data', async (req, res) => {
  try {
    const { action, no_rawat, noorder, username = '' } = req.query;
    const restrictedRadiologyActions = new Set([
      'get_daily_patients',
      'get_patient_detail',
      'get_patient_pacs_detail'
    ]);
    if (restrictedRadiologyActions.has(String(action || '').trim())) {
      DiagnosticAccessService.ensureAccess('radiologi', username);
    }

    let result;

    switch (action) {
      case 'get_radiology_requests':
        if (!no_rawat) {
          return res.status(400).json({ error: 'no_rawat is required' });
        }
        result = await RadiologyDataService.getRadiologyRequests(no_rawat);
        break;

      case 'get_radiology_request_details':
        if (!noorder) {
          return res.status(400).json({ error: 'noorder is required' });
        }
        result = await RadiologyDataService.getRadiologyRequestDetails(noorder);
        break;

      case 'get_radiology_services':
        result = await RadiologyDataService.getRadiologyServices();
        break;

      case 'get_daily_patients':
        result = await RadiologyDataService.getDailyRadiologyPatients({
          page: req.query.page,
          itemsPerPage: req.query.itemsPerPage,
          search: req.query.search,
          date: req.query.date,
          startDate: req.query.startDate,
          endDate: req.query.endDate
        });
        break;

      case 'get_patient_detail':
        if (!no_rawat) {
          return res.status(400).json({ error: 'no_rawat is required' });
        }
        result = await RadiologyDataService.getRadiologyPatientDetail(no_rawat);
        break;

      case 'get_patient_pacs_detail':
        if (!no_rawat) {
          return res.status(400).json({ error: 'no_rawat is required' });
        }
        result = await RadiologyDataService.getRadiologyPatientPacsDetail(no_rawat);
        break;

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    res.json(result);
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    console.error('Radiology data error:', error);
    res.status(statusCode).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/radiology-data', async (req, res) => {
  try {
    const { action } = req.query;
    const { no_rawat, dokter_perujuk, examinations, noorder, status_rawat, username, klinis, request_date, request_time, review_date, review_time } = req.body;
    if (String(action || '').trim() === 'save_radiology_review') {
      DiagnosticAccessService.ensureAccess('radiologi', username);
    }

    let result;

    switch (action) {
      case 'create_radiology_request':
        if (!no_rawat || !dokter_perujuk) {
          return res.status(400).json({ error: 'no_rawat and dokter_perujuk are required' });
        }
        result = await RadiologyDataService.createRadiologyRequest(
          no_rawat,
          dokter_perujuk,
          examinations,
          status_rawat,
          klinis,
          request_date,
          request_time
        );
        break;

      case 'update_radiology_request':
        if (!noorder) {
          return res.status(400).json({ error: 'noorder is required' });
        }
        result = await RadiologyDataService.updateRadiologyRequest(noorder, examinations, status_rawat, username, klinis);
        break;

      case 'save_radiology_report':
        if (!no_rawat) {
          return res.status(400).json({ error: 'no_rawat is required' });
        }
        result = await RadiologyDataService.saveRadiologyReport(
          no_rawat,
          req.body?.judul,
          req.body?.hasil,
          req.body?.kesan,
          req.body?.saran,
          review_date,
          review_time
        );
        break;

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
    if (action === 'save_radiology_report') {
      await auditCrudSuccess(req, 'radiology_report', 'create', result, { reference_id: no_rawat });
    } else {
      await auditCrudSuccess(req, 'radiology_request', action === 'update_radiology_request' ? 'update' : 'create', result);
    }
    res.json(result);
  } catch (error) {
    const action = String(req.query?.action || '').trim();
    if (action === 'save_radiology_report') {
      await auditCrudFailure(req, 'radiology_report', 'create', error, { reference_id: req.body?.no_rawat });
    } else {
      const auditAction = action === 'update_radiology_request' ? 'update' : 'create';
      await auditCrudFailure(req, 'radiology_request', auditAction, error);
    }
    const statusCode = Number(error?.statusCode) || 500;
    console.error('Radiology data error:', error);
    res.status(statusCode).json({
      success: false,
      error: error.message
    });
  }
});

app.delete('/api/radiology-data', async (req, res) => {
  try {
    const { action, noorder, username } = req.query;

    if (action === 'delete_radiology_request') {
      if (!noorder) {
        return res.status(400).json({ error: 'noorder is required' });
      }

      const result = await RadiologyDataService.deleteRadiologyRequest(noorder, username);
      await auditCrudSuccess(req, 'radiology_request', 'delete', result, { reference_id: noorder });
      res.json(result);
    } else {
      res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    await auditCrudFailure(req, 'radiology_request', 'delete', error, { reference_id: req.query?.noorder });
    const statusCode = Number(error?.statusCode) || 500;
    console.error('Radiology data error:', error);
    res.status(statusCode).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/digital-files/options', async (_req, res) => {
  try {
    const result = await DigitalFilesService.getFileOptions();
    res.json(result);
  } catch (error) {
    console.error('Error in digital-files options endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/digital-files/upload', handleDigitalFilesUpload, async (req, res) => {
  try {
    const uploadedFiles = [
      ...((req.files && Array.isArray(req.files.file)) ? req.files.file : []),
      ...((req.files && Array.isArray(req.files.files)) ? req.files.files : [])
    ];
    const { no_rawat, kode } = req.body || {};

    const result = await DigitalFilesService.uploadFiles({
      noRawat: no_rawat,
      kode,
      files: uploadedFiles
    });

    res.status(result.success ? 200 : 207).json(result);
  } catch (error) {
    console.error('Error in digital-files upload endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/digital-files/:no_rawat', async (req, res) => {
  try {
    const { no_rawat } = req.params;
    const kdDokter = String(req.query.username || req.query.kd_dokter || '').trim();
    const debugMode = String(req.query.debug || '') === '1';

    if (!no_rawat) {
      return res.status(400).json({
        success: false,
        error: 'no_rawat is required'
      });
    }

    const result = await DigitalFilesService.getFiles(no_rawat, kdDokter);
    if (debugMode) {
      return res.json({
        ...result,
        _debug: {
          pid: process.pid,
          cwd: process.cwd(),
          envPath: path.resolve(__dirname, '.env'),
          rawDigitalFilesBaseUrl: String(process.env.DIGITAL_FILES_BASE_URL || '').trim() || null,
          resolvedDigitalFilesBaseUrl: DigitalFilesService.getUploadsBaseUrl() || null,
        }
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Error in digital-files GET endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.delete('/api/digital-files', async (req, res) => {
  try {
    const {
      no_rawat,
      kode,
      lokasi_file,
      username,
      kd_dokter
    } = req.body || {};

    const result = await DigitalFilesService.deleteFile({
      noRawat: no_rawat,
      kode,
      lokasiFile: lokasi_file,
      kdDokter: username || kd_dokter
    });

    await auditCrudSuccess(req, 'digital_file', 'delete', result, {
      reference_id: `${no_rawat || ''}:${kode || ''}:${lokasi_file || ''}`
    });

    res.json(result);
  } catch (error) {
    await auditCrudFailure(req, 'digital_file', 'delete', error, {
      reference_id: `${req.body?.no_rawat || ''}:${req.body?.kode || ''}:${req.body?.lokasi_file || ''}`
    });
    const statusCode = Number(error?.statusCode) || 500;
    console.error('Error in digital-files DELETE endpoint:', error);
    res.status(statusCode).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/debug/digital-files-env', async (_req, res) => {
  try {
    const rawDigitalFilesBaseUrl = String(process.env.DIGITAL_FILES_BASE_URL || '').trim();
    const resolvedDigitalFilesBaseUrl = DigitalFilesService.getUploadsBaseUrl();

    res.json({
      success: true,
      cwd: process.cwd(),
      envPath: path.resolve(__dirname, '.env'),
      hasDigitalFilesBaseUrl: Boolean(rawDigitalFilesBaseUrl),
      digitalFilesBaseUrl: rawDigitalFilesBaseUrl || null,
      resolvedDigitalFilesBaseUrl: resolvedDigitalFilesBaseUrl || null,
      pid: process.pid,
      nodeEnv: process.env.NODE_ENV || 'development',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/prescription-data', async (req, res) => {
  try {
    const {
      action,
      no_rawat,
      kd_dokter,
      no_resep,
      medicines,
      compounds,
      prescription_date,
      prescription_time,
      prescription_status,
      username,
      set_kronis,
      set_prb
    } = req.body;
    
    let result;
    
    switch (action) {
      case 'create_prescription':
        if (!no_rawat || !kd_dokter) {
          return res.status(400).json({
            success: false,
            error: 'no_rawat and kd_dokter are required for create_prescription'
          });
        }
        result = await PrescriptionDataService.createPrescription(
          no_rawat,
          kd_dokter,
          medicines,
          compounds,
          prescription_date,
          prescription_status,
          prescription_time,
          { set_kronis, set_prb }
        );
        break;
        
      case 'update_prescription':
        if (!no_resep) {
          return res.status(400).json({
            success: false,
            error: 'no_resep is required for update_prescription'
          });
        }
        result = await PrescriptionDataService.updatePrescription(
          no_resep,
          medicines,
          compounds,
          prescription_date,
          prescription_status,
          username,
          prescription_time
        );
        break;
        
      case 'delete_prescription':
        if (!no_resep) {
          return res.status(400).json({
            success: false,
            error: 'no_resep is required for delete_prescription'
          });
        }
        result = await PrescriptionDataService.deletePrescription(no_resep, username);
        break;
        
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid action. Supported actions: create_prescription, update_prescription, delete_prescription'
        });
    }
    const auditAction = action === 'update_prescription'
      ? 'update'
      : action === 'delete_prescription'
        ? 'delete'
        : 'create';
    await auditCrudSuccess(req, 'prescription', auditAction, result);
    res.json(result);
  } catch (error) {
    const auditAction = req.body?.action === 'update_prescription'
      ? 'update'
      : req.body?.action === 'delete_prescription'
        ? 'delete'
        : 'create';
    await auditCrudFailure(req, 'prescription', auditAction, error);
    console.error('Prescription data error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Resume Pasien Data endpoints
app.post('/api/resume-pasien-data', async (req, res) => {
  try {
    const {
      page = "1",
      itemsPerPage = "50", 
      search = "",
      statusPulang = "all",
      username = "",
      resumeStatus = "all",
      jenisDpjp = "all",
      verificationStatus = "all",
      startDate,
      endDate
    } = req.body;

    const result = await ResumePasienDataService.getResumePasienData({
      page,
      itemsPerPage,
      search,
      statusPulang,
      username,
      resumeStatus,
      jenisDpjp,
      verificationStatus,
      startDate,
      endDate
    });

    res.json(result);
  } catch (error) {
    console.error('Resume pasien data error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/resume-pasien-data/:no_rawat', async (req, res) => {
  try {
    const { no_rawat } = req.params;
    const { status_rawat = 'Ranap', kd_dokter = '' } = req.query;
    
    if (!no_rawat) {
      return res.status(400).json({
        success: false,
        error: 'no_rawat is required'
      });
    }

    const result = await ResumePasienDataService.getResumeDetail(no_rawat, status_rawat, kd_dokter);
    res.json(result);
  } catch (error) {
    console.error('Resume detail error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/resume-pasien-data/:no_rawat/logs', async (req, res) => {
  try {
    const { no_rawat } = req.params;

    if (!no_rawat) {
      return res.status(400).json({
        success: false,
        error: 'no_rawat is required'
      });
    }

    const result = await ResumePasienDataService.getResumeHistoryLogs(no_rawat);
    res.json(result);
  } catch (error) {
    console.error('Resume history log error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/resume-pasien-data/:no_rawat', async (req, res) => {
  try {
    const { no_rawat } = req.params;
    const resumeData = req.body;
    const statusRawat = String(req.body?.status_rawat || 'Ranap').trim();
    
    if (!no_rawat) {
      return res.status(400).json({
        success: false,
        error: 'no_rawat is required'
      });
    }

    const result = await ResumePasienDataService.saveResume(no_rawat, resumeData, statusRawat);
    await ResumePasienDataService.appendResumeHistoryLog(no_rawat, {
      action: result?.action_type || 'update',
      status_rawat: result?.status_rawat || statusRawat,
      request_payload: req.body && typeof req.body === 'object' ? { ...req.body } : {},
      actor: ResumePasienDataService.normalizeResumeHistoryActor({
        username: req.body?.actor_username || req.body?.username || '',
        doctor_code: req.body?.kd_dokter || '',
        doctor_name: req.body?.actor_name || req.body?.dokter_penulis || '',
        ip_address: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '',
        user_agent: req.headers['user-agent'] || ''
      }),
      message: result?.message || 'Resume berhasil disimpan'
    });
    await auditCrudSuccess(req, 'resume_pasien', 'upsert', result, { no_rawat, reference_id: no_rawat });
    res.json(result);
  } catch (error) {
    await auditCrudFailure(req, 'resume_pasien', 'upsert', error, { no_rawat: req.params.no_rawat, reference_id: req.params.no_rawat });
    console.error('Save resume error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/resume-pasien-data/:no_rawat/verification', async (req, res) => {
  try {
    const { no_rawat } = req.params;
    const { kd_dokter = '', verified = true } = req.body || {};

    if (!no_rawat) {
      return res.status(400).json({
        success: false,
        error: 'no_rawat is required'
      });
    }

    const result = await ResumePasienDataService.setResumeVerification(no_rawat, kd_dokter, Boolean(verified));
    await ResumePasienDataService.appendResumeHistoryLog(no_rawat, {
      action: result?.action_type || (Boolean(verified) ? 'verify' : 'unverify'),
      status_rawat: result?.status_rawat || 'Ranap',
      request_payload: req.body && typeof req.body === 'object' ? { ...req.body } : {},
      actor: ResumePasienDataService.normalizeResumeHistoryActor({
        username: req.body?.actor_username || req.body?.username || '',
        doctor_code: kd_dokter,
        doctor_name: req.body?.actor_name || '',
        ip_address: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '',
        user_agent: req.headers['user-agent'] || ''
      }),
      message: result?.message || 'Status verifikasi resume diperbarui'
    });
    await auditCrudSuccess(req, 'resume_verification', 'update', result, { no_rawat, reference_id: no_rawat });
    res.json(result);
  } catch (error) {
    await auditCrudFailure(req, 'resume_verification', 'update', error, { no_rawat: req.params.no_rawat, reference_id: req.params.no_rawat });
    console.error('Resume verification error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.delete('/api/resume-pasien-data/:no_rawat', async (req, res) => {
  try {
    const { no_rawat } = req.params;
    const { status_rawat = 'Ranap', kd_dokter = '' } = req.query;
    
    if (!no_rawat) {
      return res.status(400).json({
        success: false,
        error: 'no_rawat is required'
      });
    }

    const result = await ResumePasienDataService.deleteResume(no_rawat, status_rawat, kd_dokter);
    await ResumePasienDataService.appendResumeHistoryLog(no_rawat, {
      action: result?.action_type || 'delete',
      status_rawat: result?.status_rawat || status_rawat,
      request_payload: req.query && typeof req.query === 'object' ? { ...req.query } : {},
      actor: ResumePasienDataService.normalizeResumeHistoryActor({
        username: req.query?.actor_username || req.query?.username || '',
        doctor_code: kd_dokter,
        doctor_name: req.query?.actor_name || '',
        ip_address: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '',
        user_agent: req.headers['user-agent'] || ''
      }),
      message: result?.message || 'Resume berhasil dihapus'
    });
    await auditCrudSuccess(req, 'resume_pasien', 'delete', result, { no_rawat, reference_id: no_rawat });
    res.json(result);
  } catch (error) {
    await auditCrudFailure(req, 'resume_pasien', 'delete', error, { no_rawat: req.params.no_rawat, reference_id: req.params.no_rawat });
    console.error('Delete resume error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Register routes
console.log('📊 Registering statistics-data routes at /api/statistics-data');
app.use('/api/statistics-data', statisticsDataRoutes);
console.log('✅ Statistics-data routes registered successfully');

// Register update examination routes
console.log('📝 Registering update-examination routes at /api/update-examination');
app.use('/api/update-examination', updateExaminationRoute);
console.log('✅ Update-examination routes registered successfully');

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error'
  });
});

// Start server
app.listen(PORT, async () => {
  console.log(`\n🚀 Dokter Ulun API Server`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Server running on: http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Auth endpoints: http://localhost:${PORT}/api/auth`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  
  // Test database connection
  console.log('🔍 Testing database connection...');
  try {
    await testConnection();
  } catch (error) {
    console.error('⚠️ Database connection test failed, but server will continue:', error.message);
  }
});

export default app;
