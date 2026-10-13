# ParkZone Admin Panel: Next.js Integration, Architecture, DB Types & Feature Specification

> **Target Application**: `parkzone_admin` (Next.js 14/15 App Router)  
> **Backend & Database**: Supabase PostgreSQL (Shared with ParkZone Mobile App)  
> **Auth & Access Control**: Supabase Auth with Role-Based Access Control (`profiles.role = 'admin'`)  
> **Purpose**: Complete guide for your agent/developer to implement all features, database connections, TypeScript types, and server actions for the ParkZone Admin Web App.

---

## 1. System Overview & The Admin's Role

The **ParkZone Mobile App** relies dynamically on data configured by the **ParkZone Admin Panel**:
1. **Locations & Topologies**: Admins create parking locations in Kigali, setting precise GPS coordinates (`latitude`, `longitude`) and choosing the layout topology (`oblique` 45°, `perpendicular` 90°, or `parallel`).
2. **Parking Bays / Spaces**: Admins configure individual bays (e.g., `Bay 101`), assigning them to zones (`Zone A`, `Zone B`, `Zone C`) and types (`regular`, `ev`, `handicap`).
3. **EV Fast Charging Stations**: Admins provision EV charging points (`CCS2 DC Fast`, `Type 2 AC`, etc.), setting power output (kW), tariffs (RWF/kWh), and monitoring live telemetry.
4. **Enforcement & Arrears Oversight**: Admins inspect all active parking sessions, monitor 3,000 RWF citations issued to unregistered vehicles with Irembo reference codes, and audit flagged overdue invoices.

---

## 2. Environment Variables & Supabase Setup (`.env.local`)

Place these environment variables in `/Users/macbook/Documents/Dev/parkzone_admin/.env.local`:

```bash
# Public Supabase credentials (same project as ParkZone mobile app)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Secret Service Role Key (Used strictly on server-side for admin bypass if needed)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 3. Supabase Client Configurations for Next.js App Router

### 3.1 Browser Client (`lib/supabase/client.ts`)
```typescript
import { createBrowserClient } from "@supabase/ssr";
import { Database } from "@/types/database";

export function createClient() {
    return createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
}
```

### 3.2 Server Client (`lib/supabase/server.ts`)
```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { Database } from "@/types/database";

export async function createClient() {
    const cookieStore = await cookies();

    return createServerClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch {
                        // The `setAll` method was called from a Server Component.
                    }
                },
            },
        }
    );
}
```

### 3.3 Privileged Admin Service Client (`lib/supabase/admin.ts`)
```typescript
import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";

export function createAdminClient() {
    return createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    );
}
```

---

## 4. Complete TypeScript Database Types (`types/database.ts`)

Copy and paste this into `types/database.ts` in your Next.js project:

```typescript
export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[];

export type UserRole = "driver" | "agent" | "operator" | "admin";
export type VehicleType = "gasoline" | "ev" | "handicap";
export type TopologyType = "oblique" | "perpendicular" | "parallel";
export type SpaceType = "regular" | "ev" | "handicap";
export type TicketStatus = "active" | "completed" | "overdue" | "cancelled";
export type PaymentStatus = "unpaid" | "paid" | "refunded" | "waived" | "dismissed" | "appealed";
export type EVStatus = "available" | "charging" | "faulted" | "reserved";

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string;
                    email: string | null;
                    phone_number: string | null;
                    full_name: string | null;
                    avatar_url: string | null;
                    role: UserRole;
                    is_active: boolean;
                    phone_hash: string | null;
                    email_hash: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id: string;
                    email?: string | null;
                    phone_number?: string | null;
                    full_name?: string | null;
                    avatar_url?: string | null;
                    role?: UserRole;
                    is_active?: boolean;
                    phone_hash?: string | null;
                    email_hash?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
            };
            vehicles: {
                Row: {
                    id: string;
                    user_id: string;
                    plate_number: string;
                    plate_hash: string;
                    masked_plate: string;
                    vehicle_type: VehicleType;
                    make_model: string | null;
                    color: string | null;
                    handicap_permit_number: string | null;
                    is_default: boolean;
                    has_unpaid_arrears: boolean;
                    total_arrears_rwf: number;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    plate_number: string;
                    plate_hash: string;
                    masked_plate: string;
                    vehicle_type?: VehicleType;
                    make_model?: string | null;
                    color?: string | null;
                    handicap_permit_number?: string | null;
                    is_default?: boolean;
                    has_unpaid_arrears?: boolean;
                    total_arrears_rwf?: number;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: Partial<Database["public"]["Tables"]["vehicles"]["Insert"]>;
            };
            parking_locations: {
                Row: {
                    id: string;
                    name: string;
                    address: string;
                    city: string;
                    country: string;
                    latitude: number;
                    longitude: number;
                    layout_topology: TopologyType;
                    total_spots: number;
                    available_spots: number;
                    hourly_rate: number;
                    daily_rate: number;
                    currency: string;
                    qr_code_identifier: string;
                    opening_hours: Json | null;
                    facilities: string[] | null;
                    is_active: boolean;
                    status: "active" | "inactive" | "maintenance";
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    name: string;
                    address: string;
                    city?: string;
                    country?: string;
                    latitude: number;
                    longitude: number;
                    layout_topology?: TopologyType;
                    total_spots?: number;
                    available_spots?: number;
                    hourly_rate?: number;
                    daily_rate?: number;
                    currency?: string;
                    qr_code_identifier: string;
                    opening_hours?: Json | null;
                    facilities?: string[] | null;
                    is_active?: boolean;
                    status?: "active" | "inactive" | "maintenance";
                    created_at?: string;
                    updated_at?: string;
                };
                Update: Partial<Database["public"]["Tables"]["parking_locations"]["Insert"]>;
            };
            parking_spaces: {
                Row: {
                    id: string;
                    location_id: string;
                    space_number: string;
                    zone_code: string;
                    space_type: SpaceType;
                    is_occupied: boolean;
                    current_vehicle_id: string | null;
                    current_plate_hash: string | null;
                    current_vehicle_plate: string | null;
                    qr_code_token: string;
                    camera_device_id: string | null;
                    occupied_at: string | null;
                    is_active: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    location_id: string;
                    space_number: string;
                    zone_code?: string;
                    space_type?: SpaceType;
                    is_occupied?: boolean;
                    current_vehicle_id?: string | null;
                    current_plate_hash?: string | null;
                    current_vehicle_plate?: string | null;
                    qr_code_token: string;
                    camera_device_id?: string | null;
                    occupied_at?: string | null;
                    is_active?: boolean;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: Partial<Database["public"]["Tables"]["parking_spaces"]["Insert"]>;
            };
            ev_charging_points: {
                Row: {
                    id: string;
                    location_id: string;
                    space_id: string | null;
                    station_identifier: string;
                    connector_type: string;
                    max_output_kw: number;
                    price_per_kwh: number;
                    status: EVStatus;
                    current_power_draw_kw: number;
                    estimated_free_at: string | null;
                    last_heartbeat: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    location_id: string;
                    space_id?: string | null;
                    station_identifier: string;
                    connector_type?: string;
                    max_output_kw?: number;
                    price_per_kwh?: number;
                    status?: EVStatus;
                    current_power_draw_kw?: number;
                    estimated_free_at?: string | null;
                    last_heartbeat?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: Partial<Database["public"]["Tables"]["ev_charging_points"]["Insert"]>;
            };
            parking_tickets: {
                Row: {
                    id: string;
                    ticket_number: string;
                    user_id: string | null;
                    vehicle_id: string | null;
                    plate_hash: string;
                    vehicle_plate: string;
                    location_id: string;
                    space_id: string | null;
                    entry_time: string;
                    exit_time: string | null;
                    status: TicketStatus;
                    hourly_rate: number;
                    daily_cap: number;
                    rate_applied: "hourly" | "daily";
                    hours_elapsed: number;
                    total_amount: number;
                    amount_paid: number;
                    payment_status: PaymentStatus;
                    payment_method: string | null;
                    is_flagged_by_agent: boolean;
                    qr_token: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    ticket_number: string;
                    user_id?: string | null;
                    vehicle_id?: string | null;
                    plate_hash: string;
                    vehicle_plate: string;
                    location_id: string;
                    space_id?: string | null;
                    entry_time?: string;
                    exit_time?: string | null;
                    status?: TicketStatus;
                    hourly_rate?: number;
                    daily_cap?: number;
                    rate_applied?: "hourly" | "daily";
                    hours_elapsed?: number;
                    total_amount?: number;
                    amount_paid?: number;
                    payment_status?: PaymentStatus;
                    payment_method?: string | null;
                    is_flagged_by_agent?: boolean;
                    qr_token: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: Partial<Database["public"]["Tables"]["parking_tickets"]["Insert"]>;
            };
            parking_fines: {
                Row: {
                    id: string;
                    fine_number: string;
                    vehicle_id: string | null;
                    plate_hash: string;
                    vehicle_plate: string;
                    location_id: string;
                    space_id: string | null;
                    fine_amount: number;
                    currency: string;
                    reason: string;
                    issued_by: string | null;
                    payment_status: PaymentStatus;
                    irembo_reference_code: string | null;
                    evidence_photo_url: string | null;
                    notes: string | null;
                    issued_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    fine_number: string;
                    vehicle_id?: string | null;
                    plate_hash: string;
                    vehicle_plate: string;
                    location_id: string;
                    space_id?: string | null;
                    fine_amount?: number;
                    currency?: string;
                    reason?: string;
                    issued_by?: string | null;
                    payment_status?: PaymentStatus;
                    irembo_reference_code?: string | null;
                    evidence_photo_url?: string | null;
                    notes?: string | null;
                    issued_at?: string;
                    updated_at?: string;
                };
                Update: Partial<Database["public"]["Tables"]["parking_fines"]["Insert"]>;
            };
            vehicle_invoice_flags: {
                Row: {
                    id: string;
                    ticket_id: string;
                    plate_hash: string;
                    flagged_by_agent_id: string | null;
                    flagged_at: string;
                    overdue_amount_rwf: number;
                    notification_status: string;
                    resolution_status: string;
                };
                Insert: {
                    id?: string;
                    ticket_id: string;
                    plate_hash: string;
                    flagged_by_agent_id?: string | null;
                    flagged_at?: string;
                    overdue_amount_rwf: number;
                    notification_status?: string;
                    resolution_status?: string;
                };
                Update: Partial<Database["public"]["Tables"]["vehicle_invoice_flags"]["Insert"]>;
            };
        };
    };
}
```

---

## 5. Admin Features & Functionality Specification

### Feature 1: Parking Locations CRUD
* **Route**: `/locations` or `/admin/locations`
* **Functionality**:
  * Form to create a new parking location in Kigali.
  * Fields:
    * `name`: string (e.g., "Kigali Heights Underground & Surface")
    * `address`: string (e.g., "KG 7 Ave, Gasabo, Kigali")
    * `city`: string (default "Kigali")
    * `latitude`: number (e.g., -1.9536000)
    * `longitude`: number (e.g., 30.0606000)
    * `layout_topology`: `"oblique"` (45°) | `"perpendicular"` (90°) | `"parallel"`
    * `hourly_rate`: number (default: 300 RWF)
    * `daily_rate`: number (default: 2000 RWF)
    * `total_spots`: number (e.g., 120)
    * `status`: `"active"` | `"inactive"` | `"maintenance"`
  * **Server Action Example**:
    ```typescript
    "use server";
    import { createClient } from "@/lib/supabase/server";
    import { revalidatePath } from "next/cache";

    export async function createLocation(formData: FormData) {
        const supabase = await createClient();
        const name = formData.get("name") as string;
        const code = `KGL-${name.replace(/\s+/g, "").slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

        const { error } = await supabase.from("parking_locations").insert({
            name,
            address: formData.get("address") as string,
            city: "Kigali",
            country: "Rwanda",
            latitude: parseFloat(formData.get("latitude") as string),
            longitude: parseFloat(formData.get("longitude") as string),
            layout_topology: formData.get("layout_topology") as any || "perpendicular",
            hourly_rate: parseFloat(formData.get("hourly_rate") as string || "300"),
            daily_rate: parseFloat(formData.get("daily_rate") as string || "2000"),
            total_spots: parseInt(formData.get("total_spots") as string || "50"),
            available_spots: parseInt(formData.get("total_spots") as string || "50"),
            qr_code_identifier: code,
            is_active: true,
            status: "active",
        });

        if (error) throw new Error(error.message);
        revalidatePath("/locations");
    }
    ```

---

### Feature 2: Individual Bay / Space Generator
* **Route**: `/locations/[id]/spaces`
* **Functionality**:
  * Bulk generate spaces for a chosen lot (e.g., Stalls `101` through `130`).
  * Assign to a zone: `Zone A`, `Zone B`, `Zone C`, `EV Fast Hub`.
  * Assign space type: `regular`, `ev`, `handicap`.
  * Specify `camera_device_id` for automated ANPR cameras.
  * **Server Action Example**:
    ```typescript
    "use server";
    import { createClient } from "@/lib/supabase/server";
    import { revalidatePath } from "next/cache";

    export async function bulkGenerateSpaces(locationId: string, prefix: string, count: number, zoneCode: string, type: "regular" | "ev" | "handicap") {
        const supabase = await createClient();
        const records = [];

        for (let i = 1; i <= count; i++) {
            const num = `${prefix}-${i.toString().padStart(2, "0")}`;
            records.push({
                location_id: locationId,
                space_number: num,
                zone_code: zoneCode,
                space_type: type,
                is_occupied: false,
                qr_code_token: `QR-${locationId.slice(0, 4)}-${num}`,
                is_active: true,
            });
        }

        const { error } = await supabase.from("parking_spaces").insert(records);
        if (error) throw new Error(error.message);
        revalidatePath(`/locations/${locationId}`);
    }
    ```

---

### Feature 3: EV Charging Station Telemetry & Management
* **Route**: `/ev-stations`
* **Functionality**:
  * Register new EV chargers under parking locations.
  * Fields:
    * `station_identifier`: e.g., "KGL-EV-KH-01"
    * `connector_type`: `"CCS2 DC Fast"`, `"Type 2 AC"`, `"CHAdeMO"`, `"GBT"`
    * `max_output_kw`: e.g., 60 kW or 150 kW
    * `price_per_kwh`: e.g., 250 RWF
    * `status`: `"available"` | `"charging"` | `"faulted"` | `"reserved"`
  * Live power simulation or OCPP webhook updates.

---

### Feature 4: Violations & Arrears Dashboard
* **Route**: `/citations`
* **Functionality**:
  * Real-time table of issued **3,000 RWF Citations** (`parking_fines`).
  * Displays:
    * Citation number (`FN-XXXXXX`)
    * Irembo reference code (`IREMBO-RW-XXXXXX`)
    * Vehicle Plate
    * Location and timestamp
    * Evidence photo link
    * Status (`unpaid`, `paid`, `dismissed`)
  * Mark citation as verified/paid upon confirmation from municipal revenue records.

---

### Feature 5: Revenue & Commuter Cap Analytics
* **Route**: `/analytics`
* **Functionality**:
  * Live revenue calculation:
    $$\text{Total Accrued} = \sum (\text{hourly\_sessions} \times 300) + \sum (\text{daily\_capped\_sessions} \times 2000)$$
  * Occupancy rate per Kigali location ($ \text{Occupied} / \text{Total} \times 100\% $).
  * Breakdown of vehicle types parked: Gasoline vs. EV vs. Handicap.

---

## 6. Supabase Admin Row Level Security (RLS) Policies

To ensure your Next.js admin users can manage everything securely, run this SQL in your Supabase SQL Editor:

```sql
-- Allow Admin users full access across all operational tables

CREATE POLICY "Admins have full access to parking_locations"
    ON public.parking_locations FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins have full access to parking_spaces"
    ON public.parking_spaces FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins have full access to ev_charging_points"
    ON public.ev_charging_points FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins have full access to parking_fines"
    ON public.parking_fines FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins have full access to vehicle_invoice_flags"
    ON public.vehicle_invoice_flags FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );
```
