import {
  SimCableType,
  SimCliMode,
  SimDevice,
  SimDeviceInterface,
  SimDeviceType,
  SimDiagramLabel,
  SimLineSettings,
  SimLink,
  SimOspfConfig,
  SimStaticRoute,
  SimTopologyShape,
  SimVlanEntry
} from '../components/Lab/networkSimTypes';
import { createDefaultDevice } from '../components/Lab/networkSimEngine';
import {
  LabGridSettings,
  MAX_LAB_CANVAS_HEIGHT,
  MAX_LAB_CANVAS_WIDTH,
  computeRequiredCanvasSize,
  normalizeCanvasDimensions,
  sanitizeLabelsForStorage,
  sanitizeShapesForStorage
} from './labPersistence';

export const TOPOLOGY_JSON_FORMAT = 'netplus-lab-project-v1';
export const TOPOLOGY_JSON_VERSION = 1;

export interface ExportedTopologyJson {
  format: string;
  version: number;
  title: string;
  status: 'in_progress' | 'completed';
  presetId: string;
  canvasSize?: {
    width: number;
    height: number;
  };
  showCustomLabels?: boolean;
  gridSettings?: LabGridSettings;
  exportedAt: string;
  studentEmail?: string;
  objectivesSummary?: {
    passed: number;
    total: number;
    completed: boolean;
  };
  summary: {
    deviceCount: number;
    linkCount: number;
    shapeCount: number;
    labelCount: number;
  };
  devices: SimDevice[];
  links: SimLink[];
  shapes: SimTopologyShape[];
  labels: SimDiagramLabel[];
}

export type TopologyImportParseResult =
  | {
      ok: true;
      data: {
        title?: string;
        status: 'in_progress' | 'completed';
        presetId: string;
        canvasSize: {
          width: number;
          height: number;
        };
        showCustomLabels?: boolean;
        gridSettings?: LabGridSettings;
        devices: SimDevice[];
        links: SimLink[];
        shapes: SimTopologyShape[];
        labels: SimDiagramLabel[];
        warnings: string[];
      };
    }
  | {
      ok: false;
      error: string;
    };

const VALID_DEVICE_TYPES = new Set<SimDeviceType>(['router', 'switch', 'pc', 'server']);
const VALID_CABLE_TYPES = new Set<SimCableType>(['straight', 'crossover', 'fiber', 'serial']);
const VALID_CLI_MODES = new Set<SimCliMode>([
  'user',
  'privileged',
  'global',
  'interface',
  'interface_range',
  'router_ospf',
  'vlan_db',
  'line'
]);
const VALID_IFACE_KINDS = new Set<SimDeviceInterface['kind']>([
  'ethernet',
  'fiber',
  'serial',
  'subinterface',
  'loopback',
  'svi'
]);

function stripUndefinedDeep<T>(val: T): T {
  if (Array.isArray(val)) {
    return val.map(item => stripUndefinedDeep(item)) as unknown as T;
  }
  if (val && typeof val === 'object') {
    const out: Record<string, unknown> = {};
    Object.entries(val as Record<string, unknown>).forEach(([k, v]) => {
      if (v !== undefined) {
        out[k] = stripUndefinedDeep(v);
      }
    });
    return out as T;
  }
  return val;
}

function clampInt(raw: unknown, min: number, max: number, fallback: number): number {
  const num = Number(raw);
  if (!Number.isFinite(num)) return fallback;
  return Math.round(Math.min(max, Math.max(min, num)));
}

function normalizeInterface(raw: unknown, index: number): SimDeviceInterface | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const name = typeof obj.name === 'string' ? obj.name.trim().slice(0, 64) : '';
  if (!name) return null;

  const shortName =
    typeof obj.shortName === 'string' && obj.shortName.trim()
      ? obj.shortName.trim().slice(0, 32)
      : name;

  const kind: SimDeviceInterface['kind'] = VALID_IFACE_KINDS.has(
    obj.kind as SimDeviceInterface['kind']
  )
    ? (obj.kind as SimDeviceInterface['kind'])
    : name.toLowerCase().startsWith('serial')
    ? 'serial'
    : name.toLowerCase().startsWith('loopback')
    ? 'loopback'
    : name.toLowerCase().startsWith('vlan')
    ? 'svi'
    : name.includes('.')
    ? 'subinterface'
    : 'ethernet';

  const normalized: SimDeviceInterface = {
    name,
    shortName,
    kind,
    ip: typeof obj.ip === 'string' ? obj.ip.trim().slice(0, 45) : '',
    mask: typeof obj.mask === 'string' ? obj.mask.trim().slice(0, 45) : '',
    adminUp: typeof obj.adminUp === 'boolean' ? obj.adminUp : true,
    mac:
      typeof obj.mac === 'string' && obj.mac.trim()
        ? obj.mac.trim().slice(0, 24)
        : `00:50:56:00:00:${(index + 1).toString(16).padStart(2, '0').toUpperCase()}`
  };

  if (typeof obj.description === 'string' && obj.description.trim()) {
    normalized.description = obj.description.trim().slice(0, 120);
  }
  if (obj.duplex === 'auto' || obj.duplex === 'full' || obj.duplex === 'half') {
    normalized.duplex = obj.duplex;
  }
  if (obj.speed === 'auto' || obj.speed === '10' || obj.speed === '100' || obj.speed === '1000') {
    normalized.speed = obj.speed;
  }
  if (Number.isFinite(Number(obj.bandwidth)) && Number(obj.bandwidth) > 0) {
    normalized.bandwidth = Math.round(Number(obj.bandwidth));
  }
  if (Number.isFinite(Number(obj.clockRate)) && Number(obj.clockRate) > 0) {
    normalized.clockRate = Math.round(Number(obj.clockRate));
  }
  if (obj.switchportMode === 'access' || obj.switchportMode === 'trunk') {
    normalized.switchportMode = obj.switchportMode;
  }
  if (Number.isFinite(Number(obj.accessVlan)) && Number(obj.accessVlan) >= 1) {
    normalized.accessVlan = Math.round(Number(obj.accessVlan));
  }
  if (Number.isFinite(Number(obj.trunkNativeVlan)) && Number(obj.trunkNativeVlan) >= 1) {
    normalized.trunkNativeVlan = Math.round(Number(obj.trunkNativeVlan));
  }
  if (Array.isArray(obj.trunkAllowedVlans)) {
    const vlans = obj.trunkAllowedVlans
      .map(v => Math.round(Number(v)))
      .filter(v => Number.isFinite(v) && v >= 1 && v <= 4094);
    normalized.trunkAllowedVlans = vlans;
  }
  if (typeof obj.portfast === 'boolean') {
    normalized.portfast = obj.portfast;
  }
  if (typeof obj.bpduGuard === 'boolean') {
    normalized.bpduGuard = obj.bpduGuard;
  }
  if (obj.portSecurity && typeof obj.portSecurity === 'object') {
    const ps = obj.portSecurity as Record<string, unknown>;
    normalized.portSecurity = {
      enabled: Boolean(ps.enabled),
      maximum: clampInt(ps.maximum, 1, 132, 1),
      violation:
        ps.violation === 'protect' || ps.violation === 'restrict' || ps.violation === 'shutdown'
          ? ps.violation
          : 'shutdown',
      sticky: Boolean(ps.sticky)
    };
  }
  if (Number.isFinite(Number(obj.dot1qVlan)) && Number(obj.dot1qVlan) >= 1) {
    normalized.dot1qVlan = Math.round(Number(obj.dot1qVlan));
  }
  if (typeof obj.parentInterface === 'string' && obj.parentInterface.trim()) {
    normalized.parentInterface = obj.parentInterface.trim().slice(0, 64);
  }

  return normalized;
}

function normalizeStaticRoutes(raw: unknown): SimStaticRoute[] {
  if (!Array.isArray(raw)) return [];
  const routes: SimStaticRoute[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    if (
      typeof obj.network === 'string' &&
      typeof obj.mask === 'string' &&
      typeof obj.nextHop === 'string' &&
      obj.network.trim() &&
      obj.mask.trim() &&
      obj.nextHop.trim()
    ) {
      routes.push({
        network: obj.network.trim().slice(0, 45),
        mask: obj.mask.trim().slice(0, 45),
        nextHop: obj.nextHop.trim().slice(0, 45)
      });
    }
  }
  return routes;
}

function normalizeOspf(raw: unknown): SimOspfConfig | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  const networks = Array.isArray(obj.networks)
    ? obj.networks
        .filter((n): n is Record<string, unknown> => Boolean(n && typeof n === 'object'))
        .map(n => ({
          network: typeof n.network === 'string' ? n.network.trim() : '',
          wildcard: typeof n.wildcard === 'string' ? n.wildcard.trim() : '',
          area: typeof n.area === 'string' || typeof n.area === 'number' ? String(n.area).trim() : '0'
        }))
        .filter(n => n.network && n.wildcard)
    : [];

  const config: SimOspfConfig = {
    processId:
      typeof obj.processId === 'string' || typeof obj.processId === 'number'
        ? String(obj.processId).trim() || '1'
        : '1',
    routerId: typeof obj.routerId === 'string' ? obj.routerId.trim() : '',
    networks
  };
  if (Array.isArray(obj.passiveInterfaces)) {
    config.passiveInterfaces = obj.passiveInterfaces
      .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      .map(s => s.trim());
  }
  if (typeof obj.passiveDefault === 'boolean') {
    config.passiveDefault = obj.passiveDefault;
  }
  if (typeof obj.defaultInformationOriginate === 'boolean') {
    config.defaultInformationOriginate = obj.defaultInformationOriginate;
  }
  if (Number.isFinite(Number(obj.referenceBandwidth)) && Number(obj.referenceBandwidth) > 0) {
    config.referenceBandwidth = Math.round(Number(obj.referenceBandwidth));
  }
  return config;
}

function normalizeVlans(raw: unknown): SimVlanEntry[] {
  if (!Array.isArray(raw)) return [];
  const entries: SimVlanEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const id = Math.round(Number(obj.id));
    if (!Number.isFinite(id) || id < 1 || id > 4094) continue;
    entries.push({
      id,
      name:
        typeof obj.name === 'string' && obj.name.trim()
          ? obj.name.trim().slice(0, 48)
          : `VLAN${String(id).padStart(4, '0')}`
    });
  }
  return entries;
}

function normalizeLineSettings(raw: unknown): SimLineSettings | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  const settings: SimLineSettings = {};
  if (typeof obj.password === 'string') settings.password = obj.password.slice(0, 64);
  if (typeof obj.login === 'boolean') settings.login = obj.login;
  if (typeof obj.loginLocal === 'boolean') settings.loginLocal = obj.loginLocal;
  if (typeof obj.transportInput === 'string') settings.transportInput = obj.transportInput.slice(0, 32);
  if (typeof obj.execTimeout === 'string') settings.execTimeout = obj.execTimeout.slice(0, 24);
  if (typeof obj.loggingSync === 'boolean') settings.loggingSync = obj.loggingSync;
  return settings;
}

export function normalizeDeviceForJson(
  dev: SimDevice,
  maxWidth: number = MAX_LAB_CANVAS_WIDTH,
  maxHeight: number = MAX_LAB_CANVAS_HEIGHT
): SimDevice {
  const rawRot = Number(dev.rotation);
  const normRot = Number.isFinite(rawRot) ? ((Math.round(rawRot) % 360) + 360) % 360 : 0;
  const rawLx = Number(dev.labelOffsetX);
  const normLx = Number.isFinite(rawLx) ? Math.round(Math.min(220, Math.max(-220, rawLx))) : 0;
  const rawLy = Number(dev.labelOffsetY);
  const normLy = Number.isFinite(rawLy) ? Math.round(Math.min(180, Math.max(-180, rawLy))) : 0;
  const cleanCustomLabel =
    typeof dev.customLabel === 'string' && dev.customLabel.trim()
      ? dev.customLabel.trim().slice(0, 64)
      : undefined;

  return stripUndefinedDeep({
    ...dev,
    id: String(dev.id).slice(0, 128),
    name: String(dev.name || 'Device').slice(0, 64),
    customLabel: cleanCustomLabel,
    useCustomLabel: cleanCustomLabel
      ? dev.useCustomLabel === false
        ? false
        : true
      : undefined,
    model: String(dev.model || '').slice(0, 80),
    x: clampInt(dev.x, 20, maxWidth - 20, 500),
    y: clampInt(dev.y, 20, maxHeight - 20, 290),
    rotation: normRot !== 0 ? normRot : undefined,
    labelOffsetX: normLx !== 0 ? normLx : undefined,
    labelOffsetY: normLy !== 0 ? normLy : undefined,
    cliHistory: Array.isArray(dev.cliHistory)
      ? dev.cliHistory.slice(-120).map(line => String(line).slice(0, 400))
      : [],
    interfaces: Array.isArray(dev.interfaces) ? dev.interfaces : [],
    staticRoutes: Array.isArray(dev.staticRoutes) ? dev.staticRoutes : [],
    vlans: Array.isArray(dev.vlans) ? dev.vlans : []
  });
}

export function buildTopologyJsonPayload(params: {
  title: string;
  status: 'in_progress' | 'completed';
  presetId: string;
  canvasSize?: { width: number; height: number };
  showCustomLabels?: boolean;
  gridSettings?: LabGridSettings;
  studentEmail?: string;
  objectivesSummary?: {
    passed: number;
    total: number;
    completed: boolean;
  };
  devices: SimDevice[];
  links: SimLink[];
  shapes?: SimTopologyShape[];
  labels?: SimDiagramLabel[];
}): ExportedTopologyJson {
  const cleanShapes = sanitizeShapesForStorage(params.shapes);
  const cleanLabels = sanitizeLabelsForStorage(params.labels);
  const cleanDevices = params.devices.map(d => normalizeDeviceForJson(d));
  const resolvedCanvasSize = computeRequiredCanvasSize(
    cleanDevices,
    cleanShapes,
    cleanLabels,
    params.canvasSize?.width,
    params.canvasSize?.height
  );
  const cleanLinks = params.links.map(link =>
    stripUndefinedDeep({
      id: String(link.id).slice(0, 128),
      cableType: link.cableType,
      fromDeviceId: String(link.fromDeviceId).slice(0, 128),
      fromPort: String(link.fromPort).slice(0, 64),
      toDeviceId: String(link.toDeviceId).slice(0, 128),
      toPort: String(link.toPort).slice(0, 64)
    })
  );

  return stripUndefinedDeep({
    format: TOPOLOGY_JSON_FORMAT,
    version: TOPOLOGY_JSON_VERSION,
    title: params.title.trim().slice(0, 120) || 'Network Topology',
    status: params.status,
    presetId: params.presetId || 'blank-sandbox',
    canvasSize: resolvedCanvasSize,
    ...(typeof params.showCustomLabels === 'boolean'
      ? { showCustomLabels: params.showCustomLabels }
      : {}),
    ...(params.gridSettings ? { gridSettings: params.gridSettings } : {}),
    exportedAt: new Date().toISOString(),
    ...(params.studentEmail ? { studentEmail: params.studentEmail } : {}),
    ...(params.objectivesSummary ? { objectivesSummary: params.objectivesSummary } : {}),
    summary: {
      deviceCount: cleanDevices.length,
      linkCount: cleanLinks.length,
      shapeCount: cleanShapes.length,
      labelCount: cleanLabels.length
    },
    devices: cleanDevices,
    links: cleanLinks,
    shapes: cleanShapes,
    labels: cleanLabels
  });
}

export function triggerTopologyJsonDownload(
  payload: ExportedTopologyJson,
  filename: string
): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function parseAndValidateTopologyJson(
  rawText: string,
  knownPresetIds?: Set<string>
): TopologyImportParseResult {
  if (!rawText || !rawText.trim()) {
    return { ok: false, error: 'The selected topology file is empty.' };
  }

  let parsedRaw: unknown;
  try {
    parsedRaw = JSON.parse(rawText);
  } catch {
    return {
      ok: false,
      error: 'Could not parse JSON file. Ensure the file is valid .netlab.json or .json syntax.'
    };
  }

  if (!parsedRaw || typeof parsedRaw !== 'object' || Array.isArray(parsedRaw)) {
    return {
      ok: false,
      error: 'Invalid lab project format: expected a JSON object at root.'
    };
  }

  let root = parsedRaw as Record<string, unknown>;
  if (
    !Array.isArray(root.devices) &&
    root.topology &&
    typeof root.topology === 'object' &&
    !Array.isArray(root.topology) &&
    Array.isArray((root.topology as Record<string, unknown>).devices)
  ) {
    root = root.topology as Record<string, unknown>;
  }

  if (!Array.isArray(root.devices)) {
    return {
      ok: false,
      error: 'Invalid lab project format: missing "devices" array.'
    };
  }

  const warnings: string[] = [];
  const rawShapes = Array.isArray(root.shapes) ? sanitizeShapesForStorage(root.shapes) : [];
  const rawLabels = Array.isArray(root.labels) ? sanitizeLabelsForStorage(root.labels) : [];

  const isExplicitFormat = root.format === TOPOLOGY_JSON_FORMAT;
  if (
    root.devices.length === 0 &&
    rawShapes.length === 0 &&
    rawLabels.length === 0 &&
    !isExplicitFormat
  ) {
    return {
      ok: false,
      error: 'The JSON file contains no devices, zones, or labels to import.'
    };
  }

  const normalizedDevices: SimDevice[] = [];
  const usedDeviceIds = new Set<string>();
  let skippedDevices = 0;

  root.devices.forEach((rawItem, idx) => {
    if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
      skippedDevices += 1;
      return;
    }
    const item = rawItem as Record<string, unknown>;
    const devType = item.type as SimDeviceType;
    if (!VALID_DEVICE_TYPES.has(devType)) {
      skippedDevices += 1;
      return;
    }

    const fallbackX = 200 + (idx % 4) * 180;
    const fallbackY = 150 + Math.floor(idx / 4) * 140;
    const x = clampInt(
      item.x,
      20,
      MAX_LAB_CANVAS_WIDTH - 20,
      clampInt(fallbackX, 20, MAX_LAB_CANVAS_WIDTH - 20, 500)
    );
    const y = clampInt(
      item.y,
      20,
      MAX_LAB_CANVAS_HEIGHT - 20,
      clampInt(fallbackY, 20, MAX_LAB_CANVAS_HEIGHT - 20, 290)
    );

    const defaultNames: Record<SimDeviceType, string> = {
      router: `R-${idx + 1}`,
      switch: `SW-${idx + 1}`,
      pc: `PC-${idx + 1}`,
      server: `Server-${idx + 1}`
    };
    const name =
      typeof item.name === 'string' && item.name.trim()
        ? item.name.trim().slice(0, 64)
        : defaultNames[devType];

    let devId =
      typeof item.id === 'string' && item.id.trim()
        ? item.id.trim().slice(0, 128)
        : `${devType}-import-${idx + 1}`;
    if (usedDeviceIds.has(devId)) {
      devId = `${devId}-${idx + 1}`;
    }
    usedDeviceIds.add(devId);

    const baseline = createDefaultDevice(devType, name, x, y, devId);

    const rawIfaces = Array.isArray(item.interfaces)
      ? item.interfaces
          .map((iface, ifaceIdx) => normalizeInterface(iface, ifaceIdx))
          .filter((iface): iface is SimDeviceInterface => Boolean(iface))
      : [];

    const interfaces = rawIfaces.length > 0 ? rawIfaces : baseline.interfaces;

    const rawRot = Number(item.rotation);
    const normRot = Number.isFinite(rawRot) ? ((Math.round(rawRot) % 360) + 360) % 360 : 0;
    const rawLx = Number(item.labelOffsetX);
    const normLx = Number.isFinite(rawLx) ? Math.round(Math.min(220, Math.max(-220, rawLx))) : 0;
    const rawLy = Number(item.labelOffsetY);
    const normLy = Number.isFinite(rawLy) ? Math.round(Math.min(180, Math.max(-180, rawLy))) : 0;
    const cleanCustomLabel =
      typeof item.customLabel === 'string' && item.customLabel.trim()
        ? item.customLabel.trim().slice(0, 64)
        : undefined;

    const cliMode: SimCliMode = VALID_CLI_MODES.has(item.cliMode as SimCliMode)
      ? (item.cliMode as SimCliMode)
      : baseline.cliMode;

    const cliHistory = Array.isArray(item.cliHistory)
      ? item.cliHistory.slice(-120).map(line => String(line).slice(0, 400))
      : baseline.cliHistory;

    const vlans = Array.isArray(item.vlans)
      ? normalizeVlans(item.vlans)
      : baseline.vlans;

    const device: SimDevice = {
      ...baseline,
      id: devId,
      name,
      ...(cleanCustomLabel
        ? {
            customLabel: cleanCustomLabel,
            useCustomLabel: item.useCustomLabel === false ? false : true
          }
        : {}),
      type: devType,
      model:
        typeof item.model === 'string' && item.model.trim()
          ? item.model.trim().slice(0, 80)
          : baseline.model,
      x,
      y,
      ...(normRot !== 0 ? { rotation: normRot } : {}),
      ...(normLx !== 0 ? { labelOffsetX: normLx } : {}),
      ...(normLy !== 0 ? { labelOffsetY: normLy } : {}),
      interfaces,
      staticRoutes: normalizeStaticRoutes(item.staticRoutes),
      vlans: devType === 'switch' && vlans.length === 0 ? [{ id: 1, name: 'default' }] : vlans,
      cliMode,
      cliHistory,
      ...(typeof item.gateway === 'string' ? { gateway: item.gateway.trim().slice(0, 45) } : {}),
      ...(typeof item.dns === 'string' ? { dns: item.dns.trim().slice(0, 45) } : {}),
      ...(typeof item.defaultGateway === 'string'
        ? { defaultGateway: item.defaultGateway.trim().slice(0, 45) }
        : {}),
      ...(normalizeOspf(item.ospf) ? { ospf: normalizeOspf(item.ospf) } : {}),
      ...(typeof item.activeInterfaceName === 'string'
        ? { activeInterfaceName: item.activeInterfaceName.slice(0, 64) }
        : {}),
      ...(Array.isArray(item.activeInterfaceRange)
        ? {
            activeInterfaceRange: item.activeInterfaceRange
              .filter((s): s is string => typeof s === 'string')
              .slice(0, 24)
          }
        : {}),
      ...(Number.isFinite(Number(item.activeVlanId))
        ? { activeVlanId: Math.round(Number(item.activeVlanId)) }
        : {}),
      ...(item.activeLine === 'console' || item.activeLine === 'vty'
        ? { activeLine: item.activeLine }
        : {}),
      ...(typeof item.bannerMotd === 'string' ? { bannerMotd: item.bannerMotd.slice(0, 240) } : {}),
      ...(typeof item.enableSecret === 'string'
        ? { enableSecret: item.enableSecret.slice(0, 64) }
        : {}),
      ...(typeof item.servicePasswordEncryption === 'boolean'
        ? { servicePasswordEncryption: item.servicePasswordEncryption }
        : {}),
      ...(typeof item.ipDomainLookup === 'boolean'
        ? { ipDomainLookup: item.ipDomainLookup }
        : {}),
      ...(typeof item.domainName === 'string' ? { domainName: item.domainName.slice(0, 80) } : {}),
      ...(typeof item.nameServer === 'string' ? { nameServer: item.nameServer.slice(0, 45) } : {}),
      ...(Array.isArray(item.users)
        ? {
            users: item.users
              .filter((u): u is Record<string, unknown> => Boolean(u && typeof u === 'object'))
              .filter(u => typeof u.username === 'string' && typeof u.secret === 'string')
              .map(u => ({
                username: String(u.username).slice(0, 64),
                secret: String(u.secret).slice(0, 64)
              }))
          }
        : {}),
      ...(item.lineConfig && typeof item.lineConfig === 'object'
        ? {
            lineConfig: {
              ...(normalizeLineSettings((item.lineConfig as Record<string, unknown>).console)
                ? { console: normalizeLineSettings((item.lineConfig as Record<string, unknown>).console) }
                : {}),
              ...(normalizeLineSettings((item.lineConfig as Record<string, unknown>).vty)
                ? { vty: normalizeLineSettings((item.lineConfig as Record<string, unknown>).vty) }
                : {})
            }
          }
        : {}),
      ...(Array.isArray(item.startupConfigLines)
        ? {
            startupConfigLines: item.startupConfigLines
              .filter((l): l is string => typeof l === 'string')
              .slice(0, 200)
          }
        : {}),
      ...(typeof item.startupConfigSavedAt === 'string'
        ? { startupConfigSavedAt: item.startupConfigSavedAt.slice(0, 64) }
        : {})
    };

    normalizedDevices.push(stripUndefinedDeep(device));
  });

  if (root.devices.length > 0 && normalizedDevices.length === 0) {
    return {
      ok: false,
      error: 'No valid router, switch, workstation, or server nodes found in the JSON file.'
    };
  }

  if (skippedDevices > 0) {
    warnings.push(`skipped ${skippedDevices} unrecognized device record${skippedDevices === 1 ? '' : 's'}`);
  }

  const deviceById = new Map<string, SimDevice>();
  normalizedDevices.forEach(dev => deviceById.set(dev.id, dev));

  const findPortName = (dev: SimDevice, rawPort: string): string | null => {
    const target = rawPort.trim().toLowerCase();
    if (!target) return null;
    const match = dev.interfaces.find(
      iface =>
        iface.name.toLowerCase() === target || iface.shortName.toLowerCase() === target
    );
    return match ? match.name : null;
  };

  const normalizedLinks: SimLink[] = [];
  const usedLinkIds = new Set<string>();
  const usedPorts = new Set<string>();
  let skippedLinks = 0;

  const rawLinks = Array.isArray(root.links) ? root.links : [];
  rawLinks.forEach((rawLink, idx) => {
    if (!rawLink || typeof rawLink !== 'object' || Array.isArray(rawLink)) {
      skippedLinks += 1;
      return;
    }
    const obj = rawLink as Record<string, unknown>;
    const fromDeviceId = typeof obj.fromDeviceId === 'string' ? obj.fromDeviceId.trim() : '';
    const toDeviceId = typeof obj.toDeviceId === 'string' ? obj.toDeviceId.trim() : '';
    const rawFromPort = typeof obj.fromPort === 'string' ? obj.fromPort : '';
    const rawToPort = typeof obj.toPort === 'string' ? obj.toPort : '';

    if (!fromDeviceId || !toDeviceId || fromDeviceId === toDeviceId) {
      skippedLinks += 1;
      return;
    }

    const fromDev = deviceById.get(fromDeviceId);
    const toDev = deviceById.get(toDeviceId);
    if (!fromDev || !toDev) {
      skippedLinks += 1;
      return;
    }

    const fromPort = findPortName(fromDev, rawFromPort);
    const toPort = findPortName(toDev, rawToPort);
    if (!fromPort || !toPort) {
      skippedLinks += 1;
      return;
    }

    const fromPortKey = `${fromDeviceId}::${fromPort}`;
    const toPortKey = `${toDeviceId}::${toPort}`;
    if (usedPorts.has(fromPortKey) || usedPorts.has(toPortKey)) {
      skippedLinks += 1;
      return;
    }

    const cableType: SimCableType = VALID_CABLE_TYPES.has(obj.cableType as SimCableType)
      ? (obj.cableType as SimCableType)
      : 'straight';

    let linkId =
      typeof obj.id === 'string' && obj.id.trim()
        ? obj.id.trim().slice(0, 128)
        : `link-import-${idx + 1}`;
    if (usedLinkIds.has(linkId)) {
      linkId = `${linkId}-${idx + 1}`;
    }

    usedLinkIds.add(linkId);
    usedPorts.add(fromPortKey);
    usedPorts.add(toPortKey);

    normalizedLinks.push({
      id: linkId,
      cableType,
      fromDeviceId,
      fromPort,
      toDeviceId,
      toPort
    });
  });

  if (skippedLinks > 0) {
    warnings.push(`skipped ${skippedLinks} dangling or conflicting cable link${skippedLinks === 1 ? '' : 's'}`);
  }

  const rawPresetId = typeof root.presetId === 'string' ? root.presetId.trim() : 'blank-sandbox';
  const resolvedPresetId =
    knownPresetIds && knownPresetIds.size > 0
      ? knownPresetIds.has(rawPresetId)
        ? rawPresetId
        : 'blank-sandbox'
      : rawPresetId || 'blank-sandbox';

  const title =
    typeof root.title === 'string' && root.title.trim()
      ? root.title.trim().slice(0, 120)
      : undefined;

  const status: 'in_progress' | 'completed' =
    root.status === 'completed' ? 'completed' : 'in_progress';

  const rawCanvasObj =
    root.canvasSize && typeof root.canvasSize === 'object' && !Array.isArray(root.canvasSize)
      ? (root.canvasSize as Record<string, unknown>)
      : null;
  const requestedCanvas = normalizeCanvasDimensions(rawCanvasObj?.width, rawCanvasObj?.height);
  const resolvedCanvasSize = computeRequiredCanvasSize(
    normalizedDevices,
    rawShapes,
    rawLabels,
    requestedCanvas.width,
    requestedCanvas.height
  );

  const rawGridObj =
    root.gridSettings && typeof root.gridSettings === 'object' && !Array.isArray(root.gridSettings)
      ? (root.gridSettings as Record<string, unknown>)
      : null;
  const normalizedGridSettings: LabGridSettings | undefined = rawGridObj
    ? stripUndefinedDeep({
        ...(typeof rawGridObj.showGrid === 'boolean' ? { showGrid: rawGridObj.showGrid } : {}),
        ...(typeof rawGridObj.snapToGrid === 'boolean'
          ? { snapToGrid: rawGridObj.snapToGrid }
          : {}),
        ...(rawGridObj.gridSize === 10 ||
        rawGridObj.gridSize === 20 ||
        rawGridObj.gridSize === 40 ||
        rawGridObj.gridSize === 50
          ? { gridSize: rawGridObj.gridSize }
          : {}),
        ...(rawGridObj.gridStyle === 'lines' || rawGridObj.gridStyle === 'dots'
          ? { gridStyle: rawGridObj.gridStyle }
          : {})
      })
    : undefined;

  return {
    ok: true,
    data: {
      ...(title ? { title } : {}),
      status,
      presetId: resolvedPresetId,
      canvasSize: resolvedCanvasSize,
      ...(typeof root.showCustomLabels === 'boolean'
        ? { showCustomLabels: root.showCustomLabels }
        : {}),
      ...(normalizedGridSettings && Object.keys(normalizedGridSettings).length > 0
        ? { gridSettings: normalizedGridSettings }
        : {}),
      devices: normalizedDevices,
      links: normalizedLinks,
      shapes: rawShapes,
      labels: rawLabels,
      warnings
    }
  };
}
