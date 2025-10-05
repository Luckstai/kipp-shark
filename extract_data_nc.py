import json
import numpy as np
import netCDF4 as nc
import sys

def extract_nc_info(filepath):
    """Extrai todas as variáveis, dimensões e atributos de um arquivo .nc e imprime em dicionário JSON."""
    with nc.Dataset(filepath, 'r') as ds:
        print(ds)
        info = {
            "arquivo": filepath,
            "atributos_globais": {attr: str(getattr(ds, attr)) for attr in ds.ncattrs()},
            "dimensoes": {dim: len(ds.dimensions[dim]) for dim in ds.dimensions},
            "variaveis": {}
        }

        for var_name, var in ds.variables.items():
            try:
                data = var[:]
                if hasattr(data, 'shape'):
                    sample = data.flatten()[:5].tolist()  # pequena amostra
                else:
                    sample = [data]

                info["variaveis"][var_name] = {
                    "dtype": str(var.dtype),
                    "dimensoes": var.dimensions,
                    "shape": getattr(data, "shape", None),
                    "atributos": {a: str(getattr(var, a)) for a in var.ncattrs()},
                    "sample": [float(x) if isinstance(x, (np.integer, np.floating)) else x for x in sample]
                }
            except Exception as e:
                info["variaveis"][var_name] = {"erro": str(e)}

        return info

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python extract_data_nc.py <arquivo.nc>")
        sys.exit(1)

    filepath = sys.argv[1]
    try:
        result = extract_nc_info(filepath)
        # conversão segura para tipos nativos
        result = json.loads(json.dumps(result, default=lambda o: o.item() if isinstance(o, np.generic) else str(o)))
        print(json.dumps(result, indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"❌ Erro: {e}")
