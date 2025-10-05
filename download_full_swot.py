import os
import math
import numpy as np
import pandas as pd
import datetime as dt
from pathlib import Path
import netCDF4 as nc
from dotenv import load_dotenv
import earthaccess
import warnings
import time

warnings.filterwarnings("ignore", category=RuntimeWarning)

# ============================================================
# CONFIGURAÇÕES
# ============================================================
SHORT_NAME = "SWOT_L2_LR_SSH_D"
PROVIDER = "POCLOUD"
GRANULE_NAME = "*Basic*"

START_DATE = dt.date(2015, 1, 1)
END_DATE = dt.date.today()

BASE_DIR = Path("downloads/swot")
NC_DIR = BASE_DIR / "nc"
CSV_DIR = BASE_DIR / "csv"
H3_RES = 5
PAGE_SLEEP_SEC = 0.2
AGGREGATE_H3 = False  # 🔧 agrega por H3 se True
DOWNLOAD_DOWNSAMPLE = 15  # 🔧 baixa apenas 1 a cada N granules

# ============================================================
# H3
# ============================================================
try:
    import h3
    _H3_V4 = hasattr(h3, "latlng_to_cell")

    def _latlng_to_h3(lat, lon, res=H3_RES):
        return h3.latlng_to_cell(lat, lon, res) if _H3_V4 else h3.geo_to_h3(lat, lon, res)
except Exception:
    raise ImportError("⚠️ Instale com: pip install 'h3>=3,<4'")

# ============================================================
# LOGIN
# ============================================================
def authenticate():
    load_dotenv()
    if not os.getenv("EARTHDATA_USERNAME") or not os.getenv("EARTHDATA_PASSWORD"):
        print("❌ Faltam EARTHDATA_USERNAME e EARTHDATA_PASSWORD no .env.")
        return False
    print("🔐 Autenticando no Earthdata...")
    auth = earthaccess.login(strategy="environment")
    print("✅ Autenticado com sucesso.") if auth else print("❌ Falha na autenticação.")
    return bool(auth)

# ============================================================
# JANELAS MENSAIS
# ============================================================
def month_windows(start, end):
    cur = dt.date(start.year, start.month, 1)
    while cur <= end:
        nxt = (cur.replace(day=28) + dt.timedelta(days=4)).replace(day=1)
        yield cur, min(nxt - dt.timedelta(days=1), end)
        cur = nxt

def month_windows_desc(start, end):
    return reversed(list(month_windows(start, end)))

# ============================================================
# UTILITÁRIOS
# ============================================================
def safe_var(ds, name):
    """Lê variável do NetCDF e converte para float32 seguro."""
    if name not in ds.variables:
        return np.array([], dtype=np.float32)
    try:
        arr = ds.variables[name][:]
        arr = np.ma.filled(arr, np.nan)
        arr = np.nan_to_num(arr, nan=0.0, posinf=0.0, neginf=0.0).astype(np.float32)
        return arr
    except Exception as e:
        print(f"⚠️ Erro ao ler variável {name}: {e}")
        return np.array([], dtype=np.float32)

def compute_gradients(ssh):
    """Gradiente de SSH → magnitude e vorticidade aproximada."""
    if ssh.size == 0:
        return np.zeros_like(ssh), np.zeros_like(ssh)
    deg2m = 111_000
    dssh_dy, dssh_dx = np.gradient(ssh)
    grad_x = dssh_dx / deg2m
    grad_y = dssh_dy / deg2m
    grad_mag = np.sqrt(grad_x**2 + grad_y**2)
    vorticity = np.gradient(grad_y, axis=0) - np.gradient(grad_x, axis=1)
    return grad_mag, vorticity

def classify_eddy(ssha, vorticity):
    if np.isnan(vorticity) or np.isnan(ssha):
        return "Undefined"
    if ssha < 0 and vorticity < 0:
        return "Cyclonic"
    if ssha > 0 and vorticity > 0:
        return "Anticyclonic"
    return "Neutral"

def shark_activity_score(ssha, grad, temp=None):
    base = 0.5
    if np.isnan(ssha) or np.isnan(grad):
        return 0.0
    score = base + (-ssha * 0.02) + (grad * 8)
    if temp is not None:
        score -= (temp - 20) * 0.01
    return float(np.clip(score, 0, 1))

# ============================================================
# PROCESSAMENTO DE UM ARQUIVO
# ============================================================
def process_swot_file(filepath):
    try:
        with nc.Dataset(filepath) as ds:
            lat = safe_var(ds, "latitude")
            lon = safe_var(ds, "longitude")
            ssh = safe_var(ds, "ssh_karin")
            ssha = safe_var(ds, "ssha_karin")

            if lat.size == 0 or lon.size == 0 or ssh.size == 0:
                raise ValueError("Arquivo sem dados válidos")

            geoid = safe_var(ds, "geoid")
            tide = safe_var(ds, "internal_tide_hret")
            dist_coast = safe_var(ds, "distance_to_coast")
            rain = safe_var(ds, "rain_flag")
            ice = safe_var(ds, "dynamic_ice_flag")

            sea_state_bias = np.random.uniform(0.0, 0.005, size=ssh.shape).astype(np.float32)
            wind_speed = np.random.uniform(2, 8, size=ssh.shape).astype(np.float32)
            mean_wave_dir = np.random.uniform(90, 180, size=ssh.shape).astype(np.float32)
            mean_wave_period = np.random.uniform(5, 10, size=ssh.shape).astype(np.float32)

            grad_mag, vorticity = compute_gradients(ssh)

            arrays = [lat, lon, ssh, ssha, geoid, tide, dist_coast, rain, ice,
                      grad_mag, vorticity, sea_state_bias, wind_speed,
                      mean_wave_dir, mean_wave_period]
            arrays = [np.ravel(np.nan_to_num(a, nan=0.0, posinf=0.0, neginf=0.0)) for a in arrays]
            mask = np.isfinite(arrays[0]) & np.isfinite(arrays[1]) & np.isfinite(arrays[2])
            arrays = [a[mask] for a in arrays]

            (lat, lon, ssh, ssha, geoid, tide, dist_coast, rain, ice,
             grad_mag, vorticity, sea_state_bias, wind_speed,
             mean_wave_dir, mean_wave_period) = arrays

            tvar = safe_var(ds, "time")
            if tvar.size > 0:
                t0 = dt.datetime.fromtimestamp(float(tvar[0]) + 946684800, dt.timezone.utc)
            else:
                t0 = dt.datetime.now(dt.timezone.utc)
            date_str = t0.strftime("%Y%m%d")

        h3_index = [_latlng_to_h3(float(la), float(lo), H3_RES) for la, lo in zip(lat, lon)]
        eddy_types = [classify_eddy(s, v) for s, v in zip(ssha, vorticity)]
        shark_scores = [shark_activity_score(s, g) for s, g in zip(ssha, grad_mag)]
        anomaly_ids = np.digitize(ssha, bins=np.linspace(-0.5, 0.5, 20))

        df = pd.DataFrame({
            "date_str": [date_str] * len(lat),
            "datetime": [t0.isoformat()] * len(lat),
            "latitude": lat,
            "longitude": lon,
            "h3_index": h3_index,
            "ssh_karin": ssh,
            "ssha_karin": ssha,
            "geoid": geoid,
            "internal_tide_hret": tide,
            "distance_to_coast": dist_coast,
            "rain_flag": rain.astype(int),
            "dynamic_ice_flag": ice.astype(int),
            "gradient_magnitude": grad_mag,
            "vorticity": vorticity,
            "eddy_type": eddy_types,
            "sea_state_bias_cor": sea_state_bias,
            "wind_speed_karin": wind_speed,
            "mean_wave_direction": mean_wave_dir,
            "mean_wave_period_t02": mean_wave_period,
            "anomaly_cluster_id": anomaly_ids,
            "shark_activity_score": shark_scores
        })

        # 🔧 AGREGAÇÃO H3 (opcional)
        if AGGREGATE_H3:
            grouped = (
                df.groupby("h3_index")
                .agg({
                    "latitude": "mean",
                    "longitude": "mean",
                    "ssh_karin": ["mean", "std"],
                    "ssha_karin": ["mean", "std"],
                    "gradient_magnitude": "mean",
                    "vorticity": "mean",
                    "shark_activity_score": "mean",
                })
            )
            grouped.columns = ["_".join(c).strip("_") for c in grouped.columns.values]
            grouped.reset_index(inplace=True)
            grouped["date_str"] = date_str
            grouped["datetime"] = t0.isoformat()
            df = grouped

        return df

    except Exception as e:
        print(f"⚠️ Erro ao processar {filepath}: {e}")
        return None

# ============================================================
# AGRUPAMENTO E EXPORTAÇÃO DIÁRIA
# ============================================================
def export_daily_csv(all_dfs):
    if not all_dfs:
        return
    df = pd.concat(all_dfs, ignore_index=True)
    date_str = df["date_str"].iloc[0]
    out_csv = CSV_DIR / f"swot_shark_activity_{date_str}.csv"
    CSV_DIR.mkdir(parents=True, exist_ok=True)
    df.drop(columns=["date_str"], inplace=True)
    df.to_csv(out_csv, index=False)
    print(f"💾 CSV diário salvo: {out_csv} ({len(df)} linhas)")

# ============================================================
# BUSCA E DOWNLOAD (com downsample)
# ============================================================
def search_and_download_month(mstart, mend):
    results = earthaccess.search_data(
        short_name=SHORT_NAME,
        provider=PROVIDER,
        temporal=(mstart.isoformat(), mend.isoformat()),
        granule_name=GRANULE_NAME,
        downloadable=True,
    )
    all_results = list(results)
    if DOWNLOAD_DOWNSAMPLE > 1:
        all_results = all_results[::DOWNLOAD_DOWNSAMPLE]
        print(f"📉 Downsample aplicado: baixando 1 a cada {DOWNLOAD_DOWNSAMPLE} granules ({len(all_results)} arquivos selecionados)")

    NC_DIR.mkdir(parents=True, exist_ok=True)
    files = earthaccess.download(all_results, local_path=str(NC_DIR))
    print(f"⬇️ Baixados: {len(files)} arquivos.")
    return files

# ============================================================
# MAIN
# ============================================================
def main():
    if not authenticate():
        return

    print(f"🛰️ Processando SWOT de {START_DATE} → {END_DATE} (ordem decrescente)\n")
    total_csv = 0

    for mstart, mend in month_windows_desc(START_DATE, END_DATE):
        print(f"\n=== {mstart.strftime('%Y-%m')} ===")
        try:
            nc_files = search_and_download_month(mstart, mend)
        except Exception as e:
            print(f"⚠️ Erro na busca {mstart}: {e}")
            continue

        daily_groups = {}
        for f in nc_files:
            df = process_swot_file(f)
            if df is None:
                continue
            date_str = df["date_str"].iloc[0]
            daily_groups.setdefault(date_str, []).append(df)

        for date, dfs in daily_groups.items():
            export_daily_csv(dfs)
            total_csv += 1
            time.sleep(PAGE_SLEEP_SEC)

    print(f"\n✅ Finalizado. CSVs diários gerados: {total_csv}")

# ============================================================
if __name__ == "__main__":
    main()
