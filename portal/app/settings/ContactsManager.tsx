"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Contact {
  phone_number: string;
  status: "AUTO" | "MANUAL" | "PAUSED";
  is_vip: boolean;
  daily_counter: number;
  last_human_interaction: string | null;
}

interface Props {
  token: string;
}

export default function ContactsManager({ token }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [newPhone, setNewPhone] = useState("");
  const [adding, setAdding] = useState(false);

  const addContact = async () => {
    if (!newPhone.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/contacts/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: newPhone.trim(), is_vip: true }),
      });
      if (res.ok) {
        const created = await res.json();
        setContacts((prev) => {
          const exists = prev.find((c) => c.phone_number === created.phone_number);
          if (exists) return prev.map((c) => (c.phone_number === created.phone_number ? created : c));
          return [created, ...prev];
        });
        setNewPhone("");
      }
    } finally {
      setAdding(false);
    }
  };

  const fetchContacts = async () => {
    try {
      const res = await fetch(`/api/contacts/${token}`);
      if (res.ok) setContacts(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchContacts(); }, [token]);

  const updateContact = async (phone: string, patch: Partial<Pick<Contact, "is_vip" | "status">>) => {
    setUpdating(phone);
    try {
      const res = await fetch(`/api/contacts/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: phone, ...patch }),
      });
      if (res.ok) {
        const updated = await res.json();
        setContacts((prev) => prev.map((c) => (c.phone_number === phone ? updated : c)));
      }
    } finally {
      setUpdating(null);
    }
  };

  const formatPhone = (phone: string) => phone.replace("@c.us", "");

  const formatTime = (ts: string | null) => {
    if (!ts) return "—";
    const d = new Date(ts);
    const now = new Date();
    const diffH = Math.floor((now.getTime() - d.getTime()) / 3600000);
    if (diffH < 1) return "Hace menos de 1h";
    if (diffH < 24) return `Hace ${diffH}h`;
    return d.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; color: string }> = {
      AUTO:   { label: "Bot",    color: "bg-green-600" },
      MANUAL: { label: "Humano", color: "bg-yellow-600" },
      PAUSED: { label: "Pausa",  color: "bg-slate-600" },
    };
    const s = map[status] || map.AUTO;
    return <Badge className={`${s.color} text-white text-xs`}>{s.label}</Badge>;
  };

  if (loading) {
    return (
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="py-8 text-center text-slate-500 text-sm">
          Cargando contactos...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-slate-100 text-sm font-medium">Contactos</CardTitle>
        <p className="text-slate-500 text-xs">
          Marca VIP para que siempre atienda un humano. Reactiva el bot si ya terminaste de atender.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Add new VIP */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addContact()}
            placeholder="573001234567"
            className="flex-1 bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-slate-200 text-sm placeholder:text-slate-600 focus:outline-none focus:border-slate-500"
          />
          <Button
            size="sm"
            disabled={!newPhone.trim() || adding}
            onClick={addContact}
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8 px-3"
          >
            {adding ? "..." : "+ VIP"}
          </Button>
        </div>

        {contacts.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-4">
            Aun no hay contactos. Aparecen cuando alguien escribe al WhatsApp.
          </p>
        ) : (
          <>
            {/* Header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-2 pb-1 border-b border-slate-800">
              <span className="text-slate-500 text-xs">Numero</span>
              <span className="text-slate-500 text-xs text-center w-16">Estado</span>
              <span className="text-slate-500 text-xs text-center w-12">VIP</span>
              <span className="text-slate-500 text-xs text-center w-20">Accion</span>
            </div>

            {contacts.map((c) => (
              <div
                key={c.phone_number}
                className={`grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center px-2 py-2 rounded-lg
                  ${c.is_vip ? "bg-amber-950/20 border border-amber-900/30" : "hover:bg-slate-800/50"}`}
              >
                {/* Phone + last interaction */}
                <div className="min-w-0">
                  <p className="text-slate-200 text-sm font-mono truncate">{formatPhone(c.phone_number)}</p>
                  <p className="text-slate-600 text-xs">{formatTime(c.last_human_interaction)}</p>
                </div>

                {/* Status badge */}
                <div className="w-16 flex justify-center">
                  {statusBadge(c.status)}
                </div>

                {/* VIP toggle */}
                <div className="w-12 flex justify-center">
                  <Switch
                    checked={c.is_vip}
                    disabled={updating === c.phone_number}
                    onCheckedChange={(v) => updateContact(c.phone_number, { is_vip: v })}
                  />
                </div>

                {/* Reset to AUTO button */}
                <div className="w-20 flex justify-center">
                  {c.status === "MANUAL" && !c.is_vip && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updating === c.phone_number}
                      onClick={() => updateContact(c.phone_number, { status: "AUTO" })}
                      className="text-xs h-7 border-slate-700 text-slate-300 hover:bg-slate-800"
                    >
                      Reactivar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
