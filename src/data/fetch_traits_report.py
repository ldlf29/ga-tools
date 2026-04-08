#!/usr/bin/env python3
"""
fetch_traits_report.py
======================
1. Lee mokiMetadata.json para obtener todos los IDs de Moki.
2. Consulta https://api.grandarena.gg/api/v1/mokis/bulk?ids= en bloques de 80.
3. Cruza los traits recibidos con las categorias definidas en traits.md.
4. Genera un reporte detallado en moki_traits_report.md.
"""

import json
import urllib.request
import urllib.error
import re
import time
from pathlib import Path

# ─── Configuracion ───────────────────────────────────────────────────────────
SCRIPT_DIR   = Path(__file__).parent
PROJECT_DIR  = SCRIPT_DIR.parent.parent          # raiz del proyecto
META_PATH    = SCRIPT_DIR / "mokiMetadata.json"
TRAITS_PATH  = SCRIPT_DIR / "traits.md"
REPORT_PATH  = SCRIPT_DIR / "moki_traits_report.md"
ENV_PATH     = PROJECT_DIR / ".env.local"
API_BASE     = "https://api.grandarena.gg/api/v1/mokis/bulk?ids="
BATCH_SIZE   = 80
BATCH_DELAY  = 2   # segundos entre batches

# ─── Leer .env.local ─────────────────────────────────────────────────────────
def load_env(path: Path) -> dict:
    env = {}
    if not path.exists():
        print(f"[WARN] .env.local no encontrado en {path}")
        return env
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env

# ─── 1. Parsear traits.md ────────────────────────────────────────────────────
def parse_traits_md(path: Path):
    """
    Formato traits.md:
        - Scheme Name       <- encabezado: empieza con '- ' y el resto no tiene '-'
        Type - Value        <- regla de trait (type exacto, value exacto)
        Type- Value         <- tambien valido

    Excepcion: 'Eye - Crying' usa substring (cualquier Eye value que contenga 'crying').
    """
    schemes = {}
    current_scheme = None

    with open(path, encoding="utf-8") as f:
        for raw_line in f:
            line = raw_line.strip()
            if not line:
                continue

            # Encabezado: empieza con "- " y el resto (el nombre) no tiene "-"
            if line.startswith("- ") and "-" not in line[2:]:
                current_scheme = line[2:].strip()
                schemes[current_scheme] = []
                continue

            # Linea de trait: "Background - Ronin Moon" o "Clothing- Pink Overalls"
            if current_scheme is not None and "-" in line:
                parts = line.split("-", 1)
                trait_type = parts[0].strip()
                value      = parts[1].strip()
                if not trait_type or not value:
                    continue
                use_substring = (trait_type.lower() == "eye" and value.lower() == "crying")
                schemes[current_scheme].append((
                    trait_type.lower(),
                    value.lower(),
                    use_substring,
                ))

    return schemes

# ─── 2. Leer IDs desde mokiMetadata.json ────────────────────────────────────
def load_meta(path: Path):
    """Devuelve lista de (token_id_int, champion_name) ordenada por token_id."""
    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    entries = []
    for _key, moki in data.items():
        token_id = int(moki["id"])
        name     = moki["name"]
        entries.append((token_id, name))

    entries.sort(key=lambda x: x[0])
    return entries

# ─── 3. Llamar a la API en batches ──────────────────────────────────────────
def fetch_batch(ids: list[int], api_key: str) -> list[dict]:
    ids_str = ",".join(str(i) for i in ids)
    url     = API_BASE + ids_str
    req     = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Origin": "https://grandarena.gg",
            "Referer": "https://grandarena.gg/",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-site",
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
            parsed = json.loads(raw)
            # API returns { data: [...] } wrapper
            if isinstance(parsed, dict) and "data" in parsed:
                return parsed["data"] if isinstance(parsed["data"], list) else []
            elif isinstance(parsed, list):
                return parsed
            return []
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")[:300]
        print(f"  [ERROR HTTP {e.code}] batch {ids[:3]}... | body: {body}")
        return []
    except Exception as e:
        print(f"  [ERROR] {e}")
        return []

def fetch_all(entries: list[tuple], api_key: str) -> dict:
    """Retorna dict { token_id: moki_api_data } para todos los mokis."""
    all_data = {}
    ids = [e[0] for e in entries]
    first_printed = False

    for i in range(0, len(ids), BATCH_SIZE):
        batch = ids[i : i + BATCH_SIZE]
        print(f"  Fetching batch {i//BATCH_SIZE + 1}: IDs {batch[0]}..{batch[-1]} ({len(batch)} mokis)")
        raw_list = fetch_batch(batch, api_key)

        # Debug: print full first moki to understand structure
        if not first_printed and raw_list:
            print(f"\n[DEBUG] Primer moki completo:\n{json.dumps(raw_list[0], indent=2)}\n")
            first_printed = True

        for moki in raw_list:
            if not isinstance(moki, dict):
                continue
            # The API uses mokiTokenId as the stable ID
            tid_raw = moki.get("mokiTokenId") or moki.get("tokenId") or moki.get("id") or 0
            try:
                tid = int(tid_raw)
            except (ValueError, TypeError):
                continue
            all_data[tid] = moki

        if i + BATCH_SIZE < len(ids):
            print(f"  Esperando {BATCH_DELAY}s antes del siguiente batch...")
            time.sleep(BATCH_DELAY)

    return all_data


# ─── 4. Cruzar traits con schemes ───────────────────────────────────────────
def build_trait_pairs(api_moki: dict) -> list[tuple]:
    """Extrae pares (trait_type_lower, value_lower) de la respuesta API."""
    pairs = []
    attributes = api_moki.get("attributes", []) or []
    for attr in attributes:
        if isinstance(attr, dict):
            tt  = attr.get("trait_type", "").strip().lower()
            val = attr.get("value", "").strip().lower()
            pairs.append((tt, val))
    return pairs

def classify(trait_pairs: list[tuple], schemes: dict) -> list[str]:
    """
    Clasifica un moki en los schemes que corresponden.
    Logica:
      - Para cada (trait_type, value, use_substring) en el scheme:
          * Si use_substring=True: trait_type match exacto Y 'value' contenido en el value del moki
          * Si use_substring=False: trait_type exacto Y value exacto (case-insensitive)
    """
    matched = []
    for scheme_name, scheme_rules in schemes.items():
        for (s_type, s_value, use_substring) in scheme_rules:
            found = False
            for (m_type, m_value) in trait_pairs:
                if m_type != s_type:
                    continue
                if use_substring:
                    # Eye - Crying: cualquier eye value que contenga 'crying'
                    if s_value in m_value:
                        found = True
                        break
                else:
                    # Match exacto del value
                    if m_value == s_value:
                        found = True
                        break
            if found:
                matched.append(scheme_name)
                break
    return matched

# ─── 5. Generar reporte ──────────────────────────────────────────────────────
def generate_report(entries, api_data, schemes, meta_map):
    # meta_map: { token_id: name }

    # Clasificar cada moki
    results = []
    for token_id, name in entries:
        api_moki = api_data.get(token_id, {})
        trait_pairs  = build_trait_pairs(api_moki)
        matched_schemes = classify(trait_pairs, schemes)

        # traits raw de la api para mostrar en reporte
        raw_traits = []
        for (tt, tv) in trait_pairs:
            raw_traits.append(f"{tt}: {tv}")

        results.append({
            "id":      token_id,
            "name":    name,
            "traits":  raw_traits,
            "schemes": matched_schemes,
            "found_in_api": bool(api_moki),
        })

    # ── Reporte por schemes (summary) ────────────────────────
    scheme_to_mokis: dict[str, list] = {s: [] for s in schemes}
    for r in results:
        for s in r["schemes"]:
            scheme_to_mokis[s].append(r)

    # ── Escribir markdown ────────────────────────────────────
    lines = []
    lines.append("# Moki Traits Report\n")
    lines.append(f"> Generado automaticamente. Total Mokis procesados: **{len(results)}**\n")
    lines.append("")

    # Resumen por scheme
    lines.append("## Resumen por Scheme\n")
    for scheme, mokis in scheme_to_mokis.items():
        lines.append(f"### {scheme} ({len(mokis)} Mokis)\n")
        if mokis:
            lines.append("| Token ID | Nombre | Trait Detectado |")
            lines.append("|----------|--------|-----------------|")
            for r in sorted(mokis, key=lambda x: x["id"]):
                # Buscar el trait puntual que matcheo
                scheme_traits = schemes[scheme]
                # scheme_traits es lista de (type, value, use_substring) — extraer solo values para el reporte
                scheme_values = [sv for (_, sv, _) in scheme_traits]
                matched_trait = next(
                    (t for t in r["traits"] if any(sv in t.lower() for sv in scheme_values)),
                    ", ".join(r["traits"]) or "—"
                )
                lines.append(f"| {r['id']} | {r['name']} | {matched_trait} |")
        else:
            lines.append("_Ningún Moki coincide con este scheme._")
        lines.append("")

    # Listado completo
    lines.append("---\n")
    lines.append("## Listado Completo de Mokis\n")
    lines.append("| Token ID | Nombre | Traits (API) | Schemes Detectados |")
    lines.append("|----------|--------|--------------|--------------------|")
    for r in results:
        traits_str  = ", ".join(r["traits"]) or "—"
        schemes_str = ", ".join(r["schemes"]) or "—"
        found_flag  = "" if r["found_in_api"] else " ⚠️ no API"
        lines.append(f"| {r['id']} | {r['name']}{found_flag} | {traits_str} | {schemes_str} |")

    return "\n".join(lines)

# ─── 6. Actualizar mokiMetadata.json ─────────────────────────────────────────

# Trait types considerados "notables" para el campo traits en mokiMetadata
NOTABLE_TRAIT_TYPES = {
    "Clothing", "Head Accessory", "Hand Accessory", "Background",
    "Mouth", "Eye", "Face Accessory", "Foreground",
}
# Valores genéricos a ignorar
IGNORED_VALUES = {
    "nothing", "normal", "common", "down", "middle", "up",
    "light blue", "dark blue", "yellow", "green", "red", "orange",
    "purple", "pink", "white", "black", "brown", "grey", "blue",
    "moca", "heavy moca", "spirits", "shocked", "surprised",
    "moku cap", "fishbone",
}

def update_moki_metadata(api_data: dict, schemes: dict):
    """
    Para cada Moki en mokiMetadata.json:
    - Agrega/actualiza 'schemes': lista de scheme names detectados
    - Actualiza 'traits': valores notables del NFT (sin genéricos)
    """
    with open(META_PATH, encoding="utf-8") as f:
        meta = json.load(f)

    updated = 0
    for key, moki_meta in meta.items():
        token_id_str = moki_meta.get("id", "")
        try:
            token_id = int(token_id_str)
        except (ValueError, TypeError):
            continue

        api_moki = api_data.get(token_id)
        if not api_moki:
            continue

        # ── Extraer traits notables de la API ────────────────────
        attributes = api_moki.get("attributes", [])
        notable_traits = []
        for attr in attributes:
            if not isinstance(attr, dict):
                continue
            tt = attr.get("trait_type", "")
            val = attr.get("value", "")
            if tt in NOTABLE_TRAIT_TYPES and val.lower() not in IGNORED_VALUES:
                notable_traits.append(val)

        # ── Clasificar schemes usando pares (type, value) exactos ───────────
        trait_pairs = build_trait_pairs(api_moki)
        matched_schemes = classify(trait_pairs, schemes)

        # ── Actualizar en el dict ─────────────────────────────────
        moki_meta["traits"]  = notable_traits
        moki_meta["schemes"] = matched_schemes
        updated += 1

    with open(META_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)

    print(f"      ✅ mokiMetadata.json actualizado: {updated} Mokis con schemes/traits.")


# ─── Main ────────────────────────────────────────────────────────────────────
def main():
    print("=== Moki Traits Report Generator ===\n")

    print("[0/4] Cargando .env.local...")
    env = load_env(ENV_PATH)
    api_key = env.get("GA_API_KEY", "")
    if not api_key:
        print("[ERROR] GA_API_KEY no encontrado en .env.local")
        return
    print(f"      GA_API_KEY cargada ({api_key[:10]}...)\n")

    print("[1/4] Parseando traits.md...")
    schemes = parse_traits_md(TRAITS_PATH)
    print(f"      {len(schemes)} schemes encontrados: {list(schemes.keys())}\n")

    print("[2/4] Leyendo mokiMetadata.json...")
    entries = load_meta(META_PATH)
    meta_map = {tid: name for tid, name in entries}
    print(f"      {len(entries)} Mokis cargados.\n")

    print("[3/4] Consultando API en batches de 80...")
    api_data = fetch_all(entries, api_key)
    print(f"      {len(api_data)} Mokis obtenidos de la API.\n")

    # Debug: mostrar estructura de primer moki para entender el formato
    if api_data:
        sample_id = next(iter(api_data))
        sample = api_data[sample_id]
        print(f"[DEBUG] Estructura de Moki {sample_id}:")
        print(json.dumps(sample, indent=2)[:800])
        print("...\n")

    print("[4/4] Generando reporte...")
    report = generate_report(entries, api_data, schemes, meta_map)

    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        f.write(report)

    print(f"      ✅ Reporte guardado en: {REPORT_PATH}")

    print("\n[5/5] Actualizando mokiMetadata.json con schemes y traits...")
    update_moki_metadata(api_data, schemes)

if __name__ == "__main__":
    main()



