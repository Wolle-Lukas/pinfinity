# Build the application in the /app directory
FROM ghcr.io/astral-sh/uv:python3.12-trixie-slim AS builder
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy

WORKDIR /app
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --frozen --no-install-project --no-dev

COPY . /app
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

# Final image without uv
FROM python:3.12-slim-trixie

RUN groupadd --system --gid 1001 pinfinity && useradd --system --uid 1001 --gid pinfinity pinfinity

COPY --from=builder --chown=pinfinity:pinfinity /app /app

RUN chmod +x /app/entrypoint.sh \
    && chmod 644 /app/app/default-data/*.json \
    && mkdir -p /app/app/data \
    && chown pinfinity:pinfinity /app/app/data

ENV PATH="/app/.venv/bin:$PATH"
WORKDIR /app
USER pinfinity

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
