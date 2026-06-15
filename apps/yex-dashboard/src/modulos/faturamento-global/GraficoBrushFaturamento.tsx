// Gráfico de linha com minimapa (Brush) para explorar picos de faturamento diário.
"use client";

import type { PontoSerieFaturamento } from "@/dominio/contratos/tiposKpi";
import { Brush, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type PropriedadesGraficoBrushFaturamento = {
  serieAtual: PontoSerieFaturamento[];
};

export default function GraficoBrushFaturamento({
  serieAtual,
}: PropriedadesGraficoBrushFaturamento) {
  const dados = serieAtual.map((ponto) => ({
    nome: ponto.dia,
    valor: ponto.valor,
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="nome" tick={{ fill: "#64748B", fontSize: 10 }} stroke="#E2E8F0" />
          <YAxis tick={{ fill: "#64748B", fontSize: 10 }} stroke="#E2E8F0" />
          <Tooltip
            contentStyle={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: 8,
              color: "#0F172A",
              fontSize: 12,
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}
          />
          <Line type="monotone" dataKey="valor" stroke="#16A34A" strokeWidth={2} dot={false} />
          <Brush height={20} travellerWidth={6} stroke="#CBD5E1" fill="#F8FAFC" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
