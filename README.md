# aerotools
## Развернуть в докере
1. Собрать образ
2. Если в системе отсутствует GPU 
    `docker compose -f compose.dev.yaml build`
3. При наличии GPU, проверить версию cuda в системе `nvcc --version`
4. Иначе установить cuda: Перейти на страницу загрузки CUDA Toolkit: https://developer.nvidia.com/cuda-downloads и выбрать свою ОС, архитектуру, нужную версию и тип установщика (обычно .exe для Windows или .deb/.run для Linux).
5. После установки cuda собрать образ `docker compose -f compose.dev.yaml build --build-arg TORCH_BACKEND=cu126`
6. После сборки образов, запустить контейнеры `docker compose -f compose.dev.yaml up -d`

## Развернуть на хосте 
### backend
1. Установить пакетный менеджер uv
`powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"`
2. Установить зависимости
`uv sync --frozen`
3. Перейти в папку с проектом
`cd backend`
4. Запустить сервер
`uv run uvicorn aerotools.app:start_app --port 8000`

### frontend
1. `cd frontend`
2. `npm install vite --save-dev`
3. `npm run build`
4. `npm run preview`