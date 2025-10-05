# download_sst_with_csv_h3.py
# ------------------------------------------------------------
# Baixa AQUA_MODIS SST (DAY/4km) do mais recente → mais antigo
# de 2015-01-01 até hoje. Salva .nc em downloads/sst/nc
# e gera CSV agregado por H3 em downloads/sst/csv.
# ------------------------------------------------------------

import os
import re
import datetime as dt
from pathlib import Path
from typing import Iterable, Tuple, Optional, List

import numpy as np
import pandas as pd
import netCDF4 as nc
from dotenv import load_dotenv
import earthaccess
import json

# ===== H3 (compatível v3 e v4) =====
try:
    import h3  # v3 (geo_to_h3/h3_to_geo) ou v4 (latlng_to_cell/cell_to_latlng)
    _H3_V4 = hasattr(h3, "latlng_to_cell")

    def _latlng_to_h3(lat, lon, res):
        return h3.latlng_to_cell(lat, lon, res) if _H3_V4 else h3.geo_to_h3(lat, lon, res)

    def _h3_to_latlng(cell):
        return h3.cell_to_latlng(cell) if _H3_V4 else h3.h3_to_geo(cell)

except Exception as _e:
    h3 = None
    _H3_V4 = False
    def _latlng_to_h3(*args, **kwargs):
        raise ImportError("Pacote 'h3' não instalado. Rode: pip install 'h3>=3,<4' ou 'h3'")
    def _h3_to_latlng(*args, **kwargs):
        raise ImportError("Pacote 'h3' não instalado. Rode: pip install 'h3>=3,<4' ou 'h3'")

# =========================
# CONFIGURAÇÕES
# =========================
SHORT_NAME = "MODISA_L3m_SST"
GRANULE_NAME = "*DAY*.SST.sst.4km*"
PROVIDER = "OB_CLOUD"

START_DATE = dt.date(2015, 1, 1)
END_DATE = dt.date.today()

BASE_DIR = Path("downloads/sst")
NC_DIR = BASE_DIR / "nc"
CSV_DIR = BASE_DIR / "csv"

DOWNSAMPLE = 1  # menor valor = mais pontos
H3_RESOLUTION = 5
H3_AGGREGATE = True  # agrega por hex (gera média/min/máx/std/contagem + centróides)


# =========================
# LOGIN
# =========================
def authenticate() -> bool:
    load_dotenv()
    if not os.getenv("EARTHDATA_USERNAME") or not os.getenv("EARTHDATA_PASSWORD"):
        print("❌ .env ausente ou sem EARTHDATA_USERNAME/EARTHDATA_PASSWORD.")
        return False

    print("🔐 Autenticando no Earthdata...")
    try:
        from contextlib import redirect_stdout, redirect_stderr
        from io import StringIO
        with redirect_stdout(StringIO()), redirect_stderr(StringIO()):
            auth = earthaccess.login(strategy="environment")
        if auth:
            print("✅ Autenticado com sucesso.")
            return True
        print("❌ Falha na autenticação.")
        return False
    except Exception as e:
        print(f"❌ Erro na autenticação: {e}")
        return False


# =========================
# JANELAS TEMPORAIS
# =========================
def month_windows(start: dt.date, end: dt.date) -> Iterable[Tuple[dt.date, dt.date]]:
    cur = dt.date(start.year, start.month, 1)
    last = dt.date(end.year, end.month, 1)
    while cur <= last:
        nxt = (cur.replace(day=28) + dt.timedelta(days=4)).replace(day=1)
        month_end = min(nxt - dt.timedelta(days=1), end)
        yield cur, month_end
        cur = nxt

def month_windows_desc(start: dt.date, end: dt.date) -> Iterable[Tuple[dt.date, dt.date]]:
    return reversed(list(month_windows(start, end)))


# =========================
# EXPORTAÇÃO CSV (com H3 opcional)
# =========================
def export_csv(
    filepath: str,
    downsample: int = 8,
    output_csv_path: Optional[str] = None,
    *,
    h3_resolution: Optional[int] = None,
    h3_aggregate: bool = True,
) -> str:
    print(f"📝 Gerando CSV para {filepath}...")
    with nc.Dataset(filepath) as ds:
        lat_var = "lat" if "lat" in ds.variables else ("latitude" if "latitude" in ds.variables else None)
        lon_var = "lon" if "lon" in ds.variables else ("longitude" if "longitude" in ds.variables else None)
        if not lat_var or not lon_var:
            raise KeyError("Variáveis 'lat'/'lon' não encontradas no NetCDF.")

        lats = ds.variables[lat_var][:]
        lons = ds.variables[lon_var][:]

        if "sst" not in ds.variables:
            raise KeyError("Variável 'sst' não encontrada.")
        sst = np.squeeze(ds.variables["sst"][:])
        sst = np.ma.filled(sst, np.nan)

        # ======================================================
        # 🧭 DICIONÁRIO DE INSPEÇÃO (resumo do conteúdo bruto)
        # ======================================================
        sample_dict = {
            "arquivo": os.path.basename(filepath),
            "variaveis": list(ds.variables.keys()),
            "dimensoes": {k: tuple(v.shape) for k, v in ds.variables.items()},
            "atributos_globais": list(ds.ncattrs()),
            "sst_shape": sst.shape,
            "sst_range": [float(np.nanmin(sst)), float(np.nanmax(sst))],
            "latitude_range": [float(np.nanmin(lats)), float(np.nanmax(lats))],
            "longitude_range": [float(np.nanmin(lons)), float(np.nanmax(lons))],
            "sst_amostra": sst.flatten()[:10].tolist(),
        }
        print("🔍 Amostra do dado extraído:")
        for k, v in sample_dict.items():
            print(f"  {k}: {v}")
        print("-" * 80)

        # também salva esse dicionário em JSON para inspeção posterior
        json_path = Path(filepath).with_suffix(".json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(sample_dict, f, ensure_ascii=False, indent=2)

        # ======================================================
        # Data do produto
        def _infer_date_string() -> str:
            for attr in ("time_coverage_start", "start_time", "time_coverage_end", "end_time"):
                if hasattr(ds, attr):
                    s = getattr(ds, attr)
                    if s:
                        try:
                            if "T" in s:
                                return dt.datetime.fromisoformat(s.replace("Z", "+00:00")).strftime("%Y-%m-%d")
                            if len(s) == 8 and s.isdigit():
                                return dt.datetime.strptime(s, "%Y%m%d").strftime("%Y-%m-%d")
                        except Exception:
                            pass
            fname = os.path.basename(filepath)
            m = re.search(r"A(\d{7})", fname)
            if m:
                year = int(m.group(1)[:4]); doy = int(m.group(1)[4:])
                d = dt.datetime(year, 1, 1) + dt.timedelta(days=doy - 1)
                return d.strftime("%Y-%m-%d")
            if hasattr(ds, "date_created"):
                try:
                    s = getattr(ds, "date_created")
                    if "T" in s:
                        return dt.datetime.fromisoformat(s.replace("Z", "+00:00")).strftime("%Y-%m-%d")
                except Exception:
                    pass
            return "data_nao_encontrada"

        data_formatada = _infer_date_string()
        sst_min = float(np.nanmin(sst))
        sst_max = float(np.nanmax(sst))
        lat_range = (float(np.nanmin(lats)), float(np.nanmax(lats)))
        lon_range = (float(np.nanmin(lons)), float(np.nanmax(lons)))
        date_created = getattr(ds, "date_created", data_formatada)

        lon_grid, lat_grid = np.meshgrid(lons, lats)
        if sst.ndim != 2:
            raise ValueError(f"'sst' com {sst.ndim} dimensões; esperado 2D.")
        if sst.shape != lat_grid.shape:
            if sst.T.shape == lat_grid.shape:
                sst = sst.T
            else:
                raise ValueError(f"Dimensões de 'sst' {sst.shape} != grade {lat_grid.shape}.")

        df = pd.DataFrame(
            {
                "latitude": lat_grid.ravel(),
                "longitude": lon_grid.ravel(),
                "sst": sst.ravel(),
                "data": [data_formatada] * lat_grid.size,
                "sst_min": [sst_min] * lat_grid.size,
                "sst_max": [sst_max] * lat_grid.size,
                "lat_range": [lat_range] * lat_grid.size,
                "lon_range": [lon_range] * lat_grid.size,
                "date_created": [date_created] * lat_grid.size,
            }
        ).dropna(subset=["sst"])

    # H3 agregado
    if h3_resolution is not None:
        if h3 is None:
            raise ImportError("O pacote 'h3' não está instalado. Rode: pip install 'h3>=3,<4'")

        df["h3"] = [
            _latlng_to_h3(lat, lon, h3_resolution) for lat, lon in zip(df["latitude"].values, df["longitude"].values)
        ]

        if h3_aggregate:
            agg = df.groupby("h3", as_index=False).agg(
                sst_mean=("sst", "mean"),
                sst_min=("sst", "min"),
                sst_max=("sst", "max"),
                sst_std=("sst", "std"),
                n=("sst", "count"),
            )
            centroids = [_h3_to_latlng(cell) for cell in agg["h3"].values]
            agg["centroid_lat"] = [c[0] for c in centroids]
            agg["centroid_lon"] = [c[1] for c in centroids]

            agg["data"] = data_formatada
            agg["date_created"] = date_created
            agg["lat_range"] = [lat_range] * len(agg)
            agg["lon_range"] = [lon_range] * len(agg)

            df = agg
        else:
            if downsample and downsample > 1:
                df = df.iloc[::downsample, :]
    else:
        if downsample and downsample > 1:
            df = df.iloc[::downsample, :]

    if output_csv_path is None:
        suffix = f".h3r{h3_resolution}.csv" if h3_resolution is not None else ".csv"
        output_csv_path = os.path.splitext(filepath)[0] + suffix

    Path(output_csv_path).parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_csv_path, index=False)
    print(
        f"✅ CSV salvo: {output_csv_path} | linhas={len(df)} | "
        f"{'H3 res=' + str(h3_resolution) if h3_resolution is not None else 'sem H3'}"
    )
    return output_csv_path


# =========================
# BUSCA + DOWNLOAD
# =========================
def search_and_download_month(
    mstart: dt.date,
    mend: dt.date,
    *,
    short_name: str,
    granule_name: str,
    provider: str,
    nc_dir: Path,
    csv_dir: Path,
    sort_key: Optional[str] = "-start_date",
) -> Tuple[int, int]:
    params = {
        "short_name": short_name,
        "provider": provider,
        "downloadable": True,
        "temporal": (mstart.isoformat(), mend.isoformat()),
        "granule_name": granule_name,
    }
    if sort_key:
        params["sort_key"] = sort_key

    print(f"🔎 Buscando {short_name} | {mstart} → {mend} | granule='{granule_name}'")
    results = earthaccess.search_data(**params)
    print(f"   ↳ Resultados: {len(results)}")

    if not results:
        return 0, 0

    nc_dir.mkdir(parents=True, exist_ok=True)
    csv_dir.mkdir(parents=True, exist_ok=True)

    files = earthaccess.download(results, local_path=str(nc_dir))
    print(f"⬇️ Baixados: {len(files)}")

    csv_count = 0
    for f in (files or []):
        fpath = Path(f)
        csv_path = csv_dir / (f"{fpath.stem}.h3r{H3_RESOLUTION}.csv")
        if csv_path.exists():
            print(f"↪️  CSV já existe, pulando: {csv_path.name}")
            continue
        try:
            export_csv(
                str(fpath),
                downsample=DOWNSAMPLE,
                output_csv_path=str(csv_path),
                h3_resolution=H3_RESOLUTION,
                h3_aggregate=H3_AGGREGATE,
            )
            csv_count += 1
        except Exception as e:
            print(f"⚠️ Erro ao gerar CSV de {fpath.name}: {e}")

    return len(files or []), csv_count


# =========================
# MAIN
# =========================
def main():
    if not authenticate():
        return

    print(f"🛰️ Dataset: {SHORT_NAME}")
    print(f"📄 Granule: {GRANULE_NAME}")
    print(f"📂 NC  dir: {NC_DIR.resolve()}")
    print(f"📂 CSV dir: {CSV_DIR.resolve()}")
    print(f"📅 Intervalo: {START_DATE} → {END_DATE}")
    print(f"🔷 H3: res={H3_RESOLUTION}, aggregate={H3_AGGREGATE}")

    total_nc = 0
    total_csv = 0

    for mstart, mend in month_windows_desc(START_DATE, END_DATE):
        print(f"\n=== {mstart.strftime('%Y-%m')} ===")
        try:
            got_nc, got_csv = search_and_download_month(
                mstart, mend,
                short_name=SHORT_NAME,
                granule_name=GRANULE_NAME,
                provider=PROVIDER,
                nc_dir=NC_DIR,
                csv_dir=CSV_DIR,
                sort_key="-start_date",
            )
            total_nc += got_nc
            total_csv += got_csv
        except Exception as e:
            print(f"⚠️ Erro no mês {mstart.strftime('%Y-%m')}: {e}")

    print("\n=== RESUMO ===")
    print(f"⬇️ NetCDF baixados: {total_nc}")
    print(f"📝 CSVs gerados (H3): {total_csv}")
    print(f"📂 NC  final: {NC_DIR.resolve()}")
    print(f"📂 CSV final: {CSV_DIR.resolve()}")


if __name__ == "__main__":
    main()
