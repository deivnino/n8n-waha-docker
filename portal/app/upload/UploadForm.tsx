"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import NavBar from "@/components/NavBar";

interface Props { token: string }

type State = "idle" | "uploading" | "done" | "error";

export default function UploadForm({ token }: Props) {
  const [state,   setState]   = useState<State>("idle");
  const [message, setMessage] = useState("");
  const [file,    setFile]    = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    if (!file) return;
    setState("uploading");
    setMessage("");

    try {
      const form = new FormData();
      form.append("token", token);
      form.append("file",  file);

      const res  = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) {
        setState("error");
        setMessage(data.error ?? "Error al procesar el archivo");
      } else {
        setState("done");
        setMessage(`✅ ${data.chunks_processed} fragmentos procesados y guardados en la base de conocimiento`);
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
      }
    } catch {
      setState("error");
      setMessage("Error de conexión. Verifica que Ollama esté corriendo.");
    }
  };

  return (
    <main className="min-h-screen bg-slate-950">
      <NavBar />
      <div className="max-w-xl mx-auto space-y-6 p-4 md:p-8">

        {/* Header */}
        <div className="text-center space-y-1">
          <div className="text-3xl">📁</div>
          <h1 className="text-white font-semibold text-lg">Base de Conocimiento</h1>
          <p className="text-slate-400 text-xs">Sube documentos para que la IA los use al responder</p>
        </div>

        {/* Upload card */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-100 text-sm font-medium">Subir Documento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Drop zone */}
            <label
              className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer transition-colors
                ${file ? "border-green-600 bg-green-950/20" : "border-slate-700 hover:border-slate-500"}`}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.txt"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <>
                  <span className="text-3xl">📄</span>
                  <p className="text-green-400 text-sm font-medium mt-2">{file.name}</p>
                  <p className="text-slate-500 text-xs mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                </>
              ) : (
                <>
                  <span className="text-3xl text-slate-600">📎</span>
                  <p className="text-slate-400 text-sm mt-2">Toca para seleccionar archivo</p>
                  <p className="text-slate-600 text-xs mt-1">PDF o TXT — máx. 10MB</p>
                </>
              )}
            </label>

            {/* Accepted formats */}
            <div className="flex gap-2 flex-wrap">
              <Badge variant="outline" className="border-slate-700 text-slate-400 text-xs">📄 PDF</Badge>
              <Badge variant="outline" className="border-slate-700 text-slate-400 text-xs">📝 TXT</Badge>
              <Badge variant="outline" className="border-slate-700 text-slate-400 text-xs">💬 Chat WhatsApp (.txt)</Badge>
            </div>

            {/* Upload button */}
            <Button
              onClick={handleUpload}
              disabled={!file || state === "uploading"}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium"
            >
              {state === "uploading" ? "Procesando... (puede tomar unos segundos)" : "Subir y Procesar"}
            </Button>

            {/* Result */}
            {message && (
              <p className={`text-sm text-center ${state === "done" ? "text-green-400" : "text-red-400"}`}>
                {message}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Info */}
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-4 space-y-2">
            <p className="text-slate-300 text-xs font-medium">¿Qué puedes subir?</p>
            <ul className="text-slate-500 text-xs space-y-1 list-disc list-inside">
              <li>Catálogos de productos en PDF</li>
              <li>FAQs y políticas del negocio en TXT</li>
              <li>Historial de WhatsApp exportado (.txt)</li>
              <li>Cualquier documento con info del negocio</li>
            </ul>
          </CardContent>
        </Card>

      </div>
    </main>
  );
}
