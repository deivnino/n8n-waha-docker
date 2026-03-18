"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ClientSettings, DAYS } from "@/lib/types";

interface Props {
  token: string;
  initialSettings: ClientSettings;
}

const STATUS_OPTIONS = [
  { value: "AUTO",   label: "Auto",   desc: "La IA responde automáticamente",     color: "bg-green-600" },
  { value: "MANUAL", label: "Manual", desc: "Solo responden los asesores humanos", color: "bg-yellow-600" },
  { value: "PAUSED", label: "Pausado",desc: "El bot está completamente apagado",  color: "bg-slate-600" },
] as const;

export default function SettingsForm({ token, initialSettings }: Props) {
  const [settings, setSettings] = useState<ClientSettings>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const updateDay = (day: string, field: "enabled" | "open" | "close", value: string | boolean) => {
    setSettings((prev) => ({
      ...prev,
      business_hours: {
        ...prev.business_hours,
        schedule: {
          ...prev.business_hours.schedule,
          [day]: { ...prev.business_hours.schedule[day], [field]: value },
        },
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/settings/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center space-y-1">
          <div className="text-3xl">⚙️</div>
          <h1 className="text-white font-semibold text-lg">{settings.client_name}</h1>
          <p className="text-slate-400 text-xs">{settings.phone_number}</p>
        </div>

        {/* Modo de atención */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-100 text-sm font-medium">Modo de Atención</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSettings((p) => ({ ...p, status: opt.value }))}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left
                  ${settings.status === opt.value
                    ? "border-slate-500 bg-slate-800"
                    : "border-slate-700 bg-slate-850 opacity-60 hover:opacity-80"
                  }`}
              >
                <Badge className={`${opt.color} text-white text-xs w-16 justify-center shrink-0`}>
                  {opt.label}
                </Badge>
                <span className="text-slate-300 text-sm">{opt.desc}</span>
                {settings.status === opt.value && (
                  <span className="ml-auto text-slate-400 text-xs">✓</span>
                )}
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Horario de atención */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-slate-100 text-sm font-medium">Horario de Atención</CardTitle>
              <div className="flex items-center gap-2">
                <Label htmlFor="outside-toggle" className="text-slate-400 text-xs">
                  Mensaje fuera de horario
                </Label>
                <Switch
                  id="outside-toggle"
                  checked={settings.outside_hours_enabled}
                  onCheckedChange={(v) => setSettings((p) => ({ ...p, outside_hours_enabled: v }))}
                />
              </div>
            </div>
            <p className="text-slate-500 text-xs">Zona horaria: Colombia (GMT-5)</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {DAYS.map(({ key, label }) => {
              const day = settings.business_hours?.schedule?.[key] ?? { enabled: false, open: "09:00", close: "18:00" };
              return (
                <div key={key} className="flex items-center gap-3">
                  <Switch
                    checked={day.enabled}
                    onCheckedChange={(v) => updateDay(key, "enabled", v)}
                  />
                  <span className={`text-sm w-20 shrink-0 ${day.enabled ? "text-slate-200" : "text-slate-500"}`}>
                    {label}
                  </span>
                  <Input
                    type="time"
                    value={day.open}
                    disabled={!day.enabled}
                    onChange={(e) => updateDay(key, "open", e.target.value)}
                    className="bg-slate-800 border-slate-700 text-slate-200 h-8 text-xs w-28 disabled:opacity-30"
                  />
                  <span className="text-slate-500 text-xs">–</span>
                  <Input
                    type="time"
                    value={day.close}
                    disabled={!day.enabled}
                    onChange={(e) => updateDay(key, "close", e.target.value)}
                    className="bg-slate-800 border-slate-700 text-slate-200 h-8 text-xs w-28 disabled:opacity-30"
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Mensaje fuera de horario */}
        {settings.outside_hours_enabled && (
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-slate-100 text-sm font-medium">Mensaje Fuera de Horario</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={settings.business_hours?.outside_message ?? ""}
                onChange={(e) =>
                  setSettings((p) => ({
                    ...p,
                    business_hours: { ...p.business_hours, outside_message: e.target.value },
                  }))
                }
                rows={3}
                className="bg-slate-800 border-slate-700 text-slate-200 text-sm resize-none"
                placeholder="Escribe el mensaje que recibirán los clientes fuera de horario..."
              />
            </CardContent>
          </Card>
        )}

        <Separator className="border-slate-800" />

        {/* Save */}
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-medium"
        >
          {saving ? "Guardando..." : saved ? "✓ Guardado" : "Guardar Cambios"}
        </Button>

      </div>
    </main>
  );
}
