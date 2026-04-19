#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
  CREATE DATABASE walletos_users;
  CREATE DATABASE walletos_wallets;
  CREATE DATABASE walletos_notifications;
EOSQL
