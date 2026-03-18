"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import NavBar from "@/components/NavBar";

interface WeekDay { day: string; count: number }
interface Message  { role: string; content: string; created_at: string }

interface DashboardData {
  client: {
    phone_number: string;
    client_name: string;
    status: string;
    is_vip: boolean;
    last_human_interaction: string;
  };
  stats: {
    total_user: number;
    total_assistant: number;
    escalations: number;
    daily_counter: number;
  };
  week: WeekDay[];
  recent: Message[];
}

const STATUS_COLOR: Record<string, string> = {
  AUTO:   "bg-green-600",
  MANUAL: "bg-yellow-600",
  PAUSED: "bg-slate-600",
};

const ROLE_LABEL: Record<string, string> = {
  user: "Cliente",
  assistant: "IA",
  system: "Sistema",
};

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardContent className="pt-5 pb-4 text-center">
        <p className="text-3xl font-bold text-white">{value}</p>
        <p className="text-xs text-slate-400 mt-1">{label}</p>
        {sub && <p className="text-xs text-slate-600 mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// Simple inline bar chart using CSS
function WeekChart({ data }: { data: WeekDay[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const fmt = (d: string) => new Date(d).toLocaleDateString("es-CO", { weekday: "short", day: "numeric" });

  if (data.length === 0) {
    return <p className="text-slate-500 text-sm text-center py-4">Sin mensajes en los últimos 7 días</p>;
  }

  return (
    <div className="flex items-end gap-2 h-24 px-1">
      {data.map((d) => (
        <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-slate-500 text-xs">{d.count}</span>
          <div
            className="w-full rounded-sm bg-green-600 transition-all"
            style={{ height: `${(d.count / max) * 64}px`, minHeight: "4px" }}
          />
          <span className="text-slate-600 text-xs truncate w-full text-center">{fmt(d.day)}</span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardView({ token }: { token: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshed, setRefreshed] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/dashboard/${token}`, { cache: "no-store" });
    if (res.ok) {
      setData(await res.json());
      setRefreshed(new Date());
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400 text-sm">Cargando métricas...</p>
      </main>
    );
  }

  if (!data) return null;

  const { client, stats, week, recent } = data;

  return (
    <main className="min-h-screen bg-slate-950">
      <NavBar />
      <div className="max-w-2xl mx-auto space-y-6 p-4 md:p-8">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-white font-semibold text-lg">{client.client_name}</h1>
              {client.is_vip && <Badge className="bg-amber-600 text-white text-xs">VIP</Badge>}
              <Badge className={`${STATUS_COLOR[client.status] ?? "bg-slate-600"} text-white text-xs`}>
                {client.status}
              </Badge>
            </div>
            <p className="text-slate-400 text-xs mt-0.5">{client.phone_number}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/settings?token=${token}`}>
              <Button variant="outline" size="sm" className="border-slate-700 text-slate-400 hover:text-white text-xs">
                ⚙️ Config
              </Button>
            </Link>
            <Button
              variant="outline" size="sm"
              onClick={load}
              disabled={loading}
              className="border-slate-700 text-slate-400 hover:text-white text-xs"
            >
              {loading ? "..." : "↻ Actualizar"}
            </Button>
          </div>
        </div>

        {refreshed && (
          <p className="text-slate-600 text-xs text-right -mt-4">
            Actualizado: {refreshed.toLocaleTimeString("es-CO")}
          </p>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Mensajes hoy" value={stats.daily_counter} sub="hard cap: 50" />
          <StatCard label="Mensajes cliente" value={stats.total_user} sub="total histórico" />
          <StatCard label="Respuestas IA" value={stats.total_assistant} sub="total histórico" />
          <StatCard label="Escalados" value={stats.escalations} sub="a humano" />
        </div>

        {/* Week chart */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-slate-100 text-sm font-medium">Mensajes — Últimos 7 días</CardTitle>
          </CardHeader>
          <CardContent>
            <WeekChart data={week} />
          </CardContent>
        </Card>

        {/* Recent messages */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-slate-100 text-sm font-medium">Conversación Reciente</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recent.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">
                Aún no hay conversaciones registradas
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-500 text-xs w-16">Rol</TableHead>
                    <TableHead className="text-slate-500 text-xs">Mensaje</TableHead>
                    <TableHead className="text-slate-500 text-xs w-28 text-right">Hora</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((msg, i) => (
                    <TableRow key={i} className="border-slate-800 hover:bg-slate-800/50">
                      <TableCell className="py-2">
                        <Badge
                          variant="outline"
                          className={`text-xs border-0 ${
                            msg.role === "user" ? "bg-blue-900/50 text-blue-300"
                            : msg.role === "assistant" ? "bg-green-900/50 text-green-300"
                            : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {ROLE_LABEL[msg.role] ?? msg.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-300 text-xs py-2 max-w-xs truncate">
                        {msg.content}
                      </TableCell>
                      <TableCell className="text-slate-500 text-xs py-2 text-right">
                        {new Date(msg.created_at).toLocaleString("es-CO", {
                          month: "short", day: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Separator className="border-slate-800" />
        <p className="text-slate-600 text-xs text-center">
          Los datos se actualizan en tiempo real con el botón ↻
        </p>
      </div>
    </main>
  );
}
