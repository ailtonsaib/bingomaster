import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Bluetooth, Usb, Loader2, CheckCircle2, AlertCircle, Power, Cpu } from "lucide-react";
import { ELM327_INIT_COMMANDS, OBD2_PIDS, parseDTCs, parsePIDResponse, isNoData, hasNoDTCs } from "@/lib/obd2Protocol";
import { lookupDTC } from "@/lib/obd2DtcDatabase";

const BLE_SERVICE = "0000ffe0-0000-1000-8000-00805f9b34fb";
const BLE_CHAR = "0000ffe1-0000-1000-8000-00805f9b34fb";

const STEPS = {
  IDLE: "idle",
  SELECTING: "selecting",
  CONNECTING: "connecting",
  INITIALIZING: "initializing",
  WAITING_IGNITION: "waiting_ignition",
  SCANNING: "scanning",
  DONE: "done",
  ERROR: "error",
};

export default function OBD2Scanner({ onScanComplete, onScanError }) {
  const [step, setStep] = useState(STEPS.IDLE);
  const [stepLabel, setStepLabel] = useState("");
  const [initProgress, setInitProgress] = useState(0);
  const [error, setError] = useState("");
  const [connectionType, setConnectionType] = useState(null);

  const deviceRef = useRef(null);
  const writerRef = useRef(null);
  const readerRef = useRef(null);
  const readBufferRef = useRef("");
  const bluetoothCharsRef = useRef({ write: null, notify: null });
  const responseResolverRef = useRef(null);

  // === Response accumulation for Bluetooth ===
  const handleBluetoothNotification = useCallback((event) => {
    const value = event.target.value;
    let str = "";
    for (let i = 0; i < value.byteLength; i++) {
      str += String.fromCharCode(value.getUint8(i));
    }
    readBufferRef.current += str;
    if (readBufferRef.current.includes(">") && responseResolverRef.current) {
      const full = readBufferRef.current;
      readBufferRef.current = "";
      responseResolverRef.current(full);
      responseResolverRef.current = null;
    }
  }, []);

  // === Low-level: send command and wait for response ===
  const sendCommand = useCallback(async (cmd, timeout = 5000) => {
    const command = cmd + "\r";
    readBufferRef.current = "";

    return new Promise(async (resolve, reject) => {
      const timer = setTimeout(() => {
        responseResolverRef.current = null;
        reject(new Error(`Timeout ao aguardar resposta do comando: ${cmd}`));
      }, timeout);

      responseResolverRef.current = (data) => {
        clearTimeout(timer);
        resolve(data);
      };

      try {
        if (connectionType === "bluetooth") {
          const writeChar = bluetoothCharsRef.current.write;
          if (!writeChar) throw new Error("Característica Bluetooth não disponível");
          const encoded = new TextEncoder().encode(command);
          await writeChar.writeValue(encoded);
        } else if (connectionType === "serial") {
          const writer = writerRef.current;
          if (!writer) throw new Error("Writer serial não disponível");
          await writer.write(new TextEncoder().encode(command));
        }
      } catch (err) {
        clearTimeout(timer);
        responseResolverRef.current = null;
        reject(err);
      }
    });
  }, [connectionType]);

  // === Read loop for Web Serial ===
  const startSerialReadLoop = useCallback(async () => {
    const reader = readerRef.current;
    if (!reader) return;
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        readBufferRef.current += decoder.decode(value, { stream: true });
        if (readBufferRef.current.includes(">") && responseResolverRef.current) {
          const full = readBufferRef.current;
          readBufferRef.current = "";
          responseResolverRef.current(full);
          responseResolverRef.current = null;
        }
      }
    } catch (err) {
      // Read loop ended
    }
  }, []);

  // === Connect via Bluetooth ===
  const connectBluetooth = async () => {
    if (!navigator.bluetooth) {
      throw new Error("Seu navegador não suporta Web Bluetooth. Use Google Chrome ou Microsoft Edge no desktop ou Android.");
    }
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [BLE_SERVICE] }],
      optionalServices: [BLE_SERVICE, "e7810a71-73ae-499d-8c15-fa5a7ef0cb3e"],
    });

    deviceRef.current = device;
    const server = await device.gatt.connect();

    // Try common service UUID
    let service;
    try {
      service = await server.getPrimaryService(BLE_SERVICE);
    } catch {
      service = await server.getPrimaryService("e7810a71-73ae-499d-8c15-fa5a7ef0cb3e");
    }

    const writeChar = await service.getCharacteristic(BLE_CHAR);
    let notifyChar;
    try {
      notifyChar = await service.getCharacteristic(BLE_CHAR);
    } catch {
      notifyChar = await service.getCharacteristic("bef8d6c9-9c21-4c9e-b680-baf8d03dec8e");
    }

    bluetoothCharsRef.current = { write: writeChar, notify: notifyChar };
    await notifyChar.startNotifications();
    notifyChar.addEventListener("characteristicvaluechanged", handleBluetoothNotification);

    device.addEventListener("gattserverdisconnected", () => {
      setStep(STEPS.ERROR);
      setError("Conexão Bluetooth perdida com o scanner OBD2.");
    });
  };

  // === Connect via Serial (USB) ===
  const connectSerial = async () => {
    if (!navigator.serial) {
      throw new Error("Seu navegador não suporta Web Serial. Use Google Chrome ou Microsoft Edge no desktop.");
    }
    const port = await navigator.serial.requestPort();
    deviceRef.current = port;
    await port.open({ baudRate: 38400 });

    const encoder = new TextEncoderStream();
    encoder.readable.pipeTo(port.writable);
    writerRef.current = encoder.writable.getWriter();

    const decoder = new TextDecoderStream();
    port.readable.pipeTo(decoder.writable);
    readerRef.current = decoder.readable.getReader();

    startSerialReadLoop();
  };

  // === Full scan flow ===
  const handleConnect = async (type) => {
    setConnectionType(type);
    setStep(STEPS.CONNECTING);
    setError("");
    setStepLabel(type === "bluetooth" ? "Conectando ao scanner Bluetooth..." : "Conectando ao scanner USB...");

    try {
      if (type === "bluetooth") {
        await connectBluetooth();
      } else {
        await connectSerial();
      }

      // Initialize ELM327
      setStep(STEPS.INITIALIZING);
      setInitProgress(0);
      for (let i = 0; i < ELM327_INIT_COMMANDS.length; i++) {
        const cmdDef = ELM327_INIT_COMMANDS[i];
        setStepLabel(cmdDef.label);
        await sendCommand(cmdDef.cmd, 3000);
        await new Promise((r) => setTimeout(r, cmdDef.delay));
        setInitProgress(Math.round(((i + 1) / ELM327_INIT_COMMANDS.length) * 100));
      }

      // Ask user to turn on the vehicle
      setStep(STEPS.WAITING_IGNITION);
    } catch (err) {
      setStep(STEPS.ERROR);
      setError(err.message || "Falha ao conectar com o scanner OBD2.");
      onScanError?.(err.message);
    }
  };

  const handleStartScan = async () => {
    setStep(STEPS.SCANNING);
    setError("");

    try {
      // Initialize OBD2 protocol (query supported PIDs)
      setStepLabel("Inicializando comunicação com a ECU...");
      await sendCommand("0100", 8000);

      // Read DTCs
      setStepLabel("Lendo códigos de falhas armazenados (DTCs)...");
      let dtcResponse = "";
      try {
        dtcResponse = await sendCommand("03", 8000);
      } catch {
        dtcResponse = "";
      }

      let dtcCodes = [];
      if (dtcResponse && !isNoData(dtcResponse) && !hasNoDTCs(dtcResponse)) {
        dtcCodes = parseDTCs(dtcResponse);
      }

      // Read live data PIDs
      const liveData = [];
      for (const pidDef of OBD2_PIDS) {
        setStepLabel(`Lendo sensor: ${pidDef.name}...`);
        try {
          const response = await sendCommand(pidDef.pid, 4000);
          if (response && !isNoData(response)) {
            const parsed = parsePIDResponse(response, pidDef.pid);
            if (parsed) liveData.push(parsed);
          }
        } catch {
          // PID not supported, skip
        }
      }

      // Build result
      const result = {
        dtcs: dtcCodes.map((code) => ({ code, description: lookupDTC(code) })),
        liveData,
        scannedAt: new Date().toISOString(),
        hasStoredCodes: dtcCodes.length > 0,
      };

      setStep(STEPS.DONE);
      setStepLabel("Diagnóstico concluído!");
      onScanComplete?.(result);
    } catch (err) {
      setStep(STEPS.ERROR);
      setError(err.message || "Erro durante a leitura dos dados do veículo.");
      onScanError?.(err.message);
    }
  };

  const handleDisconnect = async () => {
    try {
      if (connectionType === "bluetooth" && deviceRef.current?.gatt) {
        deviceRef.current.gatt.disconnect();
      }
      if (connectionType === "serial") {
        if (writerRef.current) await writerRef.current.close();
        if (readerRef.current) await readerRef.current.cancel();
        if (deviceRef.current?.close) await deviceRef.current.close();
      }
    } catch {
      // Ignore disconnect errors
    }
    setStep(STEPS.IDLE);
    setConnectionType(null);
    setError("");
  };

  // === UI ===
  if (step === STEPS.IDLE) {
    return (
      <div className="text-center py-6">
        <div className="w-16 h-16 rounded-full bg-[#DBEAFE] flex items-center justify-center mx-auto mb-4">
          <Cpu className="w-8 h-8 text-[#2563EB]" />
        </div>
        <h3 className="font-bold text-[#1B1C21] mb-1">Scanner OBD2</h3>
        <p className="text-sm text-[#71717A] mb-5 max-w-sm mx-auto">
          Conecte o scanner OBD2 (ELM327) na porta do veículo e escolha o tipo de conexão abaixo.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={() => handleConnect("bluetooth")}
            className="h-11 px-6 rounded-xl text-white font-medium"
            style={{ backgroundColor: "#2563EB" }}
          >
            <Bluetooth className="w-4 h-4 mr-2" /> Conectar via Bluetooth
          </Button>
          <Button
            onClick={() => handleConnect("serial")}
            variant="outline"
            className="h-11 px-6 rounded-xl font-medium border-gray-200 hover:bg-gray-50"
          >
            <Usb className="w-4 h-4 mr-2" /> Conectar via USB
          </Button>
        </div>
        <p className="text-xs text-[#A1A1AA] mt-4">
          Requer Google Chrome ou Edge. O scanner deve ser compatível com ELM327.
        </p>
      </div>
    );
  }

  if (step === STEPS.WAITING_IGNITION) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-6"
      >
        <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4 animate-pulse">
          <Power className="w-10 h-10 text-amber-600" />
        </div>
        <h3 className="font-bold text-[#1B1C21] text-lg mb-1">Ligue a ignição do veículo</h3>
        <p className="text-sm text-[#71717A] mb-6 max-w-sm mx-auto">
          Gire a chave para a posição <strong>ON (ignição ligada)</strong> ou dê partida no motor.
          O scanner precisa que a ECU esteja ativa para ler os dados.
        </p>
        <Button
          onClick={handleStartScan}
          className="h-11 px-8 rounded-xl text-white font-medium"
          style={{ backgroundColor: "#2563EB" }}
        >
          <CheckCircle2 className="w-4 h-4 mr-2" /> Veículo ligado — Iniciar diagnóstico
        </Button>
        <button
          onClick={handleDisconnect}
          className="block mx-auto mt-3 text-xs text-[#A1A1AA] hover:text-gray-600"
        >
          Cancelar
        </button>
      </motion.div>
    );
  }

  if (step === STEPS.ERROR) {
    return (
      <div className="text-center py-6">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-red-600" />
        </div>
        <h3 className="font-bold text-[#1B1C21] mb-1">Erro na conexão</h3>
        <p className="text-sm text-red-600 mb-5 max-w-sm mx-auto">{error}</p>
        <div className="flex gap-3 justify-center">
          <Button
            onClick={() => handleConnect(connectionType)}
            variant="outline"
            className="h-10 px-5 rounded-lg"
          >
            Tentar novamente
          </Button>
          <Button
            onClick={handleDisconnect}
            className="h-10 px-5 rounded-lg"
            variant="ghost"
          >
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  // Loading / scanning / done
  return (
    <div className="py-6">
      <div className="flex flex-col items-center text-center mb-5">
        <Loader2 className="w-10 h-10 text-[#2563EB] animate-spin mb-3" />
        <p className="text-sm font-medium text-[#1B1C21]">{stepLabel}</p>
      </div>

      {step === STEPS.INITIALIZING && (
        <div className="max-w-xs mx-auto">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: "#2563EB" }}
              animate={{ width: `${initProgress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <p className="text-xs text-[#A1A1AA] text-center mt-2">{initProgress}%</p>
        </div>
      )}

      {step === STEPS.SCANNING && (
        <p className="text-xs text-[#A1A1AA] text-center max-w-xs mx-auto">
          Lendo dados em tempo real da ECU do veículo. Isso pode levar alguns segundos.
        </p>
      )}

      {step === STEPS.DONE && (
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <p className="text-sm text-[#52525B] mb-4">Scanner conectado. Diagnóstico OBD2 concluído.</p>
          <Button
            onClick={handleDisconnect}
            variant="outline"
            size="sm"
            className="rounded-lg"
          >
            Desconectar scanner
          </Button>
        </div>
      )}
    </div>
  );
}