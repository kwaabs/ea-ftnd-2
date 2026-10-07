// Report Builder — data source registry (Phase 1, on-screen only, no
// persistence). Every source here reuses an ALREADY-BUILT backend
// endpoint/hook exactly as-is — this file holds no query logic of its
// own, only metadata (label, groupBy whitelist, display color/unit) that
// use-report-builder-data.ts's switch dispatches on. No new backend query
// engine, no new filter/groupBy surface beyond what each domain already
// exposes — see this session's design discussion for why that's
// deliberate (a true ad-hoc "any column, any join" builder would be a
// different, much larger project).

export type DataSourceKey =
  | "zeus-postpaid"
  | "zeus-amr"
  | "zeus-prepaid"
  | "mms"
  | "bot"
  | "bxc"
  | "holley"
  | "ecash4"
  | "pns"
  | "alpha"
  | "streetlighting"
  | "bsp-purchases"
  | "bsp-status"

export interface GroupByOption {
  value: string
  label: string
}

export interface DataSourceDef {
  key: DataSourceKey
  label: string
  description: string
  /** Tailwind color token stem (e.g. "blue" -> border-blue-300, bg-blue-600) — one per source so blocks stay visually distinguishable on the canvas. */
  color: string
  /** Empty for a KPI-only source (bsp-status) — there's nothing to group a single online/offline count by. */
  groupByOptions: GroupByOption[]
  defaultGroupBy?: string
  /** True for sources that only ever render as a single KPI number, never a table/chart series (bsp-status). */
  kpiOnly?: boolean
  /** Unit label for the primary value column/axis, e.g. "kWh", "meters". */
  valueLabel: string
  /** Label for the secondary count column shown in table mode, e.g. "Customers", "Consumers". Omitted where the source has no count concept. */
  secondaryLabel?: string
}

const REGION_DISTRICT: GroupByOption[] = [
  { value: "region", label: "Region" },
  { value: "district", label: "District" },
]

export const DATA_SOURCES: Record<DataSourceKey, DataSourceDef> = {
  "zeus-postpaid": {
    key: "zeus-postpaid",
    label: "Zeus — Non-AMR Postpaid",
    description: "Zeus billing, metermodeltype=Postpaid",
    color: "blue",
    groupByOptions: [
      { value: "regionname", label: "Region" },
      { value: "districtname", label: "District" },
      { value: "tariffclassname", label: "Tariff class" },
      { value: "billingmonth", label: "Billing month" },
    ],
    defaultGroupBy: "regionname",
    valueLabel: "kWh",
    secondaryLabel: "Customers",
  },
  "zeus-amr": {
    key: "zeus-amr",
    label: "Zeus — AMR Postpaid",
    description: "Zeus billing, metermodeltype=AMR",
    color: "indigo",
    groupByOptions: [
      { value: "regionname", label: "Region" },
      { value: "districtname", label: "District" },
      { value: "tariffclassname", label: "Tariff class" },
      { value: "billingmonth", label: "Billing month" },
    ],
    defaultGroupBy: "regionname",
    valueLabel: "kWh",
    secondaryLabel: "Customers",
  },
  "zeus-prepaid": {
    key: "zeus-prepaid",
    label: "Zeus — Prepaid",
    description: "Zeus billing, metermodeltype=Prepaid (deduped against MMS)",
    color: "violet",
    groupByOptions: [
      { value: "regionname", label: "Region" },
      { value: "districtname", label: "District" },
      { value: "tariffclassname", label: "Tariff class" },
      { value: "billingmonth", label: "Billing month" },
    ],
    defaultGroupBy: "regionname",
    valueLabel: "kWh",
    secondaryLabel: "Customers",
  },
  streetlighting: {
    key: "streetlighting",
    label: "Streetlighting",
    description: "Zeus billing, tariff class E03",
    color: "cyan",
    groupByOptions: [
      { value: "regionname", label: "Region" },
      { value: "districtname", label: "District" },
      { value: "billingmonth", label: "Billing month" },
    ],
    defaultGroupBy: "regionname",
    valueLabel: "kWh",
    secondaryLabel: "Customers",
  },
  mms: {
    key: "mms",
    label: "MMS",
    description: "app.mms_customer_sales",
    color: "green",
    groupByOptions: [
      ...REGION_DISTRICT,
      { value: "contract_type", label: "Contract type" },
      { value: "tariff", label: "Tariff" },
      { value: "manufacturer", label: "Manufacturer" },
      { value: "model", label: "Meter model" },
    ],
    defaultGroupBy: "region",
    valueLabel: "kWh",
    secondaryLabel: "Customers",
  },
  bot: {
    key: "bot",
    label: "BOT",
    description: "Legacy consumption source",
    color: "amber",
    groupByOptions: [
      ...REGION_DISTRICT,
      { value: "tariff", label: "Tariff" },
      { value: "billmonth", label: "Bill month" },
    ],
    defaultGroupBy: "region",
    valueLabel: "kWh",
    secondaryLabel: "Customers",
  },
  bxc: {
    key: "bxc",
    label: "BXC",
    description: "Legacy consumption source",
    color: "purple",
    groupByOptions: [
      ...REGION_DISTRICT,
      { value: "tariff", label: "Tariff" },
      { value: "billmonth", label: "Bill month" },
    ],
    defaultGroupBy: "region",
    valueLabel: "kWh",
    secondaryLabel: "Customers",
  },
  holley: {
    key: "holley",
    label: "Holley",
    description: "Legacy consumption source",
    color: "teal",
    groupByOptions: [
      ...REGION_DISTRICT,
      { value: "tariff_class", label: "Tariff class" },
    ],
    defaultGroupBy: "region",
    valueLabel: "kWh",
    secondaryLabel: "Customers",
  },
  ecash4: {
    key: "ecash4",
    label: "ECASH 4",
    description: "Legacy consumption source",
    color: "orange",
    groupByOptions: [
      ...REGION_DISTRICT,
      { value: "tariff", label: "Tariff" },
    ],
    defaultGroupBy: "region",
    valueLabel: "kWh",
    secondaryLabel: "Customers",
  },
  pns: {
    key: "pns",
    label: "PNS",
    description: "Legacy consumption source (opaque region/district codes)",
    color: "rose",
    groupByOptions: [
      { value: "region", label: "Region code" },
      { value: "district", label: "District code" },
      { value: "tariff", label: "Tariff" },
      { value: "billmonth", label: "Bill month" },
    ],
    defaultGroupBy: "region",
    valueLabel: "kWh",
    secondaryLabel: "Customers",
  },
  alpha: {
    key: "alpha",
    label: "Alpha T&D",
    description: "Legacy Oracle metering source (no region/district)",
    color: "fuchsia",
    groupByOptions: [
      { value: "substation", label: "Substation" },
      { value: "energy_code", label: "Energy code" },
    ],
    defaultGroupBy: "substation",
    valueLabel: "Value",
    secondaryLabel: "Consumers",
  },
  "bsp-purchases": {
    key: "bsp-purchases",
    label: "BSP Purchases",
    description: "BSP incomer meter imports",
    color: "sky",
    groupByOptions: [
      { value: "region", label: "Region" },
      { value: "station", label: "Station" },
    ],
    defaultGroupBy: "region",
    valueLabel: "kWh",
  },
  "bsp-status": {
    key: "bsp-status",
    label: "BSP Meter Status",
    description: "Online vs offline incomer meters",
    color: "slate",
    groupByOptions: [],
    kpiOnly: true,
    valueLabel: "meters",
  },
}

export const DATA_SOURCE_LIST: DataSourceDef[] = Object.values(DATA_SOURCES)
