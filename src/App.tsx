/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from "react";
import ReactECharts from "echarts-for-react";
import { 
  TrendingUp, 
  TrendingDown, 
  X, 
  ChevronRight, 
  BarChart3, 
  PieChart, 
  LayoutDashboard, 
  Users, 
  ShieldAlert, 
  Activity,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink
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
  reasons?: FlagReason[];
}

interface Widget {
  id: string;
  title: string;
  group: "Composition" | "Governance Posture" | "Peer Analysis" | "Trends";
  defaultView: ViewType;
}

// --- Data ---

const SUMMARY_KPIS = [
  { label: "Users with Drift", value: "847", trend: "+12%", up: true, color: "amber" },
  { label: "Drifted Grants", value: "3,241", trend: "+8%", up: true, color: "amber" },
  { label: "High / Critical Users", value: "312", trend: "+5%", up: true, color: "amber" },
  { label: "Drift Rate", value: "34.2%", trend: "+2.1%", up: true, color: "amber" },
  { label: "Users Without Peer Group", value: "156", trend: "-3%", up: false, color: "green" },
  { label: "Dormant Users with Drift", value: "203", trend: "+7%", up: true, color: "amber" },
];

const WIDGETS: Widget[] = [
  // Composition
  { id: "driftByClass", title: "Drift by Class", group: "Composition", defaultView: "Chart" },
  { id: "dominantDrift", title: "Users by Dominant Drift Class", group: "Composition", defaultView: "Chart" },
  { id: "authSource", title: "Drift by Authorization Source", group: "Composition", defaultView: "Chart" },
  { id: "usersByApp", title: "Users with Drift by Application", group: "Composition", defaultView: "Chart" },
  { id: "grantsByApp", title: "Drifted Grants by Application", group: "Composition", defaultView: "Chart" },
  { id: "severityBand", title: "Drift by Severity Band", group: "Composition", defaultView: "Chart" },
  // Governance Posture
  { id: "requestNoEndDate", title: "Request Grants — No End Date", group: "Governance Posture", defaultView: "Card" },
  { id: "discoveredLongLived", title: "Discovered — Long-Lived, No End Date", group: "Governance Posture", defaultView: "Card" },
  { id: "overdueRecert", title: "Grants Overdue for Recertification", group: "Governance Posture", defaultView: "Card" },
  { id: "endDateBeyondCert", title: "End Date Beyond Last Positive Cert", group: "Governance Posture", defaultView: "Card" },
  // Peer Analysis
  { id: "peerCoverage", title: "Peer Scoring Coverage", group: "Peer Analysis", defaultView: "Chart" },
  { id: "peerDeviation", title: "Users Flagged for Peer Deviation", group: "Peer Analysis", defaultView: "Card" },
  { id: "peerHotSpots", title: "Peer Hot Spots", group: "Peer Analysis", defaultView: "Chart" },
  // Trends
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

const CHART_COLORS = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452'];

// --- Drill-Down Data Lookup ---

const generateUserList = (count: number, overrides: Partial<User>, reasonCode: string, reasonStatement: string): User[] => {
  const names = [
    "Sarah Jenkins", "Michael Chen", "David Rodriguez", "Emma Wilson", "James Taylor", 
    "Linda Martinez", "Robert Brown", "Patricia Garcia", "Alex Thompson", "Jessica Lee",
    "Brian Miller", "Karen Davis", "Steven Moore", "Nancy White", "Paul Anderson", "Sandra Clark"
  ];
  
  const driftClasses = ["Discovered Access Drift", "Certification Drift", "Request Access Drift", "Peer Deviation Drift", "Accumulated Drift"];
  const apps = ["Salesforce", "GitHub", "Workday", "SAP", "Jira", "Confluence", "ServiceNow", "Okta"];
  const peerGroups = ["Engineering IC L4-L5", "Sales AE Mid-Market", "Finance Analyst", "HR Business Partner", "IT Operations", "Legal Counsel"];

  return Array.from({ length: count }, (_, i) => {
    const userDomClass = overrides.dominantClass || driftClasses[i % driftClasses.length];
    const userSeverity = overrides.severity || (
      (userDomClass === "Discovered Access Drift" || userDomClass === "Certification Drift") ? "High" : "Medium"
    );

    // Generate 1-3 reasons
    const numReasons = 1 + (i % 3);
    const reasons: FlagReason[] = [{ code: reasonCode, statement: reasonStatement }];
    
    if (numReasons > 1) {
      reasons.push({
        code: "DISCOVERED_ACCESS_DRIFT",
        statement: `Automated scan detected Discovered Access Drift for this identity across multiple systems.`
      });
    }
    if (numReasons > 2) {
      const group = peerGroups[i % peerGroups.length];
      reasons.push({
        code: "PEER_DEVIATION_DRIFT",
        statement: `User in ${group} peer group holds 12+ entitlements not present in 95% of the group baseline.`
      });
    }

    // Refine the primary reason statement if it's a standard code
    if (reasonCode === "CERTIFICATION_DRIFT") {
      const daysMatch = reasonStatement.match(/(\d+) day/);
      const days = daysMatch ? daysMatch[1] : (30 + (i * 12)).toString();
      const dateMatch = reasonStatement.match(/\d{4}-\d{2}-\d{2}/);
      const date = dateMatch ? dateMatch[0] : "2024-10-15";
      reasons[0].statement = `Access for Finance Admin last satisfied certification on ${date} and is now ${days} day(s) beyond the required review point.`;
    } else if (reasonCode === "REQUEST_ACCESS_DRIFT") {
      const appMatch = reasonStatement.match(/in (Salesforce|GitHub|Workday|SAP|Jira|Confluence|ServiceNow|Okta)/);
      const app = appMatch ? appMatch[1] : apps[(i + 2) % apps.length];
      reasons[0].statement = `Request-based access for ${app} found with no configured expiration date in the identity vault.`;
    } else if (reasonCode === "USER_DORMANT") {
      const daysMatch = reasonStatement.match(/(\d+)\+ days/);
      const days = daysMatch ? daysMatch[1] : (60 + (i * 5)).toString();
      reasons[0].statement = `User account has not performed a login event in ${days}+ days while retaining privileged entitlements.`;
    } else if (reasonCode === "DISCOVERED_ACCESS_DRIFT") {
      if (reasonStatement.includes("Critical severity drift")) {
        reasons[0].statement = "Critical severity drift: Unauthorized administrative access discovered in production environment.";
      } else if (reasonStatement.includes("newly identified")) {
        const monthMatch = reasonStatement.match(/in (\w+) following/);
        const month = monthMatch ? monthMatch[1] : "current";
        reasons[0].statement = `User newly identified with access drift in ${month} following system integration update.`;
      } else if (reasonStatement.includes("synchronization cycle")) {
        const appMatch = reasonStatement.match(/in (Salesforce|GitHub|Workday|SAP|Jira|Confluence|ServiceNow|Okta)/);
        const app = appMatch ? appMatch[1] : apps[i % apps.length];
        reasons[0].statement = `Drift detected in ${app} entitlements during the last synchronization cycle.`;
      } else if (reasonStatement.includes("direct assignment")) {
        reasons[0].statement = "Access source identified as direct assignment in target system, bypassing request workflows.";
      } else if (reasonStatement.includes("90+ days")) {
        reasons[0].statement = "Discovered access has been active for 90+ days without any associated governance or request record.";
      } else {
        const clsMatch = reasonStatement.match(/(Discovered Access Drift|Certification Drift|Request Access Drift|Peer Deviation Drift|Accumulated Drift)/);
        const cls = clsMatch ? clsMatch[1] : "Discovered Access Drift";
        reasons[0].statement = `Automated scan detected ${cls} for this identity across multiple systems.`;
      }
    } else if (reasonCode === "PEER_DEVIATION_DRIFT") {
      const groupMatch = reasonStatement.match(/in (Engineering IC L4-L5|Sales AE Mid-Market|Finance Analyst|HR Business Partner|IT Operations|Legal Counsel) peer group/);
      const group = groupMatch ? groupMatch[1] : peerGroups[i % peerGroups.length];
      if (reasonStatement.includes("confidence")) {
        reasons[0].statement = "User flagged for significant deviation from peer group access patterns (Scoring confidence: 92%).";
      } else if (reasonStatement.includes("eligible")) {
        reasons[0].statement = "User is eligible for peer analysis and shows significant deviations from group baseline.";
      } else {
        reasons[0].statement = `User in ${group} peer group holds 12+ entitlements not present in 95% of the group baseline.`;
      }
    } else if (reasonCode === "ACCUMULATED_DRIFT") {
      if (reasonStatement.includes("drift cohort")) {
        const monthMatch = reasonStatement.match(/part of the (\w+) drift cohort/);
        const month = monthMatch ? monthMatch[1] : "current";
        reasons[0].statement = `User part of the ${month} drift cohort identified during monthly reconciliation.`;
      } else if (reasonStatement.includes("reporting period")) {
        const monthMatch = reasonStatement.match(/in the (\w+) reporting/);
        const month = monthMatch ? monthMatch[1] : "current";
        reasons[0].statement = `Grants identified as drifted in the ${month} reporting period.`;
      } else if (reasonStatement.includes("excluded")) {
        reasons[0].statement = "User excluded from peer analysis due to unique role profile or lack of sufficient peer group size.";
      } else if (reasonStatement.includes("Minor deviation")) {
        reasons[0].statement = "Low severity drift: Minor deviation from standard access profile detected.";
      } else {
        reasons[0].statement = `Access source identified as legacy role assignment that no longer matches current job function.`;
      }
    }

    return {
      id: `u-${Math.random().toString(36).substr(2, 9)}`,
      name: names[i % names.length],
      severity: userSeverity,
      dominantClass: userDomClass,
      grantCount: 5 + Math.floor(Math.random() * 15),
      reasons,
      ...overrides
    };
  });
};

const DRILL_DOWN_DATA: Record<string, User[]> = {};

// Drift by Class & Dominant Drift
const driftClasses = ["Discovered Access Drift", "Certification Drift", "Request Access Drift", "Peer Deviation Drift", "Accumulated Drift"];
driftClasses.forEach(cls => {
  const severity: Severity = (cls === "Discovered Access Drift" || cls === "Certification Drift") ? "High" : "Medium";
  const code = cls.toUpperCase().replace(/ /g, "_");
  
  // Drift by Class list
  DRILL_DOWN_DATA[`driftByClass::${cls}`] = generateUserList(8, 
    { dominantClass: cls, severity }, 
    code, 
    `Automated scan detected ${cls} for this identity across multiple systems.`
  );
  
  // Dominant Drift list (distinct instance)
  DRILL_DOWN_DATA[`dominantDrift::${cls}`] = generateUserList(8, 
    { dominantClass: cls, severity }, 
    code, 
    `Identity governance analysis identifies ${cls} as the primary risk factor.`
  );
});

// Auth Source
DRILL_DOWN_DATA["authSource::DISCOVERED"] = generateUserList(8, 
  { severity: "High", dominantClass: "Discovered Access Drift" }, 
  "DISCOVERED_ACCESS_DRIFT", 
  "Access source identified as direct assignment in target system, bypassing request workflows."
);
DRILL_DOWN_DATA["authSource::REQUEST"] = generateUserList(8, 
  { severity: "Medium", dominantClass: "Request Access Drift" }, 
  "REQUEST_ACCESS_DRIFT", 
  "Access source identified as expired or unmanaged request with no associated end date."
);
DRILL_DOWN_DATA["authSource::ROLE"] = generateUserList(8, 
  { severity: "Low", dominantClass: "Accumulated Drift" }, 
  "ACCUMULATED_DRIFT", 
  "Access source identified as legacy role assignment that no longer matches current job function."
);

// Apps
const apps = ["Salesforce", "GitHub", "Workday", "SAP", "Jira", "Confluence", "ServiceNow", "Okta"];
apps.forEach(app => {
  DRILL_DOWN_DATA[`usersByApp::${app}`] = generateUserList(8, 
    {}, 
    "DISCOVERED_ACCESS_DRIFT", 
    `Drift detected in ${app} entitlements during the last synchronization cycle.`
  );
  DRILL_DOWN_DATA[`grantsByApp::${app}`] = generateUserList(8, 
    { severity: "High" }, 
    "CERTIFICATION_DRIFT", 
    `High-risk grants in ${app} have exceeded their required recertification window.`
  );
});

// Severity
DRILL_DOWN_DATA["severityBand::Critical"] = generateUserList(8, 
  { severity: "Critical", dominantClass: "Discovered Access Drift" }, 
  "DISCOVERED_ACCESS_DRIFT", 
  "Critical severity drift: Unauthorized administrative access discovered in production environment."
);
DRILL_DOWN_DATA["severityBand::High"] = generateUserList(8, 
  { severity: "High", dominantClass: "Certification Drift" }, 
  "CERTIFICATION_DRIFT", 
  "High severity drift: Access for Finance Admin last satisfied certification on 2024-10-15 and is now 74 day(s) beyond the required review point."
);
DRILL_DOWN_DATA["severityBand::Medium"] = generateUserList(8, 
  { severity: "Medium", dominantClass: "Request Access Drift" }, 
  "REQUEST_ACCESS_DRIFT", 
  "Medium severity drift: Request-based access found with no configured expiration date."
);
DRILL_DOWN_DATA["severityBand::Low"] = generateUserList(8, 
  { severity: "Low", dominantClass: "Accumulated Drift" }, 
  "ACCUMULATED_DRIFT", 
  "Low severity drift: Minor deviation from standard access profile detected."
);

// Peer Hot Spots
const peerGroups = ["Engineering IC L4-L5", "Sales AE Mid-Market", "Finance Analyst", "HR Business Partner", "IT Operations", "Legal Counsel"];
peerGroups.forEach(group => {
  DRILL_DOWN_DATA[`peerHotSpots::${group}`] = generateUserList(8, 
    { dominantClass: "Peer Deviation Drift" }, 
    "PEER_DEVIATION_DRIFT", 
    `User in ${group} peer group holds 12+ entitlements not present in 95% of the group baseline.`
  );
});

// Peer Coverage
DRILL_DOWN_DATA["peerCoverage::Eligible"] = generateUserList(8, 
  { dominantClass: "Peer Deviation Drift" }, 
  "PEER_DEVIATION_DRIFT", 
  "User is eligible for peer analysis and shows significant deviations from group baseline."
);
DRILL_DOWN_DATA["peerCoverage::Excluded"] = generateUserList(8, 
  { severity: "Low", dominantClass: "Accumulated Drift" }, 
  "ACCUMULATED_DRIFT", 
  "User excluded from peer analysis due to unique role profile or lack of sufficient peer group size."
);

// Peer Deviation Card
DRILL_DOWN_DATA["peerDeviation::"] = generateUserList(8, 
  { dominantClass: "Peer Deviation Drift" }, 
  "PEER_DEVIATION_DRIFT", 
  "User flagged for significant deviation from peer group access patterns (Scoring confidence: 92%)."
);

// Governance Posture Cards
DRILL_DOWN_DATA["overdueRecert::"] = generateUserList(8, 
  { dominantClass: "Certification Drift", severity: "High" }, 
  "CERTIFICATION_DRIFT", 
  "Access review is overdue by more than 30 days. Last certification date: 2024-11-20."
);
DRILL_DOWN_DATA["requestNoEndDate::"] = generateUserList(8, 
  { dominantClass: "Request Access Drift", severity: "Medium" }, 
  "REQUEST_ACCESS_DRIFT", 
  "Request-based access found with no configured expiration date in the identity vault."
);
DRILL_DOWN_DATA["discoveredLongLived::"] = generateUserList(8, 
  { dominantClass: "Discovered Access Drift", severity: "High" }, 
  "DISCOVERED_ACCESS_DRIFT", 
  "Discovered access has been active for 90+ days without any associated governance or request record."
);
DRILL_DOWN_DATA["endDateBeyondCert::"] = generateUserList(8, 
  { dominantClass: "Certification Drift", severity: "Medium" }, 
  "CERTIFICATION_DRIFT", 
  "Access end date (2025-12-31) exceeds the last positive certification date (2024-06-15)."
);

// Trends
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
months.forEach(month => {
  DRILL_DOWN_DATA[`usersDriftOverTime::${month}`] = generateUserList(8, 
    {}, 
    "ACCUMULATED_DRIFT", 
    `User part of the ${month} drift cohort identified during monthly reconciliation.`
  );
  DRILL_DOWN_DATA[`grantsDriftOverTime::${month}`] = generateUserList(8, 
    {}, 
    "ACCUMULATED_DRIFT", 
    `Grants identified as drifted in the ${month} reporting period.`
  );
  DRILL_DOWN_DATA[`newlyDrifted::${month}`] = generateUserList(8, 
    { severity: "High" }, 
    "DISCOVERED_ACCESS_DRIFT", 
    `User newly identified with access drift in ${month} following system integration update.`
  );
});

// --- Components ---

const SummaryCard = ({ label, value, trend, up, color }: any) => (
  <div className="bg-[#1a1d27] border border-[#2a2d3a] p-4 rounded-lg flex flex-col justify-between min-w-[180px] flex-1">
    <span className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider">{label}</span>
    <div className="flex items-baseline gap-2 mt-1">
      <span className="text-2xl font-bold text-[#e2e8f0]">{value}</span>
      <div className={cn(
        "flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded",
        color === "amber" ? "text-amber-500 bg-amber-500/10" : "text-green-500 bg-green-500/10"
      )}>
        {up ? <TrendingUp size={10} className="mr-0.5" /> : <TrendingDown size={10} className="mr-0.5" />}
        {trend}
      </div>
    </div>
  </div>
);

const WidgetHeader = ({ title, view, onViewChange }: { title: string, view: ViewType, onViewChange: (v: ViewType) => void }) => (
  <div className="flex items-center justify-between mb-4">
    <h3 className="text-sm font-semibold text-[#e2e8f0] truncate pr-2">{title}</h3>
    <div className="flex bg-[#13161f] p-0.5 rounded-md border border-[#2a2d3a]">
      <button 
        onClick={() => onViewChange("Chart")}
        className={cn(
          "px-2 py-1 text-[10px] font-medium rounded transition-all",
          view === "Chart" ? "bg-[#2a2d3a] text-[#e2e8f0] shadow-sm" : "text-[#94a3b8] hover:text-[#e2e8f0]"
        )}
      >
        Chart
      </button>
      <button 
        onClick={() => onViewChange("Card")}
        className={cn(
          "px-2 py-1 text-[10px] font-medium rounded transition-all",
          view === "Card" ? "bg-[#2a2d3a] text-[#e2e8f0] shadow-sm" : "text-[#94a3b8] hover:text-[#e2e8f0]"
        )}
      >
        Card
      </button>
    </div>
  </div>
);

const DrillDownUserRow = ({ 
  user, 
  isExpanded, 
  onToggle 
}: { 
  user: User, 
  isExpanded: boolean, 
  onToggle: () => void 
}) => (
  <div className="border-b border-[#2a2d3a]">
    <div 
      className={cn(
        "flex items-center justify-between p-3 cursor-pointer transition-colors",
        isExpanded ? "bg-[#2a2d3a]/50" : "hover:bg-[#2a2d3a]/30"
      )}
      onClick={onToggle}
    >
      <div className="flex flex-col">
        <span className="text-sm font-medium text-[#e2e8f0]">{user.name}</span>
        <span className="text-[10px] text-[#94a3b8]">{user.dominantClass}</span>
      </div>
      <div className="flex items-center gap-3">
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
          className={cn("text-[#94a3b8] transition-transform duration-200", isExpanded && "rotate-90")} 
        />
      </div>
    </div>
    
    {isExpanded && (
      <div className="px-4 pb-4 pt-1 bg-[#1a1d27]/50 border-t border-[#2a2d3a]/50">
        <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-2">
          <AlertCircle size={10} /> Why Flagged
        </h4>
        <div className="space-y-2">
          {(user.reasons || [
            { code: "PEER_DEVIATION_DRIFT", statement: `User holds ${user.grantCount} entitlements that deviate significantly from their assigned peer group baseline.` }
          ]).map((reason, idx) => (
            <div key={idx} className="text-[11px] leading-relaxed">
              <span className="font-mono font-bold text-blue-400">{reason.code}</span>
              <span className="text-[#94a3b8]"> — {reason.statement}</span>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

export default function App() {
  const [enabledWidgets, setEnabledWidgets] = useState<string[]>(DEFAULT_ENABLED);
  const [widgetViews, setWidgetViews] = useState<Record<string, ViewType>>(
    WIDGETS.reduce((acc, w) => ({ ...acc, [w.id]: w.defaultView }), {})
  );
  const [drillDown, setDrillDown] = useState<{ open: boolean, title: string, users: User[] }>({
    open: false,
    title: "",
    users: []
  });
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const toggleWidget = (id: string) => {
    setEnabledWidgets(prev => 
      prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]
    );
  };

  const setView = (id: string, view: ViewType) => {
    setWidgetViews(prev => ({ ...prev, [id]: view }));
  };

  const openDrillDown = (widgetId: string, segmentLabel: string = "") => {
    const key = `${widgetId}::${segmentLabel}`;
    let users = DRILL_DOWN_DATA[key];
    
    if (!users) {
      console.warn(`Drill-down key not found: ${key}. Falling back to default list.`);
      users = DRILL_DOWN_DATA["driftByClass::Discovered Access Drift"];
    }
    
    setDrillDown({ 
      open: true, 
      title: `${WIDGETS.find(w => w.id === widgetId)?.title || "Analysis"}${segmentLabel ? ` — ${segmentLabel}` : ""}`, 
      users 
    });
    setExpandedUserId(null);
  };

  // --- Chart Options Generators ---

  const getChartOption = (id: string) => {
    const baseOption = {
      backgroundColor: 'transparent',
      color: CHART_COLORS,
      tooltip: { trigger: 'item', backgroundColor: '#1a1d27', borderColor: '#2a2d3a', textStyle: { color: '#e2e8f0' } },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    };

    switch (id) {
      case "driftByClass":
        return {
          ...baseOption,
          tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
          xAxis: { type: 'value', splitLine: { lineStyle: { color: '#2a2d3a' } }, axisLabel: { color: '#94a3b8' } },
          yAxis: { 
            type: 'category', 
            data: ['Accumulated Drift', 'Peer Deviation Drift', 'Request Access Drift', 'Certification Drift', 'Discovered Access Drift'],
            axisLabel: { color: '#94a3b8', fontSize: 10 }
          },
          series: [{
            name: 'Drift Count',
            type: 'bar',
            data: [321, 456, 612, 876, 976],
            itemStyle: { borderRadius: [0, 4, 4, 0] }
          }]
        };
      case "dominantDrift":
        return {
          ...baseOption,
          series: [{
            type: 'pie',
            radius: ['40%', '70%'],
            avoidLabelOverlap: false,
            itemStyle: { borderRadius: 4, borderColor: '#1a1d27', borderWidth: 2 },
            label: { show: false },
            emphasis: { label: { show: true, fontSize: '10', fontWeight: 'bold', color: '#e2e8f0' } },
            data: [
              { value: 245, name: 'Discovered Access Drift' },
              { value: 212, name: 'Certification Drift' },
              { value: 187, name: 'Request Access Drift' },
              { value: 124, name: 'Peer Deviation Drift' },
              { value: 79, name: 'Accumulated Drift' }
            ]
          }]
        };
      case "peerCoverage":
        return {
          ...baseOption,
          series: [{
            type: 'pie',
            radius: ['50%', '70%'],
            avoidLabelOverlap: false,
            itemStyle: { borderRadius: 4, borderColor: '#1a1d27', borderWidth: 2 },
            label: { show: false },
            emphasis: { label: { show: true, fontSize: '12', fontWeight: 'bold', color: '#e2e8f0' } },
            data: [{ value: 2134, name: 'Eligible' }, { value: 156, name: 'Excluded' }]
          }]
        };
      case "authSource":
        return {
          ...baseOption,
          series: [{
            type: 'pie',
            radius: '65%',
            center: ['50%', '50%'],
            data: [
              { value: 18, name: 'ROLE' },
              { value: 31, name: 'REQUEST' },
              { value: 51, name: 'DISCOVERED' }
            ],
            emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' } }
          }]
        };
      case "usersByApp":
      case "grantsByApp":
        const isGrants = id === "grantsByApp";
        return {
          ...baseOption,
          tooltip: { trigger: 'axis' },
          grid: { ...baseOption.grid, bottom: '30%' },
          xAxis: { 
            type: 'category', 
            data: ['Salesforce', 'GitHub', 'Workday', 'SAP', 'Jira', 'Confluence', 'ServiceNow', 'Okta'],
            axisLabel: { color: '#94a3b8', fontSize: 9, rotate: 45 },
            splitLine: { show: false }
          },
          yAxis: { 
            type: 'value', 
            axisLabel: { color: '#94a3b8', fontSize: 9 },
            splitLine: { lineStyle: { color: '#2a2d3a' } }
          },
          series: [{
            type: 'bar',
            data: isGrants ? [412, 334, 289, 267, 198, 156, 134, 112] : [198, 167, 145, 132, 118, 97, 84, 71],
            itemStyle: { borderRadius: [4, 4, 0, 0] }
          }]
        };
      case "peerHotSpots":
        return {
          ...baseOption,
          tooltip: { trigger: 'axis' },
          xAxis: { 
            type: 'value', 
            axisLabel: { color: '#94a3b8', fontSize: 9 },
            splitLine: { show: false }
          },
          yAxis: { 
            type: 'category', 
            data: ['Legal Counsel', 'IT Operations', 'HR Business Partner', 'Finance Analyst', 'Sales AE Mid-Market', 'Engineering IC L4-L5'],
            axisLabel: { color: '#94a3b8', fontSize: 9 },
            splitLine: { lineStyle: { color: '#2a2d3a' } }
          },
          series: [{
            type: 'bar',
            data: [29, 38, 43, 51, 64, 87],
            itemStyle: { borderRadius: [0, 4, 4, 0] }
          }]
        };
      case "severityBand":
        return {
          ...baseOption,
          tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
          legend: { show: true, bottom: 0, textStyle: { color: '#94a3b8', fontSize: 10 }, icon: 'circle' },
          grid: { ...baseOption.grid, bottom: '25%' },
          xAxis: { type: 'value', show: false },
          yAxis: { type: 'category', data: ['Severity'], show: false },
          series: [
            { 
              name: 'Low', type: 'bar', stack: 'total', data: [124], 
              itemStyle: { color: SEVERITY_COLORS.Low },
              label: { show: true, position: 'inside', color: '#fff', fontSize: 10, formatter: '{c}' }
            },
            { 
              name: 'Medium', type: 'bar', stack: 'total', data: [411], 
              itemStyle: { color: SEVERITY_COLORS.Medium },
              label: { show: true, position: 'inside', color: '#fff', fontSize: 10, formatter: '{c}' }
            },
            { 
              name: 'High', type: 'bar', stack: 'total', data: [289], 
              itemStyle: { color: SEVERITY_COLORS.High },
              label: { show: true, position: 'inside', color: '#fff', fontSize: 10, formatter: '{c}' }
            },
            { 
              name: 'Critical', type: 'bar', stack: 'total', data: [23], 
              itemStyle: { color: SEVERITY_COLORS.Critical },
              label: { show: true, position: 'right', color: SEVERITY_COLORS.Critical, fontSize: 10, fontWeight: 'bold', formatter: '{c}' }
            },
          ]
        };
      case "requestNoEndDate":
      case "discoveredLongLived":
      case "overdueRecert":
      case "endDateBeyondCert":
      case "peerDeviation":
        let val = 187, total = 276;
        if (id === "discoveredLongLived") { val = 94; total = 412; }
        if (id === "overdueRecert") { val = 341; total = 1847; }
        if (id === "endDateBeyondCert") { val = 156; total = 1847; }
        if (id === "peerDeviation") { val = 298; total = 2134; }
        return {
          ...baseOption,
          grid: { top: 10, bottom: 10, left: 10, right: 10 },
          xAxis: { type: 'value', max: total, show: false },
          yAxis: { type: 'category', data: [''], show: false },
          series: [
            { type: 'bar', data: [total], barWidth: 20, itemStyle: { color: '#2a2d3a', borderRadius: 10 }, silent: true },
            { type: 'bar', data: [val], barWidth: 20, barGap: '-100%', itemStyle: { color: '#5470c6', borderRadius: 10 } }
          ]
        };
      case "usersDriftOverTime":
      case "grantsDriftOverTime":
      case "newlyDrifted":
        const isNewly = id === "newlyDrifted";
        return {
          ...baseOption,
          tooltip: { trigger: 'axis' },
          xAxis: { 
            type: 'category', 
            data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            axisLabel: { color: '#94a3b8', fontSize: 9 }
          },
          yAxis: { type: 'value', axisLabel: { color: '#94a3b8', fontSize: 9 }, splitLine: { lineStyle: { color: '#2a2d3a' } } },
          series: isNewly 
            ? [
                { name: 'Newly Drifted', type: 'line', smooth: true, data: [89, 95, 87, 102, 98, 91, 88, 97, 84, 79, 73, 68] },
                { name: 'No Longer Drifted', type: 'line', smooth: true, data: [32, 40, 29, 38, 35, 44, 36, 41, 38, 45, 47, 51], itemStyle: { color: '#91cc75' } }
              ]
            : [{ 
                name: id === "usersDriftOverTime" ? 'Users' : 'Grants', 
                type: 'line', 
                smooth: true, 
                areaStyle: { opacity: 0.1 },
                data: id === "usersDriftOverTime" 
                  ? [701, 718, 734, 756, 771, 788, 802, 819, 831, 839, 844, 847]
                  : [2680, 2743, 2801, 2867, 2934, 2998, 3054, 3112, 3167, 3201, 3228, 3241]
              }]
        };
      default:
        return baseOption;
    }
  };

  // --- Render Helpers ---

  const renderWidgetContent = (widget: Widget) => {
    const view = widgetViews[widget.id];
    
    if (view === "Chart") {
      return (
        <div className="h-[180px] w-full">
          <ReactECharts 
            option={getChartOption(widget.id)} 
            style={{ height: '100%', width: '100%' }}
            onEvents={{
              'click': (params: any) => {
                let segment = params.name || params.seriesName;
                // Special handling for stacked bars where params.name is the category but we want the segment
                if (widget.id === 'severityBand') {
                  segment = params.seriesName;
                }
                openDrillDown(widget.id, segment);
              }
            }}
          />
        </div>
      );
    }

    // Card View
    let mainVal = "", subText = "", trend = "";
    switch (widget.id) {
      case "driftByClass": mainVal = "412"; subText = "Discovered Access Drift"; break;
      case "dominantDrift": mainVal = "29%"; subText = "Discovered Access Drift"; break;
      case "authSource": mainVal = "51%"; subText = "DISCOVERED Source"; break;
      case "usersByApp": mainVal = "198"; subText = "Salesforce Users"; break;
      case "grantsByApp": mainVal = "412"; subText = "Salesforce Grants"; break;
      case "severityBand": mainVal = "312"; subText = "High/Critical Combined"; break;
      case "requestNoEndDate": mainVal = "187"; subText = "Request-based grants with no configured end date"; break;
      case "discoveredLongLived": mainVal = "94"; subText = "Discovered access aged ≥ 90 days with no end date"; break;
      case "overdueRecert": mainVal = "341"; subText = "Non-role grants past recertification due date"; break;
      case "endDateBeyondCert": mainVal = "156"; subText = "Grants whose end date exceeds last positive certification date"; break;
      case "peerCoverage": mainVal = "2,134"; subText = "Eligible · 156 Excluded"; break;
      case "peerDeviation": mainVal = "298"; subText = "Users in valid peer groups flagged for deviation"; break;
      case "peerHotSpots": mainVal = "87"; subText = "Engineering IC L4-L5 Deviations"; break;
      case "usersDriftOverTime": mainVal = "847"; subText = "↑ +146 over 12 months"; break;
      case "grantsDriftOverTime": mainVal = "3,241"; subText = "↑ +561 over 12 months"; break;
      case "newlyDrifted": mainVal = "+17"; subText = "Net newly drifted this month"; break;
    }

    return (
      <div 
        className="h-[180px] flex flex-col justify-center items-center text-center p-4 cursor-pointer hover:bg-[#2a2d3a]/20 transition-colors rounded-lg"
        onClick={() => openDrillDown(widget.id)}
      >
        <span className="text-4xl font-bold text-[#e2e8f0] mb-2">{mainVal}</span>
        <span className="text-xs text-[#94a3b8] leading-relaxed max-w-[200px]">{subText}</span>
        {trend && <span className="text-[10px] font-bold text-amber-500 mt-2">{trend}</span>}
      </div>
    );
  };

  const groupedWidgets = useMemo(() => {
    return WIDGETS.reduce((acc, w) => {
      if (!acc[w.group]) acc[w.group] = [];
      acc[w.group].push(w);
      return acc;
    }, {} as Record<string, Widget[]>);
  }, []);

  return (
    <div className="min-h-screen bg-[#0f1117] text-[#e2e8f0] font-sans selection:bg-blue-500/30">
      
      {/* Section 1: Fixed Summary Bar */}
      <header className="fixed top-0 left-0 right-0 h-24 bg-[#13161f] border-b border-[#2a2d3a] z-40 px-6 flex items-center gap-4 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-3 pr-6 border-r border-[#2a2d3a] mr-2">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/20">
            <ShieldAlert className="text-white" size={24} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-sm font-bold tracking-tight">ACCESS DRIFT</h1>
            <span className="text-[10px] text-[#94a3b8] font-medium uppercase tracking-widest">Enterprise Dashboard</span>
          </div>
        </div>
        <div className="flex gap-4 flex-1 min-w-max">
          {SUMMARY_KPIS.map((kpi, i) => (
            <SummaryCard key={i} {...kpi} />
          ))}
        </div>
      </header>

      <div className="pt-24 flex h-screen overflow-hidden">
        
        {/* Section 2: Catalog Sidebar */}
        <aside className="w-[280px] bg-[#13161f] border-r border-[#2a2d3a] flex flex-col overflow-hidden">
          <div className="p-5 border-b border-[#2a2d3a]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-[#94a3b8] uppercase tracking-widest">Available Widgets</h2>
              <span className="bg-blue-600/20 text-blue-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {enabledWidgets.length} / {WIDGETS.length}
              </span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#2a2d3a]" size={14} />
              <input 
                type="text" 
                placeholder="Search widgets..." 
                className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-md py-2 pl-9 pr-4 text-xs focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
            {(Object.entries(groupedWidgets) as [string, Widget[]][]).map(([group, widgets]) => (
              <div key={group}>
                <h3 className="text-[10px] font-bold text-[#2a2d3a] uppercase tracking-widest mb-3 flex items-center gap-2">
                  <div className="h-px flex-1 bg-[#2a2d3a]" />
                  {group}
                  <div className="h-px flex-1 bg-[#2a2d3a]" />
                </h3>
                <div className="space-y-1">
                  {widgets.map(w => (
                    <label 
                      key={w.id} 
                      className={cn(
                        "flex items-center justify-between p-2 rounded-md cursor-pointer transition-all group",
                        enabledWidgets.includes(w.id) ? "bg-blue-600/10 text-blue-400" : "hover:bg-[#1a1d27] text-[#94a3b8]"
                      )}
                    >
                      <span className="text-xs font-medium truncate pr-2">{w.title}</span>
                      <div className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={enabledWidgets.includes(w.id)}
                          onChange={() => toggleWidget(w.id)}
                        />
                        <div className="w-7 h-4 bg-[#2a2d3a] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Dashboard Canvas */}
        <main className="flex-1 bg-[#0f1117] overflow-y-auto p-6 custom-scrollbar relative">
          {enabledWidgets.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
              <LayoutDashboard size={64} className="mb-4 text-[#2a2d3a]" />
              <h2 className="text-xl font-bold mb-2">Dashboard is Empty</h2>
              <p className="text-sm max-w-xs">Select widgets from the catalog on the left to start building your visualization.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {enabledWidgets.map(id => {
                const widget = WIDGETS.find(w => w.id === id);
                if (!widget) return null;
                return (
                  <div 
                    key={id} 
                    className="bg-[#1a1d27] border border-[#2a2d3a] rounded-xl p-5 flex flex-col shadow-xl shadow-black/20 hover:border-[#3a3d4a] transition-all group"
                  >
                    <WidgetHeader 
                      title={widget.title} 
                      view={widgetViews[id]} 
                      onViewChange={(v) => setView(id, v)} 
                    />
                    <div className="flex-1 min-h-[180px]">
                      {renderWidgetContent(widget)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Section 3: Drill-Down Panel */}
      <div 
        className={cn(
          "fixed inset-0 z-50 transition-opacity duration-300 pointer-events-none",
          drillDown.open ? "opacity-100 pointer-events-auto" : "opacity-0"
        )}
      >
        <div 
          className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
          onClick={() => setDrillDown(prev => ({ ...prev, open: false }))}
        />
        <div 
          className={cn(
            "absolute top-0 right-0 bottom-0 w-[400px] bg-[#13161f] border-l border-[#2a2d3a] shadow-2xl transition-transform duration-300 flex flex-col",
            drillDown.open ? "translate-x-0" : "translate-x-full"
          )}
        >
          <div className="p-6 border-b border-[#2a2d3a] flex items-center justify-between bg-[#1a1d27]">
            <div className="flex flex-col">
              <h2 className="text-lg font-bold text-[#e2e8f0]">Drill-Down Analysis</h2>
              <span className="text-xs text-blue-400 font-medium">{drillDown.title}</span>
            </div>
            <button 
              onClick={() => setDrillDown(prev => ({ ...prev, open: false }))}
              className="p-2 hover:bg-[#2a2d3a] rounded-full text-[#94a3b8] hover:text-[#e2e8f0] transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          
          <div className="p-4 bg-[#0f1117] border-b border-[#2a2d3a] flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#2a2d3a]" size={14} />
              <input 
                type="text" 
                placeholder="Search users..." 
                className="w-full bg-[#13161f] border border-[#2a2d3a] rounded-md py-2 pl-9 pr-4 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <button className="p-2 bg-[#13161f] border border-[#2a2d3a] rounded-md text-[#94a3b8] hover:text-[#e2e8f0]">
              <Filter size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {drillDown.users.length > 0 ? (
              drillDown.users.map((user: User) => (
                <div key={user.id}>
                  <DrillDownUserRow 
                    user={user} 
                    isExpanded={expandedUserId === user.id}
                    onToggle={() => setExpandedUserId(prev => prev === user.id ? null : user.id)}
                  />
                </div>
              ))
            ) : (
              <div className="p-12 text-center opacity-40">
                <Users size={48} className="mx-auto mb-4 text-[#2a2d3a]" />
                <p className="text-sm">No users found for this segment.</p>
              </div>
            )}
          </div>

          <div className="p-6 bg-[#1a1d27] border-t border-[#2a2d3a] flex items-center justify-between">
            <span className="text-xs text-[#94a3b8]">Showing {drillDown.users.length} users</span>
            <button className="text-xs font-bold text-blue-400 hover:underline flex items-center gap-1">
              Export CSV <ExternalLink size={12} />
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #2a2d3a; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3a3d4a; }
      `}</style>
    </div>
  );
}
