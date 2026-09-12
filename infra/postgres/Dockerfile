FROM postgres:17-alpine AS vector-build
ARG PGVECTOR_VERSION=0.8.2
RUN apk add --no-cache build-base curl \
    && curl --fail --location --retry 3 "https://github.com/pgvector/pgvector/archive/refs/tags/v${PGVECTOR_VERSION}.tar.gz" -o /tmp/vector.tar.gz \
    && tar -xzf /tmp/vector.tar.gz -C /tmp \
    && cd "/tmp/pgvector-${PGVECTOR_VERSION}" \
    && make with_llvm=no OPTFLAGS="" \
    && make with_llvm=no install DESTDIR=/opt/pgvector

FROM postgres:17-alpine
COPY --from=vector-build /opt/pgvector/usr/local/ /usr/local/
