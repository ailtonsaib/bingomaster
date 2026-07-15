// ELM327 AT commands, OBD2 PID definitions, and response parsing

export const ELM327_INIT_COMMANDS = [
  { cmd: "ATZ", label: "Resetando adaptador...", delay: 1000 },
  { cmd: "ATE0", label: "Desabilitando eco...", delay: 200 },
  { cmd: "ATL0", label: "Desabilitando quebras de linha...", delay: 200 },
  { cmd: "ATS0", label: "Desabilitando espaços...", delay: 200 },
  { cmd: "ATH1", label: "Habilitando cabeçalhos...", delay: 200 },
  { cmd: "ATSP0", label: "Auto-seleção de protocolo...", delay: 200 },
];

export const OBD2_PIDS = [
  { pid: "0104", name: "Carga do motor", unit: "%", parse: (a) => (a[0] * 100) / 255 },
  { pid: "0105", name: "Temperatura do líquido de arrefecimento", unit: "°C", parse: (a) => a[0] - 40 },
  { pid: "010B", name: "Pressão absoluta do coletor", unit: "kPa", parse: (a) => a[0] },
  { pid: "010C", name: "Rotação do motor (RPM)", unit: "rpm", parse: (a) => ((a[0] * 256) + a[1]) / 4 },
  { pid: "010D", name: "Velocidade do veículo", unit: "km/h", parse: (a) => a[0] },
  { pid: "010F", name: "Temperatura do ar de admissão", unit: "°C", parse: (a) => a[0] - 40 },
  { pid: "0110", name: "Fluxo de ar (MAF)", unit: "g/s", parse: (a) => ((a[0] * 256) + a[1]) / 100 },
  { pid: "0111", name: "Posição da borboleta", unit: "%", parse: (a) => (a[0] * 100) / 255 },
  { pid: "011F", name: "Tempo de funcionamento", unit: "s", parse: (a) => (a[0] * 256) + a[1] },
  { pid: "0121", name: "Distância com MIL acesa", unit: "km", parse: (a) => (a[0] * 256) + a[1] },
  { pid: "012F", name: "Nível de combustível", unit: "%", parse: (a) => (a[0] * 100) / 255 },
  { pid: "0142", name: "Tensão do módulo de controle", unit: "V", parse: (a) => ((a[0] * 256) + a[1]) / 1000 },
  { pid: "0146", name: "Temperatura ambiente", unit: "°C", parse: (a) => a[0] - 40 },
  { pid: "015C", name: "Temperatura do óleo do motor", unit: "°C", parse: (a) => a[0] - 40 },
];

// Convert hex string response to byte array
export function parseHexResponse(raw) {
  const cleaned = raw.replace(/[\s\r\n>]/g, "").toUpperCase();
  const bytes = [];
  for (let i = 0; i + 1 < cleaned.length; i += 2) {
    bytes.push(parseInt(cleaned.substring(i, i + 2), 16));
  }
  return bytes;
}

// Parse DTCs from Mode 03 response
export function parseDTCs(rawResponse) {
  const lines = rawResponse.split(/\r\n/).filter((l) => l.trim() && !l.startsWith(">"));
  const dtcCodes = [];

  for (const line of lines) {
    const bytes = parseHexResponse(line);
    // Look for 43 (positive response to mode 03)
    const idx = bytes.findIndex((b) => b === 0x43);
    if (idx === -1) continue;

    const dataBytes = bytes.slice(idx + 1);
    // First byte after 43 is the number of DTCs (in some protocols)
    // Then pairs of 2 bytes encode each DTC
    let start = 0;
    // If first data byte looks like a count (not a valid DTC first byte), skip it
    if (dataBytes.length > 0 && dataBytes[0] <= 0x0f && dataBytes.length % 2 === 1) {
      start = 1;
    }

    for (let i = start; i + 1 < dataBytes.length; i += 2) {
      const first = dataBytes[i];
      const second = dataBytes[i + 1];
      if (first === 0 && second === 0) continue; // No DTC

      const code = decodeDTC(first, second);
      if (code) dtcCodes.push(code);
    }
  }

  return [...new Set(dtcCodes)]; // remove duplicates
}

function decodeDTC(firstByte, secondByte) {
  const first = firstByte >> 6;
  const second = (firstByte >> 4) & 0x03;
  const third = firstByte & 0x0f;
  const fourth = (secondByte >> 4) & 0x0f;
  const fifth = secondByte & 0x0f;

  const systemChars = ["P", "C", "B", "U"];
  const system = systemChars[first];

  const code = `${system}${second}${third.toString(16).toUpperCase()}${fourth.toString(16).toUpperCase()}${fifth.toString(16).toUpperCase()}`;
  return code;
}

// Parse a PID response (Mode 01)
export function parsePIDResponse(rawResponse, pid) {
  const pidDef = OBD2_PIDS.find((p) => p.pid === pid);
  if (!pidDef) return null;

  const lines = rawResponse.split(/\r\n/).filter((l) => l.trim() && !l.startsWith(">"));
  for (const line of lines) {
    const bytes = parseHexResponse(line);
    // Find 41 (positive response to mode 01)
    const idx = bytes.findIndex((b) => b === 0x41);
    if (idx === -1) continue;

    // Next byte should match the PID number (e.g. 0x05 for 0105)
    const pidByte = parseInt(pid.substring(2), 16);
    if (bytes[idx + 1] === pidByte) {
      const data = bytes.slice(idx + 2);
      const value = pidDef.parse(data);
      return { name: pidDef.name, value: Math.round(value * 10) / 10, unit: pidDef.unit };
    }
  }
  return null;
}

// Check if response indicates "NO DATA"
export function isNoData(rawResponse) {
  const upper = rawResponse.toUpperCase();
  return upper.includes("NODATA") || upper.includes("NO DATA") || upper.includes("UNABLETOCONNECT");
}

// Check if response indicates no DTCs stored
export function hasNoDTCs(rawResponse) {
  const upper = rawResponse.toUpperCase();
  return upper.includes("NODATA") || (upper.includes("43") && upper.includes("000000"));
}