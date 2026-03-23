#!/usr/bin/env python3
"""
WhatsApp Chat Exporter - WAHA Integration
==========================================
Exporta todos los chats de WAHA a archivos .txt en formato WhatsApp estándar.

Uso:
    python export_chats.py                    # Exportar todos los chats
    python export_chats.py --chat-id XXXXXX   # Exportar chat específico
    python export_chats.py --limit 10         # Limitar a 10 chats

Requisitos:
    - WAHA corriendo en http://localhost:3000
    - Session activa de WhatsApp en WAHA
    - pip install -r requirements.txt

Output:
    ./../../data/whatsapp_exports/[chat_name]_[timestamp].txt
"""

import requests
import json
import argparse
from datetime import datetime
from pathlib import Path
import os
import sys
import time


class WAHAChatExporter:
    """Exportador de chats desde WAHA API"""
    
    def __init__(self, waha_url="http://localhost:3000", session="default", api_key=None):
        self.waha_url = waha_url.rstrip('/')
        self.session = session
        self.api_key = api_key
        self.export_dir = Path(__file__).parent.parent.parent / "data" / "whatsapp_exports"
        self.export_dir.mkdir(parents=True, exist_ok=True)
        
    def _make_request(self, endpoint, params=None):
        """Wrapper para requests con manejo de errores"""
        try:
            url = f"{self.waha_url}/api/{self.session}/{endpoint}"
            headers = {"accept": "application/json"}
            if self.api_key:
                headers["X-Api-Key"] = self.api_key

            if params is None:
                params = {}

            response = requests.get(url, params=params, headers=headers, timeout=30)
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.ConnectionError:
            print(f"❌ Error: No se puede conectar a WAHA en {self.waha_url}")
            print(f"   Verifica que WAHA esté corriendo: docker-compose ps")
            sys.exit(1)
        except requests.exceptions.Timeout:
            print(f"❌ Error: Timeout al conectar con WAHA")
            sys.exit(1)
        except requests.exceptions.HTTPError as e:
            print(f"❌ Error HTTP {e.response.status_code}: {e.response.text}")
            sys.exit(1)
        except Exception as e:
            print(f"❌ Error inesperado: {e}")
            sys.exit(1)
    
    def get_chats(self, limit=None):
        """Obtiene lista de chats desde WAHA"""
        print(f"🔍 Obteniendo lista de chats desde WAHA...")
        
        params = {}
        if limit:
            params['limit'] = limit
            
        chats = self._make_request("chats", params)
        
        if not chats or len(chats) == 0:
            print("⚠️  No se encontraron chats. Asegúrate de:")
            print("   1. WAHA está conectado a WhatsApp Web")
            print("   2. Tienes chats activos en tu cuenta")
            return []
        
        print(f"✅ Encontrados {len(chats)} chats")
        return chats
    
    def get_messages(self, chat_id, limit=1000):
        """Obtiene mensajes de un chat específico"""
        try:
            params = {
                'limit': limit,
                'downloadMedia': 'false'  # No descargar multimedia por ahora
            }
            messages = self._make_request(f"chats/{chat_id}/messages", params)
            return messages if messages else []
        except Exception as e:
            print(f"   ⚠️  Error obteniendo mensajes: {e}")
            return []
    
    def format_message(self, msg):
        """Formatea mensaje al estilo WhatsApp export"""
        try:
            # Extraer timestamp
            timestamp = msg.get('timestamp', msg.get('t', 0))
            if timestamp:
                # Convertir timestamp Unix a datetime
                dt = datetime.fromtimestamp(timestamp)
                date_str = dt.strftime('%d/%m/%Y, %H:%M')
            else:
                date_str = 'N/A'
            
            # Extraer remitente (limpiar ID de WhatsApp)
            sender = msg.get('from', msg.get('author', 'Unknown'))
            sender = sender.split('@')[0]  # Quitar @c.us o @g.us
            
            # Extraer texto del mensaje
            body = msg.get('body', msg.get('text', ''))
            
            # Manejar tipos especiales de mensajes
            msg_type = msg.get('type', 'chat')
            if msg_type == 'image':
                body = '📷 [Imagen]' + (f' {body}' if body else '')
            elif msg_type == 'video':
                body = '🎥 [Video]' + (f' {body}' if body else '')
            elif msg_type == 'audio' or msg_type == 'ptt':
                body = '🎤 [Audio]'
            elif msg_type == 'document':
                body = '📄 [Documento]' + (f' {body}' if body else '')
            elif msg_type == 'sticker':
                body = '🎨 [Sticker]'
            elif msg_type == 'location':
                body = '📍 [Ubicación]'
            
            if not body:
                body = '[Mensaje sin contenido]'
            
            return f"[{date_str}] {sender}: {body}"
            
        except Exception as e:
            return f"[Error formateando mensaje: {e}]"
    
    def export_chat(self, chat):
        """Exporta un chat individual a archivo .txt"""
        raw_id = chat.get('id')
        # WAHA devuelve id como objeto {server, user, _serialized} — usar _serialized
        if isinstance(raw_id, dict):
            chat_id = raw_id.get('_serialized', str(raw_id))
        else:
            chat_id = str(raw_id)
        chat_name = chat.get('name', chat_id)
        
        # Sanitizar nombre para filesystem
        safe_name = "".join(c if c.isalnum() or c in (' ', '-', '_') else '_' for c in chat_name)
        safe_name = safe_name[:50]  # Limitar longitud
        
        print(f"\n📤 Exportando: {chat_name}")
        
        # Obtener mensajes
        messages = self.get_messages(chat_id)
        
        if not messages:
            print(f"   ⚠️  No hay mensajes para exportar")
            return None
        
        print(f"   📨 {len(messages)} mensajes encontrados")
        
        # Formatear contenido
        export_lines = []
        export_lines.append(f"=" * 60)
        export_lines.append(f"WhatsApp Chat Export - {chat_name}")
        export_lines.append(f"Chat ID: {chat_id}")
        export_lines.append(f"Fecha de exportación: {datetime.now().strftime('%d/%m/%Y, %H:%M')}")
        export_lines.append(f"Total mensajes: {len(messages)}")
        export_lines.append(f"=" * 60)
        export_lines.append("")
        
        # Ordenar mensajes por timestamp (más antiguos primero)
        messages_sorted = sorted(messages, key=lambda m: m.get('timestamp', m.get('t', 0)))
        
        for msg in messages_sorted:
            formatted_msg = self.format_message(msg)
            export_lines.append(formatted_msg)
        
        export_text = "\n".join(export_lines)
        
        # Guardar archivo
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = self.export_dir / f"{safe_name}_{timestamp}.txt"
        
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                f.write(export_text)
            
            print(f"   ✅ Guardado: {filename.name}")
            return filename
            
        except Exception as e:
            print(f"   ❌ Error guardando archivo: {e}")
            return None
    
    def export_all(self, limit=None, chat_id_filter=None):
        """Exporta todos los chats o uno específico"""
        print("=" * 60)
        print("📱 WhatsApp Chat Exporter - WAHA")
        print("=" * 60)
        
        # Obtener chats
        chats = self.get_chats(limit=limit)
        
        if not chats:
            return
        
        # Filtrar por chat_id si se especificó
        if chat_id_filter:
            def _get_chat_id_str(c):
                raw = c.get('id', '')
                return raw.get('_serialized', str(raw)) if isinstance(raw, dict) else str(raw)
            chats = [c for c in chats if chat_id_filter in _get_chat_id_str(c)]
            if not chats:
                print(f"❌ No se encontró chat con ID que contenga: {chat_id_filter}")
                return
        
        # Exportar cada chat
        exported_count = 0
        failed_count = 0
        
        for i, chat in enumerate(chats, 1):
            print(f"\n[{i}/{len(chats)}]", end=" ")
            result = self.export_chat(chat)
            
            if result:
                exported_count += 1
            else:
                failed_count += 1
            
            # Rate limiting (evitar saturar WAHA)
            if i < len(chats):
                time.sleep(1)
        
        # Resumen
        print("\n" + "=" * 60)
        print("📊 Resumen de exportación")
        print("=" * 60)
        print(f"✅ Chats exportados exitosamente: {exported_count}")
        if failed_count > 0:
            print(f"❌ Chats con errores: {failed_count}")
        print(f"📁 Directorio de salida: {self.export_dir}")
        print("=" * 60)


def main():
    """CLI para el exportador"""
    parser = argparse.ArgumentParser(
        description='Exporta chats de WhatsApp desde WAHA a archivos .txt'
    )
    parser.add_argument(
        '--waha-url',
        default='http://localhost:3000',
        help='URL de WAHA (default: http://localhost:3000)'
    )
    parser.add_argument(
        '--session',
        default='default',
        help='Nombre de la sesión de WAHA (default: default)'
    )
    parser.add_argument(
        '--chat-id',
        help='Exportar solo un chat específico (ID parcial)'
    )
    parser.add_argument(
        '--limit',
        type=int,
        help='Limitar número de chats a exportar'
    )
    parser.add_argument(
        '--api-key',
        default=os.environ.get('WAHA_API_KEY'),
        help='WAHA API key (default: env WAHA_API_KEY)'
    )
    
    args = parser.parse_args()
    
    # Crear exporter y ejecutar
    exporter = WAHAChatExporter(waha_url=args.waha_url, session=args.session, api_key=args.api_key)
    exporter.export_all(limit=args.limit, chat_id_filter=args.chat_id)


if __name__ == "__main__":
    main()
