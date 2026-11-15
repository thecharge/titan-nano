FROM ubuntu:24.04
RUN apt-get update && apt-get install -y --no-install-recommends bubblewrap git ca-certificates && rm -rf /var/lib/apt/lists/*
RUN useradd -m prover
RUN mkdir -p /run/user/$(id -u prover) && chown prover /run/user/$(id -u prover) && chmod 700 /run/user/$(id -u prover)
