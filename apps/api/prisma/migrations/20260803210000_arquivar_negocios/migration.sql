-- Arquivamento de negócios: separado do status, porque FINALIZADO já tem efeito de
-- negócio (dá baixa nos animais) e um negócio finalizado com parcelas a receber
-- ainda precisa ficar à vista.
ALTER TABLE "Deal" ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "Deal_farmId_archivedAt_idx" ON "Deal"("farmId", "archivedAt");

-- Cancelado é encerrado por definição: já nasce arquivado.
UPDATE "Deal" SET "archivedAt" = "updatedAt" WHERE "status" = 'CANCELADO';
