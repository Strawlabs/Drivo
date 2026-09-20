-- ============================================================
-- KYC STORAGE LEGACY POLICY
-- Found live during the security audit pass (pg_policies on
-- storage.objects, checked because rides had just turned up the same
-- shape of surprise): a policy named "Allow authenticated uploads"
-- (ALL, qual/with_check = bucket_id = 'kyc-documents' only — no folder
-- check at all) predating kyc_documents_insert_own/update_own/
-- select_own_or_admin and never captured anywhere in schema.sql. It
-- silently granted any authenticated user full read/write/delete on
-- every driver's KYC documents — Aadhar, PAN, license, EV
-- certification scans — regardless of how tightly those three real
-- policies were scoped, since Postgres ORs permissive policies
-- together. Already run against production; recorded here so schema.sql
-- and a fresh environment both reflect it.
-- ============================================================

drop policy if exists "Allow authenticated uploads" on storage.objects;
