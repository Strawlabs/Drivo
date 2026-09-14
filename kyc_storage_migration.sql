-- ============================================================
-- REAL KYC REVIEW — storage policies for the kyc-documents bucket
-- ============================================================
-- The bucket already exists (private) and DriverVerificationPage has
-- been uploading real files to it — driver_profiles.kyc_status just had
-- no policy letting anyone actually READ them back, so "approve" on the
-- admin dashboard was a rubber stamp with nothing behind it. Files are
-- stored as "<user_id>/<doc_id>.<ext>", so storage.foldername(name)[1]
-- is the owning driver's own auth uid — that's the whole access rule.
create policy "kyc_documents_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'kyc-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "kyc_documents_update_own"
  on storage.objects for update
  using (bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "kyc_documents_select_own_or_admin"
  on storage.objects for select
  using (
    bucket_id = 'kyc-documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from public.users where id = auth.uid() and role = 'admin')
    )
  );
