"""
Módulo Singleton para gerenciar conexões e buscas do Earth Access.
Fornece uma interface reutilizável para acessar dados do NASA Earthdata.
"""

import os
import datetime
import earthaccess
from typing import List, Optional, Tuple, Dict, Any
from dotenv import load_dotenv


class EarthAccessManager:
    """
    Singleton para gerenciar conexões e buscas do Earth Access.
    Garante que apenas uma instância seja criada e reutilizada.
    """
    
    _instance = None
    _authenticated = False
    _auth_failed = False
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(EarthAccessManager, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if not self._initialized:
            self._load_credentials()
            self._initialized = True
    
    def _load_credentials(self):
        """Carrega credenciais do arquivo .env"""
        load_dotenv()
        
        if not os.getenv("EARTHDATA_USERNAME") or not os.getenv("EARTHDATA_PASSWORD"):
            raise ValueError(
                "❌ Credenciais não encontradas no arquivo .env\n"
                "Configure EARTHDATA_USERNAME e EARTHDATA_PASSWORD no arquivo .env"
            )
    
    def authenticate(self) -> bool:
        """
        Autentica com o Earth Access.
        
        Returns:
            bool: True se autenticação bem-sucedida, False caso contrário
        """
        if self._authenticated:
            return True
            
        if self._auth_failed:
            print("❌ Autenticação já falhou anteriormente. Parando execução.")
            return False
            
        try:
            print("🔐 Autenticando com Earthdata...")
            
            # Suprime logs duplicados do earthaccess
            import logging
            import sys
            from contextlib import redirect_stderr, redirect_stdout
            from io import StringIO
            
            # Captura e suprime todos os logs duplicados
            with redirect_stderr(StringIO()), redirect_stdout(StringIO()):
                auth = earthaccess.login(strategy="environment")
            
            if auth:
                self._authenticated = True
                print("✅ Autenticação realizada com sucesso!")
                return True
            else:
                print("❌ Falha na autenticação")
                self._auth_failed = True
                return False
        except Exception as e:
            print(f"❌ Erro na autenticação: {e}")
            self._auth_failed = True
            return False
    
    def search_data(
        self,
        short_name: str,
        provider: str = "OB_CLOUD",
        downloadable: bool = True,
        temporal: Optional[Tuple[str, str]] = None,
        granule_name: Optional[str] = None,
        # Parâmetros geográficos
        bounding_box: Optional[Tuple[float, float, float, float]] = None,  # (min_lon, min_lat, max_lon, max_lat)
        polygon: Optional[List[Tuple[float, float]]] = None,  # Lista de coordenadas (lon, lat)
        point: Optional[Tuple[float, float]] = None,  # (lon, lat)
        # Parâmetros de filtro
        cloud_cover: Optional[Tuple[float, float]] = None,  # (min, max) percentual
        day_night_flag: Optional[str] = None,  # "DAY", "NIGHT", "BOTH"
        instrument: Optional[str] = None,
        platform: Optional[str] = None,
        processing_level: Optional[str] = None,
        version: Optional[str] = None,
        # Parâmetros de paginação
        count: Optional[int] = None,
        cursor: Optional[str] = None,
        # Parâmetros de data
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
        **kwargs
    ) -> List[Any]:
        """
        Busca dados usando earthaccess.search_data com autenticação automática.
        
        Args:
            short_name (str): Nome curto do dataset
            provider (str): Provedor dos dados (padrão: "OB_CLOUD")
            downloadable (bool): Se deve retornar apenas dados baixáveis
            temporal (Tuple[str, str], optional): Tupla com data início e fim
            granule_name (str, optional): Padrão do nome do granule
            
            # Parâmetros geográficos
            bounding_box (Tuple[float, float, float, float], optional): Bounding box (min_lon, min_lat, max_lon, max_lat)
            polygon (List[Tuple[float, float]], optional): Lista de coordenadas (lon, lat) formando polígono
            point (Tuple[float, float], optional): Ponto específico (lon, lat)
            
            # Parâmetros de filtro
            cloud_cover (Tuple[float, float], optional): Cobertura de nuvens (min, max) em percentual
            day_night_flag (str, optional): "DAY", "NIGHT", "BOTH"
            instrument (str, optional): Nome do instrumento
            platform (str, optional): Nome da plataforma
            processing_level (str, optional): Nível de processamento
            version (str, optional): Versão do dataset
            
            # Parâmetros de paginação
            count (int, optional): Número máximo de resultados
            cursor (str, optional): Cursor para paginação
            
            # Parâmetros de data alternativos
            start_time (str, optional): Data/hora de início (formato ISO)
            end_time (str, optional): Data/hora de fim (formato ISO)
            
            **kwargs: Argumentos adicionais para earthaccess.search_data
            
        Returns:
            List[Any]: Lista de resultados da busca
            
        Raises:
            Exception: Se não conseguir autenticar ou buscar dados
        """
        if not self._authenticated:
            if not self.authenticate():
                raise Exception("Falha na autenticação com Earth Access")
        
        try:
            # Validação de parâmetros geográficos
            spatial_params = [bounding_box, polygon, point]
            if sum(1 for param in spatial_params if param is not None) > 1:
                raise ValueError("Apenas um parâmetro geográfico pode ser especificado: bounding_box, polygon ou point")
            
            # Constrói parâmetros de busca
            search_params = {
                "short_name": short_name,
                "provider": provider,
                "downloadable": downloadable,
                **kwargs
            }
            
            # Adiciona parâmetros condicionalmente
            if temporal:
                search_params["temporal"] = temporal
            if granule_name:
                search_params["granule_name"] = granule_name
            if bounding_box:
                search_params["bounding_box"] = bounding_box
            if polygon:
                search_params["polygon"] = polygon
            if point:
                search_params["point"] = point
            if cloud_cover:
                search_params["cloud_cover"] = cloud_cover
            if day_night_flag:
                search_params["day_night_flag"] = day_night_flag
            if instrument:
                search_params["instrument"] = instrument
            if platform:
                search_params["platform"] = platform
            if processing_level:
                search_params["processing_level"] = processing_level
            if version:
                search_params["version"] = version
            if count:
                search_params["count"] = count
            if cursor:
                search_params["cursor"] = cursor
            if start_time:
                search_params["start_time"] = start_time
            if end_time:
                search_params["end_time"] = end_time
            
            # Log de parâmetros de busca
            print(f"🔍 Buscando dados: {short_name}")
            if temporal:
                print(f"📅 Período: {temporal[0]} a {temporal[1]}")
            if bounding_box:
                print(f"🗺️ Bounding Box: {bounding_box}")
            if polygon:
                print(f"🔷 Polígono: {len(polygon)} pontos")
            if point:
                print(f"📍 Ponto: {point}")
            if granule_name:
                print(f"📄 Padrão: {granule_name}")
            if cloud_cover:
                print(f"☁️ Cobertura de nuvens: {cloud_cover[0]}% - {cloud_cover[1]}%")
            
            results = earthaccess.search_data(**search_params)
            print(f"✅ Encontrados {len(results)} resultados")
            
            return results
            
        except Exception as e:
            print(f"❌ Erro na busca: {e}")
            raise
    
    def search_recent_data(
        self,
        short_name: str,
        max_days_back: int = 7,
        granule_name: str = "*DAY*.4km*",
        provider: str = "OB_CLOUD",
        # Parâmetros geográficos
        bounding_box: Optional[Tuple[float, float, float, float]] = None,
        polygon: Optional[List[Tuple[float, float]]] = None,
        point: Optional[Tuple[float, float]] = None,
        # Outros parâmetros
        cloud_cover: Optional[Tuple[float, float]] = None,
        day_night_flag: Optional[str] = None,
        **kwargs
    ) -> List[Any]:
        """
        Busca dados recentes dos últimos N dias.
        
        Args:
            short_name (str): Nome curto do dataset
            max_days_back (int): Número máximo de dias para buscar (padrão: 7)
            granule_name (str): Padrão do nome do granule
            provider (str): Provedor dos dados
            
            # Parâmetros geográficos
            bounding_box (Tuple[float, float, float, float], optional): Bounding box (min_lon, min_lat, max_lon, max_lat)
            polygon (List[Tuple[float, float]], optional): Lista de coordenadas (lon, lat) formando polígono
            point (Tuple[float, float], optional): Ponto específico (lon, lat)
            
            # Outros parâmetros
            cloud_cover (Tuple[float, float], optional): Cobertura de nuvens (min, max) em percentual
            day_night_flag (str, optional): "DAY", "NIGHT", "BOTH"
            
            **kwargs: Argumentos adicionais
            
        Returns:
            List[Any]: Lista de resultados encontrados
        """
        all_results = []
        
        # Tenta autenticar uma única vez antes de começar as buscas
        if not self._authenticated:
            if not self.authenticate():
                print("❌ Falha na autenticação. Parando execução.")
                return []
        
        for delta in range(1, max_days_back + 1):
            date = datetime.datetime.now(datetime.timezone.utc).date() - datetime.timedelta(days=delta)
            
            try:
                results = self.search_data(
                    short_name=short_name,
                    provider=provider,
                    temporal=(str(date), str(date)),
                    granule_name=granule_name,
                    bounding_box=bounding_box,
                    polygon=polygon,
                    point=point,
                    cloud_cover=cloud_cover,
                    day_night_flag=day_night_flag,
                    **kwargs
                )
                
                if results:
                    all_results.extend(results)
                    print(f"✅ Encontrados {len(results)} resultados para {date}")
                else:
                    print(f"ℹ️ Nenhum resultado para {date}")
                    
            except Exception as e:
                print(f"⚠️ Erro ao buscar dados para {date}: {e}")
                # Se for erro de autenticação, para a execução
                if "autenticação" in str(e).lower() or "authentication" in str(e).lower():
                    print("❌ Erro de autenticação detectado. Parando execução.")
                    break
                continue
        
        return all_results
    
    def download_data(
        self,
        results: List[Any],
        local_path: str = "downloads"
    ) -> List[str]:
        """
        Baixa dados usando earthaccess.download.
        
        Args:
            results (List[Any]): Lista de resultados da busca
            local_path (str): Diretório local para salvar os arquivos
            
        Returns:
            List[str]: Lista de caminhos dos arquivos baixados
        """
        if not results:
            print("⚠️ Nenhum resultado para baixar")
            return []
        
        try:
            os.makedirs(local_path, exist_ok=True)
            print(f"📥 Baixando {len(results)} arquivo(s) para {local_path}...")
            
            files = earthaccess.download(results, local_path=local_path)
            print(f"✅ {len(files)} arquivo(s) baixado(s) com sucesso!")
            
            return files
            
        except Exception as e:
            print(f"❌ Erro ao baixar dados: {e}")
            raise
    
    def is_authenticated(self) -> bool:
        """Verifica se está autenticado."""
        return self._authenticated
    
    def reset_authentication(self):
        """Reseta o estado de autenticação (útil para testes)."""
        self._authenticated = False
        self._auth_failed = False


# Instância global do singleton
earth_manager = EarthAccessManager()


def get_earth_manager() -> EarthAccessManager:
    """
    Função de conveniência para obter a instância do EarthAccessManager.
    
    Returns:
        EarthAccessManager: Instância singleton do gerenciador
    """
    return earth_manager
