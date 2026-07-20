import { Stack } from 'expo-router';
import { theme } from '../../../../src/lib/theme';

export default function FarmLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.primaryDark },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        headerBackTitle: 'Voltar',
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="animais/index" options={{ title: 'Rebanho' }} />
      <Stack.Screen name="animais/[animalId]" options={{ title: 'Animal' }} />
      <Stack.Screen name="pastagens/index" options={{ title: 'Pastagens' }} />
      <Stack.Screen name="pastagens/[pastureId]" options={{ title: 'Pastagem' }} />
      <Stack.Screen name="financeiro/index" options={{ title: 'Financeiro' }} />
      <Stack.Screen name="reproducao/index" options={{ title: 'Reprodução' }} />
      <Stack.Screen name="insumos/index" options={{ title: 'Insumos' }} />
      <Stack.Screen name="insumos/[supplyId]" options={{ title: 'Insumo' }} />
      <Stack.Screen name="maquinas/index" options={{ title: 'Máquinas' }} />
      <Stack.Screen name="maquinas/[machineId]" options={{ title: 'Máquina' }} />
      <Stack.Screen name="equipe/index" options={{ title: 'Equipe' }} />
      <Stack.Screen name="agenda/index" options={{ title: 'Agenda' }} />
      <Stack.Screen name="safras/index" options={{ title: 'Safras' }} />
      <Stack.Screen name="safras/[cropId]" options={{ title: 'Safra' }} />
      <Stack.Screen name="negocios/index" options={{ title: 'Negócios' }} />
      <Stack.Screen name="negocios/[dealId]" options={{ title: 'Negócio' }} />
      <Stack.Screen name="documentos/index" options={{ title: 'Documentos' }} />
      <Stack.Screen name="relatorios/index" options={{ title: 'Relatórios' }} />
      <Stack.Screen name="inteligencia/index" options={{ title: 'Inteligência' }} />
      <Stack.Screen name="notificacoes/index" options={{ title: 'Notificações' }} />
      <Stack.Screen name="contatos/index" options={{ title: 'Contatos' }} />
      <Stack.Screen name="membros/index" options={{ title: 'Membros' }} />
      <Stack.Screen name="mapa/index" options={{ title: 'Mapa' }} />
    </Stack>
  );
}
