-- =============================================================================
-- Varda SaaS Platform — Seed Data
-- Demo organization: Grey Havens Electrical
-- Matches the structure from the existing TypeScript seedData.ts
-- =============================================================================
-- NOTE: This seed file is meant to be run with the Supabase service role
-- (bypasses RLS). It creates a demo org with realistic sample data.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Demo Organization
-- ─────────────────────────────────────────────────────────────────────────────

insert into organizations (id, name, trade_type, phone, email, address, website, created_at)
values (
  '00000000-0000-0000-0000-000000000001',
  'Grey Havens Electrical',
  'electrician',
  '07XXX XXX XXX',
  'info@thegreyhavens.co.uk',
  'Colchester, Essex',
  'https://thegreyhavens.co.uk',
  '2023-04-01'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- App Settings (matches DEFAULT_SETTINGS from DataContext)
-- ─────────────────────────────────────────────────────────────────────────────

insert into app_settings (org_id, settings_json)
values (
  '00000000-0000-0000-0000-000000000001',
  '{
    "business": {
      "businessName": "Grey Havens Electrical",
      "ownerName": "Matt",
      "phone": "07XXX XXX XXX",
      "email": "info@thegreyhavens.co.uk",
      "address1": "",
      "address2": "",
      "city": "Colchester",
      "county": "Essex",
      "postcode": "",
      "website": "https://thegreyhavens.co.uk",
      "vatNumber": "",
      "companyNumber": ""
    },
    "workingHours": {
      "Monday":    {"enabled": true,  "start": "08:00", "end": "17:00"},
      "Tuesday":   {"enabled": true,  "start": "08:00", "end": "17:00"},
      "Wednesday": {"enabled": true,  "start": "08:00", "end": "17:00"},
      "Thursday":  {"enabled": true,  "start": "08:00", "end": "17:00"},
      "Friday":    {"enabled": true,  "start": "08:00", "end": "17:00"},
      "Saturday":  {"enabled": true,  "start": "09:00", "end": "13:00"},
      "Sunday":    {"enabled": false, "start": "10:00", "end": "14:00"}
    },
    "quoteConfig": {
      "validityDays": 30,
      "prefix": "GH-Q",
      "paymentTerms": 14,
      "bankName": "",
      "sortCode": "",
      "accountNumber": "",
      "footer": "Thank you for choosing Grey Havens Electrical. All work guaranteed for 12 months."
    },
    "notifications": {
      "jobReminders": true,
      "quoteFollowUp": true,
      "invoiceOverdue": true,
      "scheduleAlerts": true,
      "weeklyDigest": false
    }
  }'::jsonb
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Pricing Config (matches DEFAULT_PRICING_CONFIG from DataContext)
-- ─────────────────────────────────────────────────────────────────────────────

insert into pricing_config (org_id, config_json)
values (
  '00000000-0000-0000-0000-000000000001',
  '{
    "labourRate": 55,
    "vatRate": 0.20,
    "certFee": 85,
    "wastePct": 0.05,
    "marginTarget": 0.30,
    "emergencyMult": 1.5,
    "outOfHoursMult": 1.25,
    "difficultyMin": 1.0,
    "difficultyMax": 2.0,
    "hassleMin": 1.0,
    "hassleMax": 1.6,
    "emergencyMinCharge": 150
  }'::jsonb
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Job Type Configs (matches DEFAULT_JOB_TYPE_CONFIGS from DataContext)
-- ─────────────────────────────────────────────────────────────────────────────

insert into job_type_configs (org_id, job_type_id, name, base_material_cost, base_hours, cert_required, is_per_unit, min_charge) values
  ('00000000-0000-0000-0000-000000000001', 'consumer-unit',   'Consumer Unit',   320,  6,   true,  false, 0),
  ('00000000-0000-0000-0000-000000000001', 'ev-charger',      'EV Charger',      450,  5,   true,  false, 0),
  ('00000000-0000-0000-0000-000000000001', 'fault-finding',   'Fault Finding',   10,   2,   false, false, 150),
  ('00000000-0000-0000-0000-000000000001', 'rewire',          'Rewire',          180,  8,   true,  true,  0),
  ('00000000-0000-0000-0000-000000000001', 'lighting',        'Lighting',        15,   0.5, false, true,  0),
  ('00000000-0000-0000-0000-000000000001', 'eicr',            'EICR',            0,    3,   true,  false, 0),
  ('00000000-0000-0000-0000-000000000001', 'smart-home',      'Smart Home',      200,  6,   false, false, 0),
  ('00000000-0000-0000-0000-000000000001', 'ethernet',        'Ethernet',        60,   1.5, false, true,  0),
  ('00000000-0000-0000-0000-000000000001', 'smoke-detectors', 'Smoke Detectors', 35,   0.5, false, true,  0),
  ('00000000-0000-0000-0000-000000000001', 'minor-works',     'Minor Works',     20,   1,   false, false, 0),
  ('00000000-0000-0000-0000-000000000001', 'cctv',            'CCTV',            150,  4,   false, false, 0),
  ('00000000-0000-0000-0000-000000000001', 'other',           'Other',           0,    1,   false, false, 0);

-- ─────────────────────────────────────────────────────────────────────────────
-- Sample Customers (10 customers from the Essex/Suffolk/Norfolk area)
-- ─────────────────────────────────────────────────────────────────────────────

insert into customers (id, org_id, name, phone, email, address1, address2, city, postcode, notes, created_at) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'James Thompson',  '07832 456123', 'james.thompson@gmail.com',      '14 High Street',    '', 'Colchester',       'CO3 4AB', 'Regular customer, always pays on time', '2023-04-10'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Sarah Clarke',    '07945 789012', 'sarah_clarke@hotmail.co.uk',    '87 Mill Lane',      '', 'Ipswich',          'IP2 7DE', 'Referred by previous customer',         '2023-05-15'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'David Patel',     '07712 345678', 'david.patel@outlook.com',       '23 Church Road',    '', 'Bury St Edmunds',  'IP33 2FG', 'Found us on Google',                   '2023-07-22'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Emma Woodward',   '07856 234567', 'emmawoodward@gmail.com',        '52 Station Road',   '', 'Thetford',         'IP24 3HJ', 'Prefers WhatsApp communication',       '2023-09-03'),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Michael Harris',  '07923 678901', 'michael_harris@yahoo.co.uk',    '9 Park Avenue',     '', 'Diss',             'IP22 4KL', 'Has dogs - call before arriving',      '2023-11-18'),
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'Rachel Mitchell', '07734 890123', 'rachel.mitchell@icloud.com',    '31 The Green',      '', 'Braintree',        'CM7 5MN', '',                                      '2024-01-08'),
  ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'Andrew Brown',    '07891 012345', 'andrew_brown@btinternet.com',   '66 Manor Road',     '', 'Chelmsford',       'CM1 6PQ', '',                                      '2024-03-20'),
  ('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'Claire Taylor',   '07812 567890', 'claire.taylor@gmail.com',       '18 Victoria Street','', 'Sudbury',          'CO10 7RS', '',                                     '2024-06-14'),
  ('10000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 'Robert Walker',   '07967 123456', 'robert.walker@outlook.com',     '45 Queens Road',    '', 'Stowmarket',       'IP14 8TU', '',                                     '2024-09-02'),
  ('10000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Helen Cooper',    '07745 234567', 'helen_cooper@hotmail.co.uk',    '72 King Street',    '', 'Hadleigh',         'IP7 9VW',  '',                                     '2024-11-25');

-- ─────────────────────────────────────────────────────────────────────────────
-- Sample Quotes (mix of statuses across the timeline)
-- ─────────────────────────────────────────────────────────────────────────────

insert into quotes (id, org_id, ref, customer_id, job_type_id, job_type_name, description, quantity, difficulty, hassle_factor, emergency, out_of_hours, cert_required, customer_supplies_materials, notes, materials, labour, certificates, waste, subtotal, adjustments, net_total, vat, grand_total, margin, est_hours, status, created_at, sent_at, viewed_at, accepted_at) values
  -- Historical: completed and paid
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'GH-Q1001', '10000000-0000-0000-0000-000000000001', 'consumer-unit', 'Consumer Unit Upgrade', 'Replace old fuse board with 18th Edition consumer unit', 1, 45, 25, false, false, true, false, '', 292.50, 282.50, 85, 15, 675, -25, 650, 130, 780.00, 0.43, 6.5, 'Accepted', '2023-04-20', '2023-04-20', '2023-04-21', '2023-04-23'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'GH-Q1002', '10000000-0000-0000-0000-000000000002', 'ev-charger', 'EV Charger Install', 'Install 7kW EV charger on driveway wall', 1, 35, 20, false, false, true, false, '', 400, 330, 85, 20, 835, 15, 850, 170, 1020.00, 0.39, 5.0, 'Accepted', '2023-05-28', '2023-05-28', '2023-05-29', '2023-05-31'),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'GH-Q1003', '10000000-0000-0000-0000-000000000003', 'fault-finding', 'Fault Finding', 'Intermittent tripping on lighting circuit', 1, 55, 35, false, false, false, false, '', 10, 190, 0, 1, 201, -1, 200, 40, 240.00, 0.95, 2.0, 'Accepted', '2023-08-10', '2023-08-10', '2023-08-11', '2023-08-12'),
  ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'GH-Q1004', '10000000-0000-0000-0000-000000000004', 'lighting', 'Lighting Install', 'Install 6x downlights in kitchen', 6, 30, 20, false, false, false, false, '', 90, 210, 0, 5, 305, -5, 300, 60, 360.00, 0.70, 3.0, 'Accepted', '2023-10-01', '2023-10-01', '2023-10-02', '2023-10-03'),
  ('20000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'GH-Q1005', '10000000-0000-0000-0000-000000000005', 'eicr', 'EICR', 'EICR - landlord certificate for rental property', 1, 40, 30, false, false, true, false, '', 5, 180, 85, 0, 270, 10, 280, 56, 336.00, 0.64, 3.0, 'Accepted', '2023-12-05', '2023-12-05', '2023-12-06', '2023-12-07'),

  -- Expired / declined quotes
  ('20000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'GH-Q1006', '10000000-0000-0000-0000-000000000006', 'rewire', 'Rewire (per room)', 'Full rewire of 3-bed semi - 6 rooms', 6, 65, 50, false, false, true, false, '', 1400, 1815, 85, 70, 3370, 130, 3500, 700, 4200.00, 0.52, 32.0, 'Expired', '2024-02-10', '2024-02-10', null, null),
  ('20000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'GH-Q1007', '10000000-0000-0000-0000-000000000007', 'smart-home', 'Smart Home Install', 'Full smart home setup - lights, heating, and security', 1, 50, 40, false, false, false, false, '', 400, 400, 0, 20, 820, -20, 800, 160, 960.00, 0.50, 7.0, 'Declined', '2024-04-15', '2024-04-15', '2024-04-16', null),

  -- Recent: various active statuses
  ('20000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'GH-Q1008', '10000000-0000-0000-0000-000000000008', 'ethernet', 'Ethernet Wiring', 'Run Cat6 to home office - 2 points', 2, 30, 15, false, false, false, false, '', 105, 120, 0, 5, 230, 20, 250, 50, 300.00, 0.48, 3.0, 'Accepted', '2026-03-15', '2026-03-15', '2026-03-16', '2026-03-17'),
  ('20000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 'GH-Q1009', '10000000-0000-0000-0000-000000000009', 'minor-works', 'Minor Works', 'Add double socket in home office', 1, 25, 15, false, false, false, false, '', 20, 90, 0, 1, 111, 9, 120, 24, 144.00, 0.75, 1.5, 'Sent', '2026-04-01', '2026-04-01', null, null),
  ('20000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'GH-Q1010', '10000000-0000-0000-0000-000000000010', 'consumer-unit', 'Consumer Unit Upgrade', 'Upgrade consumer unit with RCBO protection', 1, 50, 30, false, false, true, false, '', 310, 270, 85, 15, 680, 20, 700, 140, 840.00, 0.39, 7.0, 'Draft', '2026-04-05', null, null, null),

  -- Emergency callout
  ('20000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'GH-Q1011', '10000000-0000-0000-0000-000000000001', 'fault-finding', 'Fault Finding', 'Power keeps tripping when using kitchen appliances', 1, 60, 45, true, false, false, false, 'Emergency callout - customer has no power', 15, 280, 0, 1, 296, 4, 300, 60, 360.00, 0.93, 2.5, 'Accepted', '2026-03-25', '2026-03-25', '2026-03-25', '2026-03-25');

-- ─────────────────────────────────────────────────────────────────────────────
-- Sample Jobs
-- ─────────────────────────────────────────────────────────────────────────────

insert into jobs (id, org_id, customer_id, quote_id, invoice_id, job_type, value, estimated_hours, actual_hours, status, date, notes, created_at) values
  -- Historical: paid
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', null, 'Consumer Unit Upgrade', 780.00, 6.5, 7.0,  'Paid',        '2023-05-02', 'Replace old fuse board with 18th Edition consumer unit', '2023-04-20'),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', null, 'EV Charger Install',    1020.00, 5.0, 5.5,  'Paid',        '2023-06-12', 'Install 7kW EV charger on driveway wall', '2023-05-28'),
  ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', null, 'Fault Finding',         240.00, 2.0, 1.5,  'Paid',        '2023-08-18', 'Intermittent tripping on lighting circuit', '2023-08-10'),
  ('30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', null, 'Lighting Install',      360.00, 3.0, 3.5,  'Paid',        '2023-10-15', 'Install 6x downlights in kitchen', '2023-10-01'),
  ('30000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', null, 'EICR',                  336.00, 3.0, 2.5,  'Paid',        '2023-12-18', 'EICR - landlord certificate for rental property', '2023-12-05'),

  -- Recent: active
  ('30000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000008', null, 'Ethernet Wiring',       300.00, 3.0, null, 'Scheduled',   '2026-04-10', 'Run Cat6 to home office - 2 points', '2026-03-15'),
  ('30000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000009', null, 'Minor Works',           144.00, 1.5, null, 'Quoted',      '2026-04-12', 'Add double socket in home office', '2026-04-01'),
  ('30000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000010', null, 'Consumer Unit Upgrade',  840.00, 7.0, null, 'Lead',        '2026-04-15', 'Upgrade consumer unit with RCBO protection', '2026-04-05'),
  ('30000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000011', null, 'Fault Finding',         360.00, 2.5, 2.0,  'Complete',    '2026-03-26', 'Power keeps tripping when using kitchen appliances', '2026-03-25');

-- ─────────────────────────────────────────────────────────────────────────────
-- Sample Invoices
-- ─────────────────────────────────────────────────────────────────────────────

insert into invoices (id, org_id, ref, job_id, quote_id, customer_id, customer_name, job_type_name, description, net_total, vat, grand_total, status, due_date, created_at, sent_at, paid_at) values
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'GH-INV001', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'James Thompson',  'Consumer Unit Upgrade', 'Replace old fuse board with 18th Edition consumer unit', 650, 130, 780.00, 'Paid', '2023-06-02', '2023-05-03', '2023-05-03', '2023-05-15'),
  ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'GH-INV002', '30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Sarah Clarke',    'EV Charger Install',    'Install 7kW EV charger on driveway wall', 850, 170, 1020.00, 'Paid', '2023-07-12', '2023-06-13', '2023-06-13', '2023-06-28'),
  ('40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'GH-INV003', '30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'David Patel',     'Fault Finding',         'Intermittent tripping on lighting circuit', 200, 40, 240.00, 'Paid', '2023-09-18', '2023-08-19', '2023-08-19', '2023-08-30'),
  ('40000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'GH-INV004', '30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', 'Emma Woodward',   'Lighting Install',      'Install 6x downlights in kitchen', 300, 60, 360.00, 'Paid', '2023-11-15', '2023-10-16', '2023-10-16', '2023-11-01'),
  ('40000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'GH-INV005', '30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000005', 'Michael Harris',  'EICR',                  'EICR - landlord certificate for rental property', 280, 56, 336.00, 'Paid', '2024-01-18', '2023-12-19', '2023-12-19', '2024-01-05'),
  -- Recent: draft invoice for completed emergency job
  ('40000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'GH-INV006', '30000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001', 'James Thompson',  'Fault Finding',         'Power keeps tripping when using kitchen appliances', 300, 60, 360.00, 'Draft', '2026-04-26', '2026-03-27', null, null);

-- Update jobs with their invoice IDs
update jobs set invoice_id = '40000000-0000-0000-0000-000000000001' where id = '30000000-0000-0000-0000-000000000001';
update jobs set invoice_id = '40000000-0000-0000-0000-000000000002' where id = '30000000-0000-0000-0000-000000000002';
update jobs set invoice_id = '40000000-0000-0000-0000-000000000003' where id = '30000000-0000-0000-0000-000000000003';
update jobs set invoice_id = '40000000-0000-0000-0000-000000000004' where id = '30000000-0000-0000-0000-000000000004';
update jobs set invoice_id = '40000000-0000-0000-0000-000000000005' where id = '30000000-0000-0000-0000-000000000005';
update jobs set invoice_id = '40000000-0000-0000-0000-000000000006' where id = '30000000-0000-0000-0000-000000000009';

-- ─────────────────────────────────────────────────────────────────────────────
-- Schedule Events (upcoming week)
-- ─────────────────────────────────────────────────────────────────────────────

insert into schedule_events (org_id, job_id, customer_id, customer_name, job_type, date, slot, status, notes) values
  ('00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000008', 'Claire Taylor', 'Ethernet Wiring',       '2026-04-10', 'morning',   'Scheduled', 'Run Cat6 to home office - 2 points'),
  ('00000000-0000-0000-0000-000000000001', null,                                   '10000000-0000-0000-0000-000000000001', 'James Thompson','Consumer Unit Upgrade', '2026-04-09', 'full',      'Scheduled', 'Booked Consumer Unit Upgrade for James Thompson'),
  ('00000000-0000-0000-0000-000000000001', null,                                   '10000000-0000-0000-0000-000000000002', 'Sarah Clarke',  'EICR',                  '2026-04-11', 'morning',   'Scheduled', 'Booked EICR for Sarah Clarke'),
  ('00000000-0000-0000-0000-000000000001', null,                                   '10000000-0000-0000-0000-000000000003', 'David Patel',   'Lighting Install',      '2026-04-11', 'afternoon', 'Scheduled', 'Booked Lighting Install for David Patel'),
  ('00000000-0000-0000-0000-000000000001', null,                                   '10000000-0000-0000-0000-000000000004', 'Emma Woodward', 'Minor Works',           '2026-04-14', 'morning',   'Scheduled', 'Booked Minor Works for Emma Woodward'),
  ('00000000-0000-0000-0000-000000000001', null,                                   '10000000-0000-0000-0000-000000000005', 'Michael Harris','EV Charger Install',    '2026-04-15', 'full',      'Scheduled', 'Booked EV Charger Install for Michael Harris');

-- ─────────────────────────────────────────────────────────────────────────────
-- Communications Log (sample messages)
-- ─────────────────────────────────────────────────────────────────────────────

insert into communications (org_id, customer_id, customer_name, template_name, channel, status, date, body) values
  -- Historical quote/invoice comms
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'James Thompson',  'Quote Sent',       'email',    'Delivered', '2023-04-20', 'Hi James, your quote GH-Q1001 for Consumer Unit Upgrade (£780.00 inc. VAT) is ready. Let me know if you have any questions.'),
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'James Thompson',  'Invoice Sent',     'email',    'Delivered', '2023-05-03', 'Invoice GH-INV001 for £780.00 has been sent. Payment due by 2023-06-02.'),
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'James Thompson',  'Payment Received', 'email',    'Delivered', '2023-05-15', 'Payment of £780.00 received for invoice GH-INV001. Thank you!'),
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'Sarah Clarke',    'Quote Sent',       'whatsapp', 'Delivered', '2023-05-28', 'Hi Sarah, your quote GH-Q1002 for EV Charger Install (£1020.00 inc. VAT) is ready. Let me know if you have any questions.'),
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'Sarah Clarke',    'Invoice Sent',     'email',    'Delivered', '2023-06-13', 'Invoice GH-INV002 for £1020.00 has been sent. Payment due by 2023-07-12.'),
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'Sarah Clarke',    'Payment Received', 'email',    'Delivered', '2023-06-28', 'Payment of £1020.00 received for invoice GH-INV002. Thank you!'),

  -- Expired quote follow-up
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000006', 'Rachel Mitchell', 'Quote Sent',       'email',    'Delivered', '2024-02-10', 'Hi Rachel, your quote GH-Q1006 for Rewire (£4200.00 inc. VAT) is ready. Let me know if you have any questions.'),
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000006', 'Rachel Mitchell', 'Follow Up',        'whatsapp', 'Read',      '2024-02-28', 'Hi Rachel, just following up on the quote I sent over for Rewire. Happy to answer any questions or adjust if needed. Cheers, Matt'),

  -- Recent activity
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000008', 'Claire Taylor',   'Quote Sent',       'email',    'Delivered', '2026-03-15', 'Hi Claire, your quote GH-Q1008 for Ethernet Wiring (£300.00 inc. VAT) is ready. Let me know if you have any questions.'),
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000008', 'Claire Taylor',   'Appointment Reminder', 'whatsapp', 'Read',  '2026-04-09', 'Hi Claire, just a reminder about your Ethernet Wiring appointment tomorrow. I''ll be with you between 8-12. Cheers, Matt'),
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'James Thompson',  'Quote Sent',       'whatsapp', 'Delivered', '2026-03-25', 'Hi James, your quote GH-Q1011 for Fault Finding (£360.00 inc. VAT) is ready. Let me know if you have any questions.'),
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'James Thompson',  'Job Complete',     'email',    'Delivered', '2026-03-26', 'Hi James, your Fault Finding has been completed. Thanks for choosing Grey Havens Electrical.'),
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000009', 'Robert Walker',   'Quote Sent',       'email',    'Delivered', '2026-04-01', 'Hi Robert, your quote GH-Q1009 for Minor Works (£144.00 inc. VAT) is ready. Let me know if you have any questions.');

-- ─────────────────────────────────────────────────────────────────────────────
-- Sample Expenses
-- ─────────────────────────────────────────────────────────────────────────────

insert into expenses (org_id, date, supplier, description, category, amount, vat, total, job_id, receipt, created_at) values
  ('00000000-0000-0000-0000-000000000001', '2023-04-15', 'CEF Colchester',      '18th Edition consumer unit + MCBs',           'Materials',           185.00, 37.00, 222.00, '30000000-0000-0000-0000-000000000001', true,  '2023-04-15'),
  ('00000000-0000-0000-0000-000000000001', '2023-05-10', 'Edmundson Electrical', 'Zappi V2 EV charger unit',                    'Materials',           320.00, 64.00, 384.00, '30000000-0000-0000-0000-000000000002', true,  '2023-05-10'),
  ('00000000-0000-0000-0000-000000000001', '2023-06-01', 'Shell',               'Diesel - June',                                'Vehicle',             95.00,  19.00, 114.00, null,                                   true,  '2023-06-01'),
  ('00000000-0000-0000-0000-000000000001', '2023-07-15', 'Screwfix',            'LED downlights x12, fire hoods, driver units', 'Materials',           78.50,  15.70, 94.20,  null,                                   true,  '2023-07-15'),
  ('00000000-0000-0000-0000-000000000001', '2023-09-01', 'NICEIC',              'Annual scheme membership',                     'Subscriptions',       360.00, 72.00, 432.00, null,                                   true,  '2023-09-01'),
  ('00000000-0000-0000-0000-000000000001', '2024-01-10', 'Toolstation',         'Fluke T6 voltage tester',                      'Tools & Equipment',   189.00, 37.80, 226.80, null,                                   true,  '2024-01-10'),
  ('00000000-0000-0000-0000-000000000001', '2024-03-15', 'AXA Insurance',       'Public liability insurance renewal',           'Insurance',           420.00, 0.00,  420.00, null,                                   true,  '2024-03-15'),
  ('00000000-0000-0000-0000-000000000001', '2024-06-20', 'IET',                 '18th Edition course - Amendment 2',            'Training',            295.00, 59.00, 354.00, null,                                   true,  '2024-06-20'),
  ('00000000-0000-0000-0000-000000000001', '2026-03-20', 'CEF Colchester',      'Cable, clips, junction boxes for ethernet run','Materials',           45.00,  9.00,  54.00,  '30000000-0000-0000-0000-000000000006', true,  '2026-03-20'),
  ('00000000-0000-0000-0000-000000000001', '2026-04-01', 'Shell',               'Diesel - April',                               'Vehicle',             102.00, 20.40, 122.40, null,                                   true,  '2026-04-01');

-- =============================================================================
-- DONE — Demo data seeded for Grey Havens Electrical
-- =============================================================================
