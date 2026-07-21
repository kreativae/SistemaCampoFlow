import { useState, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator,
  Alert, Modal, ScrollView, KeyboardAvoidingView, Platform, Dimensions,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MapView, { Marker, Polygon, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { apiFetch } from '../../../../../src/lib/api';
import { theme } from '../../../../../src/lib/theme';
import { EmptyState } from '../../../../../src/components/EmptyState';

const FEATURE_TYPES = [
  { value: 'CERCA', label: 'Cerca', icon: 'git-commit' as const, color: '#92400E' },
  { value: 'PASTAGEM', label: 'Pastagem', icon: 'leaf' as const, color: '#4D7C0F' },
  { value: 'NASCENTE', label: 'Nascente', icon: 'water' as const, color: '#0369A1' },
  { value: 'RESERVA', label: 'Reserva', icon: 'shield' as const, color: '#15803D' },
  { value: 'OUTRO', label: 'Outro', icon: 'location' as const, color: '#6B7280' },
] as const;

const GEO_TYPES = [
  { value: 'PONTO', label: 'Ponto' },
  { value: 'POLIGONO', label: 'Polígono' },
] as const;

interface MapFeature {
  id: string;
  name: string;
  type: string;
  geometryType: string;
  coordinates: [number, number][];
  notes?: string;
}

function typeConfig(type: string) {
  return FEATURE_TYPES.find((t) => t.value === type) ?? FEATURE_TYPES[4];
}

export default function MapScreen() {
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const qc = useQueryClient();
  const mapRef = useRef<MapView>(null);

  const { data: features, isLoading } = useQuery({
    queryKey: ['map-features', farmId],
    queryFn: () => apiFetch<MapFeature[]>(`/fazendas/${farmId}/elementos-mapa`),
    enabled: !!farmId,
  });

  const createMut = useMutation({
    mutationFn: (body: any) => apiFetch(`/fazendas/${farmId}/elementos-mapa`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['map-features', farmId] }),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, ...body }: any) => apiFetch(`/fazendas/${farmId}/elementos-mapa/${id}`, { method: 'PATCH', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['map-features', farmId] }),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/fazendas/${farmId}/elementos-mapa/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['map-features', farmId] }),
  });

  const [showForm, setShowForm] = useState(false);
  const [showList, setShowList] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', type: 'PASTAGEM', geometryType: 'PONTO', lat: '', lng: '', notes: '' });
  const [region, setRegion] = useState({
    latitude: -15.78,
    longitude: -47.93,
    latitudeDelta: 0.5,
    longitudeDelta: 0.5,
  });
  const [locating, setLocating] = useState(false);

  const goToMyLocation = useCallback(async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão negada', 'Ative a localização nas configurações.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const newRegion = { latitude: loc.coords.latitude, longitude: loc.coords.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 };
      setRegion(newRegion);
      mapRef.current?.animateToRegion(newRegion, 500);
    } catch {
      Alert.alert('Erro', 'Não foi possível obter a localização.');
    } finally {
      setLocating(false);
    }
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: '', type: 'PASTAGEM', geometryType: 'PONTO', lat: '', lng: '', notes: '' });
    setShowForm(true);
  };

  const openEdit = (f: MapFeature) => {
    setEditingId(f.id);
    setForm({
      name: f.name,
      type: f.type,
      geometryType: f.geometryType,
      lat: String(f.coordinates[0][0]),
      lng: String(f.coordinates[0][1]),
      notes: f.notes ?? '',
    });
    setShowForm(true);
  };

  const confirmDelete = (f: MapFeature) => {
    Alert.alert('Excluir elemento', `Deseja excluir "${f.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => deleteMut.mutate(f.id) },
    ]);
  };

  const focusFeature = (f: MapFeature) => {
    setShowList(false);
    const lat = f.coordinates[0][0];
    const lng = f.coordinates[0][1];
    mapRef.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.005, longitudeDelta: 0.005 }, 600);
  };

  const handleSave = () => {
    if (!form.name || !form.lat || !form.lng) {
      Alert.alert('Erro', 'Nome, latitude e longitude são obrigatórios');
      return;
    }
    const coordinates: [number, number][] = [[Number(form.lat), Number(form.lng)]];
    const payload = { name: form.name, type: form.type, geometryType: form.geometryType, coordinates, notes: form.notes || undefined };
    const opts = {
      onSuccess: () => { setShowForm(false); setEditingId(null); },
      onError: (err: any) => Alert.alert('Erro', err.message),
    };
    if (editingId) updateMut.mutate({ id: editingId, ...payload }, opts);
    else createMut.mutate(payload, opts);
  };

  const handleMapPress = (e: any) => {
    if (showForm) {
      const { latitude, longitude } = e.nativeEvent.coordinate;
      setForm((f) => ({ ...f, lat: latitude.toFixed(6), lng: longitude.toFixed(6) }));
      Haptics.selectionAsync();
    }
  };

  const isSaving = createMut.isPending || updateMut.isPending;

  if (isLoading) return <View style={s.center}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;

  return (
    <View style={s.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_DEFAULT}
        region={region}
        onRegionChangeComplete={setRegion}
        onPress={handleMapPress}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {features?.map((f: MapFeature) => {
          const cfg = typeConfig(f.type);
          if (f.geometryType === 'POLIGONO' && f.coordinates.length >= 3) {
            return (
              <Polygon
                key={f.id}
                coordinates={f.coordinates.map((coord: [number, number]) => ({ latitude: coord[0], longitude: coord[1] }))}
                strokeColor={cfg.color}
                fillColor={cfg.color + '30'}
                strokeWidth={2}
                tappable
                onPress={() => openEdit(f)}
              />
            );
          }
          return (
            <Marker
              key={f.id}
              coordinate={{ latitude: f.coordinates[0][0], longitude: f.coordinates[0][1] }}
              title={f.name}
              description={cfg.label}
              pinColor={cfg.color}
              onCalloutPress={() => openEdit(f)}
            />
          );
        })}
      </MapView>

      {/* Controles flutuantes */}
      <View style={s.controls}>
        <TouchableOpacity style={s.ctrlBtn} onPress={goToMyLocation} disabled={locating}>
          {locating ? <ActivityIndicator size={18} color={theme.colors.primary} /> : <Ionicons name="navigate" size={20} color={theme.colors.primary} />}
        </TouchableOpacity>
        <TouchableOpacity style={s.ctrlBtn} onPress={() => setShowList(true)}>
          <Ionicons name="list" size={20} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {/* FAB para adicionar */}
      <TouchableOpacity style={s.fab} activeOpacity={0.85} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); openCreate(); }}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Lista de elementos */}
      <Modal visible={showList} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modal}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, alignSelf: 'center', marginBottom: 14 }} />
            <Text style={s.modalTitle}>Elementos do mapa</Text>
            {!features?.length ? (
              <EmptyState icon="📍" title="Nenhum elemento" subtitle="Toque no + para cadastrar" />
            ) : (
              <FlatList
                data={features}
                keyExtractor={(f) => f.id}
                renderItem={({ item, index }) => {
                  const cfg = typeConfig(item.type);
                  return (
                    <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 50)}>
                      <TouchableOpacity style={s.listItem} activeOpacity={0.7} onPress={() => focusFeature(item)} onLongPress={() => confirmDelete(item)}>
                        <View style={[s.listIcon, { backgroundColor: cfg.color + '20' }]}>
                          <Ionicons name={cfg.icon} size={18} color={cfg.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.listName}>{item.name}</Text>
                          <Text style={s.listMeta}>{cfg.label} · {item.geometryType === 'PONTO' ? 'Ponto' : 'Polígono'}</Text>
                        </View>
                        <TouchableOpacity onPress={() => openEdit(item)} hitSlop={8}>
                          <Ionicons name="pencil" size={16} color={theme.colors.textMuted} />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    </Animated.View>
                  );
                }}
              />
            )}
            <TouchableOpacity style={s.closeListBtn} onPress={() => setShowList(false)}>
              <Text style={s.closeListText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Formulário de criação/edição */}
      <Modal visible={showForm} animationType="slide" transparent>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modal}>
            <ScrollView>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, alignSelf: 'center', marginBottom: 14 }} />
              <Text style={s.modalTitle}>{editingId ? 'Editar Elemento' : 'Novo Elemento'}</Text>
              <Text style={s.hint}>Toque no mapa para preencher as coordenadas</Text>

              <Text style={s.label}>Nome *</Text>
              <TextInput style={s.input} value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="Ex: Nascente principal" />

              <Text style={s.label}>Tipo</Text>
              <View style={s.chipRow}>
                {FEATURE_TYPES.map((t) => (
                  <TouchableOpacity key={t.value} style={[s.chip, form.type === t.value && { backgroundColor: t.color + '20', borderColor: t.color }]}
                    onPress={() => setForm({ ...form, type: t.value })}>
                    <Ionicons name={t.icon} size={14} color={form.type === t.value ? t.color : '#999'} />
                    <Text style={[s.chipText, form.type === t.value && { color: t.color }]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={s.coordRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Latitude *</Text>
                  <TextInput style={s.input} value={form.lat} onChangeText={(v) => setForm({ ...form, lat: v })} keyboardType="numeric" placeholder="-15.78" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Longitude *</Text>
                  <TextInput style={s.input} value={form.lng} onChangeText={(v) => setForm({ ...form, lng: v })} keyboardType="numeric" placeholder="-47.93" />
                </View>
              </View>

              <Text style={s.label}>Notas</Text>
              <TextInput style={[s.input, { height: 80, textAlignVertical: 'top' }]} value={form.notes} onChangeText={(v) => setForm({ ...form, notes: v })} multiline placeholder="Observações..." />

              <View style={s.modalActions}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => { setShowForm(false); setEditingId(null); }}>
                  <Text style={s.cancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={isSaving}>
                  {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Salvar</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  controls: { position: 'absolute', top: 12, right: 14, gap: 8 },
  ctrlBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', ...theme.shadow.card },
  fab: { position: 'absolute', bottom: 28, right: 24, width: 60, height: 60, borderRadius: 30, backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center', ...theme.shadow.fab },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(16,24,40,0.55)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%' },
  modalTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3, color: theme.colors.primary, marginBottom: 8 },
  hint: { fontSize: 13, color: theme.colors.textMuted, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 4, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: '#fafafa' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fafafa' },
  chipText: { fontSize: 13, fontWeight: '500', color: '#999' },
  coordRow: { flexDirection: 'row', gap: 12 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 20 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#f0f0f0', alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600', color: '#666' },
  saveBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: theme.colors.primary, alignItems: 'center' },
  saveText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  listIcon: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  listName: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
  listMeta: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  closeListBtn: { marginTop: 16, padding: 14, borderRadius: 10, backgroundColor: '#f0f0f0', alignItems: 'center' },
  closeListText: { fontSize: 15, fontWeight: '600', color: '#666' },
});
