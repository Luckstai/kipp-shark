# sharks_h3_daily_global.py
# ------------------------------------------------------------
# Busca ocorrências de tubarões (OBIS) no MUNDO TODO (sem bbox),
# agrega por (H3, espécie) e salva **UM CSV POR DIA**.
# - H3 resolução 5 (hex maior → menos linhas)
# - Colunas: date, species, h3, n_obs, centroid_lat, centroid_lon
# ------------------------------------------------------------

import os
import time
import math
import requests
import pandas as pd
from datetime import datetime, timedelta
import datetime as dt
from pathlib import Path
from typing import Dict, Tuple, Optional, List

# ===== H3 (compatível v3 e v4) =====
try:
    import h3  # v3 (geo_to_h3/h3_to_geo) ou v4 (latlng_to_cell/cell_to_latlng)
    _H3_V4 = hasattr(h3, "latlng_to_cell")

    def _latlng_to_h3(lat, lon, res):
        return h3.latlng_to_cell(lat, lon, res) if _H3_V4 else h3.geo_to_h3(lat, lon, res)

    def _h3_to_latlng(cell):
        return h3.cell_to_latlng(cell) if _H3_V4 else h3.h3_to_geo(cell)

except Exception as _e:
    raise ImportError("Pacote 'h3' não encontrado. Instale com: pip install 'h3>=3,<4'  (ou 'h3')")


# =============================
# CONFIGURAÇÕES
# =============================

# Espécies-alvo (adicione/edite à vontade)
SPECIES: List[str] = [
    "Carcharhinus",  # requiem sharks
    "Galeocerdo",    # tiger shark
    "Sphyrna",       # hammerhead
    "Prionace",      # blue shark
    "Carcharodon"    # great white
]

# Janela temporal (últimos 10 anos até hoje)
# START_DATE = TODAY.replace(year=TODAY.year - 10)  # 10 anos atrás, mesma data
# END_DATE = TODAY                                  # inclui hoje
START_DATE = dt.date(2015, 1, 1)
END_DATE = dt.date(2025, 1, 1)

# OBIS API
OBIS_URL = "https://api.obis.org/v3/occurrence"
PAGE_SIZE = 1000
REQUEST_TIMEOUT = 60
REQUEST_SLEEP = 0.2    # pausa entre páginas por educação com a API
MAX_RETRIES = 3
RETRY_SLEEP = 1.0

# H3
H3_RESOLUTION = 5
MIN_POINTS_PER_HEX = 1   # aumente (ex.: 3, 5) para filtrar hexes pouco povoados

# Saída
BASE_DIR = Path("downloads/sharks")
# agora salvamos por período (um arquivo para o intervalo start..end)
CSV_DIR = BASE_DIR / "period"
CSV_DIR.mkdir(parents=True, exist_ok=True)

# Comportamento
SKIP_IF_EXISTS = True    # se o CSV do dia existir, pula
VERBOSE = True


# =============================
# HELPERS
# =============================

def _req_get(url: str, params: dict) -> Optional[requests.Response]:
    """GET com tentativas e backoff simples."""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            r = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
            if r.status_code == 200:
                return r
            if VERBOSE:
                print(f"⚠️  HTTP {r.status_code} (tentativa {attempt}/{MAX_RETRIES})")
        except Exception as e:
            if VERBOSE:
                print(f"⚠️  Erro de rede: {e} (tentativa {attempt}/{MAX_RETRIES})")
        time.sleep(RETRY_SLEEP * attempt)
    return None


def daterange(start_date: datetime.date, end_date: datetime.date):
    """Gera dias [start_date, end_date], mais recente → mais antigo."""
    cur = end_date
    while cur >= start_date:
        yield cur
        cur -= timedelta(days=1)


def fetch_one_species_one_day(species: str, day: datetime.date) -> Dict[str, int]:
    """
    Busca no OBIS **global** por uma espécie em um único dia (start=end=day),
    e agrega contagem por H3 (resolução H3_RESOLUTION).
    Retorna dict {h3_id: n_obs}.
    """
    total_est = None
    offset = 0
    hex_counts: Dict[str, int] = {}

    while True:
        params = {
            "scientificname": species,
            "startdate": day.isoformat(),
            "enddate": day.isoformat(),
            "size": PAGE_SIZE,
            "from": offset,
        }
        resp = _req_get(OBIS_URL, params)
        if resp is None:
            # falha definitiva nesse bloco/página
            break

        data = resp.json()
        results = data.get("results", [])
        total_est = data.get("total", total_est)

        if not results:
            break

        for rec in results:
            lat = rec.get("decimalLatitude")
            lon = rec.get("decimalLongitude")
            if lat is None or lon is None:
                continue
            try:
                lat = float(lat); lon = float(lon)
                if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
                    continue
                h = _latlng_to_h3(lat, lon, H3_RESOLUTION)
                hex_counts[h] = hex_counts.get(h, 0) + 1
            except Exception:
                continue

        offset += PAGE_SIZE
        if total_est is not None and offset >= total_est:
            break

        time.sleep(REQUEST_SLEEP)

    # filtro mínimo de pontos por hex (opcional)
    if MIN_POINTS_PER_HEX > 1 and hex_counts:
        hex_counts = {h: n for h, n in hex_counts.items() if n >= MIN_POINTS_PER_HEX}

    return hex_counts


def fetch_all_species_one_day(day: datetime.date) -> pd.DataFrame:
    """
    Busca **todas as espécies** para um dia e agrega por (species, h3).
    Retorna DataFrame com colunas:
      date, species, h3, n_obs, centroid_lat, centroid_lon
    """
    rows = []
    for sp in SPECIES:
        if VERBOSE:
            print(f"📡 {day} | espécie={sp}")
        counts = fetch_one_species_one_day(sp, day)
        if not counts:
            continue
        for h, n in counts.items():
            clat, clon = _h3_to_latlng(h)
            rows.append({
                "date": day.isoformat(),
                "species": sp,
                "h3": h,
                "n_obs": n,
                "centroid_lat": clat,
                "centroid_lon": clon,
            })

    if not rows:
        return pd.DataFrame(columns=["date","species","h3","n_obs","centroid_lat","centroid_lon"])
    return pd.DataFrame(rows)


def save_daily_csv(day: datetime.date, df: pd.DataFrame):
    """Salva o CSV do dia no padrão solicitado (um arquivo por dia)."""
    out_path = CSV_DIR / f"sharks_h3r{H3_RESOLUTION}_{day.isoformat()}.csv"
    if SKIP_IF_EXISTS and out_path.exists():
        if VERBOSE:
            print(f"↪️  Já existe: {out_path.name} (pulado)")
        return
    df.to_csv(out_path, index=False)
    print(f"💾 CSV salvo: {out_path} ({len(df)} linhas)")


def fetch_one_species_period(species: str, start_date: datetime.date, end_date: datetime.date) -> Dict[Tuple[str, str], int]:
    """
    Busca no OBIS **global** para uma espécie em um período (start_date → end_date),
    e agrega contagem por (date_iso, H3).
    Retorna dict {(date_iso, h3_id): n_obs}.
    """
    total_est = None
    offset = 0
    counts: Dict[Tuple[str, str], int] = {}

    while True:
        params = {
            "scientificname": species,
            "startdate": start_date.isoformat(),
            "enddate": end_date.isoformat(),
            "size": PAGE_SIZE,
            "from": offset,
        }
        resp = _req_get(OBIS_URL, params)
        if resp is None:
            # falha definitiva nesse bloco/página
            break

        data = resp.json()
        results = data.get("results", [])
        total_est = data.get("total", total_est)

        if not results:
            break

        for rec in results:
            lat = rec.get("decimalLatitude")
            lon = rec.get("decimalLongitude")
            if lat is None or lon is None:
                continue

            # extrai data do registro (usa os primeiros 10 chars se houver timestamp)
            ev = rec.get("eventDate") or rec.get("date") or rec.get("eventdate")
            if not ev:
                continue
            try:
                date_iso = str(ev)[:10]
            except Exception:
                continue

            try:
                lat = float(lat); lon = float(lon)
                if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
                    continue
                h = _latlng_to_h3(lat, lon, H3_RESOLUTION)
                key = (date_iso, h)
                counts[key] = counts.get(key, 0) + 1
            except Exception:
                continue

        offset += PAGE_SIZE
        if total_est is not None and offset >= total_est:
            break

        time.sleep(REQUEST_SLEEP)

    # filtro mínimo (aplica-se por (date,hex))
    if MIN_POINTS_PER_HEX > 1 and counts:
        counts = {k: n for k, n in counts.items() if n >= MIN_POINTS_PER_HEX}

    return counts


def fetch_all_species_period(start_date: datetime.date, end_date: datetime.date) -> pd.DataFrame:
    """
    Busca **todas as espécies** para o período e agrega por (date, species, h3).
    Retorna DataFrame com colunas:
      date, species, h3, n_obs, centroid_lat, centroid_lon
    """
    rows = []
    for sp in SPECIES:
        if VERBOSE:
            print(f"📡 Período {start_date} → {end_date} | espécie={sp}")
        counts = fetch_one_species_period(sp, start_date, end_date)
        if not counts:
            continue
        for (date_iso, h), n in counts.items():
            clat, clon = _h3_to_latlng(h)
            rows.append({
                "date": date_iso,
                "species": sp,
                "h3": h,
                "n_obs": n,
                "centroid_lat": clat,
                "centroid_lon": clon,
            })

    if not rows:
        return pd.DataFrame(columns=["date","species","h3","n_obs","centroid_lat","centroid_lon"])
    return pd.DataFrame(rows)


def save_period_csv(start_date: datetime.date, end_date: datetime.date, df: pd.DataFrame):
    """Salva o CSV do período no padrão solicitado (um arquivo para o intervalo)."""
    out_path = CSV_DIR / f"sharks_h3r{H3_RESOLUTION}_{start_date.isoformat()}_{end_date.isoformat()}.csv"
    if SKIP_IF_EXISTS and out_path.exists():
        if VERBOSE:
            print(f"↪️  Já existe: {out_path.name} (pulado)")
        return
    df.to_csv(out_path, index=False)
    print(f"💾 CSV salvo: {out_path} ({len(df)} linhas)")


# =============================
# EXECUÇÃO
# =============================

def main():
    print("🐟 OBIS → H3 por período (global)")
    print(f"⏱️  Período: {START_DATE} → {END_DATE}")
    print(f"🧪 Espécies: {', '.join(SPECIES)}")
    print(f"🔷 H3 res={H3_RESOLUTION}, min_points_per_hex={MIN_POINTS_PER_HEX}")
    print(f"📂 Saída: {CSV_DIR.resolve()}\n")
    df_period = fetch_all_species_period(START_DATE, END_DATE)
    if df_period.empty:
        print("⚠️  Sem ocorrências para o período.")
    else:
        save_period_csv(START_DATE, END_DATE, df_period)

    print("\n🏁 Finalizado.")


if __name__ == "__main__":
    main()
