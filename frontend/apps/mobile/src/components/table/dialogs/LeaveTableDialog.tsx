/**
 * LeaveTableDialog — native port of PWA `components/game/LeaveTableDialog.tsx`.
 *
 * "Returning to balance" row, amber hand-in-progress warning, Stay / Leave
 * footer (danger leave). Visual values 1:1 from the PWA source.
 */

import { fonts as FONTS } from '@stackbluff/ui-native';
import { Text, View } from 'react-native';
import { AlertTriangleIcon, LogOutIcon } from '../icons';
import { DialogButton, DialogShell } from './DialogShell';

export interface LeaveTableDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  stackAmount: number;
  isHandInProgress: boolean;
}

export function LeaveTableDialog({
  open,
  onClose,
  onConfirm,
  stackAmount,
  isHandInProgress,
}: LeaveTableDialogProps) {
  return (
    <DialogShell open={open} onClose={onClose}>
      {/* Header — px-5 pt-5 pb-3 border-b border-white/5 */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.05)',
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#e2e2e2' }}>Leave Table</Text>
      </View>

      {/* Content — px-5 py-4 space-y-4 */}
      <View style={{ paddingHorizontal: 20, paddingVertical: 16, gap: 16 }}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Text
            style={{
              fontSize: 11,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              color: '#c7c6cb',
            }}
          >
            Returning to balance
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text
              style={{ fontFamily: FONTS.data, fontSize: 14, fontWeight: '700', color: '#4edea3' }}
            >
              ${stackAmount.toLocaleString()}
            </Text>
            <LogOutIcon size={12} color="#f87171" />
          </View>
        </View>

        {isHandInProgress && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 8,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: 'rgba(245,158,11,0.1)',
              borderWidth: 1,
              borderColor: 'rgba(245,158,11,0.2)',
            }}
          >
            <View style={{ marginTop: 2 }}>
              <AlertTriangleIcon size={16} color="#fbbf24" />
            </View>
            <Text style={{ fontSize: 11, color: '#fcd34d', flex: 1 }}>
              <Text style={{ fontWeight: '700' }}>Hand in progress.</Text> You will be seated out
              and your chips returned after the hand completes.
            </Text>
          </View>
        )}
      </View>

      {/* Footer — px-5 py-4 border-t */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingVertical: 16,
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.05)',
          flexDirection: 'row',
          gap: 12,
        }}
      >
        <DialogButton label="Stay" onPress={onClose} variant="ghost" />
        <DialogButton label="Leave" onPress={onConfirm} variant="danger" />
      </View>
    </DialogShell>
  );
}
