-- students: allow anon to select, insert, update (upsert requires both)
CREATE POLICY "anon_select_students" ON students FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_students" ON students FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_students" ON students FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- zones: allow anon to select (needed for dashboard and reports)
CREATE POLICY "anon_select_zones" ON zones FOR SELECT TO anon USING (true);

-- college_zone_mapping: allow anon to select (needed for zone lookup during upload)
CREATE POLICY "anon_select_college_zone_mapping" ON college_zone_mapping FOR SELECT TO anon USING (true);
