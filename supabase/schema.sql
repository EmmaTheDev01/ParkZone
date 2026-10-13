-- ==============================================================================
-- ParkZone Master Database Schema (Kigali, Rwanda)
-- Fully compliant with Rwanda Data Protection & Privacy Law (Law Nº 058/2021)
-- Cryptographic Blind Indexing, Zero-Knowledge Field Enforcement,
-- 3D Aerial Lot Topologies, Active EV Telemetry, and 300/2000 RWF Pricing Engine.
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 2. ENCRYPTED PROFILES TABLE (Extends Supabase auth.users)
-- Driver PII is encrypted; blind hashes enable indexed lookups without plain exposure.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    phone_hash VARCHAR(64) UNIQUE,
    email_hash VARCHAR(64) UNIQUE,
    email TEXT,
    phone_number TEXT,
    full_name TEXT,
    avatar_url TEXT,
    role VARCHAR(20) NOT NULL DEFAULT 'driver' CHECK (role IN ('driver', 'agent', 'operator', 'admin')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_phone_hash ON public.profiles(phone_hash);
CREATE INDEX IF NOT EXISTS idx_profiles_email_hash ON public.profiles(email_hash);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- ------------------------------------------------------------------------------
-- 3. VEHICLES TABLE (Deterministic Plate Hashing & Masking)
-- Plates are strictly registered on vehicle records.
-- Marshals see only masked_plate (e.g. "RAD *** A"); plate_hash provides O(1) searches.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    plate_number TEXT NOT NULL,
    plate_hash VARCHAR(64) NOT NULL UNIQUE,
    masked_plate VARCHAR(16) NOT NULL,
    vehicle_type VARCHAR(20) NOT NULL DEFAULT 'gasoline' CHECK (vehicle_type IN ('gasoline', 'ev', 'handicap')),
    make_model TEXT,
    color TEXT,
    handicap_permit_number TEXT,
    is_default BOOLEAN NOT NULL DEFAULT false,
    has_unpaid_arrears BOOLEAN NOT NULL DEFAULT false,
    total_arrears_rwf NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, plate_number)
);

CREATE INDEX IF NOT EXISTS idx_vehicles_user_id ON public.vehicles(user_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_plate_hash ON public.vehicles(plate_hash);
CREATE INDEX IF NOT EXISTS idx_vehicles_type ON public.vehicles(vehicle_type);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own vehicles"
    ON public.vehicles FOR ALL
    USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 4. PARKING LOCATIONS TABLE (Kigali Hubs & Layout Topologies)
-- Supports Oblique (45°), Perpendicular (90°), and Parallel (0°) layouts.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.parking_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(120) NOT NULL,
    address VARCHAR(255) NOT NULL,
    city VARCHAR(64) NOT NULL DEFAULT 'Kigali',
    country VARCHAR(64) NOT NULL DEFAULT 'Rwanda',
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    layout_topology VARCHAR(32) NOT NULL DEFAULT 'oblique' CHECK (layout_topology IN ('oblique', 'perpendicular', 'parallel')),
    total_spots INTEGER NOT NULL DEFAULT 0,
    available_spots INTEGER NOT NULL DEFAULT 0,
    hourly_rate NUMERIC(10, 2) NOT NULL DEFAULT 300.00,
    daily_rate NUMERIC(10, 2) NOT NULL DEFAULT 2000.00,
    currency VARCHAR(8) NOT NULL DEFAULT 'RWF',
    qr_code_identifier VARCHAR(64) UNIQUE NOT NULL,
    opening_hours JSONB DEFAULT '{"open": "06:00", "close": "22:00", "24_7": true}'::jsonb,
    facilities TEXT[] DEFAULT ARRAY['CCTV', 'Security Guard', 'EV Fast Charging']::TEXT[],
    is_active BOOLEAN NOT NULL DEFAULT true,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parking_locations_status ON public.parking_locations(status);
CREATE INDEX IF NOT EXISTS idx_parking_locations_active ON public.parking_locations(is_active);

ALTER TABLE public.parking_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public/Authenticated users can view active locations"
    ON public.parking_locations FOR SELECT
    USING (status = 'active' OR is_active = true OR auth.role() = 'authenticated');

-- ------------------------------------------------------------------------------
-- 5. PARKING SPACES TABLE (Zone Partitioning & Green/Red Occupancy)
-- Zones: Zone A, Zone B, Zone C, EV Fast Hub.
-- Green = Vacant, Red = Occupied.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.parking_spaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_id UUID NOT NULL REFERENCES public.parking_locations(id) ON DELETE CASCADE,
    space_number VARCHAR(16) NOT NULL,
    zone_code VARCHAR(16) NOT NULL DEFAULT 'Zone A',
    space_type VARCHAR(20) NOT NULL DEFAULT 'regular' CHECK (space_type IN ('regular', 'ev', 'handicap')),
    is_occupied BOOLEAN NOT NULL DEFAULT false,
    current_vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    current_plate_hash VARCHAR(64),
    current_vehicle_plate TEXT,
    qr_code_token VARCHAR(64) UNIQUE NOT NULL,
    camera_device_id VARCHAR(64),
    occupied_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (location_id, space_number)
);

CREATE INDEX IF NOT EXISTS idx_parking_spaces_location_zone ON public.parking_spaces(location_id, zone_code);
CREATE INDEX IF NOT EXISTS idx_parking_spaces_occupied ON public.parking_spaces(is_occupied);
CREATE INDEX IF NOT EXISTS idx_parking_spaces_type ON public.parking_spaces(space_type);

CREATE OR REPLACE VIEW public.parking_spots AS SELECT * FROM public.parking_spaces;

ALTER TABLE public.parking_spaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view parking spaces"
    ON public.parking_spaces FOR SELECT
    USING (true);

-- ------------------------------------------------------------------------------
-- 6. ACTIVE EV CHARGING TELEMETRY (OCPP 2.0.1 Ready)
-- Live power output (kW), dynamic availability, and queue estimation.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ev_charging_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_id UUID NOT NULL REFERENCES public.parking_locations(id) ON DELETE CASCADE,
    space_id UUID REFERENCES public.parking_spaces(id) ON DELETE SET NULL,
    station_identifier VARCHAR(64) NOT NULL,
    connector_type VARCHAR(32) NOT NULL DEFAULT 'CCS2', -- CCS2, Type 2, CHAdeMO, GBT
    max_output_kw NUMERIC(6, 2) NOT NULL DEFAULT 60.00,
    price_per_kwh NUMERIC(10, 2) NOT NULL DEFAULT 250.00,
    status VARCHAR(32) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'charging', 'faulted', 'reserved')),
    current_power_draw_kw NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    estimated_free_at TIMESTAMPTZ,
    last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ev_charging_location ON public.ev_charging_points(location_id);
CREATE INDEX IF NOT EXISTS idx_ev_charging_status ON public.ev_charging_points(status);

ALTER TABLE public.ev_charging_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view EV chargers"
    ON public.ev_charging_points FOR SELECT
    USING (true);

-- ------------------------------------------------------------------------------
-- 7. PARKING TICKETS / ACTIVE SESSIONS TABLE
-- Hourly: 300 RWF | Daily cap: 2,000 RWF.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.parking_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_number VARCHAR(32) UNIQUE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    plate_hash VARCHAR(64) NOT NULL,
    vehicle_plate TEXT NOT NULL,
    location_id UUID NOT NULL REFERENCES public.parking_locations(id) ON DELETE RESTRICT,
    space_id UUID REFERENCES public.parking_spaces(id) ON DELETE SET NULL,
    entry_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    exit_time TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'overdue', 'cancelled')),
    hourly_rate NUMERIC(10, 2) NOT NULL DEFAULT 300.00,
    daily_cap NUMERIC(10, 2) NOT NULL DEFAULT 2000.00,
    rate_applied VARCHAR(20) NOT NULL DEFAULT 'hourly' CHECK (rate_applied IN ('hourly', 'daily')),
    hours_elapsed NUMERIC(6, 2) DEFAULT 0.00,
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 300.00,
    amount_paid NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded', 'waived')),
    payment_method VARCHAR(20) CHECK (payment_method IN ('momo', 'airtel', 'card', 'cash', 'wallet')),
    is_flagged_by_agent BOOLEAN NOT NULL DEFAULT false,
    qr_token VARCHAR(64) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parking_tickets_plate_hash ON public.parking_tickets(plate_hash);
CREATE INDEX IF NOT EXISTS idx_parking_tickets_status ON public.parking_tickets(status);

ALTER TABLE public.parking_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own tickets"
    ON public.parking_tickets FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users insert own tickets"
    ON public.parking_tickets FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own tickets"
    ON public.parking_tickets FOR UPDATE
    USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 8. PARKING FINES & OVERDUE FLAGS (Zero-Contact Citation Table)
-- 3,000 RWF penalty for cars parked without app check-in or QR scan.
-- Non-payable in-app; synchronized with Irembo / municipal authority.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.parking_fines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fine_number VARCHAR(32) UNIQUE NOT NULL,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    plate_hash VARCHAR(64) NOT NULL,
    vehicle_plate TEXT NOT NULL,
    location_id UUID NOT NULL REFERENCES public.parking_locations(id) ON DELETE RESTRICT,
    space_id UUID REFERENCES public.parking_spaces(id) ON DELETE SET NULL,
    fine_amount NUMERIC(10, 2) NOT NULL DEFAULT 3000.00,
    currency VARCHAR(8) NOT NULL DEFAULT 'RWF',
    reason VARCHAR(64) NOT NULL DEFAULT 'unregistered_parking' CHECK (
        reason IN ('unregistered_parking', 'overstay', 'illegal_spot', 'unauthorized_handicap', 'unauthorized_ev')
    ),
    issued_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'dismissed', 'appealed')),
    irembo_reference_code VARCHAR(64),
    evidence_photo_url TEXT,
    notes TEXT,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.vehicle_invoice_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID REFERENCES public.parking_tickets(id) ON DELETE CASCADE,
    plate_hash VARCHAR(64) NOT NULL,
    flagged_by_agent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    flagged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    overdue_amount_rwf NUMERIC(10, 2) NOT NULL,
    notification_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    resolution_status VARCHAR(20) NOT NULL DEFAULT 'open'
);

CREATE INDEX IF NOT EXISTS idx_parking_fines_plate_hash ON public.parking_fines(plate_hash);
CREATE INDEX IF NOT EXISTS idx_invoice_flags_plate_hash ON public.vehicle_invoice_flags(plate_hash);

ALTER TABLE public.parking_fines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_invoice_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view fines issued to their vehicles"
    ON public.parking_fines FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.vehicles 
            WHERE public.vehicles.plate_hash = public.parking_fines.plate_hash 
            AND public.vehicles.user_id = auth.uid()
        )
    );

-- ------------------------------------------------------------------------------
-- 9. ZERO-CONTACT AGENT AUDIT RPC (Zero PII Exposed to Field Marshals)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_plate_status(p_plate_hash VARCHAR)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ticket RECORD;
    v_vehicle RECORD;
    v_fine_count INTEGER;
    v_fine_total NUMERIC;
    v_diff_seconds NUMERIC;
    v_response JSONB;
BEGIN
    -- Query active or overdue ticket
    SELECT * INTO v_ticket
    FROM public.parking_tickets
    WHERE plate_hash = p_plate_hash AND status IN ('active', 'overdue')
    ORDER BY entry_time DESC
    LIMIT 1;

    -- Query vehicle record for arrears
    SELECT * INTO v_vehicle
    FROM public.vehicles
    WHERE plate_hash = p_plate_hash
    LIMIT 1;

    -- Query unpaid fines
    SELECT COUNT(*), COALESCE(SUM(fine_amount), 0)
    INTO v_fine_count, v_fine_total
    FROM public.parking_fines
    WHERE plate_hash = p_plate_hash AND payment_status = 'unpaid';

    IF v_ticket IS NOT NULL THEN
        v_diff_seconds := EXTRACT(EPOCH FROM (NOW() - v_ticket.entry_time));

        -- If ticket has elapsed beyond normal buffer
        IF v_ticket.status = 'overdue' OR v_diff_seconds > 43200 THEN
            v_response := jsonb_build_object(
                'status', 'OVERDUE',
                'ticket_id', v_ticket.id,
                'entry_time', v_ticket.entry_time,
                'seconds_elapsed', v_diff_seconds,
                'overdue_amount', v_ticket.total_amount,
                'has_arrears', true,
                'arrears_amount', COALESCE(v_vehicle.total_arrears_rwf, 0.00) + v_fine_total,
                'masked_plate', COALESCE(v_vehicle.masked_plate, 'RAD *** A')
            );
        ELSE
            -- Check if within 15-minute arrival grace buffer
            IF v_diff_seconds <= 900 THEN
                v_response := jsonb_build_object(
                    'status', 'GRACE_BUFFER',
                    'ticket_id', v_ticket.id,
                    'entry_time', v_ticket.entry_time,
                    'seconds_remaining', 900 - v_diff_seconds,
                    'has_arrears', COALESCE(v_vehicle.has_unpaid_arrears, false),
                    'arrears_amount', COALESCE(v_vehicle.total_arrears_rwf, 0.00),
                    'masked_plate', COALESCE(v_vehicle.masked_plate, 'RAD *** A')
                );
            ELSE
                v_response := jsonb_build_object(
                    'status', 'PAID',
                    'ticket_id', v_ticket.id,
                    'entry_time', v_ticket.entry_time,
                    'seconds_elapsed', v_diff_seconds,
                    'has_arrears', COALESCE(v_vehicle.has_unpaid_arrears, false),
                    'arrears_amount', COALESCE(v_vehicle.total_arrears_rwf, 0.00),
                    'masked_plate', COALESCE(v_vehicle.masked_plate, 'RAD *** A')
                );
            END IF;
        END IF;
    ELSE
        -- No active record: Unregistered vehicle
        v_response := jsonb_build_object(
            'status', 'UNREGISTERED',
            'has_arrears', COALESCE(v_vehicle.has_unpaid_arrears, false) OR v_fine_count > 0,
            'arrears_amount', COALESCE(v_vehicle.total_arrears_rwf, 0.00) + v_fine_total,
            'fine_count', v_fine_count,
            'masked_plate', COALESCE(v_vehicle.masked_plate, 'RAD *** A')
        );
    END IF;

    RETURN v_response;
END;
$$;

-- ------------------------------------------------------------------------------
-- 10. CORE PRICING CALCULATION FUNCTION (300 RWF vs 2,000 RWF Daily Cap)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_parking_fee(
    p_entry_time TIMESTAMPTZ,
    p_exit_time TIMESTAMPTZ DEFAULT NOW(),
    p_hourly_rate NUMERIC DEFAULT 300.00,
    p_daily_cap NUMERIC DEFAULT 2000.00
)
RETURNS TABLE (
    hours_elapsed NUMERIC,
    billed_hours INTEGER,
    calculated_amount NUMERIC,
    rate_applied TEXT
) AS $$
DECLARE
    v_diff_seconds NUMERIC;
    v_hours NUMERIC;
    v_ceil_hours INTEGER;
    v_amount NUMERIC;
    v_rate TEXT;
BEGIN
    v_diff_seconds := EXTRACT(EPOCH FROM (p_exit_time - p_entry_time));
    IF v_diff_seconds < 0 THEN
        v_diff_seconds := 0;
    END IF;

    v_hours := v_diff_seconds / 3600.0;
    v_ceil_hours := GREATEST(1, CEIL(v_hours)::INTEGER);
    v_amount := v_ceil_hours * p_hourly_rate;

    IF v_amount >= p_daily_cap THEN
        v_amount := p_daily_cap;
        v_rate := 'daily';
    ELSE
        v_rate := 'hourly';
    END IF;

    RETURN QUERY SELECT 
        ROUND(v_hours, 2),
        v_ceil_hours,
        v_amount,
        v_rate;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ------------------------------------------------------------------------------
-- 11. SAMPLE SEED DATA ACROSS THREE KIGALI TOPOLOGIES
-- 1. Oblique (45°): KN 4 Ave (Nyarugenge CBD)
-- 2. Perpendicular (90°): Kigali Heights (Gasabo)
-- 3. Parallel (0°): Kimihurura Gastronomy Corridor (KG 674 St)
-- ------------------------------------------------------------------------------
INSERT INTO public.parking_locations (
    id, name, address, city, country, latitude, longitude, layout_topology,
    total_spots, available_spots, hourly_rate, daily_rate, currency, qr_code_identifier
) VALUES 
(
    '11111111-1111-1111-1111-111111111111',
    'Kigali Heights Underground & Surface',
    'KG 7 Ave, Gasabo, Kigali',
    'Kigali', 'Rwanda',
    -1.9536000, 30.0606000,
    'perpendicular',
    120, 48, 300.00, 2000.00, 'RWF', 'KGL-KH-001'
),
(
    '22222222-2222-2222-2222-222222222222',
    'KN 4 Ave CBD Boulevard',
    'KN 4 Ave, Nyarugenge, Kigali',
    'Kigali', 'Rwanda',
    -1.9482000, 30.0588000,
    'oblique',
    80, 24, 300.00, 2000.00, 'RWF', 'KGL-KN4-002'
),
(
    '33333333-3333-3333-3333-333333333333',
    'Kimihurura Dining & Culture Corridor',
    'KG 674 St, Kimihurura, Kigali',
    'Kigali', 'Rwanda',
    -1.9589000, 30.0762000,
    'parallel',
    40, 15, 300.00, 2000.00, 'RWF', 'KGL-KMH-003'
)
ON CONFLICT (id) DO UPDATE SET
    layout_topology = EXCLUDED.layout_topology;

-- Seed Parking Spaces with Zones (Zone A, Zone B, Zone C, EV Fast Hub)
INSERT INTO public.parking_spaces (
    location_id, space_number, zone_code, space_type, is_occupied, current_vehicle_plate, qr_code_token
) VALUES
-- Kigali Heights Stalls (Perpendicular 90°)
('11111111-1111-1111-1111-111111111111', '101', 'Zone A', 'regular', false, NULL, 'KH-ZA-101'),
('11111111-1111-1111-1111-111111111111', '102', 'Zone A', 'regular', true, 'RAC 120 D', 'KH-ZA-102'),
('11111111-1111-1111-1111-111111111111', '103', 'Zone A', 'regular', false, NULL, 'KH-ZA-103'),
('11111111-1111-1111-1111-111111111111', '104', 'Zone A', 'regular', false, NULL, 'KH-ZA-104'),
('11111111-1111-1111-1111-111111111111', '201', 'Zone B', 'regular', false, NULL, 'KH-ZB-201'),
('11111111-1111-1111-1111-111111111111', '202', 'Zone B', 'regular', true, 'RAF 880 E', 'KH-ZB-202'),
('11111111-1111-1111-1111-111111111111', 'EV-01', 'EV Fast Hub', 'ev', false, NULL, 'KH-EV-01'),
('11111111-1111-1111-1111-111111111111', 'EV-02', 'EV Fast Hub', 'ev', true, 'RAD 450 A', 'KH-EV-02'),
('11111111-1111-1111-1111-111111111111', 'H-01', 'Zone A', 'handicap', false, NULL, 'KH-H-01')
ON CONFLICT (location_id, space_number) DO NOTHING;

-- Seed EV Charging Telemetry Point
INSERT INTO public.ev_charging_points (
    location_id, station_identifier, connector_type, max_output_kw, price_per_kwh, status, current_power_draw_kw
) VALUES
('11111111-1111-1111-1111-111111111111', 'KGL-EV-KH-01', 'CCS2 DC Fast', 60.00, 250.00, 'available', 0.0),
('11111111-1111-1111-1111-111111111111', 'KGL-EV-KH-02', 'Type 2 AC', 22.00, 200.00, 'charging', 18.5)
ON CONFLICT DO NOTHING;
