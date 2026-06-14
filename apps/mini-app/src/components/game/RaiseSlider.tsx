import { useForm } from '@tanstack/react-form';
import { MotionSlider } from '@stackbluff/shared/ui/motion-wrappers';
import { Button } from '@/components/ui/button';
export const RaiseSlider = ({ min, max, step, pot, onConfirm }: { min: number; max: number; step: number; pot: number; onConfirm: (amount: number) => void }) => {
  const form = useForm({ defaultValues: { amount: min }, onSubmit: ({ value }) => onConfirm(value.amount) });
  return (
    <form.Field name="amount" validators={{ onChange: ({ value }) => value >= min && value <= max }} children={(field) => (
      <div className="space-y-4">
        <MotionSlider value={[field.state.value]} min={min} max={max} step={step} onValueChange={(v) => field.handleChange(v[0])} />
        <div className="flex gap-2">
          <Button onClick={() => field.handleChange(Math.floor(pot * 0.5))}>½ POT</Button>
          <Button onClick={() => field.handleChange(Math.floor(pot * 0.75))}>¾ POT</Button>
          <Button onClick={() => field.handleChange(pot)}>POT</Button>
          <Button onClick={() => field.handleChange(max)}>MAX</Button>
        </div>
        <Button onClick={() => form.handleSubmit()}>Confirm Raise</Button>
      </div>
    )} />
  );
};
