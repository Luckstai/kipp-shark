import os
import earthaccess
import textwrap
from dotenv import load_dotenv
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


if not authenticate():
    exit(0)
    
# ==============================
# 2) Buscar datasets
# ==============================
SEARCH_KEYWORD = "MODISA_L3m_SST"  # troque aqui se quiser outra keyword

print(f"\n🌍 Procurando datasets com keyword: '{SEARCH_KEYWORD}'...")
datasets = earthaccess.search_datasets(keyword=SEARCH_KEYWORD)

if not datasets:
    print("❌ Nenhum dataset encontrado.")
    exit(0)

print(f"📂 {len(datasets)} datasets encontrados:\n")

# ==============================
# 3) Exibir de forma legível e salvar em TXT
# ==============================
output_file = "datasets_result.txt"
with open(output_file, "w", encoding="utf-8") as f:
    for i, d in enumerate(datasets, 1):
        meta = d.get("meta", {})
        umm  = d.get("umm", {})
        short_name = umm.get("ShortName")
        version    = umm.get("Version")
        provider   = meta.get("provider-id")
        doi        = umm.get("DOI", {}).get("DOI", "N/A")
        title      = umm.get("EntryTitle")
        summary    = umm.get("Abstract", "")

        block = (
            f"🔹 [{i}] {title}\n"
            f"   short_name : {short_name}\n"
            f"   version    : {version}\n"
            f"   provider   : {provider}\n"
            f"   DOI        : {doi}\n"
            f"   resumo     : {textwrap.fill(summary, width=80, subsequent_indent='                ')}\n\n"
        )
        print(block)   # imprime no terminal
        f.write(block) # salva no arquivo

print(f"\n📄 Resultados salvos em: {output_file}")