-- Enable storage for job attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-attachments', 'job-attachments', true)
ON CONFLICT DO NOTHING;

-- RLS: users can only access their org's files
CREATE POLICY "Org users can upload job attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'job-attachments');

CREATE POLICY "Org users can view job attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'job-attachments');

CREATE POLICY "Org users can delete job attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'job-attachments');

-- Track attachments metadata
CREATE TABLE job_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL, -- path in storage bucket
  file_type text NOT NULL, -- image/jpeg, application/pdf, etc.
  file_size integer NOT NULL,
  category text DEFAULT 'general', -- before, after, certificate, receipt, other
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_attachments_job_id ON job_attachments(job_id);
ALTER TABLE job_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org isolation: job_attachments" ON job_attachments
  FOR ALL USING (org_id = auth_org_id());
