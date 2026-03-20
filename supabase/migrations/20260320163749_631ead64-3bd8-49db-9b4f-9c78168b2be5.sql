INSERT INTO storage.buckets (id, name, public) VALUES ('office-assets', 'office-assets', true);

CREATE POLICY "Auth can upload office assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'office-assets');
CREATE POLICY "Auth can update office assets" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'office-assets');
CREATE POLICY "Auth can delete office assets" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'office-assets');
CREATE POLICY "Public can view office assets" ON storage.objects FOR SELECT TO public USING (bucket_id = 'office-assets');