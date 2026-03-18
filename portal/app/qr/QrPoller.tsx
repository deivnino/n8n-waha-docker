"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import NavBar from "@/components/NavBar";

interface Props {
  sessionId: string;
  clientName: string;
  phoneNumber: string;
}

type Status = "loading" | "starting" | "qr_ready" | "connected" | "error";

const POLL_INTERVAL = 3000;

export default function QrPoller({ sessionId, clientName, phoneNumber }: Props) {
  const [status, setStatus] = useState<Status>("loading");
  const [qrSrc, setQrSrc] = useState<string | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/qr/${sessionId}`, { cache: "no-store" });
      if (!res.ok) {
        setStatus("error");
        return false;
      }
      const data = await res.json();

      if (data.connected) {
        setStatus("connected");
        return true; // stop polling
      }

      if (data.starting) {
        setStatus("starting");
      } else if (data.qr) {
        setQrSrc(data.qr);
        setStatus("qr_ready");
      }
    } catch {
      setStatus("error");
    }
    return false;
  }, [sessionId]);

  useEffect(() => {
    let stopped = false;

    const run = async () => {
      const done = await poll();
      if (!done && !stopped) {
        setTimeout(run, POLL_INTERVAL);
      }
    };

    run();
    return () => {
      stopped = true;
    };
  }, [poll]);

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col">
      <NavBar />
      <div className="flex-1 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm bg-slate-900 border-slate-800 text-slate-100">
        <CardHeader className="text-center space-y-2">
          <div className="text-3xl">📱</div>
          <CardTitle className="text-lg font-semibold">{clientName}</CardTitle>
          <p className="text-xs text-slate-400">{phoneNumber}</p>
        </CardHeader>

        <CardContent className="flex flex-col items-center gap-4">
          {(status === "loading" || status === "starting") && (
            <>
              <Spinner className="w-8 h-8 text-slate-400" />
              <p className="text-sm text-slate-400">
                {status === "starting"
                  ? "Iniciando sesión de WhatsApp..."
                  : "Cargando código QR..."}
              </p>
            </>
          )}

          {status === "qr_ready" && qrSrc && (
            <>
              <Badge variant="outline" className="border-yellow-500 text-yellow-400 text-xs">
                Escanea con WhatsApp
              </Badge>
              <div className="bg-white p-3 rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrSrc} alt="WhatsApp QR Code" className="w-52 h-52 object-contain" />
              </div>
              <p className="text-xs text-slate-400 text-center">
                Abre WhatsApp → Dispositivos vinculados → Vincular dispositivo
              </p>
            </>
          )}

          {status === "connected" && (
            <>
              <div className="text-5xl">✅</div>
              <Badge className="bg-green-600 text-white text-sm px-4 py-1">
                WhatsApp Conectado
              </Badge>
              <p className="text-sm text-slate-300 text-center">
                El asistente ya está activo y listo para responder.
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <div className="text-5xl">⚠️</div>
              <Badge variant="destructive" className="text-sm">
                Error de conexión
              </Badge>
              <p className="text-sm text-slate-400 text-center">
                No se pudo obtener el QR. Contacta a soporte.
              </p>
            </>
          )}
        </CardContent>
      </Card>
      </div>
    </main>
  );
}
