-- Remove resíduo do gateway anterior (Mercado Pago), substituído pelo Stripe na
-- migração 20260711141427_migrar_mp_para_stripe. Nenhum código referencia estas
-- estruturas desde então: a tabela de log ficou órfã e nunca mais recebeu escrita.
DROP TABLE IF EXISTS "MercadoPagoLog";
DROP TYPE IF EXISTS "MercadoPagoLogEvent";

-- HealthCheck nunca foi usada: o endpoint /health verifica o banco com
-- `SELECT 1` via $queryRaw, sem tocar em nenhuma tabela.
DROP TABLE IF EXISTS "HealthCheck";
