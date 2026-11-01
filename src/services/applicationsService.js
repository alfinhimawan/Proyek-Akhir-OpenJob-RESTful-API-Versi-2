import pool, { withTransaction } from '../config/database.js';
import { DATA_SOURCE_CACHE, DATA_SOURCE_DATABASE } from '../config/env.js';
import AuthorizationError from '../exceptions/AuthorizationError.js';
import InvariantError from '../exceptions/InvariantError.js';
import NotFoundError from '../exceptions/NotFoundError.js';
import { generateId } from '../utils/id.js';
import { cacheService } from './CacheService.js';
import { producerService } from './ProducerService.js';

const APPLICATION_LIST_SELECT = `
  SELECT a.id, a.user_id, a.job_id, a.status, a.created_at, a.updated_at,
         u.name AS user_name, u.email AS user_email,
         j.title AS job_title, j.company_id, c.name AS company_name,
         j.job_type, j.location_city
  FROM applications a
  JOIN users u ON u.id = a.user_id
  JOIN jobs j ON j.id = a.job_id
  JOIN companies c ON c.id = j.company_id`;

const PROFILE_APPLICATION_SELECT = `
  SELECT a.id, a.user_id, a.job_id, a.status, a.created_at, a.updated_at,
         u.name AS user_name, u.email AS user_email,
         j.title AS job_title, j.company_id, c.name AS company_name,
         j.job_type, j.location_city, j.salary_min, j.salary_max
  FROM applications a
  JOIN users u ON u.id = a.user_id
  JOIN jobs j ON j.id = a.job_id
  JOIN companies c ON c.id = j.company_id`;

/*
 * Lamaran hanya terlihat oleh pelamar dan pemilik lowongan ($1 = id user yang login).
 * Parameter tambahan dipakai oleh filter masing-masing query.
 */
const VISIBLE_TO_USER = '(a.user_id = $1 OR j.owner_id = $1)';

export const getApplicationCacheKey = (id) => `application:${id}`;
export const getApplicationsByUserCacheKey = (userId) => `applications:user:${userId}`;
export const getApplicationsByJobCacheKey = (jobId) => `applications:job:${jobId}`;

const findApplicationAccess = async (id) => {
  const { rows } = await pool.query(
    `SELECT a.user_id AS applicant_id, a.job_id, j.owner_id AS job_owner_id
     FROM applications a
     JOIN jobs j ON j.id = a.job_id
     WHERE a.id = $1`,
    [id],
  );
  if (!rows.length) {
    throw new NotFoundError('Application tidak ditemukan');
  }
  return rows[0];
};

/**
 * Membuat lamaran pekerjaan baru dalam transaksi database, menghapus cache list terkait,
 * lalu mengirim pesan `{ application_id }` ke RabbitMQ.
 * @param {string} userId
 * @param {{ job_id: string, status: string }} payload
 * @returns {Promise<{ id: string, user_id: string, job_id: string, status: string }>}
 */
export const addApplication = async (userId, { job_id: jobId, status }) => {
  const application = await withTransaction(async (client) => {
    // FOR SHARE mencegah job dihapus sebelum lamaran tersimpan.
    const { rows } = await client.query(
      'SELECT status FROM jobs WHERE id = $1 FOR SHARE',
      [jobId],
    );
    if (!rows.length) {
      throw new NotFoundError('Job tidak ditemukan');
    }
    if (rows[0].status !== 'open') {
      throw new InvariantError('Lowongan pekerjaan ini sudah ditutup');
    }

    const result = await client.query(
      `INSERT INTO applications (id, user_id, job_id, status)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, job_id, status`,
      [generateId('application'), userId, jobId, status],
    );
    return result.rows[0];
  });

  await cacheService.delete([
    getApplicationsByUserCacheKey(userId),
    getApplicationsByJobCacheKey(jobId),
  ]);

  await producerService.sendApplicationCreated(application.id);

  return application;
};

/**
 * Mengambil seluruh lamaran yang berhak dilihat oleh pengguna (sebagai pelamar maupun pemilik job).
 * @param {string} userId
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export const getApplications = async (userId) => {
  const { rows } = await pool.query(
    `${APPLICATION_LIST_SELECT} WHERE ${VISIBLE_TO_USER} ORDER BY a.created_at DESC`,
    [userId],
  );
  return rows;
};

/**
 * Mengambil daftar lamaran milik pengguna pada endpoint profil (`/profile/applications`).
 * @param {string} userId
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export const getProfileApplications = async (userId) => {
  const { rows } = await pool.query(
    `${PROFILE_APPLICATION_SELECT} WHERE a.user_id = $1 ORDER BY a.created_at DESC`,
    [userId],
  );
  return rows;
};

/**
 * Mengambil daftar lamaran berdasarkan ID user.
 * Cache hanya digunakan apabila peminta adalah pemilik daftar (`viewerId === targetUserId`).
 * @param {string} viewerId
 * @param {string} targetUserId
 * @returns {Promise<{ data: Array<Record<string, unknown>>, source: string }>}
 */
export const getApplicationsByUserId = async (viewerId, targetUserId) => {
  if (viewerId === targetUserId) {
    const cacheKey = getApplicationsByUserCacheKey(targetUserId);
    const cached = await cacheService.getJson(cacheKey);
    if (cached && cached.ownerId === viewerId && Array.isArray(cached.data)) {
      return { data: cached.data, source: DATA_SOURCE_CACHE };
    }

    const { rows } = await pool.query(
      `${APPLICATION_LIST_SELECT}
       WHERE a.user_id = $1
       ORDER BY a.created_at DESC`,
      [targetUserId],
    );

    await cacheService.setJson(cacheKey, { ownerId: targetUserId, data: rows });
    return { data: rows, source: DATA_SOURCE_DATABASE };
  }

  const { rows } = await pool.query(
    `${APPLICATION_LIST_SELECT}
     WHERE ${VISIBLE_TO_USER} AND a.user_id = $2
     ORDER BY a.created_at DESC`,
    [viewerId, targetUserId],
  );
  return { data: rows, source: DATA_SOURCE_DATABASE };
};

/**
 * Mengambil daftar lamaran berdasarkan ID job.
 * Cache menyimpan `{ ownerId, data }` dan hanya digunakan apabila peminta adalah pemilik job.
 * @param {string} viewerId
 * @param {string} jobId
 * @returns {Promise<{ data: Array<Record<string, unknown>>, source: string }>}
 */
export const getApplicationsByJobId = async (viewerId, jobId) => {
  const cacheKey = getApplicationsByJobCacheKey(jobId);
  const cached = await cacheService.getJson(cacheKey);

  if (cached && cached.ownerId === viewerId && Array.isArray(cached.data)) {
    return { data: cached.data, source: DATA_SOURCE_CACHE };
  }

  if (!cached) {
    const jobRes = await pool.query('SELECT owner_id FROM jobs WHERE id = $1', [jobId]);
    if (jobRes.rowCount && jobRes.rows[0].owner_id === viewerId) {
      const { rows } = await pool.query(
        `${APPLICATION_LIST_SELECT}
         WHERE a.job_id = $1
         ORDER BY a.created_at DESC`,
        [jobId],
      );
      await cacheService.setJson(cacheKey, { ownerId: viewerId, data: rows });
      return { data: rows, source: DATA_SOURCE_DATABASE };
    }
  }

  const { rows } = await pool.query(
    `${APPLICATION_LIST_SELECT}
     WHERE ${VISIBLE_TO_USER} AND a.job_id = $2
     ORDER BY a.created_at DESC`,
    [viewerId, jobId],
  );
  return { data: rows, source: DATA_SOURCE_DATABASE };
};

/**
 * Mengambil detail satu lamaran dengan verifikasi kepemilikan dan dukungan cache Redis.
 * @param {string} id
 * @param {string} userId
 * @returns {Promise<{ data: Record<string, unknown>, source: string }>}
 */
export const getApplicationById = async (id, userId) => {
  const cacheKey = getApplicationCacheKey(id);
  const cached = await cacheService.getJson(cacheKey);

  if (cached && cached.data) {
    if (userId !== cached.applicantId && userId !== cached.jobOwnerId) {
      throw new AuthorizationError('Anda tidak berhak mengakses application ini');
    }
    return { data: cached.data, source: DATA_SOURCE_CACHE };
  }

  const { applicant_id: applicantId, job_owner_id: jobOwnerId } =
    await findApplicationAccess(id);
  if (userId !== applicantId && userId !== jobOwnerId) {
    throw new AuthorizationError('Anda tidak berhak mengakses application ini');
  }

  const { rows } = await pool.query(`${APPLICATION_LIST_SELECT} WHERE a.id = $1`, [id]);
  if (!rows.length) {
    throw new NotFoundError('Application tidak ditemukan');
  }

  const application = rows[0];
  await cacheService.setJson(cacheKey, {
    applicantId,
    jobOwnerId,
    data: application,
  });

  return { data: application, source: DATA_SOURCE_DATABASE };
};

/**
 * Memastikan pengguna adalah pelamar atau pemilik lowongan dari lamaran terkait.
 * @param {string} id
 * @param {string} userId
 * @returns {Promise<{ applicantId: string, jobId: string, jobOwnerId: string | null }>}
 */
export const verifyApplicationAccess = async (id, userId) => {
  const {
    applicant_id: applicantId,
    job_id: jobId,
    job_owner_id: jobOwnerId,
  } = await findApplicationAccess(id);

  if (userId !== applicantId && userId !== jobOwnerId) {
    throw new AuthorizationError('Anda tidak berhak mengakses application ini');
  }

  return { applicantId, jobId, jobOwnerId };
};

/**
 * Memastikan pengguna adalah pemilik lowongan sehingga berhak mengubah status lamaran.
 * @param {string} id
 * @param {string} userId
 * @returns {Promise<{ applicantId: string, jobId: string, jobOwnerId: string }>}
 */
export const verifyJobOwnerOfApplication = async (id, userId) => {
  const {
    applicant_id: applicantId,
    job_id: jobId,
    job_owner_id: jobOwnerId,
  } = await findApplicationAccess(id);

  if (userId !== jobOwnerId) {
    throw new AuthorizationError('Hanya pemilik lowongan yang dapat mengubah status');
  }

  return { applicantId, jobId, jobOwnerId };
};

/**
 * Memperbarui status lamaran oleh pemilik lowongan dan menghapus cache detail serta list lamaran.
 * @param {string} id
 * @param {string} userId
 * @param {string} status
 * @returns {Promise<void>}
 */
export const updateApplicationStatus = async (id, userId, status) => {
  const { applicantId, jobId } = await verifyJobOwnerOfApplication(id, userId);

  await pool.query(
    'UPDATE applications SET status = $1, updated_at = NOW() WHERE id = $2',
    [status, id],
  );

  await cacheService.delete([
    getApplicationCacheKey(id),
    getApplicationsByUserCacheKey(applicantId),
    getApplicationsByJobCacheKey(jobId),
  ]);
};

/**
 * Menghapus lamaran oleh pelamar atau pemilik lowongan serta menghapus cache detail dan list lamaran.
 * @param {string} id
 * @param {string} userId
 * @returns {Promise<void>}
 */
export const deleteApplication = async (id, userId) => {
  const { applicantId, jobId } = await verifyApplicationAccess(id, userId);

  await pool.query('DELETE FROM applications WHERE id = $1', [id]);

  await cacheService.delete([
    getApplicationCacheKey(id),
    getApplicationsByUserCacheKey(applicantId),
    getApplicationsByJobCacheKey(jobId),
  ]);
};

/**
 * Mengambil rincian pelamar, lowongan, dan pemilik lowongan (job owner) untuk pengiriman email consumer.
 * @param {string} applicationId
 * @returns {Promise<Record<string, unknown> | null>}
 */
export const getNotificationDetailsByApplicationId = async (applicationId) => {
  const { rows } = await pool.query(
    `SELECT a.id AS application_id,
            a.created_at AS applied_at,
            applicant.id AS applicant_id,
            applicant.name AS applicant_name,
            applicant.email AS applicant_email,
            j.id AS job_id,
            j.title AS job_title,
            c.name AS company_name,
            owner.id AS job_owner_id,
            owner.name AS job_owner_name,
            owner.email AS job_owner_email
     FROM applications a
     JOIN users applicant ON applicant.id = a.user_id
     JOIN jobs j ON j.id = a.job_id
     JOIN companies c ON c.id = j.company_id
     LEFT JOIN users owner ON owner.id = COALESCE(j.owner_id, c.owner_id)
     WHERE a.id = $1`,
    [applicationId],
  );

  return rows[0] ?? null;
};
