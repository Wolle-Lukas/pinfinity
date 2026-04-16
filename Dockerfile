# Build the pinfinitylication in the /pinfinity directory
FROM ghcr.io/astral-sh/uv:python3.12-trixie-slim AS builder
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy

WORKDIR /pinfinity
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --frozen --no-install-project --no-dev

COPY . /pinfinity
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

# Final image without uv
FROM python:3.12-slim-trixie

RUN groupadd --system pinfinity && useradd --system --gid pinfinity pinfinity

COPY --from=builder --chown=pinfinity:pinfinity /pinfinity /pinfinity

RUN chmod +x /pinfinity/entrypoint.sh \
    && chmod 644 /pinfinity/pinfinity/default-data/*.json \
    && mkdir -p /pinfinity/pinfinity/data \
    && chown pinfinity:pinfinity /pinfinity/pinfinity/data

ENV PATH="/pinfinity/.venv/bin:$PATH"
WORKDIR /pinfinity
USER pinfinity

ENTRYPOINT ["/pinfinity/entrypoint.sh"]
CMD ["uvicorn", "pinfinity.main:pinfinity", "--host", "0.0.0.0", "--port", "8000"]
