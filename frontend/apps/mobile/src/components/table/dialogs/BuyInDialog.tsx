/**
 * BuyInDialog — native port of PWA `components/game/BuyInDialog.tsx` (357B).
 *
 * Balance row, insufficient-balance warning, −/+ amount stepper with tap-to-
 * type custom input, accent-filled slider (ui-native RaiseSlider — the PWA
 * buy-in range input has the same 6px accent track + radial thumb), MIN /
 * 50% / 75% / MAX presets, min-max labels and Cancel / Take Seat footer.
 * Amount step ladder (5/25/100) + effectiveMax = min(maxBuyIn, balance) are
 * PWA-exact.
 */

import { fonts as FONTS, RaiseSlider } from '@stackbluff/ui-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, TextInput, type TextInputInstance, View } from 'react-native';
import { MinusIcon, PlusIcon, XIcon } from '../icons';
import { DialogButton, DialogShell } from './DialogShell';

export interface BuyInDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (amount: number) => void;
  minBuyIn: number;
  maxBuyIn: number;
  defaultBuyIn: number;
  tableName?: string;
  stakeLevel?: string;
  currentBalance: number;
  isRebuy?: boolean;
  isTournament?: boolean;
}

const STAKE_CONFIG: Record<string, string> = {
  Micro: '$0.02/$0.05',
  Low: '$0.10/$0.25',
  Medium: '$0.50/$1.00',
  High: '$2/$4',
  VeryHigh: '$5/$10',
};

function stepFor(stakeLevel?: string): number {
  if (stakeLevel === 'Micro') return 5;
  if (stakeLevel === 'Low') return 25;
  return 100;
}

export function BuyInDialog({
  open,
  onClose,
  onConfirm,
  minBuyIn,
  maxBuyIn,
  defaultBuyIn,
  tableName,
  stakeLevel,
  currentBalance,
  isRebuy = false,
  isTournament = false,
}: BuyInDialogProps) {
  const [amount, setAmount] = useState(defaultBuyIn);
  const [customInput, setCustomInput] = useState(false);
  const [inputValue, setInputValue] = useState(String(defaultBuyIn));
  const inputRef = useRef<TextInputInstance | null>(null);

  // Reset on open (PWA remounts the dialog through AnimatePresence).
  useEffect(() => {
    if (open) {
      setAmount(defaultBuyIn);
      setInputValue(String(defaultBuyIn));
      setCustomInput(false);
    }
  }, [open, defaultBuyIn]);

  const effectiveMax = Math.min(maxBuyIn, currentBalance);
  const canAfford = currentBalance >= minBuyIn;
  const isValid = amount >= minBuyIn && amount <= effectiveMax;
  const step = stepFor(stakeLevel);

  const presets = useMemo(
    () => [
      { label: 'MIN', value: minBuyIn },
      { label: '50%', value: Math.max(minBuyIn, Math.floor(effectiveMax * 0.5)) },
      { label: '75%', value: Math.max(minBuyIn, Math.floor(effectiveMax * 0.75)) },
      { label: 'MAX', value: effectiveMax },
    ],
    [minBuyIn, effectiveMax],
  );

  // Deduplicate presets (PWA parity).
  const uniquePresets = presets.filter(
    (p, i) => presets.findIndex((x) => x.value === p.value) === i,
  );

  const handleConfirm = () => {
    if (isValid) onConfirm(amount);
  };

  const commitInput = (raw: string) => {
    const n = Number.parseInt(raw, 10);
    if (!Number.isNaN(n)) setAmount(n);
  };

  return (
    <DialogShell open={open} onClose={onClose}>
      {/* Header — flex justify-between px-5 pt-5 pb-3 border-b border-white/5 */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.05)',
        }}
      >
        <View style={{ flex: 1, paddingRight: 28 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#e2e2e2' }}>
            {isRebuy ? 'Rebuy' : 'Buy In'}
          </Text>
          {isTournament && (
            <Text style={{ fontSize: 12, color: '#facc15', marginTop: 4 }}>
              ⚠️ Tournament mode: no rebuys allowed
            </Text>
          )}
          {tableName && (
            <Text style={{ fontSize: 11, color: '#c7c6cb', marginTop: 2 }}>
              {tableName} • {STAKE_CONFIG[stakeLevel ?? ''] ?? stakeLevel}
            </Text>
          )}
        </View>
        <Pressable
          onPress={onClose}
          hitSlop={6}
          style={{ padding: 6, borderRadius: 8 }}
          accessibilityLabel="Close"
        >
          <XIcon size={16} color="#c7c6cb" />
        </Pressable>
      </View>

      {/* Content — px-5 py-4 space-y-5 */}
      <View style={{ paddingHorizontal: 20, paddingVertical: 16, gap: 20 }}>
        {/* Balance */}
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
            Available Balance
          </Text>
          <Text
            style={{
              fontFamily: FONTS.data,
              fontSize: 14,
              fontWeight: '700',
              color: canAfford ? '#4edea3' : '#f87171',
            }}
          >
            ${currentBalance.toLocaleString()}
          </Text>
        </View>

        {!canAfford && (
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: 'rgba(239,68,68,0.1)',
              borderWidth: 1,
              borderColor: 'rgba(239,68,68,0.2)',
            }}
          >
            <Text style={{ color: '#f87171', fontSize: 11 }}>
              Insufficient balance. Minimum buy-in is ${minBuyIn.toLocaleString()}.
            </Text>
          </View>
        )}

        {/* Amount display + steppers */}
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }}
        >
          <StepperButton
            disabled={amount <= minBuyIn}
            onPress={() => {
              const newAmt = Math.max(minBuyIn, amount - step);
              setAmount(newAmt);
              setInputValue(String(newAmt));
            }}
          >
            <MinusIcon size={16} color="#c7c6cb" />
          </StepperButton>

          <Pressable
            onPress={() => setCustomInput(true)}
            style={{ minWidth: 120, alignItems: 'center', justifyContent: 'center' }}
          >
            {customInput ? (
              <TextInput
                ref={inputRef}
                value={inputValue}
                onChangeText={(v) => {
                  setInputValue(v);
                  commitInput(v);
                }}
                onBlur={() => {
                  setCustomInput(false);
                  const clamped = Math.min(Math.max(amount, minBuyIn), effectiveMax);
                  setAmount(clamped);
                  setInputValue(String(clamped));
                }}
                onSubmitEditing={() => inputRef.current?.blur()}
                keyboardType="number-pad"
                autoFocus
                allowFontScaling={false}
                style={{
                  width: '100%',
                  textAlign: 'center',
                  color: '#4edea3',
                  fontFamily: FONTS.data,
                  fontSize: 30,
                  fontWeight: '700',
                  padding: 0,
                  fontVariant: ['tabular-nums'],
                }}
              />
            ) : (
              <Text
                allowFontScaling={false}
                style={{
                  color: '#4edea3',
                  fontFamily: FONTS.data,
                  fontSize: 30,
                  fontWeight: '700',
                  fontVariant: ['tabular-nums'],
                }}
              >
                ${amount.toLocaleString()}
              </Text>
            )}
          </Pressable>

          <StepperButton
            disabled={amount >= effectiveMax}
            onPress={() => {
              const newAmt = Math.min(effectiveMax, amount + step);
              setAmount(newAmt);
              setInputValue(String(newAmt));
            }}
          >
            <PlusIcon size={16} color="#c7c6cb" />
          </StepperButton>
        </View>

        {/* Slider — PWA buyin-slider-input (6px accent track, 22px radial thumb) */}
        <View style={{ width: '100%', paddingVertical: 4 }}>
          <RaiseSlider
            min={minBuyIn}
            max={Math.max(minBuyIn, effectiveMax)}
            step={step}
            value={Math.min(Math.max(amount, minBuyIn), Math.max(minBuyIn, effectiveMax))}
            onChange={(n) => {
              setAmount(n);
              setInputValue(String(n));
            }}
            disabled={!canAfford}
          />
        </View>

        {/* Presets */}
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {uniquePresets.map((preset, _idx) => {
            const active = amount === preset.value;
            return (
              <Pressable
                key={preset.label}
                onPress={() => {
                  setAmount(preset.value);
                  setInputValue(String(preset.value));
                }}
                style={[
                  {
                    flex: 1,
                    paddingVertical: 6,
                    borderRadius: 6,
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                  active
                    ? {
                        backgroundColor: '#4edea3',
                        shadowColor: '#4edea3',
                        shadowOpacity: 0.2,
                        shadowRadius: 15,
                        shadowOffset: { width: 0, height: 0 },
                        elevation: 4,
                      }
                    : {
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.05)',
                      },
                ]}
                accessibilityLabel={`Preset ${preset.label}`}
              >
                <Text
                  allowFontScaling={false}
                  style={{
                    fontSize: 9,
                    fontWeight: '700',
                    letterSpacing: 1.5,
                    textTransform: 'uppercase',
                    color: active ? '#003824' : '#c7c6cb',
                  }}
                >
                  {preset.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Min/Max labels */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 10, color: '#c7c6cb', fontFamily: FONTS.data }}>
            MIN ${minBuyIn.toLocaleString()}
          </Text>
          <Text style={{ fontSize: 10, color: '#c7c6cb', fontFamily: FONTS.data }}>
            MAX ${effectiveMax.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Footer — px-5 py-4 border-t border-white/5 flex gap-3 */}
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
        <DialogButton label="Cancel" onPress={onClose} variant="ghost" />
        <DialogButton
          label={isRebuy ? 'Rebuy' : 'Take Seat'}
          onPress={handleConfirm}
          variant="primary"
          disabled={!isValid}
        />
      </View>
    </DialogShell>
  );
}

function StepperButton({
  onPress,
  disabled,
  children,
}: {
  onPress: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        width: 36,
        height: 36,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(70,70,75,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.3 : 1,
        backgroundColor: 'transparent',
      }}
      accessibilityLabel={disabled ? undefined : 'Adjust amount'}
    >
      {children}
    </Pressable>
  );
}
