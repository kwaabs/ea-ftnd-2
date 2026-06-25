# Backend API Requirements — Regions View Consistency

**Purpose:** The frontend currently uses multiple disconnected endpoints to power the Regions Overview page (`/regions`) and the Region Detail page (`/regions/[region]`). This causes figures to differ between the two views for the same date range and filters. This document specifies the exact endpoints, response shapes, and field semantics required for both views to be consistent.

---

## Context: What the Frontend Needs

Both pages need to display the same four categories of data:

| Category | Display Label | Definition |
|---|---|---|
| BSP Supply | "BSP Supply (Import)" | Total energy imported from the national grid via BSP meters (`meter_type = BSP`, `system_name = import_kwh`) |
| DTX Supply | "DTX Supply (Import)" | Total energy distributed via DTX meters (`meter_type = DTX`, `system_name = import_kwh`) |
| Boundary Import | "Inter-Regional Exchange — Import" | Energy flowing **into** the selected region(s) from neighboring regions via `REGIONAL_BOUNDARY` meters |
| Boundary Export | "Inter-Regional Exchange — Export" | Energy flowing **out of** the selected region(s) to neighboring regions via `REGIONAL_BOUNDARY` meters |

**Total Consumption** is derived on the frontend as:
```
Total Consumption = BSP Import + Boundary Import - Boundary Export
```

---

## The Core Problem

### Boundary Import vs Export is direction-ambiguous across endpoints

The current `/api/v1/energy-balance/regional` endpoint returns `cross_boundary_flows.boundary_meters[].import_kwh` and `export_kwh`. These field names are recorded from the **connected (neighboring) region's perspective**, not from the requested region's perspective. This means:

- For Accra West Region: a boundary meter records `export_kwh = 1,169` — but Accra West is the **exporter**, so from Accra West's perspective this is an **export**, not an import.
- The frontend reads `import_kwh` and gets `2` — which is actually Accra West's true import.
- Result: the two values are completely flipped compared to what `region-detail` computes via the dedicated boundary endpoint.

**The boundary endpoint must return import/export values from the perspective of the region being queried, not the neighboring region.**

---

## Required Endpoints

### 1. Regional Energy Summary
**Current:** `GET /api/v1/energy-balance/regional/summary`
**Status:** Working correctly. No changes required.

**Query Parameters:**
```
dateFrom: YYYY-MM-DD
dateTo:   YYYY-MM-DD
regions:  string[] (optional, repeating param)
```

**Required Response Shape:**
```json
{
  "data": [
    {
      "region": "Accra West Region",
      "total_bsp_import": 343820280,
      "total_dtx_import": 1052,
      "total_cross_boundary_net": -1161,
      "total_net_consumption": 343819114,
      "day_count": 30,
      "average_daily_consumption": 11460637
    }
  ]
}
```

No changes needed here.

---

### 2. BSP Aggregate
**Current:** `GET /api/v1/meters/consumption/aggregate/bsp`
**Status:** Working correctly. No changes required.

**Query Parameters:**
```
dateFrom:  YYYY-MM-DD
dateTo:    YYYY-MM-DD
region:    string (comma-separated, optional)
district:  string (comma-separated, optional)
station:   string (comma-separated, optional)
group:     "meter_type,region,station"
```

**Required Response Shape (array):**
```json
[
  {
    "system_name": "import_kwh",
    "region": "Accra West Region",
    "station": "Achimota",
    "active_meters": 12,
    "total_meter_count": 15,
    "meter_type": "BSP",
    "group_period": "2025-01-01T00:00:00",
    "total_consumption": 45820000
  }
]
```

No changes needed here.

---

### 3. DTX Aggregate
**Current:** `GET /api/v1/meters/consumption/aggregate/dtx`
**Status:** Working correctly. No changes required.

**Query Parameters:**
```
dateFrom:  YYYY-MM-DD
dateTo:    YYYY-MM-DD
region:    string (comma-separated, optional)
district:  string (comma-separated, optional)
station:   string (comma-separated, optional)
```

**Required Response Shape (array):**
```json
[
  {
    "system_name": "import_kwh",
    "region": "Accra West Region",
    "district": "Achimota District",
    "active_meters": 473,
    "total_meter_count": 500,
    "total_meters_by_region": 500,
    "total_meters_by_district": 120,
    "meter_type": "DTX",
    "group_period": "2025-01-01T00:00:00",
    "total_consumption": 1052
  }
]
```

No changes needed here.

---

### 4. Regional Boundary Aggregate (CRITICAL — needs fix)
**Current:** `GET /api/v1/meters/consumption/aggregate/regional`
**Status:** Broken / inconsistent. See issue below.

**Query Parameters:**
```
dateFrom:             YYYY-MM-DD
dateTo:               YYYY-MM-DD
region:               string (comma-separated, optional)
district:             string (comma-separated, optional)
station:              string (comma-separated, optional)
boundaryMeteringPoint: string (comma-separated, optional)
meterType:            string — must accept "REGIONAL_BOUNDARY"
group:                "meter_type,region"
```

**The Issue — Root Cause (SQL):**

The current query filters `REGIONAL_BOUNDARY` meters using `mtr.region`:

```sql
WHERE
    (mtr.meter_type = 'REGIONAL_BOUNDARY')
    AND (cds.consumption_date BETWEEN '2025-10-01' AND '2025-10-22')
    AND (lower(mtr.region) IN ('accra west'))
```

This returns zero records because `REGIONAL_BOUNDARY` meters are **not assigned to a single region**. They sit on the boundary between two regions. Their location identity is stored in `boundary_metering_point` (e.g. `"Accra West/Tema"`), not `mtr.region`.

**The fix — filter by `boundary_metering_point` instead:**

```sql
WHERE
    (mtr.meter_type = 'REGIONAL_BOUNDARY')
    AND (cds.consumption_date BETWEEN '2025-10-01' AND '2025-10-22')
    AND (lower(mtr.boundary_metering_point) LIKE '%accra west%')
```

This correctly captures all boundary meters that involve Accra West, regardless of which side of the `/` delimiter the region name appears on.

When **no region filter** is passed (i.e. the Regions Overview page showing all regions), the `AND lower(mtr.boundary_metering_point) LIKE ...` clause must be omitted entirely so all boundary meters are returned.

**Required Response Shape (array):**
```json
[
  {
    "boundary_metering_point": "Tema/Accra East",
    "system_name": "import_kwh",
    "region": "Accra East Region",
    "meter_type": "REGIONAL_BOUNDARY",
    "group_period": "2025-01-01T00:00:00",
    "total_consumption": 1163,
    "active_meters": 25
  },
  {
    "boundary_metering_point": "Tema/Accra East",
    "system_name": "export_kwh",
    "region": "Accra East Region",
    "meter_type": "REGIONAL_BOUNDARY",
    "group_period": "2025-01-01T00:00:00",
    "total_consumption": 0,
    "active_meters": 25
  }
]
```

**Critical Requirement — Direction Convention:**
`system_name = "import_kwh"` must mean energy flowing **into the `region` field value**.
`system_name = "export_kwh"` must mean energy flowing **out of the `region` field value**.

This is the only convention that allows the frontend to correctly sum import and export totals for any filtered set of regions without double-counting or direction inversion.

For a boundary meter `"Tema/Accra East"`:
- The record with `region = "Accra East Region"` and `system_name = "import_kwh"` means Accra East is **receiving** energy from Tema.
- The record with `region = "Tema Region"` and `system_name = "export_kwh"` means Tema is **sending** energy to Accra East.
- These are the **same physical flow** — just recorded from both region's perspectives. The frontend will filter by the queried region(s) and only sum one side.

---

### 5. Regional Boundary Daily (CRITICAL — needs fix)
**Current:** `GET /api/v1/meters/consumption/daily/regional`
**Status:** Partially working. Same direction convention issue as above.

**Query Parameters:**
```
dateFrom:             YYYY-MM-DD
dateTo:               YYYY-MM-DD
region:               string (comma-separated, optional)
district:             string (comma-separated, optional)
station:              string (comma-separated, optional)
boundaryMeteringPoint: string (comma-separated, optional)
meterType:            string — must accept "REGIONAL_BOUNDARY"
```

**Required Response Shape (array):**
```json
[
  {
    "meter_number": "RB-001",
    "consumption_date": "2025-01-15",
    "consumed_energy": 38.5,
    "system_name": "import_kwh",
    "boundary_metering_point": "Tema/Accra East",
    "region": "Accra East Region",
    "meter_type": "REGIONAL_BOUNDARY"
  }
]
```

**Critical Requirement — Same direction convention as above:**
`system_name` must be from the perspective of the `region` field value, not the neighboring region.

---

### 6. Regional Energy Balance Detailed (for chart data and transfer network)
**Current:** `GET /api/v1/energy-balance/regional`
**Status:** Partially working. The `cross_boundary_flows` direction is inverted. BSP and DTX fields are fine.

**Query Parameters:**
```
dateFrom: YYYY-MM-DD
dateTo:   YYYY-MM-DD
regions:  string[] (optional, repeating param)
```

**Required Response Shape:**
```json
{
  "data": [
    {
      "date": "2025-01-15T00:00:00",
      "region": "Accra West Region",
      "internal_consumption": {
        "bsp_import": 11460637,
        "dtx_import": 35
      },
      "cross_boundary_flows": {
        "boundary_meters": [
          {
            "boundary_metering_point": "Tema/Accra West",
            "import_kwh": 1163,
            "export_kwh": 0
          }
        ]
      }
    }
  ]
}
```

**Critical Requirement — Direction fix for `cross_boundary_flows.boundary_meters`:**
`import_kwh` must be the energy flowing **into the `region`** in the parent record.
`export_kwh` must be the energy flowing **out of the `region`** in the parent record.

Currently these appear to be recorded from the neighboring region's perspective, which inverts the values on the frontend.

---

## Summary of Changes Required

| Endpoint | Change Required |
|---|---|
| `GET /api/v1/energy-balance/regional/summary` | None |
| `GET /api/v1/meters/consumption/aggregate/bsp` | None |
| `GET /api/v1/meters/consumption/aggregate/dtx` | None |
| `GET /api/v1/meters/consumption/aggregate/regional` | Fix: return records when `meterType=REGIONAL_BOUNDARY`. Ensure `system_name` direction is from the queried region's perspective. |
| `GET /api/v1/meters/consumption/daily/regional` | Fix: Ensure `system_name` direction is from the queried region's perspective (`region` field in each record). |
| `GET /api/v1/energy-balance/regional` | Fix: `cross_boundary_flows.boundary_meters[].import_kwh` and `export_kwh` must be from the parent `region`'s perspective, not the neighboring region's. |

---

## Validation Criteria

Once the fixes are applied, the following must hold true for any given `dateFrom`, `dateTo`, and `region` filter:

1. `regions-view` Inter-Regional Exchange Import ≈ `region-detail` Boundary Exchange Import (within rounding)
2. `regions-view` Inter-Regional Exchange Export ≈ `region-detail` Boundary Exchange Export (within rounding)
3. `regions-view` Total Consumption = BSP Import + Boundary Import - Boundary Export (same formula used in both views)
4. For a boundary meter `"A/B"`, the sum of `import_kwh` for region A + `export_kwh` for region B must equal the same physical flow value (they describe the same meter, just from opposite sides)
