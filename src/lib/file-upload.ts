import { supabase } from './supabase'

export interface Attachment {
  id: string
  orgId: string
  jobId: string
  fileName: string
  filePath: string
  fileType: string
  fileSize: number
  category: string
  notes: string
  createdAt: string
  url: string
}

const BUCKET = 'job-attachments'
const MAX_FILES_PER_JOB = 10
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

/**
 * Upload a file to Supabase Storage and create a metadata record.
 */
export async function uploadJobFile(
  orgId: string,
  jobId: string,
  file: File,
  category: string = 'general',
  notes: string = ''
): Promise<Attachment> {
  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`)
  }

  // Check existing count
  const existing = await getJobAttachments(jobId)
  if (existing.length >= MAX_FILES_PER_JOB) {
    throw new Error(`Maximum ${MAX_FILES_PER_JOB} files per job. Delete some before adding more.`)
  }

  // Build a unique path
  const timestamp = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${orgId}/${jobId}/${timestamp}-${safeName}`

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false })

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`)
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(path)

  // Insert metadata record
  const { data, error: insertError } = await supabase
    .from('job_attachments')
    .insert({
      org_id: orgId,
      job_id: jobId,
      file_name: file.name,
      file_path: path,
      file_type: file.type || 'application/octet-stream',
      file_size: file.size,
      category,
      notes,
    })
    .select()
    .single()

  if (insertError) {
    // Clean up the uploaded file on metadata failure
    await supabase.storage.from(BUCKET).remove([path])
    throw new Error(`Failed to save attachment record: ${insertError.message}`)
  }

  return mapRow(data, urlData.publicUrl)
}

/**
 * Delete a file from storage and remove its metadata record.
 */
export async function deleteJobFile(attachmentId: string, filePath: string): Promise<void> {
  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([filePath])

  if (storageError) {
    console.warn('Storage delete warning:', storageError.message)
  }

  const { error: dbError } = await supabase
    .from('job_attachments')
    .delete()
    .eq('id', attachmentId)

  if (dbError) {
    throw new Error(`Failed to delete attachment record: ${dbError.message}`)
  }
}

/**
 * Get all attachments for a job.
 */
export async function getJobAttachments(jobId: string): Promise<Attachment[]> {
  const { data, error } = await supabase
    .from('job_attachments')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to load attachments: ${error.message}`)
  }

  return (data || []).map(row => {
    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(row.file_path)
    return mapRow(row, urlData.publicUrl)
  })
}

function mapRow(row: any, url: string): Attachment {
  return {
    id: row.id,
    orgId: row.org_id,
    jobId: row.job_id,
    fileName: row.file_name,
    filePath: row.file_path,
    fileType: row.file_type,
    fileSize: row.file_size,
    category: row.category || 'general',
    notes: row.notes || '',
    createdAt: row.created_at,
    url,
  }
}

/**
 * Format file size for display.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
