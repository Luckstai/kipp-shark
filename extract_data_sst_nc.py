# extract_sst_to_csv_h3.py
# ------------------------------------------------------------
# Extrai dados de temperatura da superfície do mar (SST)
# de um arquivo .nc MODIS-Aqua e gera CSV pronto para
# visualização geoespacial e machine learning.
# ------------------------------------------------------------

import os
import re
import sys
import json
import numpy as np
import pandas as pd
import netCDF4 as nc
from pathlib import Path
from datetime import datetime
from typing import Tuple

# ===== H3 (compatível v3 e v4) =====
try:
    import h3
    _H3_V4 = hasattr(h3, "latlng_to_cell")

    def _latlng_to_h3(lat, lon, res):
        return h3.latlng_to_cell(lat, lon, res) if _H3_V4 else h3.geo_to_h3(lat, lon, res)
    def _h3_to_latlng(cell):
        return h3.cell_to_latlng(cell) if _H3_V4 else h3.h3_to_geo(cell)
except Exception:
    raise ImportError("Instale com: pip install 'h3>=3,<4'")

# =============================
# CONFIGURAÇÕES
# =============================
H3_RESOLUTION = 5
CSV_OUTPUT_DIR = Path("downloads/sst/csv")
CSV_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# =============================
# EXTRAÇÃO DE DADOS DO NC
# =============================
def extract_sst(filepath: str) -> pd.DataFrame:
    with nc.Dataset(filepath) as ds:
        # Latitude / Longitude
        lats = ds.variables["lat"][:]
        lons = ds.variables["lon"][:]

        # Variável SST
        sst = np.ma.filled(ds.variables["sst"][:], np.nan)
        scale_factor = float(getattr(ds.variables["sst"], "scale_factor", 1.0))
        add_offset = float(getattr(ds.variables["sst"], "add_offset", 0.0))
        sst_celsius = sst * scale_factor + add_offset

        # Qualidade (se existir)
        qual = ds.variables["qual_sst"][:] if "qual_sst" in ds.variables else np.zeros_like(sst)

        # Data (atributo global ou nome de arquivo)
        date_str = None
        for attr in ("time_coverage_start", "start_time"):
            if hasattr(ds, attr):
                try:
                    s = getattr(ds, attr)
                    date_str = datetime.fromisoformat(s.replace("Z", "+00:00")).strftime("%Y-%m-%d")
                    break
                except Exception:
                    pass
        if not date_str:
            fname = os.path.basename(filepath)
            m = re.search(r"\.(\d{8})\.", fname)
            if m:
                d = datetime.strptime(m.group(1), "%Y%m%d")
                date_str = d.strftime("%Y-%m-%d")
            else:
                date_str = "unknown"

        # Grade
        lon_grid, lat_grid = np.meshgrid(lons, lats)
        if sst_celsius.T.shape == lat_grid.shape:
            sst_celsius = sst_celsius.T
            qual = qual.T

        df = pd.DataFrame({
            "date": [date_str] * lat_grid.size,
            "latitude": lat_grid.ravel(),
            "longitude": lon_grid.ravel(),
            "sst_celsius": sst_celsius.ravel(),
            "sst_quality": qual.ravel(),
        }).dropna(subset=["sst_celsius"])

        # Filtra valores inválidos
        df = df[(df["sst_celsius"] > -2) & (df["sst_celsius"] < 45)]
        return df

# =============================
# AGREGAÇÃO H3 E CÁLCULO DE ANOMALIA
# =============================
def aggregate_h3(df: pd.DataFrame) -> pd.DataFrame:
    df["h3_index"] = [
        _latlng_to_h3(lat, lon, H3_RESOLUTION)
        for lat, lon in zip(df["latitude"], df["longitude"])
    ]

    agg = (
        df.groupby("h3_index", as_index=False)
        .agg(
            sst_mean_celsius=("sst_celsius", "mean"),
            sst_std_celsius=("sst_celsius", "std"),
            sst_quality=("sst_quality", "mean"),
            latitude=("latitude", "mean"),
            longitude=("longitude", "mean"),
            n_points=("sst_celsius", "count"),
            date=("date", "first")
        )
    )

    # Substitui NaN (1 ponto só) por 0.0
    agg["sst_std_celsius"] = agg["sst_std_celsius"].fillna(0.0)

    # Adiciona flag de confiança
    agg["confidence"] = np.where(agg["n_points"] > 5, "high",
                                 np.where(agg["n_points"] > 1, "medium", "low"))

    # Cálculo da anomalia
    global_mean = agg["sst_mean_celsius"].mean()
    agg["anomaly_celsius"] = agg["sst_mean_celsius"] - global_mean

    return agg


# =============================
# MAIN
# =============================
def main():

    nc_file = Path("AQUA_MODIS.20241117.L3m.DAY.SST.sst.4km.nc")
    if not nc_file.exists():
        print(f"❌ Arquivo não encontrado: {nc_file}")
        sys.exit(1)

    print(f"📂 Extraindo SST de {nc_file.name} ...")

    # Extrai o dataset
    df_raw = extract_sst(str(nc_file))
    print(f"✅ Dados extraídos: {len(df_raw):,} pontos")

    # Agrega por H3
    df_h3 = aggregate_h3(df_raw)
    print(f"🔷 Agregado por H3: {len(df_h3):,} células")

    # Salva CSV final
    out_csv = CSV_OUTPUT_DIR / f"{nc_file.stem}.h3r{H3_RESOLUTION}.csv"
    df_h3.to_csv(out_csv, index=False)
    print(f"💾 CSV salvo: {out_csv}")

    # Amostra de preview
    print("\n🔍 Amostra do CSV gerado:")
    print(df_h3.head(5).to_string(index=False))


if __name__ == "__main__":
    main()
