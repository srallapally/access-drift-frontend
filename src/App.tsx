// src/App.tsx
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import ReactECharts from "echarts-for-react";
import {
  TrendingUp,
  TrendingDown,
  X,
  ChevronRight,
  LayoutDashboard,
  Users,
  ShieldAlert,
  Search,
  Filter,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---

type Severity = "Low" | "Medium" | "High" | "Critical";
type ViewType = "Chart" | "Card";

interface FlagReason {
  code: string;
  statement: string;
}

interface User {
  id: string;
  name: string;
  severity: Severity;
  dominantClass: string;
  grantCount: number;
  reasons: FlagReason[];
}

interface Widget {
  id: string;
  title: string;
  group: "Composition" | "Governance Posture" | "Peer Analysis" | "Trends";
  defaultView: ViewType;
}

// --- Static Data ---

const SUMMARY_KPIS = [
  { label: "Users with Drift", value: "847", trend: "+12%", up: true },
  { label: "Drifted Grants", value: "3,241", trend: "+8%", up: true },
  { label: "High / Critical Users", value: "312", trend: "+5%", up: true },
  { label: "Drift Rate", value: "34.2%", trend: "+2.1%", up: true },
  { label: "Users Without Peer Group", value: "156", trend: "-3%", up: false },
  { label: "Dormant Users with Drift", value: "203", trend: "+7%", up: true },
];

const WIDGETS: Widget[] = [
  { id: "driftByClass", title: "Drift by Class", group: "Composition", defaultView: "Chart" },
  { id: "dominantDrift", title: "Users by Dominant Drift Class", group: "Composition", defaultView: "Chart" },
  { id: "authSource", title: "Drift by Authorization Source", group: "Composition", defaultView: "Chart" },
  { id: "usersByApp", title: "Users with Drift by Application", group: "Composition", defaultView: "Chart" },
  { id: "grantsByApp", title: "Drifted Grants by Application", group: "Composition", defaultView: "Chart" },
  { id: "severityBand", title: "Drift by Severity Band", group: "Composition", defaultView: "Chart" },
  { id: "requestNoEndDate", title: "Request Grants — No End Date", group: "Governance Posture", defaultView: "Card" },
  { id: "discoveredLongLived", title: "Discovered — Long-Lived, No End Date", group: "Governance Posture", defaultView: "Card" },
  { id: "overdueRecert", title: "Grants Overdue for Recertification", group: "Governance Posture", defaultView: "Card" },
  { id: "endDateBeyondCert", title: "End Date Beyond Last Positive Cert", group: "Governance Posture", defaultView: "Card" },
  { id: "peerCoverage", title: "Peer Scoring Coverage", group: "Peer Analysis", defaultView: "Chart" },
  { id: "peerDeviation", title: "Users Flagged for Peer Deviation", group: "Peer Analysis", defaultView: "Card" },
  { id: "peerHotSpots", title: "Peer Hot Spots", group: "Peer Analysis", defaultView: "Chart" },
  { id: "usersDriftOverTime", title: "Users with Drift Over Time", group: "Trends", defaultView: "Chart" },
  { id: "grantsDriftOverTime", title: "Drifted Grants Over Time", group: "Trends", defaultView: "Chart" },
  { id: "newlyDrifted", title: "Newly Drifted vs. No-Longer-Drifted", group: "Trends", defaultView: "Chart" },
];

const DEFAULT_ENABLED = ["driftByClass", "dominantDrift", "severityBand", "overdueRecert", "usersDriftOverTime"];

const SEVERITY_COLORS: Record<Severity, string> = {
  Low: "#6b7280",
  Medium: "#f59e0b",
  High: "#f97316",
  Critical: "#ef4444",
};

const CHART_COLORS = ["#5470c6", "#91cc75", "#fac858", "#ee6666", "#73c0de", "#3ba272", "#fc8452"];

// --- Reason Code Catalog Templates (normative from catalog §9) ---
// Each function returns a statement string matching the catalog contextualStatementTemplate exactly.

const ENTITLEMENT_NAMES = [
  "Finance Admin", "Salesforce Full Access", "GitHub Org Admin", "Workday Payroll View",
  "SAP Plant Manager", "Jira Project Admin", "Confluence Space Admin", "ServiceNow ITIL",
  "Okta Super Admin", "AWS S3 Full Access", "Prod DB Read Write", "HR Records View",
];

const PEER_GROUPS = [
  "Engineering IC L4-L5", "Sales AE Mid-Market", "Finance Analyst",
  "HR Business Partner", "IT Operations", "Legal Counsel",
];

const TARGET_SYSTEMS = ["Salesforce", "GitHub", "Workday", "SAP", "Jira", "Confluence", "ServiceNow", "Okta"];

const REQUEST_IDS = ["REQ-10291", "REQ-10847", "REQ-11023", "REQ-9988", "REQ-12301", "REQ-10556", "REQ-11789", "REQ-10034"];

const CERT_DATES = ["2024-08-15", "2024-09-01", "2024-10-15", "2024-11-20", "2024-07-30", "2024-06-10", "2024-10-01", "2024-09-22"];

const LAST_ACTIVITY_DATES = ["2024-09-14", "2024-08-30", "2024-10-01", "2024-07-22", "2024-11-05", "2024-08-15", "2024-09-28", "2024-10-10"];

// Catalog §9.1 — DISCOVERED_ACCESS_DRIFT
function makeDiscoveredStatement(i: number): FlagReason {
  const entitlement = ENTITLEMENT_NAMES[i % ENTITLEMENT_NAMES.length];
  const system = TARGET_SYSTEMS[i % TARGET_SYSTEMS.length];
  return {
    code: "DISCOVERED_ACCESS_DRIFT",
    statement: `Access exists in ${system} for ${entitlement}, but no governed source was found across role, request, or policy.`,
  };
}

// Catalog §9.2 — REQUEST_ACCESS_DRIFT
function makeRequestStatement(i: number): FlagReason {
  const entitlement = ENTITLEMENT_NAMES[i % ENTITLEMENT_NAMES.length];
  const requestId = REQUEST_IDS[i % REQUEST_IDS.length];
  const issueTypes = ["expired", "missing_end_date", "invalid_state", "lifecycle_mismatch"];
  const issue = issueTypes[i % issueTypes.length];
  return {
    code: "REQUEST_ACCESS_DRIFT",
    statement: `Access for ${entitlement} remains linked to request ${requestId} with issue ${issue}.`,
  };
}

// Catalog §9.3 — CERTIFICATION_DRIFT
function makeCertStatement(i: number, daysPastDue?: number): FlagReason {
  const entitlement = ENTITLEMENT_NAMES[i % ENTITLEMENT_NAMES.length];
  const lastCertified = CERT_DATES[i % CERT_DATES.length];
  const days = daysPastDue ?? (30 + (i * 13) % 120);
  const campaigns = ["Q1 Access Review", "Q2 Access Review", "Q3 Access Review", "Annual Recertification", "SOX Compliance Review"];
  const campaign = campaigns[i % campaigns.length];
  return {
    code: "CERTIFICATION_DRIFT",
    statement: `Access for ${entitlement} last satisfied certification on ${lastCertified} in campaign ${campaign} and is now ${days} day(s) beyond the required review point.`,
  };
}

// Catalog §9.4 — PEER_DEVIATION_DRIFT
function makePeerStatement(i: number, peerGroupOverride?: string): FlagReason {
  const entitlement = ENTITLEMENT_NAMES[i % ENTITLEMENT_NAMES.length];
  const group = peerGroupOverride ?? PEER_GROUPS[i % PEER_GROUPS.length];
  const metrics = ["never-seen in peer group", "present in <5% of peers", "present in <12% of peers", "present in <8% of peers"];
  const metric = metrics[i % metrics.length];
  return {
    code: "PEER_DEVIATION_DRIFT",
    statement: `Access for ${entitlement} is outside the expected peer baseline for ${group} (${metric}).`,
  };
}

// Catalog §9.5 — ACCUMULATED_DRIFT
function makeAccumulatedStatement(i: number): FlagReason {
  const grantCounts = [7, 9, 11, 6, 8, 12, 5, 10];
  const classCounts = [2, 3, 2, 4, 3, 2, 3, 4];
  const topClasses = [
    "Discovered Access Drift, Certification Drift",
    "Certification Drift, Request Access Drift",
    "Discovered Access Drift, Peer Deviation Drift",
    "Request Access Drift, Certification Drift, Peer Deviation Drift",
  ];
  return {
    code: "ACCUMULATED_DRIFT",
    statement: `User has ${grantCounts[i % grantCounts.length]} drifted grant(s) across ${classCounts[i % classCounts.length]} drift class(es) including ${topClasses[i % topClasses.length]}.`,
  };
}

// Catalog §9.6 — USER_DORMANT
function makeDormantStatement(i: number): FlagReason {
  const lastActivity = LAST_ACTIVITY_DATES[i % LAST_ACTIVITY_DATES.length];
  const inactiveDays = [95, 112, 134, 88, 107, 145, 92, 118];
  return {
    code: "USER_DORMANT",
    statement: `User has shown no qualifying activity since ${lastActivity} and has been inactive for ${inactiveDays[i % inactiveDays.length]} day(s) under the configured dormancy rule.`,
  };
}

// --- User name pools (distinct per segment to avoid repetition) ---

const NAME_POOLS: Record<string, string[]> = {
  A: ["Marcus Aurelius", "Livia Drusilla", "Titus Flavius", "Cornelia Africana", "Gaius Octavius", "Valeria Messalina", "Decimus Brutus", "Fulvia Flacca"],
  B: ["Sarah Jenkins", "Michael Chen", "David Rodriguez", "Emma Wilson", "James Taylor", "Linda Martinez", "Robert Brown", "Patricia Garcia"],
  C: ["Yuki Tanaka", "Omar Hassan", "Priya Sharma", "Lena Hoffmann", "Kwame Asante", "Ingrid Larsen", "Tariq Al-Rashid", "Meiying Zhou"],
  D: ["Aleksei Volkov", "Fatima Al-Zahra", "Sebastián Torres", "Nadia Petrov", "Hamid Karimi", "Beatriz Oliveira", "Raj Patel", "Chioma Obi"],
  E: ["Chloe Dubois", "Ethan Park", "Amara Nwosu", "Viktor Reinholt", "Zara Ahmed", "Lucas Ferreira", "Nia Okonkwo", "Ivan Petersen"],
};

function makeUsers(
  pool: keyof typeof NAME_POOLS,
  severity: Severity | "mixed",
  dominantClass: string,
  primaryReason: (i: number) => FlagReason,
  secondaryReason?: (i: number) => FlagReason,
  includeDormant = false,
): User[] {
  const names = NAME_POOLS[pool];
  const severities: Severity[] = ["Low", "Medium", "High", "Critical"];

  return names.map((name, i) => {
    const resolvedSeverity: Severity =
      severity === "mixed"
        ? severities[i % severities.length]
        : severity;

    const reasons: FlagReason[] = [primaryReason(i)];
    if (secondaryReason && i % 3 !== 0) reasons.push(secondaryReason(i));
    if (includeDormant && i % 4 === 0) reasons.push(makeDormantStatement(i));

    return {
      id: `u-${pool}-${i}`,
      name,
      severity: resolvedSeverity,
      dominantClass,
      grantCount: 4 + ((i * 7 + 3) % 18),
      reasons,
    };
  });
}

// --- DRILL_DOWN_DATA: one distinct list per clickable segment ---

const DRILL_DOWN_DATA: Record<string, User[]> = {
  // Drift by Class
  "driftByClass::Discovered Access Drift": makeUsers("A", "High", "Discovered Access Drift", makeDiscoveredStatement, makeCertStatement, true),
  "driftByClass::Certification Drift": makeUsers("B", "High", "Certification Drift", makeCertStatement, makeDiscoveredStatement),
  "driftByClass::Request Access Drift": makeUsers("C", "Medium", "Request Access Drift", makeRequestStatement, makeCertStatement),
  "driftByClass::Peer Deviation Drift": makeUsers("D", "Medium", "Peer Deviation Drift", makePeerStatement, makeAccumulatedStatement),
  "driftByClass::Accumulated Drift": makeUsers("E", "mixed", "Accumulated Drift", makeAccumulatedStatement, makeDormantStatement),

  // Users by Dominant Drift Class (distinct instances from driftByClass)
  "dominantDrift::Discovered Access Drift": makeUsers("B", "High", "Discovered Access Drift", makeDiscoveredStatement, makePeerStatement),
  "dominantDrift::Certification Drift": makeUsers("C", "High", "Certification Drift", makeCertStatement),
  "dominantDrift::Request Access Drift": makeUsers("D", "Medium", "Request Access Drift", makeRequestStatement, makeDiscoveredStatement),
  "dominantDrift::Peer Deviation Drift": makeUsers("E", "Medium", "Peer Deviation Drift", makePeerStatement),
  "dominantDrift::Accumulated Drift": makeUsers("A", "mixed", "Accumulated Drift", makeAccumulatedStatement, makeDormantStatement),

  // Auth Source
  "authSource::DISCOVERED": makeUsers("A", "High", "Discovered Access Drift", makeDiscoveredStatement, makeCertStatement),
  "authSource::REQUEST": makeUsers("C", "Medium", "Request Access Drift", makeRequestStatement),
  "authSource::ROLE": makeUsers("E", "Low", "Accumulated Drift", makeAccumulatedStatement),

  // Severity Band — all users in segment must match clicked severity
  "severityBand::Critical": makeUsers("A", "Critical", "Discovered Access Drift", makeDiscoveredStatement, makeCertStatement),
  "severityBand::High": makeUsers("B", "High", "Certification Drift", makeCertStatement, makeDiscoveredStatement),
  "severityBand::Medium": makeUsers("C", "Medium", "Request Access Drift", makeRequestStatement, makePeerStatement),
  "severityBand::Low": makeUsers("D", "Low", "Accumulated Drift", makeAccumulatedStatement),

  // Users with Drift by Application
  "usersByApp::Salesforce": makeUsers("A", "mixed", "Discovered Access Drift", (i) => makeDiscoveredStatement(i)),
  "usersByApp::GitHub": makeUsers("B", "mixed", "Certification Drift", (i) => makeCertStatement(i)),
  "usersByApp::Workday": makeUsers("C", "mixed", "Request Access Drift", (i) => makeRequestStatement(i)),
  "usersByApp::SAP": makeUsers("D", "mixed", "Peer Deviation Drift", (i) => makePeerStatement(i)),
  "usersByApp::Jira": makeUsers("E", "mixed", "Accumulated Drift", (i) => makeAccumulatedStatement(i)),
  "usersByApp::Confluence": makeUsers("A", "mixed", "Certification Drift", (i) => makeCertStatement(i)),
  "usersByApp::ServiceNow": makeUsers("B", "mixed", "Discovered Access Drift", (i) => makeDiscoveredStatement(i)),
  "usersByApp::Okta": makeUsers("C", "mixed", "Request Access Drift", (i) => makeRequestStatement(i)),

  // Drifted Grants by Application (distinct from usersByApp)
  "grantsByApp::Salesforce": makeUsers("D", "High", "Certification Drift", makeCertStatement, makeDiscoveredStatement),
  "grantsByApp::GitHub": makeUsers("E", "High", "Discovered Access Drift", makeDiscoveredStatement),
  "grantsByApp::Workday": makeUsers("A", "Medium", "Certification Drift", makeCertStatement),
  "grantsByApp::SAP": makeUsers("B", "High", "Discovered Access Drift", makeDiscoveredStatement, makePeerStatement),
  "grantsByApp::Jira": makeUsers("C", "Medium", "Request Access Drift", makeRequestStatement, makeCertStatement),
  "grantsByApp::Confluence": makeUsers("D", "Medium", "Peer Deviation Drift", makePeerStatement),
  "grantsByApp::ServiceNow": makeUsers("E", "mixed", "Accumulated Drift", makeAccumulatedStatement, makeCertStatement),
  "grantsByApp::Okta": makeUsers("A", "mixed", "Certification Drift", makeCertStatement, makeRequestStatement),

  // Peer Hot Spots — each group with peerGroupOverride
  "peerHotSpots::Engineering IC L4-L5": makeUsers("A", "Medium", "Peer Deviation Drift", (i) => makePeerStatement(i, "Engineering IC L4-L5")),
  "peerHotSpots::Sales AE Mid-Market": makeUsers("B", "Medium", "Peer Deviation Drift", (i) => makePeerStatement(i, "Sales AE Mid-Market")),
  "peerHotSpots::Finance Analyst": makeUsers("C", "High", "Peer Deviation Drift", (i) => makePeerStatement(i, "Finance Analyst"), makeCertStatement),
  "peerHotSpots::HR Business Partner": makeUsers("D", "Medium", "Peer Deviation Drift", (i) => makePeerStatement(i, "HR Business Partner")),
  "peerHotSpots::IT Operations": makeUsers("E", "High", "Peer Deviation Drift", (i) => makePeerStatement(i, "IT Operations"), makeDiscoveredStatement),
  "peerHotSpots::Legal Counsel": makeUsers("A", "Medium", "Peer Deviation Drift", (i) => makePeerStatement(i, "Legal Counsel")),

  // Peer Coverage
  "peerCoverage::Eligible": makeUsers("B", "mixed", "Peer Deviation Drift", makePeerStatement),
  "peerCoverage::Excluded": makeUsers("C", "Low", "Accumulated Drift", makeAccumulatedStatement),

  // Peer Deviation card
  "peerDeviation::": makeUsers("D", "Medium", "Peer Deviation Drift", makePeerStatement, makeAccumulatedStatement),

  // Governance Posture cards
  "overdueRecert::": makeUsers("A", "High", "Certification Drift", makeCertStatement, makeDiscoveredStatement, true),
  "requestNoEndDate::": makeUsers("B", "Medium", "Request Access Drift", makeRequestStatement, makeCertStatement),
  "discoveredLongLived::": makeUsers("C", "High", "Discovered Access Drift", makeDiscoveredStatement, makeDormantStatement),
  "endDateBeyondCert::": makeUsers("D", "Medium", "Certification Drift", (i) => makeCertStatement(i, 90 + i * 15), makeRequestStatement),

  // Trends — one list per month per widget
  ...Object.fromEntries(
    ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].flatMap((month, mi) => [
      [`usersDriftOverTime::${month}`, makeUsers(["A","B","C","D","E"][mi % 5] as keyof typeof NAME_POOLS, "mixed", "Accumulated Drift", makeAccumulatedStatement, makeDormantStatement)],
      [`grantsDriftOverTime::${month}`, makeUsers(["B","C","D","E","A"][mi % 5] as keyof typeof NAME_POOLS, "mixed", "Certification Drift", makeCertStatement, makeDiscoveredStatement)],
      [`newlyDrifted::${month}`, makeUsers(["C","D","E","A","B"][mi % 5] as keyof typeof NAME_POOLS, "High", "Discovered Access Drift", makeDiscoveredStatement, makePeerStatement)],
    ])
  ),
};

// --- ECharts option generators ---

const BASE_OPTION = {
  backgroundColor: "transparent",
  color: CHART_COLORS,
  tooltip: {
    trigger: "item" as const,
    backgroundColor: "#1a1d27",
    borderColor: "#2a2d3a",
    textStyle: { color: "#e2e8f0" },
  },
};

const AXIS_STYLE = {
  axisLabel: { color: "#94a3b8", fontSize: 10 },
  splitLine: { lineStyle: { color: "#2a2d3a" } },
};

function getChartOption(id: string) {
  switch (id) {
    case "driftByClass":
      return {
        ...BASE_OPTION,
        tooltip: { ...BASE_OPTION.tooltip, trigger: "axis" as const, axisPointer: { type: "shadow" } },
        grid: { left: "3%", right: "6%", bottom: "3%", containLabel: true },
        xAxis: { type: "value", ...AXIS_STYLE, axisLabel: { ...AXIS_STYLE.axisLabel } },
        yAxis: {
          type: "category",
          // Reversed order so Discovered (largest) appears at top
          data: ["Accumulated", "Peer Deviation", "Request Access", "Certification", "Discovered Access"],
          axisLabel: { color: "#94a3b8", fontSize: 10 },
        },
        series: [{
          name: "Grants",
          type: "bar",
          // Spec values: Discovered 412, Certification 389, Request 276, Peer Deviation 198, Accumulated 143
          data: [143, 198, 276, 389, 412],
          itemStyle: { borderRadius: [0, 4, 4, 0] },
        }],
      };

    case "dominantDrift":
      return {
        ...BASE_OPTION,
        series: [{
          type: "pie",
          radius: ["40%", "70%"],
          itemStyle: { borderRadius: 4, borderColor: "#1a1d27", borderWidth: 2 },
          label: { show: false },
          emphasis: { label: { show: true, fontSize: 10, fontWeight: "bold", color: "#e2e8f0" } },
          data: [
            { value: 412, name: "Discovered Access Drift" },
            { value: 389, name: "Certification Drift" },
            { value: 276, name: "Request Access Drift" },
            { value: 198, name: "Peer Deviation Drift" },
            { value: 143, name: "Accumulated Drift" },
          ],
        }],
      };

    case "authSource":
      return {
        ...BASE_OPTION,
        series: [{
          type: "pie",
          radius: "65%",
          data: [
            { value: 18, name: "ROLE" },
            { value: 31, name: "REQUEST" },
            { value: 51, name: "DISCOVERED" },
          ],
          emphasis: { itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.5)" } },
        }],
      };

    case "usersByApp":
    case "grantsByApp": {
      const isGrants = id === "grantsByApp";
      return {
        ...BASE_OPTION,
        tooltip: { ...BASE_OPTION.tooltip, trigger: "axis" as const },
        grid: { left: "3%", right: "4%", bottom: "28%", containLabel: true },
        xAxis: {
          type: "category",
          data: ["Salesforce", "GitHub", "Workday", "SAP", "Jira", "Confluence", "ServiceNow", "Okta"],
          axisLabel: { color: "#94a3b8", fontSize: 9, rotate: 45 },
        },
        yAxis: { type: "value", ...AXIS_STYLE },
        series: [{
          type: "bar",
          data: isGrants
            ? [412, 334, 289, 267, 198, 156, 134, 112]
            : [198, 167, 145, 132, 118, 97, 84, 71],
          itemStyle: { borderRadius: [4, 4, 0, 0] },
        }],
      };
    }

    case "severityBand":
      return {
        ...BASE_OPTION,
        tooltip: { ...BASE_OPTION.tooltip, trigger: "axis" as const, axisPointer: { type: "shadow" } },
        legend: { show: true, bottom: 0, textStyle: { color: "#94a3b8", fontSize: 10 }, icon: "circle" },
        grid: { left: "3%", right: "8%", bottom: "28%", top: "5%", containLabel: true },
        xAxis: { type: "value", show: false },
        yAxis: { type: "category", data: ["Severity"], show: false },
        series: [
          {
            name: "Low", type: "bar", stack: "total", data: [124],
            itemStyle: { color: SEVERITY_COLORS.Low },
            label: { show: true, position: "inside", color: "#fff", fontSize: 10, formatter: "{c}" },
          },
          {
            name: "Medium", type: "bar", stack: "total", data: [411],
            itemStyle: { color: SEVERITY_COLORS.Medium },
            label: { show: true, position: "inside", color: "#fff", fontSize: 10, formatter: "{c}" },
          },
          {
            name: "High", type: "bar", stack: "total", data: [289],
            itemStyle: { color: SEVERITY_COLORS.High },
            label: { show: true, position: "inside", color: "#fff", fontSize: 10, formatter: "{c}" },
          },
          {
            // Critical (23): too narrow for inside label — use outside label with min visual width trick
            name: "Critical", type: "bar", stack: "total", data: [23],
            itemStyle: { color: SEVERITY_COLORS.Critical },
            label: {
              show: true, position: "right",
              color: SEVERITY_COLORS.Critical, fontSize: 10, fontWeight: "bold",
              formatter: "■ 23",
            },
          },
        ],
      };

    case "peerCoverage":
      return {
        ...BASE_OPTION,
        series: [{
          type: "pie",
          radius: ["50%", "70%"],
          itemStyle: { borderRadius: 4, borderColor: "#1a1d27", borderWidth: 2 },
          label: { show: false },
          emphasis: { label: { show: true, fontSize: 12, fontWeight: "bold", color: "#e2e8f0" } },
          data: [
            { value: 2134, name: "Eligible" },
            { value: 156, name: "Excluded" },
          ],
        }],
      };

    case "peerHotSpots":
      return {
        ...BASE_OPTION,
        tooltip: { ...BASE_OPTION.tooltip, trigger: "axis" as const },
        grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
        xAxis: { type: "value", ...AXIS_STYLE, axisLabel: { ...AXIS_STYLE.axisLabel } },
        yAxis: {
          type: "category",
          data: ["Legal Counsel", "IT Operations", "HR Business Partner", "Finance Analyst", "Sales AE Mid-Market", "Engineering IC L4-L5"],
          axisLabel: { color: "#94a3b8", fontSize: 9 },
        },
        series: [{
          type: "bar",
          data: [29, 38, 43, 51, 64, 87],
          itemStyle: { borderRadius: [0, 4, 4, 0] },
        }],
      };

    case "requestNoEndDate":
    case "discoveredLongLived":
    case "overdueRecert":
    case "endDateBeyondCert":
    case "peerDeviation": {
      const configs: Record<string, { val: number; total: number }> = {
        requestNoEndDate: { val: 187, total: 276 },
        discoveredLongLived: { val: 94, total: 412 },
        overdueRecert: { val: 341, total: 1847 },
        endDateBeyondCert: { val: 156, total: 1847 },
        peerDeviation: { val: 298, total: 2134 },
      };
      const { val, total } = configs[id];
      return {
        ...BASE_OPTION,
        grid: { top: 20, bottom: 20, left: 20, right: 20 },
        xAxis: { type: "value", max: total, show: false },
        yAxis: { type: "category", data: [""], show: false },
        series: [
          { type: "bar", data: [total], barWidth: 24, itemStyle: { color: "#2a2d3a", borderRadius: 12 }, silent: true, z: 1 },
          { type: "bar", data: [val], barWidth: 24, barGap: "-100%", itemStyle: { color: "#5470c6", borderRadius: 12 }, z: 2 },
        ],
      };
    }

    case "usersDriftOverTime":
    case "grantsDriftOverTime":
    case "newlyDrifted": {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const isNewly = id === "newlyDrifted";
      return {
        ...BASE_OPTION,
        tooltip: { ...BASE_OPTION.tooltip, trigger: "axis" as const },
        grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
        xAxis: { type: "category", data: months, axisLabel: { color: "#94a3b8", fontSize: 9 } },
        yAxis: { type: "value", ...AXIS_STYLE },
        series: isNewly
          ? [
              { name: "Newly Drifted", type: "line", smooth: true, data: [89, 95, 87, 102, 98, 91, 88, 97, 84, 79, 73, 68] },
              { name: "No Longer Drifted", type: "line", smooth: true, itemStyle: { color: "#91cc75" }, data: [32, 40, 29, 38, 35, 44, 36, 41, 38, 45, 47, 51] },
            ]
          : [{
              name: id === "usersDriftOverTime" ? "Users" : "Grants",
              type: "line",
              smooth: true,
              areaStyle: { opacity: 0.1 },
              data: id === "usersDriftOverTime"
                ? [701, 718, 734, 756, 771, 788, 802, 819, 831, 839, 844, 847]
                : [2680, 2743, 2801, 2867, 2934, 2998, 3054, 3112, 3167, 3201, 3228, 3241],
            }],
      };
    }

    default:
      return BASE_OPTION;
  }
}

// --- Card content per widget ---

const CARD_CONTENT: Record<string, { main: string; sub: string }> = {
  driftByClass: { main: "412", sub: "Discovered Access Drift — largest class" },
  dominantDrift: { main: "29%", sub: "Discovered Access Drift — dominant class" },
  authSource: { main: "51%", sub: "DISCOVERED — highest-risk source" },
  usersByApp: { main: "198", sub: "Salesforce — most affected application" },
  grantsByApp: { main: "412", sub: "Salesforce — most drifted grants" },
  severityBand: { main: "312", sub: "High / Critical combined" },
  requestNoEndDate: { main: "187", sub: "Request-based grants with no configured end date" },
  discoveredLongLived: { main: "94", sub: "Discovered access aged ≥ 90 days with no end date" },
  overdueRecert: { main: "341", sub: "Non-role grants past recertification due date" },
  endDateBeyondCert: { main: "156", sub: "Grants whose end date exceeds last positive certification date" },
  peerCoverage: { main: "2,134", sub: "Eligible · 156 Excluded" },
  peerDeviation: { main: "298", sub: "Users in valid peer groups flagged for deviation" },
  peerHotSpots: { main: "87", sub: "Engineering IC L4-L5 — top deviation group" },
  usersDriftOverTime: { main: "847", sub: "↑ +146 over 12 months" },
  grantsDriftOverTime: { main: "3,241", sub: "↑ +561 over 12 months" },
  newlyDrifted: { main: "+17", sub: "Net newly drifted this month" },
};

// --- Components ---

const SummaryCard = ({ label, value, trend, up }: { label: string; value: string; trend: string; up: boolean }) => (
  <div className="bg-[#1a1d27] border border-[#2a2d3a] p-4 rounded-lg flex flex-col justify-between min-w-[160px] flex-1">
    <span className="text-[#94a3b8] text-[10px] font-semibold uppercase tracking-wider">{label}</span>
    <div className="flex items-baseline gap-2 mt-1">
      <span className="text-2xl font-bold text-[#e2e8f0]">{value}</span>
      <div className={cn(
        "flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded",
        up ? "text-amber-500 bg-amber-500/10" : "text-green-500 bg-green-500/10",
      )}>
        {up ? <TrendingUp size={10} className="mr-0.5" /> : <TrendingDown size={10} className="mr-0.5" />}
        {trend}
      </div>
    </div>
  </div>
);

const ViewSwitcher = ({ view, onChange }: { view: ViewType; onChange: (v: ViewType) => void }) => (
  <div className="flex bg-[#13161f] p-0.5 rounded-md border border-[#2a2d3a] shrink-0">
    {(["Chart", "Card"] as ViewType[]).map((v) => (
      <button
        key={v}
        onClick={() => onChange(v)}
        className={cn(
          "px-2 py-1 text-[10px] font-medium rounded transition-all",
          view === v ? "bg-[#2a2d3a] text-[#e2e8f0] shadow-sm" : "text-[#94a3b8] hover:text-[#e2e8f0]",
        )}
      >
        {v}
      </button>
    ))}
  </div>
);

const DrillDownRow = ({
  user, isExpanded, onToggle,
}: { user: User; isExpanded: boolean; onToggle: () => void }) => (
  <div className="border-b border-[#2a2d3a]">
    <div
      className={cn(
        "flex items-center justify-between p-3 cursor-pointer transition-colors",
        isExpanded ? "bg-[#2a2d3a]/50" : "hover:bg-[#2a2d3a]/30",
      )}
      onClick={onToggle}
    >
      <div className="flex flex-col">
        <span className="text-sm font-medium text-[#e2e8f0]">{user.name}</span>
        <span className="text-[10px] text-[#94a3b8]">{user.dominantClass}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex flex-col items-end">
          <span className="text-xs font-bold text-[#e2e8f0]">{user.grantCount} grants</span>
          <span
            className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
            style={{ backgroundColor: `${SEVERITY_COLORS[user.severity]}20`, color: SEVERITY_COLORS[user.severity] }}
          >
            {user.severity}
          </span>
        </div>
        <ChevronRight
          size={14}
          className={cn("text-[#94a3b8] transition-transform duration-200 shrink-0", isExpanded && "rotate-90")}
        />
      </div>
    </div>

    {isExpanded && (
      <div className="px-4 pb-4 pt-2 bg-[#1a1d27]/60 border-t border-[#2a2d3a]/50 space-y-2">
        <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
          <AlertCircle size={10} /> Why Flagged
        </h4>
        {user.reasons.map((r, i) => (
          <div key={i} className="text-[11px] leading-relaxed">
            <span className="font-mono font-bold text-blue-400">{r.code}</span>
            <span className="text-[#94a3b8]"> — {r.statement}</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

// --- Main App ---

export default function App() {
  const [enabledWidgets, setEnabledWidgets] = useState<string[]>(DEFAULT_ENABLED);
  const [widgetViews, setWidgetViews] = useState<Record<string, ViewType>>(
    Object.fromEntries(WIDGETS.map((w) => [w.id, w.defaultView])),
  );
  const [drillDown, setDrillDown] = useState<{ open: boolean; title: string; users: User[] }>({
    open: false, title: "", users: [],
  });
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const toggleWidget = (id: string) =>
    setEnabledWidgets((prev) => prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]);

  const setView = (id: string, view: ViewType) =>
    setWidgetViews((prev) => ({ ...prev, [id]: view }));

  const openDrillDown = (widgetId: string, segmentLabel = "") => {
    const key = `${widgetId}::${segmentLabel}`;
    const users = DRILL_DOWN_DATA[key];
    if (!users) {
      console.warn(`[DrillDown] Key not found: "${key}"`);
      return;
    }
    const widget = WIDGETS.find((w) => w.id === widgetId);
    setDrillDown({
      open: true,
      title: `${widget?.title ?? widgetId}${segmentLabel ? ` — ${segmentLabel}` : ""}`,
      users,
    });
    setExpandedUserId(null);
  };

  const handleChartClick = (widgetId: string) => (params: any) => {
    // For stacked bar (severityBand), the segment name is params.seriesName.
    // For all other charts (bar, pie, donut, line), params.name is the category/slice/point name.
    const segment = widgetId === "severityBand" ? params.seriesName : params.name;
    if (segment) openDrillDown(widgetId, segment);
  };

  const renderWidgetContent = (widget: Widget) => {
    const view = widgetViews[widget.id];

    if (view === "Chart") {
      return (
        <div className="h-[180px] w-full">
          <ReactECharts
            option={getChartOption(widget.id)}
            style={{ height: "100%", width: "100%" }}
            onEvents={{ click: handleChartClick(widget.id) }}
          />
        </div>
      );
    }

    const { main, sub } = CARD_CONTENT[widget.id] ?? { main: "—", sub: "" };
    return (
      <div
        className="h-[180px] flex flex-col justify-center items-center text-center p-4 cursor-pointer hover:bg-[#2a2d3a]/20 transition-colors rounded-lg"
        onClick={() => openDrillDown(widget.id)}
      >
        <span className="text-4xl font-bold text-[#e2e8f0] mb-2">{main}</span>
        <span className="text-xs text-[#94a3b8] leading-relaxed max-w-[200px]">{sub}</span>
      </div>
    );
  };

  const groupedWidgets = useMemo(
    () => WIDGETS.reduce((acc, w) => {
      if (!acc[w.group]) acc[w.group] = [];
      acc[w.group].push(w);
      return acc;
    }, {} as Record<string, Widget[]>),
    [],
  );

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groupedWidgets;
    const q = search.toLowerCase();
    return Object.fromEntries(
      Object.entries(groupedWidgets)
        .map(([g, ws]) => [g, ws.filter((w) => w.title.toLowerCase().includes(q))])
        .filter(([, ws]) => (ws as Widget[]).length > 0),
    );
  }, [groupedWidgets, search]);

  return (
    <div className="min-h-screen bg-[#0f1117] text-[#e2e8f0] font-sans">

      {/* Summary Bar */}
      <header className="fixed top-0 left-0 right-0 h-24 bg-[#13161f] border-b border-[#2a2d3a] z-40 px-4 flex items-center gap-4 overflow-x-auto">
        <div className="flex items-center gap-3 pr-4 border-r border-[#2a2d3a] shrink-0">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/30">
            <ShieldAlert className="text-white" size={20} />
          </div>
          <div>
            <div className="text-xs font-bold tracking-tight">ACCESS DRIFT</div>
            <div className="text-[9px] text-[#94a3b8] uppercase tracking-widest">Enterprise Dashboard</div>
          </div>
        </div>
        <div className="flex gap-3 flex-1 min-w-max">
          {SUMMARY_KPIS.map((k, i) => <SummaryCard key={i} {...k} />)}
        </div>
      </header>

      <div className="pt-24 flex h-screen overflow-hidden">

        {/* Sidebar */}
        <aside className="w-[260px] shrink-0 bg-[#13161f] border-r border-[#2a2d3a] flex flex-col overflow-hidden">
          <div className="p-4 border-b border-[#2a2d3a]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-widest">Available Widgets</span>
              <span className="bg-blue-600/20 text-blue-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {enabledWidgets.length} / {WIDGETS.length}
              </span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" size={12} />
              <input
                type="text"
                placeholder="Search widgets..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-md py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:border-blue-500 transition-colors text-[#e2e8f0] placeholder-[#94a3b8]"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-5 scrollbar-thin">
            {Object.entries(filteredGroups).map(([group, widgets]) => (
              <div key={group}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-px flex-1 bg-[#2a2d3a]" />
                  <span className="text-[9px] font-bold text-[#2a2d3a] uppercase tracking-widest whitespace-nowrap">{group}</span>
                  <div className="h-px flex-1 bg-[#2a2d3a]" />
                </div>
                <div className="space-y-0.5">
                  {(widgets as Widget[]).map((w) => (
                    <label
                      key={w.id}
                      className={cn(
                        "flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer transition-all",
                        enabledWidgets.includes(w.id) ? "bg-blue-600/10 text-blue-400" : "hover:bg-[#1a1d27] text-[#94a3b8]",
                      )}
                    >
                      <span className="text-xs truncate pr-2">{w.title}</span>
                      <div className="relative inline-flex items-center shrink-0">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={enabledWidgets.includes(w.id)}
                          onChange={() => toggleWidget(w.id)}
                        />
                        <div className="w-7 h-4 bg-[#2a2d3a] rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-3" />
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Canvas */}
        <main className="flex-1 bg-[#0f1117] overflow-y-auto p-5">
          {enabledWidgets.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
              <LayoutDashboard size={56} className="mb-4 text-[#94a3b8]" />
              <p className="text-sm font-semibold mb-1">Dashboard is empty</p>
              <p className="text-xs text-[#94a3b8] max-w-xs">Toggle widgets from the catalog on the left to start building.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {enabledWidgets.map((id) => {
                const widget = WIDGETS.find((w) => w.id === id);
                if (!widget) return null;
                return (
                  <div key={id} className="bg-[#1a1d27] border border-[#2a2d3a] rounded-xl p-4 flex flex-col hover:border-[#3a3d4a] transition-colors">
                    <div className="flex items-center justify-between mb-3 gap-2">
                      <h3 className="text-xs font-semibold text-[#e2e8f0] truncate">{widget.title}</h3>
                      <ViewSwitcher view={widgetViews[id]} onChange={(v) => setView(id, v)} />
                    </div>
                    <div className="flex-1 min-h-[180px]">{renderWidgetContent(widget)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Drill-Down Panel */}
      <div className={cn("fixed inset-0 z-50 transition-opacity duration-300", drillDown.open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none")}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDrillDown((p) => ({ ...p, open: false }))} />
        <div className={cn(
          "absolute top-0 right-0 bottom-0 w-[400px] bg-[#13161f] border-l border-[#2a2d3a] shadow-2xl flex flex-col transition-transform duration-300",
          drillDown.open ? "translate-x-0" : "translate-x-full",
        )}>
          {/* Panel header */}
          <div className="p-5 border-b border-[#2a2d3a] bg-[#1a1d27] flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#e2e8f0]">Drill-Down Analysis</h2>
              <span className="text-xs text-blue-400">{drillDown.title}</span>
            </div>
            <button
              onClick={() => setDrillDown((p) => ({ ...p, open: false }))}
              className="p-1.5 hover:bg-[#2a2d3a] rounded-full text-[#94a3b8] hover:text-[#e2e8f0] transition-colors shrink-0"
            >
              <X size={18} />
            </button>
          </div>

          {/* Search */}
          <div className="p-3 border-b border-[#2a2d3a] flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" size={12} />
              <input
                type="text"
                placeholder="Search users..."
                className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-md py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:border-blue-500 text-[#e2e8f0] placeholder-[#94a3b8]"
              />
            </div>
            <button className="p-1.5 bg-[#0f1117] border border-[#2a2d3a] rounded-md text-[#94a3b8] hover:text-[#e2e8f0]">
              <Filter size={13} />
            </button>
          </div>

          {/* User list */}
          <div className="flex-1 overflow-y-auto">
            {drillDown.users.map((user) => (
              <DrillDownRow
                key={user.id}
                user={user}
                isExpanded={expandedUserId === user.id}
                onToggle={() => setExpandedUserId((p) => (p === user.id ? null : user.id))}
              />
            ))}
          </div>

          {/* Footer */}
          <div className="p-4 bg-[#1a1d27] border-t border-[#2a2d3a] flex items-center justify-between">
            <span className="text-xs text-[#94a3b8]">Showing {drillDown.users.length} users</span>
            <button className="text-xs font-bold text-blue-400 hover:underline flex items-center gap-1">
              Export CSV <ExternalLink size={11} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
