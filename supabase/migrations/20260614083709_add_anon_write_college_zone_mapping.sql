CREATE POLICY "anon_insert_college_zone_mapping" ON college_zone_mapping FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_college_zone_mapping" ON college_zone_mapping FOR UPDATE TO anon USING (true) WITH CHECK (true);
