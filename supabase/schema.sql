-- ==============================================================================
-- ParkZone Complete Database Schema
-- Compatible with Supabase PostgreSQL and Row Level Security (RLS)
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. PROFILES TABLE (Extends Supabase auth.users)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE,
    phone_number TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'driver' CHECK (role IN ('driver', 'operator', 'admin')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick lookup by phone number and email
CREATE INDEX IF NOT EXISTS idx_profiles_phone_number ON public.profiles(phone_number);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles RLS Policies
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
    ON public.profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ------------------------------------------------------------------------------
-- 2. VEHICLES TABLE (User's registered vehicles)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    plate_number TEXT NOT NULL,
    make_model TEXT,
    color TEXT,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, plate_number)
);

CREATE INDEX IF NOT EXISTS idx_vehicles_user_id ON public.vehicles(user_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_plate_number ON public.vehicles(plate_number);

-- Enable RLS for vehicles
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- Vehicles RLS Policies
CREATE POLICY "Users can view their own vehicles"
    ON public.vehicles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own vehicles"
    ON public.vehicles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vehicles"
    ON public.vehicles FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own vehicles"
    ON public.vehicles FOR DELETE
    USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 3. PARKING LOCATIONS TABLE (Zones, Garages, and Lots)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.parking_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT DEFAULT 'Kigali',
    country TEXT DEFAULT 'Rwanda',
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    total_spots INTEGER NOT NULL DEFAULT 0,
    available_spots INTEGER NOT NULL DEFAULT 0,
    hourly_rate NUMERIC(10, 2) NOT NULL DEFAULT 500.00,
    currency TEXT NOT NULL DEFAULT 'RWF',
    qr_code_identifier TEXT UNIQUE NOT NULL,
    opening_hours JSONB DEFAULT '{"open": "06:00", "close": "22:00", "24_7": false}'::jsonb,
    rules TEXT,
    facilities TEXT[] DEFAULT ARRAY['CCTV', 'Security Guard']::TEXT[],
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parking_locations_status ON public.parking_locations(status);
CREATE INDEX IF NOT EXISTS idx_parking_locations_qr ON public.parking_locations(qr_code_identifier);

-- Enable RLS for parking locations
ALTER TABLE public.parking_locations ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view active parking locations
CREATE POLICY "Public/Authenticated users can view active locations"
    ON public.parking_locations FOR SELECT
    USING (status = 'active' OR auth.role() = 'authenticated');

-- Only admins/operators can manage locations
CREATE POLICY "Admins and operators can insert locations"
    ON public.parking_locations FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'operator')
        )
    );

CREATE POLICY "Admins and operators can update locations"
    ON public.parking_locations FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'operator')
        )
    );

-- ------------------------------------------------------------------------------
-- 4. PARKING TICKETS / SESSIONS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.parking_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_number TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    location_id UUID NOT NULL REFERENCES public.parking_locations(id) ON DELETE RESTRICT,
    vehicle_plate TEXT NOT NULL,
    entry_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    exit_time TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'overstay')),
    hourly_rate NUMERIC(10, 2) NOT NULL,
    total_amount NUMERIC(10, 2) DEFAULT 0.00,
    payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded', 'waived')),
    payment_method TEXT CHECK (payment_method IN ('momo', 'card', 'cash', 'wallet')),
    qr_token TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parking_tickets_user_id ON public.parking_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_parking_tickets_location_id ON public.parking_tickets(location_id);
CREATE INDEX IF NOT EXISTS idx_parking_tickets_status ON public.parking_tickets(status);
CREATE INDEX IF NOT EXISTS idx_parking_tickets_qr_token ON public.parking_tickets(qr_token);

-- Enable RLS for parking tickets
ALTER TABLE public.parking_tickets ENABLE ROW LEVEL SECURITY;

-- Tickets RLS Policies
CREATE POLICY "Users can view their own tickets"
    ON public.parking_tickets FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own parking tickets"
    ON public.parking_tickets FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Operators/Admins can view and update all tickets"
    ON public.parking_tickets FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'operator')
        )
    );

-- ------------------------------------------------------------------------------
-- 5. EMAIL LOGS (Audit trail for Resend email dispatches)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    email_type TEXT NOT NULL, -- e.g. 'otp_recovery', 'welcome', 'ticket_receipt'
    provider TEXT NOT NULL DEFAULT 'resend',
    provider_id TEXT, -- Resend Message ID returned from API
    status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'failed', 'delivered')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON public.email_logs(recipient);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON public.email_logs(created_at DESC);

-- Enable RLS for email logs
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Only admins and service role can access email logs
CREATE POLICY "Admins can view email logs"
    ON public.email_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ------------------------------------------------------------------------------
-- 6. AUTOMATIC TRIGGER FOR USER SIGNUP (Auto-create Profile)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, phone_number, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        (NEW.raw_user_meta_data->>'phone_number'),
        (NEW.raw_user_meta_data->>'full_name')
    )
    ON CONFLICT (id) DO UPDATE
    SET
        email = EXCLUDED.email,
        phone_number = COALESCE(EXCLUDED.phone_number, public.profiles.phone_number),
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to execute upon new user in auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 7. AUTOMATIC TRIGGER FOR updated_at TIMESTAMPS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_modtime
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_vehicles_modtime
    BEFORE UPDATE ON public.vehicles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_parking_locations_modtime
    BEFORE UPDATE ON public.parking_locations
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_parking_tickets_modtime
    BEFORE UPDATE ON public.parking_tickets
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
