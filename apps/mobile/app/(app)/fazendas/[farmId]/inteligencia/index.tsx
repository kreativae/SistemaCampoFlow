import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useQuery } from '@tanstack/react-query';
import { Svg, Rect, Text as SvgText, Line } from 'react-native-svg';
import { apiFetch, ApiError } from '../../../../../src/lib/api';
import { theme } from '../../../../../src/lib/theme';
import type { BiOverview } from '../../../../../src/lib/types';

const screenWidth = Dimensions.get('window').width;

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatPercent(value: number): string {
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return iso;
  }
}

interface KpiCardProps {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

function KpiCard({ label, value, icon, color }: KpiCardProps) {
  return (
    <View style={s.kpiCard}>
      <View style={[s.kpiIconWrap, { backgroundColor: `${color}1A` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={s.kpiValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={s.kpiLabel} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

function SalesBarChart({ months }: { months: BiOverview['forecastSales']['recentMonths'] }) {
  if (!months.length) {
    return (
      <View style={s.chartEmpty}>
        <Text style={s.chartEmptyText}>Sem dados suficientes para o gráfico</Text>
      </View>
    );
  }

  const chartWidth = screenWidth - 32 - 32;
  const chartHeight = 180;
  const paddingBottom = 28;
  const paddingTop = 10;
  const plotHeight = chartHeight - paddingBottom - paddingTop;

  const maxValue =
    months.reduce((max: number, m: BiOverview['forecastSales']['recentMonths'][number]) => {
      return Math.max(max, m.receita, m.despesa);
    }, 0) || 1;

  const groupWidth = chartWidth / months.length;
  const barWidth = Math.min(18, groupWidth / 3.5);

  return (
    <View>
      <Svg width={chartWidth} height={chartHeight}>
        <Line
          x1={0}
          y1={chartHeight - paddingBottom}
          x2={chartWidth}
          y2={chartHeight - paddingBottom}
          stroke={theme.colors.border}
          strokeWidth={1}
        />
        {months.map((m: BiOverview['forecastSales']['recentMonths'][number], i: number) => {
          const groupCenter = groupWidth * i + groupWidth / 2;
          const receitaHeight = (m.receita / maxValue) * plotHeight;
          const despesaHeight = (m.despesa / maxValue) * plotHeight;
          const receitaX = groupCenter - barWidth - 2;
          const despesaX = groupCenter + 2;
          const baseY = chartHeight - paddingBottom;

          return (
            <View key={m.period}>
              <Rect
                x={receitaX}
                y={baseY - receitaHeight}
                width={barWidth}
                height={Math.max(receitaHeight, 1)}
                rx={3}
                fill={theme.colors.success}
              />
              <Rect
                x={despesaX}
                y={baseY - despesaHeight}
                width={barWidth}
                height={Math.max(despesaHeight, 1)}
                rx={3}
                fill={theme.colors.danger}
              />
              <SvgText
                x={groupCenter}
                y={chartHeight - 10}
                fontSize={10}
                fill={theme.colors.textMuted}
                textAnchor="middle"
              >
                {m.period}
              </SvgText>
            </View>
          );
        })}
      </Svg>
      <View style={s.chartLegend}>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: theme.colors.success }]} />
          <Text style={s.legendText}>Receita</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: theme.colors.danger }]} />
          <Text style={s.legendText}>Despesa</Text>
        </View>
      </View>
    </View>
  );
}

export default function IntelligenceScreen() {
  const { farmId } = useLocalSearchParams<{ farmId: string }>();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['bi-overview', farmId],
    queryFn: () => apiFetch<BiOverview>(`/fazendas/${farmId}/inteligencia`),
    enabled: !!farmId,
    retry: (failureCount: number, err: unknown) => {
      if (err instanceof ApiError && err.status === 403) return false;
      return failureCount < 2;
    },
  });

  const isPlanBlocked = error instanceof ApiError && error.status === 403;

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  if (isPlanBlocked) {
    return (
      <View style={s.center}>
        <View style={s.upgradeIconWrap}>
          <Ionicons name="lock-closed" size={28} color={theme.colors.warning} />
        </View>
        <Text style={s.upgradeTitle}>Recurso não disponível</Text>
        <Text style={s.upgradeText}>
          Seu plano atual não inclui Inteligência. Faça upgrade para acessar.
        </Text>
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={s.center}>
        <Ionicons name="alert-circle-outline" size={28} color={theme.colors.danger} />
        <Text style={s.upgradeText}>Não foi possível carregar os dados de inteligência.</Text>
      </View>
    );
  }

  const { kpis, forecastWeightGain, forecastSales, managementSuggestions, additionalData } = data;
  const lucroColor = kpis.lucro >= 0 ? theme.colors.success : theme.colors.danger;

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeInDown.duration(300)}>
        <Text style={s.title}>Inteligência do negócio</Text>
        <Text style={s.subtitle}>Visão consolidada de desempenho financeiro e produtivo</Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(300).delay(60)} style={s.kpiGrid}>
        <KpiCard label="Total receita" value={formatBRL(kpis.totalReceita)} icon="trending-up" color={theme.colors.success} />
        <KpiCard label="Total despesa" value={formatBRL(kpis.totalDespesa)} icon="trending-down" color={theme.colors.danger} />
        <KpiCard label="Lucro" value={formatBRL(kpis.lucro)} icon="cash-outline" color={lucroColor} />
        <KpiCard label="ROI" value={formatPercent(kpis.roi)} icon="stats-chart-outline" color={theme.colors.info} />
        <KpiCard label="Rentabilidade" value={formatPercent(kpis.rentabilidade)} icon="pie-chart-outline" color={theme.colors.info} />
        <KpiCard label="Arrobas produzidas" value={kpis.arrobasProduzidas.toLocaleString('pt-BR')} icon="barbell-outline" color={theme.colors.primary} />
        <KpiCard label="Custo por arroba" value={formatBRL(kpis.custoPorArroba)} icon="pricetag-outline" color={theme.colors.warning} />
        <KpiCard label="Lucro por animal" value={formatBRL(kpis.lucroPorAnimal)} icon="paw-outline" color={theme.colors.accent} />
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(300).delay(120)} style={s.card}>
        <View style={s.cardHeader}>
          <Ionicons name="scale-outline" size={18} color={theme.colors.primary} />
          <Text style={s.cardTitle}>Previsão de ganho de peso</Text>
        </View>
        <View style={s.forecastRow}>
          <View style={s.forecastItem}>
            <Text style={s.forecastLabel}>Janela de análise</Text>
            <Text style={s.forecastValue}>{forecastWeightGain.windowDays} dias</Text>
          </View>
          <View style={s.forecastItem}>
            <Text style={s.forecastLabel}>Ganho médio diário</Text>
            <Text style={s.forecastValue}>
              {forecastWeightGain.averageDailyGainKg.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg
            </Text>
          </View>
          <View style={s.forecastItem}>
            <Text style={s.forecastLabel}>Tamanho do rebanho</Text>
            <Text style={s.forecastValue}>{forecastWeightGain.herdSize}</Text>
          </View>
        </View>
        <View style={s.highlightBox}>
          <Text style={s.highlightLabel}>Arrobas projetadas</Text>
          <Text style={s.highlightValue}>
            {forecastWeightGain.projectedArrobas.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} @
          </Text>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(300).delay(180)} style={s.card}>
        <View style={s.cardHeader}>
          <Ionicons name="bar-chart-outline" size={18} color={theme.colors.primary} />
          <Text style={s.cardTitle}>Previsão de vendas</Text>
        </View>
        <SalesBarChart months={forecastSales.recentMonths} />
        <View style={s.highlightBox}>
          <Text style={s.highlightLabel}>Receita projetada (próximo mês)</Text>
          <Text style={s.highlightValue}>{formatBRL(forecastSales.projectedNextMonthReceita)}</Text>
        </View>
      </Animated.View>

      {managementSuggestions.length > 0 && (
        <Animated.View entering={FadeInDown.duration(300).delay(240)} style={s.card}>
          <View style={s.cardHeader}>
            <Ionicons name="bulb-outline" size={18} color={theme.colors.primary} />
            <Text style={s.cardTitle}>Sugestões de manejo</Text>
          </View>
          {managementSuggestions.map((suggestion: string, i: number) => (
            <View key={i} style={s.tipCard}>
              <Ionicons name="bulb" size={16} color={theme.colors.warning} />
              <Text style={s.tipText}>{suggestion}</Text>
            </View>
          ))}
        </Animated.View>
      )}

      <Animated.View entering={FadeInDown.duration(300).delay(300)} style={s.card}>
        <View style={s.cardHeader}>
          <Ionicons name="layers-outline" size={18} color={theme.colors.primary} />
          <Text style={s.cardTitle}>Dados complementares</Text>
        </View>

        {additionalData.cotacaoBoiGordo && (
          <View style={s.dataRow}>
            <Text style={s.dataLabel}>Cotação boi gordo</Text>
            <Text style={s.dataValue}>
              {formatBRL(additionalData.cotacaoBoiGordo.price)} / {additionalData.cotacaoBoiGordo.unit}
              {'  '}
              <Text style={s.dataDate}>({formatDate(additionalData.cotacaoBoiGordo.recordedAt)})</Text>
            </Text>
          </View>
        )}

        {additionalData.valorEstimadoRebanho !== null && (
          <View style={s.dataRow}>
            <Text style={s.dataLabel}>Valor estimado do rebanho</Text>
            <Text style={s.dataValue}>{formatBRL(additionalData.valorEstimadoRebanho)}</Text>
          </View>
        )}

        <View style={s.dataRow}>
          <Text style={s.dataLabel}>Custos com máquinas</Text>
          <Text style={s.dataValue}>
            {formatBRL(additionalData.custosMaquinas)}{' '}
            <Text style={s.dataDate}>({additionalData.maquinasCount} máquinas)</Text>
          </Text>
        </View>

        <View style={s.dataRow}>
          <Text style={s.dataLabel}>Análises de solo</Text>
          <Text style={s.dataValue}>{additionalData.analisesSoloCount}</Text>
        </View>

        {additionalData.areasComCalagemPendente > 0 && (
          <View style={s.dataRow}>
            <Text style={s.dataLabel}>Áreas com calagem pendente</Text>
            <Text style={[s.dataValue, { color: theme.colors.warning }]}>
              {additionalData.areasComCalagemPendente}
            </Text>
          </View>
        )}

        <View style={[s.dataRow, { borderBottomWidth: 0 }]}>
          <Text style={s.dataLabel}>Documentos cadastrados</Text>
          <Text style={s.dataValue}>{additionalData.documentosCount}</Text>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.bg,
    padding: 32,
    gap: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginTop: 4,
    marginBottom: 16,
  },
  upgradeIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: `${theme.colors.warning}1A`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  upgradeTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
  },
  upgradeText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  kpiCard: {
    width: '48%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 14,
    ...theme.shadow.card,
  },
  kpiIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  kpiValue: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
  },
  kpiLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 16,
    marginBottom: 16,
    ...theme.shadow.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  forecastRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 8,
  },
  forecastItem: {
    flex: 1,
  },
  forecastLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginBottom: 2,
  },
  forecastValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  highlightBox: {
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.sm,
    padding: 12,
    marginTop: 8,
    alignItems: 'center',
  },
  highlightLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: 4,
  },
  highlightValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  chartEmpty: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartEmptyText: {
    fontSize: 13,
    color: theme.colors.textFaint,
  },
  chartLegend: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  tipCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: `${theme.colors.warning}0F`,
    borderRadius: theme.radius.sm,
    padding: 12,
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.text,
    lineHeight: 19,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dataLabel: {
    fontSize: 13,
    color: theme.colors.textMuted,
    flex: 1,
  },
  dataValue: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'right',
  },
  dataDate: {
    fontSize: 11,
    fontWeight: '400',
    color: theme.colors.textFaint,
  },
});
