FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libjpeg62-turbo \
    libpng16-16 \
  && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv

ARG TORCH_BACKEND=cpu

WORKDIR /src
COPY pyproject.toml ./
RUN uv sync --extra ${TORCH_BACKEND}

COPY aerotools ./aerotools
COPY toolsets ./toolsets

ENV PYTHONUNBUFFERED=1
EXPOSE 8000

CMD ["uv", "run", "uvicorn", "aerotools.app:start_app", "--host", "0.0.0.0", "--port", "8000"]
