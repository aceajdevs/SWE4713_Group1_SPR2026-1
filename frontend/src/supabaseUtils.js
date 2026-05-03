import { supabase } from './supabaseClient';

/**
 * Fetch all records from a table
 * @param {string} tableName - Name of the table
 * @param {object} options - Query options (select, filters, sorting, etc.)
 * @returns {Promise} - Array of records or error
 */
export async function fetchFromTable(tableName, options = {}) {
  try {
    let query = supabase.from(tableName).select(options.select || '*');

    if (options.filters) {
      Object.entries(options.filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
    }

    // Add sorting
    if (options.orderBy) {
      query = query.order(options.orderBy.column, {
        ascending: options.orderBy.ascending !== false,
      });
    }

    // Add limit
    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.single) {
      const { data, error } = await query.single();
      if (error) throw error;
      return { data, error: null };
    }

    const { data, error } = await query;
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error(`Error fetching from ${tableName}:`, error);
    return { data: null, error };
  }
}

/**
 * Insert a new record into a table
 * @param {string} tableName - Name of the table
 * @param {object} record - Record to insert
 * @returns {Promise} - Inserted record or error
 */
export async function insertRecord(tableName, record) {
  try {
    const { data, error } = await supabase.from(tableName).insert([record]).select();
    if (error) throw error;
    return { data: data?.[0], error: null };
  } catch (error) {
    console.error(`Error inserting into ${tableName}:`, error);
    return { data: null, error };
  }
}

/**
 * Update a record in a table
 * @param {string} tableName - Name of the table
 * @param {number|string} id - Record ID
 * @param {object} updates - Fields to update
 * @param {string} idColumn - Column name for the ID (default: 'id')
 * @returns {Promise} - Updated record or error
 */
export async function updateRecord(tableName, id, updates, idColumn = 'id') {
  try {
    const idColumn = tableName === 'chartOfAccounts' ? 'accountID' : 'id';
    const { data, error } = await supabase
      .from(tableName)
      .update(updates)
      .eq(idColumn, id)
      .select();
    if (error) throw error;
    return { data: data?.[0], error: null };
  } catch (error) {
    console.error(`Error updating ${tableName}:`, error);
    return { data: null, error };
  }
}

/**
 * Delete a record from a table
 * @param {string} tableName - Name of the table
 * @param {number|string} id - Record ID
 * @param {string} idColumn - Column name for the ID (default: 'id')
 * @returns {Promise} - Success status or error
 */
export async function deleteRecord(tableName, id, idColumn = 'id') {
  try {
    const idColumn = tableName === 'chartOfAccounts' ? 'accountID' : 'id';
    const { error } = await supabase.from(tableName).delete().eq(idColumn, id);
    if (error) throw error;
    return { success: true, error: null };
  } catch (error) {
    console.error(`Error deleting from ${tableName}:`, error);
    return { success: false, error };
  }
}

/**
 * Upload a file to Supabase Storage
 * @param {string} bucket - Storage bucket name
 * @param {string} path - File path in bucket
 * @param {File} file - File to upload
 * @returns {Promise} - File data or error
 */
export async function uploadFile(bucket, path, file) {
  try {
    const contentType = file?.type || 'application/octet-stream';
    const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
      upsert: true,
      contentType,
    });
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error(`Error uploading file to ${bucket}:`, error);
    return { data: null, error };
  }
}

export function getFileUrl(bucket, path) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || null;
}

export async function createSignedUrl(bucket, path, expiresInSec = 3600) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSec);
  if (error) throw error;
  return data?.signedUrl || null;
}

export function subscribeToTable(tableName, callback) {
  const subscription = supabase
    .channel(`public:${tableName}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: tableName },
      (payload) => callback(payload)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(subscription);
  };
}

export async function fetchErrorMessage(errorID) {
  try {
    const { data, error } = await supabase.functions.invoke('get-error-message', {
      body: { name: 'Functions' },
    });
    if (error) throw error;
    return data?.message || 'An unknown error occurred.';
  } catch (error) {
    console.error(`Error fetching error message for ID ${errorID}:`, error);
    return 'An unknown error occurred.';
  }
}
