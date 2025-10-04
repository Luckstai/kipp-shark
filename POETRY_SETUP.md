# Configuração com Poetry

Este projeto está configurado para usar Poetry como gerenciador de dependências.

## 📋 Pré-requisitos

1. **Instalar Poetry** (se ainda não tiver):

   ```bash
   curl -sSL https://install.python-poetry.org | python3 -
   ```

2. **Verificar instalação**:
   ```bash
   poetry --version
   ```

## 🚀 Configuração do Projeto

### 1. Instalar dependências

```bash
poetry install
```

### 2. Ativar ambiente virtual

```bash
poetry shell
```

### 3. Configurar credenciais

Crie o arquivo `.env` na raiz do projeto:

```bash
# Credenciais do Earthdata
EARTHDATA_USERNAME=seu_usuario_aqui
EARTHDATA_PASSWORD=sua_senha_aqui
```

## 🎯 Executar o Projeto

### Opção 1: Dentro do ambiente virtual

```bash
poetry shell
python download_plancton.py
```

### Opção 2: Comando direto do Poetry

```bash
poetry run python download_plancton.py
```

### Opção 3: Usando o script configurado

```bash
poetry run download-plancton
```

## 📦 Comandos Úteis do Poetry

### Gerenciar dependências

```bash
# Adicionar nova dependência
poetry add nome_da_dependencia

# Adicionar dependência de desenvolvimento
poetry add --group dev nome_da_dependencia

# Remover dependência
poetry remove nome_da_dependencia

# Atualizar dependências
poetry update
```

### Ambiente virtual

```bash
# Ativar ambiente virtual
poetry shell

# Desativar ambiente virtual
exit

# Ver informações do ambiente
poetry env info

# Remover ambiente virtual
poetry env remove python
```

### Build e publicação

```bash
# Construir pacote
poetry build

# Publicar no PyPI
poetry publish
```

## 🔧 Desenvolvimento

### Ferramentas de desenvolvimento incluídas

- **Black**: Formatação de código
- **Flake8**: Linting
- **MyPy**: Verificação de tipos
- **Pytest**: Testes

### Executar ferramentas

```bash
# Formatar código
poetry run black .

# Verificar linting
poetry run flake8 .

# Verificar tipos
poetry run mypy .

# Executar testes
poetry run pytest
```

## 📁 Estrutura do Projeto

```
kipp-shark/
├── pyproject.toml          # Configuração do Poetry
├── .env                    # Credenciais (não commitado)
├── .env.example            # Exemplo de credenciais
├── download_plancton.py    # Script principal
├── earthaccess_manager.py  # Módulo singleton
├── downloads/              # Diretório de downloads
│   └── planctons/         # Dados de plâncton
├── README.md
└── POETRY_SETUP.md        # Este arquivo
```

## 🚨 Troubleshooting

### Problema: Poetry não encontrado

```bash
# Adicionar ao PATH (Linux/Mac)
export PATH="$HOME/.local/bin:$PATH"

# Ou reinstalar
curl -sSL https://install.python-poetry.org | python3 -
```

### Problema: Erro de permissão

```bash
# Configurar Poetry para não criar ambiente virtual no projeto
poetry config virtualenvs.in-project false
```

### Problema: Dependências conflitantes

```bash
# Limpar cache e reinstalar
poetry cache clear --all pypi
poetry install --no-cache
```

## 📚 Documentação Adicional

- [Poetry Documentation](https://python-poetry.org/docs/)
- [Python Packaging Guide](https://packaging.python.org/)
