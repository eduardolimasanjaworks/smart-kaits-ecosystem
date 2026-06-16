-- Base dedicada à Evolution API (executado na primeira criação do volume Postgres).
-- smartuser é superuser (POSTGRES_USER) — precisa de dono/acesso explícito para o Prisma da Evolution.
CREATE DATABASE evolution OWNER smartuser;
GRANT ALL PRIVILEGES ON DATABASE evolution TO smartuser;
