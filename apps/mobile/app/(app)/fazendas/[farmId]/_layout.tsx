import { Stack } from 'expo-router';

export default function FarmLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#1B5E20' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Painel' }} />
      <Stack.Screen name="animais/index" options={{ title: 'Rebanho' }} />
      <Stack.Screen name="animais/[animalId]" options={{ title: 'Animal' }} />
      <Stack.Screen name="pastagens/index" options={{ title: 'Pastagens' }} />
      <Stack.Screen name="financeiro/index" options={{ title: 'Financeiro' }} />
      <Stack.Screen name="reproducao/index" options={{ title: 'Reprodução' }} />
      <Stack.Screen name="insumos/index" options={{ title: 'Insumos' }} />
      <Stack.Screen name="maquinas/index" options={{ title: 'Máquinas' }} />
      <Stack.Screen name="equipe/index" options={{ title: 'Equipe' }} />
      <Stack.Screen name="agenda/index" options={{ title: 'Agenda' }} />
      <Stack.Screen name="safras/index" options={{ title: 'Safras' }} />
      <Stack.Screen name="negocios/index" options={{ title: 'Negócios' }} />
      <Stack.Screen name="documentos/index" options={{ title: 'Documentos' }} />
      <Stack.Screen name="relatorios/index" options={{ title: 'Relatórios' }} />
      <Stack.Screen name="inteligencia/index" options={{ title: 'Inteligência' }} />
      <Stack.Screen name="notificacoes/index" options={{ title: 'Notificações' }} />
      <Stack.Screen name="contatos/index" options={{ title: 'Contatos' }} />
    </Stack>
  );
}
