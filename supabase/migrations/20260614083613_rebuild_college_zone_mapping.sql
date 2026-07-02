-- Clear fake seed data
DELETE FROM college_zone_mapping;

-- Populate from actual student data using college name keyword matching
INSERT INTO college_zone_mapping (college_code, college_name, zone_id)
SELECT DISTINCT ON (final_college_code)
  final_college_code,
  college_name,
  CASE
    WHEN college_name ILIKE '%Chennai%' OR college_name ILIKE '%Guindy%' OR
         college_name ILIKE '%Kancheepuram%' OR college_name ILIKE '%Kanchipuram%' OR
         college_name ILIKE '%Thiruvallur%' OR college_name ILIKE '%Chengalpattu%' OR
         college_name ILIKE '%Tambaram%'
      THEN (SELECT id FROM zones WHERE zone_code = 'CHN')
    WHEN college_name ILIKE '%Coimbatore%' OR college_name ILIKE '%Pollachi%' OR
         college_name ILIKE '%Tiruppur%'
      THEN (SELECT id FROM zones WHERE zone_code = 'CBE')
    WHEN college_name ILIKE '%Erode%' OR college_name ILIKE '%Sathyamangalam%' OR
         college_name ILIKE '%Bhavani%'
      THEN (SELECT id FROM zones WHERE zone_code = 'ERD')
    WHEN college_name ILIKE '%Salem%' OR college_name ILIKE '%Namakkal%' OR
         college_name ILIKE '%Dharmapuri%' OR college_name ILIKE '%Krishnagiri%'
      THEN (SELECT id FROM zones WHERE zone_code = 'SLM')
    WHEN college_name ILIKE '%Vellore%' OR college_name ILIKE '%Tiruvannamalai%' OR
         college_name ILIKE '%Ranipet%'
      THEN (SELECT id FROM zones WHERE zone_code = 'VEL')
    WHEN college_name ILIKE '%Madurai%' OR college_name ILIKE '%Virudhunagar%' OR
         college_name ILIKE '%Theni%' OR college_name ILIKE '%Sivaganga%'
      THEN (SELECT id FROM zones WHERE zone_code = 'MDU')
    WHEN college_name ILIKE '%Tirunelveli%' OR college_name ILIKE '%Nellai%'
      THEN (SELECT id FROM zones WHERE zone_code = 'TEN')
    WHEN college_name ILIKE '%Thoothukudi%' OR college_name ILIKE '%Tuticorin%'
      THEN (SELECT id FROM zones WHERE zone_code = 'TKD')
    WHEN college_name ILIKE '%Tiruchirappalli%' OR college_name ILIKE '%Trichy%' OR
         college_name ILIKE '%Tiruchirapalli%' OR college_name ILIKE '%Srirangam%'
      THEN (SELECT id FROM zones WHERE zone_code = 'TRC')
    WHEN college_name ILIKE '%Thanjavur%' OR college_name ILIKE '%Kumbakonam%' OR
         college_name ILIKE '%Nagapattinam%' OR college_name ILIKE '%Mayiladuthurai%'
      THEN (SELECT id FROM zones WHERE zone_code = 'TJV')
    WHEN college_name ILIKE '%Dindigul%'
      THEN (SELECT id FROM zones WHERE zone_code = 'DGL')
    ELSE NULL
  END AS zone_id
FROM students
WHERE final_college_code IS NOT NULL AND final_college_code != ''
ORDER BY final_college_code, college_name;

-- Backfill zone_id on all existing students
UPDATE students s
SET zone_id = czm.zone_id
FROM college_zone_mapping czm
WHERE s.final_college_code = czm.college_code
  AND czm.zone_id IS NOT NULL;
