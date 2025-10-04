import os
import datetime
import pprint
import numpy as np
import netCDF4 as nc
import pandas as pd
from earthaccess_manager import get_earth_manager

download_dir = "downloads/planctons"
os.makedirs(download_dir, exist_ok=True)

MAX_LOOKBACK_DAYS = 7

# ==============================
# Helpers
# ==============================
def summarize_nc(filepath):
    ds = nc.Dataset(filepath)
    lats = ds.variables["lat"][:]
    lons = ds.variables["lon"][:]
    chlor_a = ds.variables["chlor_a"][:]
    summary = {
        "arquivo": os.path.basename(filepath),
        "dimensoes": chlor_a.shape,
        "lat_range": (float(lats.min()), float(lats.max())),
        "lon_range": (float(lons.min()), float(lons.max())),
        "chlor_a_min": float(np.nanmin(chlor_a)),
        "chlor_a_max": float(np.nanmax(chlor_a)),
        "atributos_globais": {attr: getattr(ds, attr) for attr in ds.ncattrs()},
    }
    ds.close()
    return summary

def export_csv(filepath, downsample=4):
    """Exporta NetCDF para CSV com lat, lon, chlor_a e data"""
    print(f"📝 Gerando CSV para {filepath}...")
    ds = nc.Dataset(filepath)
    lats = ds.variables["lat"][:]
    lons = ds.variables["lon"][:]
    chlor_a = ds.variables["chlor_a"][:]

    # Extrai a data do arquivo NetCDF
    data_str = None
    try:
        # Tenta extrair data de diferentes atributos globais
        if hasattr(ds, 'time_coverage_start'):
            data_str = ds.time_coverage_start
        elif hasattr(ds, 'start_time'):
            data_str = ds.start_time
        elif hasattr(ds, 'time_coverage_end'):
            data_str = ds.time_coverage_end
        elif hasattr(ds, 'end_time'):
            data_str = ds.end_time
        else:
            # Tenta extrair do nome do arquivo como fallback
            filename = os.path.basename(filepath)
            # Procura por padrão de data no nome do arquivo (ex: A2024001)
            import re
            date_match = re.search(r'A(\d{7})', filename)
            if date_match:
                julian_day = date_match.group(1)
                year = julian_day[:4]
                day_of_year = julian_day[4:]
                data_str = f"{year}-{day_of_year.zfill(3)}"
        
        # Converte para formato de data mais legível se possível
        if data_str:
            try:
                # Tenta converter para datetime e depois para string formatada
                if 'T' in data_str:
                    # Formato ISO com tempo
                    data_obj = datetime.datetime.fromisoformat(data_str.replace('Z', '+00:00'))
                    data_formatada = data_obj.strftime('%Y-%m-%d')
                elif len(data_str) == 8 and data_str.isdigit():
                    # Formato YYYYMMDD
                    data_obj = datetime.datetime.strptime(data_str, '%Y%m%d')
                    data_formatada = data_obj.strftime('%Y-%m-%d')
                elif '-' in data_str and len(data_str.split('-')) == 2:
                    # Formato YYYY-DDD (julian day)
                    year, day = data_str.split('-')
                    data_obj = datetime.datetime(int(year), 1, 1) + datetime.timedelta(days=int(day)-1)
                    data_formatada = data_obj.strftime('%Y-%m-%d')
                else:
                    data_formatada = data_str
            except:
                data_formatada = data_str
        else:
            data_formatada = "data_nao_encontrada"
            
    except Exception as e:
        print(f"⚠️ Erro ao extrair data: {e}")
        data_formatada = "data_nao_encontrada"

    # Meshgrid compatível com as dimensões
    lon_grid, lat_grid = np.meshgrid(lons, lats)

    # Flatten
    data = {
        "latitude": lat_grid.flatten(),
        "longitude": lon_grid.flatten(),
        "chlor_a": chlor_a.flatten(),
        "data": [data_formatada] * len(lat_grid.flatten())  # Adiciona data para cada ponto
    }
    df = pd.DataFrame(data).dropna(subset=["chlor_a"])

    # Downsample opcional para reduzir tamanho do CSV
    if downsample > 1:
        df = df.iloc[::downsample, :]

    output_csv = os.path.splitext(filepath)[0] + ".csv"
    df.to_csv(output_csv, index=False)
    print(f"✅ CSV salvo: {output_csv} ({len(df)} linhas) - Data: {data_formatada}")

    ds.close()
    return output_csv

def buscar_dataset(short_name, label):
    """
    Busca e baixa um dataset usando o EarthAccessManager singleton.
    """
    print(f"\n🌍 Procurando dataset {label} ({short_name})...")
    
    # Obtém a instância do singleton
    earth_manager = get_earth_manager()
    
    # Verifica se está autenticado antes de prosseguir
    if not earth_manager.is_authenticated():
        print("❌ Não está autenticado. Parando busca.")
        return None
    
    # Busca dados recentes
    try:
        results = earth_manager.search_recent_data(
            short_name=short_name,
            max_days_back=MAX_LOOKBACK_DAYS,
            granule_name="*DAY*.4km*"
        )
    except Exception as e:
        print(f"❌ Erro na busca: {e}")
        return None
    
    if not results:
        print(f"❌ Nenhum dado encontrado para {short_name} nos últimos {MAX_LOOKBACK_DAYS} dias")
        return None
    
    # Filtra resultados válidos (DAY + 4km)
    valid_results = [
        g for g in results
        if any("DAY" in link and "4km" in link for link in g.data_links())
    ]
    
    if not valid_results:
        print(f"❌ Nenhum resultado válido (DAY + 4km) para {short_name}")
        return None
    
    # Verifica se arquivo já existe
    expected_name = valid_results[0].data_links()[0].split("/")[-1]
    expected_path = os.path.join(download_dir, expected_name)
    
    if os.path.exists(expected_path):
        print(f"📂 Arquivo já existe localmente: {expected_path}")
        return expected_path
    
    # Baixa o arquivo
    try:
        files = earth_manager.download_data(valid_results, download_dir)
        if files:
            found_file = files[-1]
            print(f"✅ Arquivo baixado: {found_file}")
            return found_file
    except Exception as e:
        print(f"⚠️ Erro ao baixar: {e}")
        return None
    
    return None

def main():
    """Função principal do script."""
    # ==============================
    # 1) Inicialização do Earth Access Manager
    # ==============================
    print("🔐 Inicializando Earth Access Manager...")
    earth_manager = get_earth_manager()

    # Tenta autenticar antes de prosseguir
    if not earth_manager.authenticate():
        print("❌ Falha na autenticação. Encerrando execução.")
        return

    # ==============================
    # 2) Buscar arquivo (apenas NRT)
    # ==============================
    print("🌍 Buscando dados de clorofila...")
    arquivo = buscar_dataset("MODISA_L3m_CHL_NRT", "NRT")

    if arquivo:
        try:
            print("📊 Processando arquivo...")
            resumo = summarize_nc(arquivo)
            export_csv(arquivo, downsample=8)  # gera CSV junto
            
            # ==============================
            # 3) Mostrar resultados
            # ==============================
            print("\n📊 Resumo final:")
            pprint.pprint(resumo)
            
        except Exception as e:
            print(f"⚠️ Erro ao processar {arquivo}: {e}")
    else:
        print("❌ Nenhum arquivo encontrado para processar")


if __name__ == "__main__":
    main()