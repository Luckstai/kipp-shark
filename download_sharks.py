import os
import requests
import pandas as pd
from datetime import datetime

# =============================
# CONFIGURAÇÕES
# =============================

# Espécies comuns (pode adicionar mais se quiser)
SPECIES = [
    "Carcharhinus",  # requiem sharks
    "Galeocerdo",    # tiger shark
    "Sphyrna",       # hammerhead
    "Prionace",      # blue shark
    "Carcharodon"    # great white
]

# Últimos 10 anos
CURRENT_YEAR = datetime.now().year
START_DATE = f"{CURRENT_YEAR - 10}-01-01"
END_DATE = f"{CURRENT_YEAR}-12-31"

# Regiões costeiras aproximadas (bounding boxes)
REGIONS = {
    "americas": [-120, -60, -30, 50],     # lon_min, lon_max, lat_min, lat_max
    "africa": [-30, 60, -40, 35],
    "europe": [-30, 40, 35, 70],
    "asia": [60, 180, -10, 60],
    "oceania": [110, 180, -50, -10],
    "antarctic": [-180, 180, -90, -50]
}

# Pasta de saída
OUTPUT_DIR = "downloads/sharks"

# Criar pasta se não existir
os.makedirs(OUTPUT_DIR, exist_ok=True)

# =============================
# FUNÇÃO PARA BUSCAR DADOS
# =============================

def fetch_shark_data(region_name, bbox, species_list):
    print(f"📡 Baixando dados para {region_name}...")

    lon_min, lon_max, lat_min, lat_max = bbox
    all_records = []

    for sp in species_list:
        offset = 0
        limit = 1000  # máximo permitido por requisição

        while True:
            url = (
                f"https://api.obis.org/v3/occurrence?"
                f"scientificname={sp}"
                f"&startdate={START_DATE}"
                f"&enddate={END_DATE}"
                f"&geometry=POLYGON(({lon_min}%20{lat_min},"
                f"{lon_min}%20{lat_max},"
                f"{lon_max}%20{lat_max},"
                f"{lon_max}%20{lat_min},"
                f"{lon_min}%20{lat_min}))"
                f"&size={limit}&from={offset}"
            )

            r = requests.get(url, timeout=60)
            if r.status_code != 200:
                print(f"⚠️ Erro {r.status_code} ao requisitar {url}")
                break

            data = r.json()

            if "results" not in data or not data["results"]:
                break

            all_records.extend(data["results"])
            offset += limit

            if offset >= data.get("total", offset):
                break

    print(f"✅ {len(all_records)} registros coletados para {region_name}")
    return all_records


# =============================
# COLETA E SALVAMENTO
# =============================

for region, bbox in REGIONS.items():
    records = fetch_shark_data(region, bbox, SPECIES)

    if not records:
        print(f"⚠️ Nenhum dado encontrado para {region}. Pulando...\n")
        continue

    # Converter para DataFrame
    df = pd.json_normalize(records)

    # Garantir colunas mínimas
    cols = ["scientificName", "decimalLatitude", "decimalLongitude", "eventDate", "basisOfRecord"]
    for c in cols:
        if c not in df.columns:
            df[c] = None
    df = df[cols]

    # Caminho completo do arquivo
    filename = os.path.join(OUTPUT_DIR, f"{region}_sharks.csv")

    # Salvar CSV
    df.to_csv(filename, index=False)
    print(f"💾 Arquivo salvo: {filename}\n")

print("🏁 Coleta finalizada!")
